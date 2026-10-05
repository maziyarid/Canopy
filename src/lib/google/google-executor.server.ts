import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { parseVaultKeyring } from "../social/vault-keyring.server.ts";
import { resolveCredential } from "../social/vault-store.server.ts";
import {
  googlePayloadHash,
  googleRollbackPlan,
  prepareGoogleRequest,
  validateGoogleAction,
} from "./google-actions.ts";
import {
  executeGoogleHttpRequest,
  parseGoogleOAuthCredential,
  refreshGoogleAccessToken,
  validateGoogleAdsMutation,
} from "./google-oauth.server.ts";
import {
  beginGoogleActionExecution,
  completeGoogleAction,
  failGoogleAction,
  type AdaApprovalProof,
} from "./google-proposals.server.ts";
import type { GoogleGovernedProposal } from "./google-governance-core.ts";

type ExecutionProfileRow = {
  credential_ref: string;
  auth_type: "oauth2" | "service_account";
  provider: string;
  status: string;
};

async function executionProfile(sql: Sql, proposal: GoogleGovernedProposal) {
  const rows = await sql.query<ExecutionProfileRow>(
    "select credential_ref,auth_type,provider,status from google_connection_profiles " +
      "where id=$1 and project_id=$2 limit 1",
    [proposal.connectionProfileId, proposal.projectId],
  );
  const row = rows[0];
  if (!row || row.status !== "active" || row.provider !== proposal.provider) {
    throw new Error("active_google_connection_required");
  }
  if (row.auth_type !== "oauth2") {
    throw new Error("google_write_auth_type_unsupported");
  }
  return row;
}

export type GoogleExecutionDependencies = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  consumeAdaApproval?: (
    proposal: GoogleGovernedProposal,
    proof: AdaApprovalProof,
  ) => Promise<{ approvalRef: string }>;
};

function verificationTokenResult(result: unknown) {
  if (!result || typeof result !== "object") throw new Error("google_verification_token_invalid_response");
  const row = result as Record<string, unknown>;
  const method = typeof row.method === "string" ? row.method.slice(0, 80) : "";
  const token = typeof row.token === "string" ? row.token : "";
  if (!method || !token || token.length > 8192) throw new Error("google_verification_token_invalid_response");
  return { method, token, tokenHash: googlePayloadHash({ token }) };
}

function previewSummary(result: unknown) {
  if (!result || typeof result !== "object") throw new Error("google_gtm_preview_invalid_response");
  const row = result as Record<string, unknown>;
  const version = row.containerVersion && typeof row.containerVersion === "object"
    ? row.containerVersion as Record<string, unknown>
    : {};
  const count = (key: string) => Array.isArray(version[key]) ? (version[key] as unknown[]).length : 0;
  const sync: Record<string, boolean> = {};
  if (row.syncStatus && typeof row.syncStatus === "object") {
    for (const [key, value] of Object.entries(row.syncStatus as Record<string, unknown>).slice(0, 20)) {
      if (typeof value === "boolean") sync[key] = value;
    }
  }
  return {
    compilerError: Boolean(row.compilerError),
    syncStatus: sync,
    containerVersionId:
      typeof version.containerVersionId === "string" ? version.containerVersionId.slice(0, 120) : null,
    counts: {
      tags: count("tag"),
      triggers: count("trigger"),
      variables: count("variable"),
      folders: count("folder"),
      builtInVariables: count("builtInVariable"),
      clients: count("client"),
      zones: count("zone"),
      customTemplates: count("customTemplate"),
    },
  };
}

export async function executeGovernedGoogleAction(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  proposalId: string,
  input: {
    approvalProof?: AdaApprovalProof;
  },
  dependencies: GoogleExecutionDependencies = {},
) {
  const proposal = await beginGoogleActionExecution(sql, access, actorRef, proposalId, {
    approvalProof: input.approvalProof,
    consumeAdaApproval: dependencies.consumeAdaApproval,
  });

  try {
    const profile = await executionProfile(sql, proposal);
    const keyring = parseVaultKeyring(dependencies.env ?? process.env);
    const plaintext = await resolveCredential(sql, keyring, {
      credentialRef: profile.credential_ref,
      projectId: proposal.projectId,
      actorRef: "google-action:" + actorRef,
    });
    const oauth = parseGoogleOAuthCredential(plaintext);
    const token = await refreshGoogleAccessToken(
      oauth,
      dependencies.env ?? process.env,
      dependencies.fetchImpl ?? fetch,
    );

    const contract = validateGoogleAction(proposal.action, proposal.resourceRef, proposal.payload);
    if (contract.payloadHash !== proposal.payloadHash) {
      throw new Error("google_proposal_payload_integrity_error");
    }
    const request = prepareGoogleRequest(contract);

    const adsPreflight = await validateGoogleAdsMutation({
      request,
      accessToken: token.accessToken,
      env: dependencies.env ?? process.env,
      fetchImpl: dependencies.fetchImpl ?? fetch,
    });

    const executed = await executeGoogleHttpRequest({
      request,
      accessToken: token.accessToken,
      env: dependencies.env ?? process.env,
      fetchImpl: dependencies.fetchImpl ?? fetch,
    });

    const sensitiveToken = proposal.action === "gsc.verification.get_token"
      ? verificationTokenResult(executed.result)
      : null;
    const preview = proposal.action === "gtm.workspace.preview"
      ? previewSummary(executed.result)
      : null;
    const receiptResponse = sensitiveToken
      ? { method: sensitiveToken.method, tokenHash: sensitiveToken.tokenHash }
      : preview ?? executed.result;
    const rollback = googleRollbackPlan(contract, executed.result);
    const rollbackView = {
      mode: rollback.mode,
      action: rollback.action ?? null,
      note: rollback.note,
      payloadHash: rollback.payload ? googlePayloadHash(rollback.payload) : null,
    };

    await completeGoogleAction(sql, proposal, actorRef, {
      providerRequestId: executed.requestId,
      result: {
        provider: proposal.provider,
        action: proposal.action,
        resourceRef: proposal.resourceRef,
        ...(adsPreflight ? { validation: { ok: true, requestId: adsPreflight.requestId } } : {}),
        response: receiptResponse,
        rollback,
      },
    });

    return {
      proposalId: proposal.id,
      status: "succeeded" as const,
      providerRequestId: executed.requestId,
      preflight: adsPreflight ? "passed" as const : "not_required" as const,
      ...(sensitiveToken ? {
        sensitiveResult: {
          kind: "site_verification_token" as const,
          method: sensitiveToken.method,
          token: sensitiveToken.token,
        },
      } : {}),
      ...(preview ? { preview } : {}),
      rollback: rollbackView,
    };
  } catch (error) {
    await failGoogleAction(
      sql,
      proposal,
      actorRef,
      error instanceof Error ? error.message : "google_action_failed",
    );
    throw error;
  }
}
