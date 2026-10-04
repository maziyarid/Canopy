import assert from "node:assert/strict";
import test from "node:test";
import { canReadAdaEvents, projectAdaEvents } from "./ada-events-view.ts";

const row = {
  event_id: "event-1",
  project_id: "project-a",
  site_key: "example.com",
  source: "ada",
  event_type: "ms_robot.action.proposal",
  correlation_id: "proposal-1",
  sensitivity: "internal",
  reported_at: "2026-10-03T10:00:00+00:00",
  received_at: "2026-10-03T10:00:01+00:00",
  updated_at: "2026-10-03T10:00:02+00:00",
  state: "recorded",
  action_state: "proposal_only",
  payload: { private: "sensitive fixture body" },
  envelope_sha256: "private digest",
  idempotency_key: "private key",
};

test("Ada event access requires an unrestricted project owner", () => {
  assert.equal(canReadAdaEvents("owner", ""), true);
  assert.equal(canReadAdaEvents("owner", "keyword"), false);
  for (const role of ["editor", "viewer", "client", "guest"]) {
    assert.equal(canReadAdaEvents(role, ""), false);
  }
});

test("event projection excludes payload and rejects another project or site", () => {
  const result = projectAdaEvents(
    [row, { ...row, project_id: "project-b" }, { ...row, site_key: "other.example" }],
    "project-a",
    "example.com",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].action_state, "proposal_only");
  assert.equal(result[0].state, "recorded");
  assert.equal(result[0].correlation_id, "proposal-1");
  assert.equal("payload" in result[0], false);
  assert.equal("idempotency_key" in result[0], false);
  assert.equal("envelope_sha256" in result[0], false);
  assert.equal(JSON.stringify(result).includes("sensitive fixture"), false);
});

test("malformed or executable claims never reach the event view", () => {
  const invalid = [
    null,
    {},
    { ...row, state: "executed" },
    { ...row, source: "Bearer credential" },
    { ...row, event_type: "shell.execute" },
    { ...row, action_state: "executed" },
    { ...row, received_at: "not-a-date" },
    { ...row, correlation_id: "<script>" },
    { ...row, correlation_id: "123456789:abcdefghijklmnopqrstuvwxyz0123456789" },
    { ...row, event_type: "ms_robot.action.proposal", action_state: "informational" },
  ];
  assert.deepEqual(projectAdaEvents(invalid, "project-a", "example.com"), []);
});
