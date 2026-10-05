import type { Sql } from "../db.ts";
import type { AccessCtx } from "../server/access.ts";
import { googleActionPolicy, type GoogleActionKey, type GoogleCapability, type GoogleProvider } from "./google-capabilities.ts";
import { validateGoogleAction, type GoogleResourceType } from "./google-actions.ts";
import { effectiveGoogleGrant } from "./google-connections.server.ts";
import {
  deterministicDiffHash,
  googleApprovalEnvelope,
  safeGoogleError,
  safeGoogleReceipt,
  type GoogleGovernedProposal,
} from "./google-governance-core.ts";

type ProposalRow = {
  id: string;
  project_id: string;
  actor_ref: string;
  connection_profile_id: string;
  provider: GoogleProvider;
  capability: GoogleCapability;
  action: GoogleActionKey;
  resource_type: GoogleResourceType;
  resource_ref: string;
  payload: string;
  payload_hash: string;
  deterministic_diff: string;
  snapshot_hash: string;
  approval_policy: "grant" | "ada";
  approval_ref: string;
  approval_request_ref: string;
  idempotency_key: string;
  status: GoogleGovernedProposal["status"];
  expires_at: string | null;
};

export type AdaApprovalProof = {
  ticketId: string;
  oneTimeToken: string;
  payloadHash: string;
  snapshotHash?: string;
};

export type GoogleProposalView = {
  id: string;
  projectId: string;
  actorRef: string;
  connectionProfileId: string;
  provider: GoogleProvider;
  capability: GoogleCapability;
  action: GoogleActionKey;
  resourceType: GoogleResourceType;
  resourceRef: string;
  payloadHash: string;
  diffHash: string;
  snapshotHash: string;
  approvalPolicy: "grant" | "ada";
  approvalRef: string;
  approvalRequestRef: string;
  idempotencyKey: string;
  status: GoogleGovernedProposal["status"];
  expiresAt: string | null;
};

export function googleProposalView(proposal: GoogleGovernedProposal): GoogleProposalView {
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    actorRef: proposal.actorRef,
    connectionProfileId: proposal.connectionProfileId,
    provider: proposal.provider,
    capability: proposal.capability,
    action: proposal.action,
    resourceType: proposal.resourceType,
    resourceRef: proposal.resourceRef,
    payloadHash: proposal.payloadHash,
    diffHash: deterministicDiffHash(proposal.deterministicDiff),
    snapshotHash: proposal.snapshotHash,
    approvalPolicy: proposal.approvalPolicy,
    approvalRef: proposal.approvalRef,
    approvalRequestRef: proposal.approvalRequestRef,
    idempotencyKey: proposal.idempotencyKey,
    status: proposal.status,
    expiresAt: proposal.expiresAt,
  };
}

