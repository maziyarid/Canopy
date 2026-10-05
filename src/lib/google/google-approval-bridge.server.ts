import { z } from "zod";
import type { Sql } from "../db.ts";
import type { GoogleGovernedProposal } from "./google-governance-core.ts";
import { googleActionPolicy } from "./google-capabilities.ts";
import { googleApprovalEnvelope } from "./google-governance-core.ts";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

function bridgeConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.MSROBOT_BRIDGE_URL || "http://127.0.0.1:9110").trim();
  const token = String(env.MSROBOT_BRIDGE_TOKEN || "").trim();
  const url = new URL(raw);
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) {
    throw new Error("ms_robot_bridge_url_must_be_loopback");
  }
  if (!token) throw new Error("ms_robot_bridge_token_missing");
  return { baseUrl: url.toString().replace(/\/$/, ""), token };
}

const BridgeResponse = z.object({
  accepted: z.literal(true),
  duplicate: z.boolean(),
  event_id: z.string().min(1).max(80),
  state: z.enum(["queued", "delivered", "acked", "dead"]),
}).strict();

export async function publishGoogleApprovalProposal(input: {
  proposal: GoogleGovernedProposal;
  siteKey: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}) {
  const policy = googleActionPolicy(input.proposal.action);
  if (!policy || policy.approval !== "ada") throw new Error("google_action_does_not_require_ada");
  const { baseUrl, token } = bridgeConfig(input.env ?? process.env);
  const fetchImpl = input.fetchImpl ?? fetch;
  const envelope = googleApprovalEnvelope(input.proposal, input.siteKey, policy.mutationType);

  let response: Response;
  try {
    response = await fetchImpl(baseUrl + "/v1/events", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelope),
      cache: "no-store",
    });
  } catch {
    throw new Error("ms_robot_bridge_unreachable");
  }
  if (!response.ok) throw new Error("ms_robot_bridge_http_" + response.status);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("ms_robot_bridge_invalid_json");
  }
  const parsed = BridgeResponse.safeParse(json);
  if (!parsed.success) throw new Error("ms_robot_bridge_invalid_response");
  return parsed.data;
}

export async function recordGoogleApprovalRequest(
  sql: Sql,
  proposal: GoogleGovernedProposal,
  actorRef: string,
  eventId: string,
) {
  const ref = eventId.trim();
  if (!ref) throw new Error("approval_request_ref_required");
  const rows = await sql.query<{ id: string }>(
    "update google_action_proposals set approval_request_ref=$3,updated_at=now() " +
      "where id=$1 and project_id=$2 and status='pending_approval' " +
      "and (approval_request_ref='' or approval_request_ref=$3) returning id",
    [proposal.id, proposal.projectId, ref],
  );
  if (!rows[0]) throw new Error("google_action_state_conflict");
  await sql.query(
    "insert into operation_receipts " +
      "(id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence) " +
      "values($1,$2,$3,'google.action.approval.requested',$4,'queued','',$5,$6)",
    [
      crypto.randomUUID(),
      proposal.projectId,
      actorRef,
      proposal.id,
      "approval-request:" + proposal.id,
      JSON.stringify({
        eventId: ref,
        payloadHash: proposal.payloadHash,
        action: proposal.action,
        resourceRef: proposal.resourceRef,
      }),
    ],
  );
  return { eventId: ref };
}
