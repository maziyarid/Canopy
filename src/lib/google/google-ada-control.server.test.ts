import test from "node:test";
import assert from "node:assert/strict";
import {
  claimAdaGoogleApprovalProof,
  consumeAdaGoogleApprovalProof,
  getAdaGoogleApproval,
  requestAdaGoogleApproval,
} from "./google-ada-control.server.ts";
import type { GoogleGovernedProposal } from "./google-governance-core.ts";

const proposal: GoogleGovernedProposal = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "project-a",
  actorRef: "user-a",
  connectionProfileId: "profile-a",
  provider: "gsc",
  capability: "google.gsc.site.remove",
  action: "gsc.site.remove",
  resourceType: "gsc_site",
  resourceRef: "sc-domain:example.com",
  payload: {},
  payloadHash: "a".repeat(64),
  deterministicDiff: { operation: "delete", resourceRef: "sc-domain:example.com", fields: {} },
  snapshotHash: "",
  approvalPolicy: "ada",
  approvalRef: "",
  approvalRequestRef: "",
  idempotencyKey: "proposal-1",
  status: "pending_approval",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

const env = {
  ADA_CONTROL_APPROVAL_URL: "http://127.0.0.1:8770",
  ADA_CONTROL_MS_ROBOT_TOKEN: "fixture-limited-token",
} as NodeJS.ProcessEnv;

test("approval request is loopback-only, metadata bound, and never sends mutation payload", async () => {
  let observed: any;
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    observed = { url: String(url), headers: init?.headers, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({
      ticket_id: "22222222-2222-4222-8222-222222222222",
      proposal_id: proposal.id,
      tool_name: proposal.action,
      site_id: "example.com",
      resource_id: proposal.resourceRef,
      payload_hash: proposal.payloadHash,
      snapshot_hash: null,
      dependency_hash: observed.body.dependency_hash,
      state: "PENDING",
      approval_id: null,
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  const ticket = await requestAdaGoogleApproval({
    proposal,
    siteKey: "example.com",
    bridgeEventId: "33333333-3333-4333-8333-333333333333",
    requestedBy: "user-a",
    env,
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert.equal(ticket.state, "PENDING");
  assert.equal(observed.url, "http://127.0.0.1:8770/approvals");
  assert.equal(observed.body.payload_hash, proposal.payloadHash);
  assert.equal("payload" in observed.body, false);
  assert.equal(JSON.stringify(observed.body).includes("fixture-limited-token"), false);
});

test("control client rejects non-loopback approval URLs before network", async () => {
  let called = false;
  await assert.rejects(
    () => getAdaGoogleApproval(
      "22222222-2222-4222-8222-222222222222",
      {
        ADA_CONTROL_APPROVAL_URL: "https://control.example.com",
        ADA_CONTROL_MS_ROBOT_TOKEN: "x",
      } as NodeJS.ProcessEnv,
      (async () => { called = true; return new Response("{}"); }) as typeof fetch,
    ),
    /loopback/,
  );
  assert.equal(called, false);
});

test("proof is claimed and consumed only through the limited server token", async () => {
  const calls: string[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/proof")) {
      return new Response(JSON.stringify({
        ticket_id: "22222222-2222-4222-8222-222222222222",
        one_time_token: "p".repeat(64),
        payload_hash: proposal.payloadHash,
        snapshot_hash: null,
        approval_id: "44444444-4444-4444-8444-444444444444",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      ticket_id: "22222222-2222-4222-8222-222222222222",
      state: "CONSUMED",
      approval_ref: "ada:222:444",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const proof = await claimAdaGoogleApprovalProof(
    "22222222-2222-4222-8222-222222222222",
    env,
    fetchImpl as typeof fetch,
  );
  assert.equal(proof.oneTimeToken, "p".repeat(64));
  const consumed = await consumeAdaGoogleApprovalProof(proof, env, fetchImpl as typeof fetch);
  assert.equal(consumed.approvalRef, "ada:222:444");
  assert.equal(calls.length, 2);
});