function proposalFromRow(row: ProposalRow): GoogleGovernedProposal {
  return {
    id: row.id,
    projectId: row.project_id,
    actorRef: row.actor_ref,
    connectionProfileId: row.connection_profile_id,
    provider: row.provider,
    capability: row.capability,
    action: row.action,
    resourceType: row.resource_type,
    resourceRef: row.resource_ref,
    payload: JSON.parse(row.payload || "{}"),
    payloadHash: row.payload_hash,
    deterministicDiff: JSON.parse(row.deterministic_diff || "{}"),
    snapshotHash: row.snapshot_hash,
    approvalPolicy: row.approval_policy,
    approvalRef: row.approval_ref,
    approvalRequestRef: row.approval_request_ref,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

function assertActionMember(access: AccessCtx) {
  if (!["owner", "editor", "client"].includes(access.role) || access.filter.trim()) {
    throw new Error("Forbidden");
  }
}

function assertOwner(access: AccessCtx) {
  if (access.role !== "owner" || access.filter.trim()) throw new Error("Forbidden");
}

async function receipt(
  sql: Sql,
  input: {
    projectId: string;
    actorRef: string;
    operation: string;
    targetRef: string;
    status: string;
    approvalRef?: string;
    idempotencyKey?: string;
    evidence?: Record<string, unknown>;
  },
) {
  await sql.query(
    "insert into operation_receipts " +
      "(id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      crypto.randomUUID(),
      input.projectId,
      input.actorRef,
      input.operation,
      input.targetRef,
      input.status,
      input.approvalRef || "",
      input.idempotencyKey || "",
      JSON.stringify(input.evidence || {}),
    ],
  );
}

export async function getGoogleActionProposal(sql: Sql, projectId: string, proposalId: string) {
  const rows = await sql.query<ProposalRow>(
    "select * from google_action_proposals where id=$1 and project_id=$2 limit 1",
    [proposalId, projectId],
  );
  return rows[0] ? proposalFromRow(rows[0]) : null;
}

export async function proposeGoogleAction(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  input: {
    action: GoogleActionKey;
    resourceRef: string;
    payload: unknown;
    idempotencyKey: string;
    snapshotHash?: string;
    approvalTtlSeconds?: number;
  },
) {
  assertActionMember(access);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(input.idempotencyKey)) {
    throw new Error("invalid_idempotency_key");
  }
  const contract = validateGoogleAction(input.action, input.resourceRef, input.payload);
  const effective = await effectiveGoogleGrant(sql, access, actorRef, input.action, input.resourceRef);
  const policy = effective.policy;

  const replayRows = await sql.query<ProposalRow>(
    "select * from google_action_proposals where project_id=$1 and idempotency_key=$2 limit 1",
    [access.project.id, input.idempotencyKey],
  );
  if (replayRows[0]) {
    const existing = proposalFromRow(replayRows[0]);
    if (
      existing.payloadHash !== contract.payloadHash ||
      existing.action !== input.action ||
      existing.resourceRef !== input.resourceRef
    ) {
      throw new Error("idempotency_key_payload_conflict");
    }
    return {
      proposal: existing,
      replayed: true as const,
      approvalEnvelope:
        policy.approval === "ada"
          ? googleApprovalEnvelope(existing, access.project.domain, policy.mutationType)
          : null,
    };
  }

  const id = crypto.randomUUID();
  const ttl = Math.max(300, Math.min(input.approvalTtlSeconds || 3600, 86400));
  const expiresAt =
    policy.approval === "ada" ? new Date(Date.now() + ttl * 1000).toISOString() : null;
  const status = policy.approval === "ada" ? "pending_approval" : "ready";
  const proposal: GoogleGovernedProposal = {
    id,
    projectId: access.project.id,
    actorRef,
    connectionProfileId: effective.profile.id,
    provider: policy.provider,
    capability: policy.capability,
    action: input.action,
    resourceType: policy.resourceType,
    resourceRef: input.resourceRef,
    payload: contract.payload,
    payloadHash: contract.payloadHash,
    deterministicDiff: contract.deterministicDiff,
    snapshotHash: input.snapshotHash?.trim() || "",
    approvalPolicy: policy.approval,
    approvalRef: "",
    approvalRequestRef: "",
    idempotencyKey: input.idempotencyKey,
    status,
    expiresAt,
  };

  await sql.query(
    "insert into google_action_proposals " +
      "(id,project_id,actor_ref,connection_profile_id,provider,capability,action,resource_type,resource_ref," +
      "payload,payload_hash,deterministic_diff,snapshot_hash,approval_policy,idempotency_key,status,expires_at) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
    [
      proposal.id,
      proposal.projectId,
      actorRef,
      proposal.connectionProfileId,
      proposal.provider,
      proposal.capability,
      proposal.action,
      proposal.resourceType,
      proposal.resourceRef,
      JSON.stringify(proposal.payload),
      proposal.payloadHash,
      JSON.stringify(proposal.deterministicDiff),
      proposal.snapshotHash,
      proposal.approvalPolicy,
      proposal.idempotencyKey,
      proposal.status,
      proposal.expiresAt,
    ],
  );
  await receipt(sql, {
    projectId: proposal.projectId,
    actorRef,
    operation: "google.action.propose",
    targetRef: proposal.id,
    status: proposal.status,
    idempotencyKey: proposal.idempotencyKey,
    evidence: {
      provider: proposal.provider,
      capability: proposal.capability,
      action: proposal.action,
      resourceType: proposal.resourceType,
      resourceRef: proposal.resourceRef,
      payloadHash: proposal.payloadHash,
      diffHash: deterministicDiffHash(proposal.deterministicDiff),
      approvalPolicy: proposal.approvalPolicy,
    },
  });

  return {
    proposal,
    replayed: false as const,
    approvalEnvelope:
      policy.approval === "ada"
        ? googleApprovalEnvelope(proposal, access.project.domain, policy.mutationType)
        : null,
  };
}

