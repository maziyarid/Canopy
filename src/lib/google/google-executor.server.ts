import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { parseVaultKeyring } from "../social/vault-keyring.server.ts";
import { resolveCredential } from "../social/vault-store.server.ts";
import { prepareGoogleRequest, validateGoogleAction } from "./google-actions.ts";
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

    await completeGoogleAction(sql, proposal, actorRef, {
      providerRequestId: executed.requestId,
      result: {
        provider: proposal.provider,
        action: proposal.action,
        resourceRef: proposal.resourceRef,
        ...(adsPreflight ? { validation: { ok: true, requestId: adsPreflight.requestId } } : {}),
        response: executed.result,
      },
    });

    return {
      proposalId: proposal.id,
      status: "succeeded" as const,
      providerRequestId: executed.requestId,
      preflight: adsPreflight ? "passed" as const : "not_required" as const,
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
