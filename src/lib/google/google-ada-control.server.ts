import { z } from "zod";
import type { GoogleGovernedProposal } from "./google-governance-core.ts";
import { deterministicDiffHash } from "./google-governance-core.ts";
import { googleActionPolicy } from "./google-capabilities.ts";
import type { AdaApprovalProof } from "./google-proposals.server.ts";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

function config(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.ADA_CONTROL_APPROVAL_URL || "http://127.0.0.1:8770").trim();
  const token = String(env.ADA_CONTROL_MS_ROBOT_TOKEN || "").trim();
  const url = new URL(raw);
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) {
    throw new Error("ada_control_approval_url_must_be_loopback");
  }
  if (!token) throw new Error("ada_control_ms_robot_token_missing");
  return { baseUrl: url.toString().replace(/\/$/, ""), token };
}

const Ticket = z.object({
  ticket_id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  tool_name: z.string(),
  site_id: z.string().nullable().optional(),
  resource_id: z.string().nullable().optional(),
  payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
  snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
  dependency_hash: z.string().regex(/^[0-9a-f]{64}$/),
  state: z.enum(["PENDING", "GRANTED", "DENIED", "EXPIRED", "CONSUMED"]),
  approved_by: z.string().nullable().optional(),
  approval_id: z.string().uuid().nullable().optional(),
  expires_at: z.union([z.string(), z.date()]).optional(),
}).passthrough();

const Proof = z.object({
  ticket_id: z.string().uuid(),
  one_time_token: z.string().min(32).max(256),
  payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
  snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
  approval_id: z.string().uuid(),
}).strict();

const Consumed = z.object({
  ticket_id: z.string().uuid(),
  state: z.literal("CONSUMED"),
  approval_ref: z.string().min(1).max(200),
}).strict();

async function requestJson(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("invalid_ada_control_path");
  const { baseUrl, token } = config(env);
  let response: Response;
  try {
    response = await fetchImpl(baseUrl + path, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    throw new Error("ada_control_unreachable");
  }
  if (!response.ok) throw new Error("ada_control_http_" + response.status);
  try {
    return await response.json();
  } catch {
    throw new Error("ada_control_invalid_json");
  }
}

export async function requestAdaGoogleApproval(input: {
  proposal: GoogleGovernedProposal;
  siteKey: string;
  bridgeEventId: string;
  requestedBy: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}) {
  const policy = googleActionPolicy(input.proposal.action);
  if (!policy || policy.approval !== "ada") throw new Error("google_action_does_not_require_ada");
  const payload = {
    proposal_id: input.proposal.id,
    context_receipt_id: input.bridgeEventId,
    project_id: input.proposal.projectId,
    action: input.proposal.action,
    site_id: input.siteKey,
    resource_id: input.proposal.resourceRef,
    payload_hash: input.proposal.payloadHash,
    snapshot_hash: input.proposal.snapshotHash || "",
    dependency_hash: deterministicDiffHash(input.proposal.deterministicDiff),
    requested_by: input.requestedBy,
    mutation_type: policy.mutationType,
    capability: input.proposal.capability,
    ttl_seconds: input.proposal.expiresAt
      ? Math.max(300, Math.floor((Date.parse(input.proposal.expiresAt) - Date.now()) / 1000))
      : 3600,
  };
  const result = await requestJson(
    "/approvals",
    { method: "POST", body: payload },
    input.env ?? process.env,
    input.fetchImpl ?? fetch,
  );
  const parsed = Ticket.safeParse(result);
  if (!parsed.success) throw new Error("ada_control_invalid_ticket");
  if (
    parsed.data.proposal_id !== input.proposal.id ||
    parsed.data.payload_hash !== input.proposal.payloadHash ||
    parsed.data.dependency_hash !== payload.dependency_hash
  ) {
    throw new Error("ada_control_ticket_binding_mismatch");
  }
  return parsed.data;
}

export async function getAdaGoogleApproval(
  ticketId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const result = await requestJson("/approvals/" + encodeURIComponent(ticketId), {}, env, fetchImpl);
  const parsed = Ticket.safeParse(result);
  if (!parsed.success) throw new Error("ada_control_invalid_ticket");
  return parsed.data;
}

export async function claimAdaGoogleApprovalProof(
  ticketId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<AdaApprovalProof & { approvalId: string }> {
  const result = await requestJson(
    "/approvals/" + encodeURIComponent(ticketId) + "/proof",
    { method: "POST", body: {} },
    env,
    fetchImpl,
  );
  const parsed = Proof.safeParse(result);
  if (!parsed.success) throw new Error("ada_control_invalid_proof");
  return {
    ticketId: parsed.data.ticket_id,
    oneTimeToken: parsed.data.one_time_token,
    payloadHash: parsed.data.payload_hash,
    ...(parsed.data.snapshot_hash ? { snapshotHash: parsed.data.snapshot_hash } : {}),
    approvalId: parsed.data.approval_id,
  };
}

export async function consumeAdaGoogleApprovalProof(
  proof: AdaApprovalProof,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const result = await requestJson(
    "/approvals/" + encodeURIComponent(proof.ticketId) + "/consume",
    {
      method: "POST",
      body: {
        one_time_token: proof.oneTimeToken,
        payload_hash: proof.payloadHash,
        snapshot_hash: proof.snapshotHash || "",
      },
    },
    env,
    fetchImpl,
  );
  const parsed = Consumed.safeParse(result);
  if (!parsed.success) throw new Error("ada_control_invalid_consumption");
  return { approvalRef: parsed.data.approval_ref };
}