export async function markGoogleActionRejected(
  sql: Sql,
  projectId: string,
  proposalId: string,
  approvalRef: string,
  actorRef: string,
) {
  const ref = approvalRef.trim();
  if (!ref) throw new Error("approval_reference_required");
  const rows = await sql.query<{ id: string }>(
    "update google_action_proposals set status='rejected',approval_ref=$3,updated_at=now() " +
      "where id=$1 and project_id=$2 and status='pending_approval' returning id",
    [proposalId, projectId, ref],
  );
  if (!rows[0]) throw new Error("google_action_state_conflict");
  await receipt(sql, {
    projectId,
    actorRef,
    operation: "google.action.reject",
    targetRef: proposalId,
    status: "rejected",
    approvalRef: ref,
  });
}

export async function markGoogleActionExpired(
  sql: Sql,
  projectId: string,
  proposalId: string,
  approvalRef: string,
  actorRef: string,
) {
  const ref = approvalRef.trim();
  const rows = await sql.query<{ id: string }>(
    "update google_action_proposals set status='expired',approval_ref=$3,updated_at=now() " +
      "where id=$1 and project_id=$2 and status='pending_approval' returning id",
    [proposalId, projectId, ref],
  );
  if (!rows[0]) throw new Error("google_action_state_conflict");
  await receipt(sql, {
    projectId,
    actorRef,
    operation: "google.action.expire",
    targetRef: proposalId,
    status: "expired",
    approvalRef: ref,
  });
}

export async function cancelGoogleAction(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  proposalId: string,
) {
  assertActionMember(access);
  const rows = access.role === "owner"
    ? await sql.query<{ id: string }>(
        "update google_action_proposals set status='cancelled',updated_at=now() " +
          "where id=$1 and project_id=$2 and status in ('pending_approval','ready') returning id",
        [proposalId, access.project.id],
      )
    : await sql.query<{ id: string }>(
        "update google_action_proposals set status='cancelled',updated_at=now() " +
          "where id=$1 and project_id=$2 and actor_ref=$3 and status in ('pending_approval','ready') returning id",
        [proposalId, access.project.id, actorRef],
      );
  if (!rows[0]) throw new Error("google_action_state_conflict");
  await receipt(sql, {
    projectId: access.project.id,
    actorRef,
    operation: "google.action.cancel",
    targetRef: proposalId,
    status: "cancelled",
  });
}

export async function beginGoogleActionExecution(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
  proposalId: string,
  input: {
    approvalProof?: AdaApprovalProof;
    consumeAdaApproval?: (
      proposal: GoogleGovernedProposal,
      proof: AdaApprovalProof,
    ) => Promise<{ approvalRef: string }>;
  },
) {
  assertActionMember(access);
  const proposal = await getGoogleActionProposal(sql, access.project.id, proposalId);
  if (!proposal) throw new Error("google_action_not_found");
  if (proposal.actorRef !== actorRef && access.role !== "owner") {
    throw new Error("google_action_actor_mismatch");
  }
  if (proposal.expiresAt && Date.parse(proposal.expiresAt) <= Date.now()) {
    await sql.query(
      "update google_action_proposals set status='expired',updated_at=now() where id=$1 and project_id=$2",
      [proposal.id, proposal.projectId],
    );
    throw new Error("google_action_expired");
  }

  const fresh = await effectiveGoogleGrant(sql, access, actorRef, proposal.action, proposal.resourceRef);
  if (fresh.profile.id !== proposal.connectionProfileId) {
    throw new Error("google_connection_profile_changed");
  }

  let approvalRef = "";
  let expectedStatus: GoogleGovernedProposal["status"] = "ready";
  if (proposal.approvalPolicy === "ada") {
    expectedStatus = "pending_approval";
    if (!input.approvalProof || !input.consumeAdaApproval) throw new Error("ada_approval_required");
    if (!proposal.approvalRequestRef || input.approvalProof.ticketId !== proposal.approvalRequestRef) {
      throw new Error("ada_approval_ticket_mismatch");
    }
    if (input.approvalProof.payloadHash !== proposal.payloadHash) {
      throw new Error("ada_approval_payload_mismatch");
    }
    const consumed = await input.consumeAdaApproval(proposal, input.approvalProof);
    approvalRef = consumed.approvalRef.trim();
    if (!approvalRef) throw new Error("ada_approval_reference_missing");
  }

  const rows = await sql.query<{ id: string }>(
    "update google_action_proposals " +
      "set status='executing',approval_ref=$3,approval_payload_hash=$4," +
      "approved_at=case when $3<>'' then now() else approved_at end,updated_at=now() " +
      "where id=$1 and project_id=$2 and status=$5 returning id",
    [
      proposal.id,
      proposal.projectId,
      approvalRef,
      approvalRef ? proposal.payloadHash : "",
      expectedStatus,
    ],
  );
  if (!rows[0]) throw new Error("google_action_state_conflict");

  await receipt(sql, {
    projectId: proposal.projectId,
    actorRef,
    operation: "google.action.execute.begin",
    targetRef: proposal.id,
    status: "executing",
    approvalRef,
    idempotencyKey: proposal.idempotencyKey,
    evidence: {
      payloadHash: proposal.payloadHash,
      action: proposal.action,
      resourceRef: proposal.resourceRef,
    },
  });
  return { ...proposal, status: "executing" as const, approvalRef };
}

export async function completeGoogleAction(
  sql: Sql,
  proposal: GoogleGovernedProposal,
  actorRef: string,
  input: { providerRequestId?: string; result: unknown },
) {
  const result = safeGoogleReceipt(input.result);
  const requestId = input.providerRequestId?.trim().slice(0, 200) || "";
  const rows = await sql.query<{ id: string }>(
    "update google_action_proposals " +
      "set status='succeeded',provider_request_id=$3,result_receipt=$4,last_error='',executed_at=now(),updated_at=now() " +
      "where id=$1 and project_id=$2 and status='executing' returning id",
    [proposal.id, proposal.projectId, requestId, result],
  );
  if (!rows[0]) throw new Error("google_action_state_conflict");
  await receipt(sql, {
    projectId: proposal.projectId,
    actorRef,
    operation: "google.action.execute",
    targetRef: proposal.id,
    status: "succeeded",
    approvalRef: proposal.approvalRef,
    idempotencyKey: proposal.idempotencyKey,
    evidence: {
      action: proposal.action,
      resourceRef: proposal.resourceRef,
      payloadHash: proposal.payloadHash,
      providerRequestId: requestId,
      result: JSON.parse(result),
    },
  });
}

export async function failGoogleAction(
  sql: Sql,
  proposal: GoogleGovernedProposal,
  actorRef: string,
  error: string,
) {
  const safe = safeGoogleError(error);
  await sql.query(
    "update google_action_proposals set status='failed',last_error=$3,updated_at=now() " +
      "where id=$1 and project_id=$2 and status='executing'",
    [proposal.id, proposal.projectId, safe],
  );
  await receipt(sql, {
    projectId: proposal.projectId,
    actorRef,
    operation: "google.action.execute",
    targetRef: proposal.id,
    status: "failed",
    approvalRef: proposal.approvalRef,
    idempotencyKey: proposal.idempotencyKey,
    evidence: {
      action: proposal.action,
      resourceRef: proposal.resourceRef,
      payloadHash: proposal.payloadHash,
      error: safe,
    },
  });
}

export async function listActorGoogleProposals(
  sql: Sql,
  access: AccessCtx,
  actorRef: string,
): Promise<GoogleProposalView[]> {
  assertActionMember(access);
  const rows = await sql.query<ProposalRow>(
    "select * from google_action_proposals where project_id=$1 and actor_ref=$2 order by created_at desc limit 100",
    [access.project.id, actorRef],
  );
  return rows.map(proposalFromRow).map(googleProposalView);
}

export async function listGoogleProposals(sql: Sql, access: AccessCtx) {
  assertOwner(access);
  const rows = await sql.query<ProposalRow>(
    "select * from google_action_proposals where project_id=$1 order by created_at desc limit 100",
    [access.project.id],
  );
  return rows.map(proposalFromRow).map(googleProposalView);
}

export function proposalApprovalPolicy(action: GoogleActionKey) {
  const policy = googleActionPolicy(action);
  if (!policy) throw new Error("unknown_google_action");
  return policy.approval;
}
