import assert from "node:assert/strict";
import test from "node:test";
import { filterAdaEvents } from "./ada-event-list.ts";
import type { AdaEventView } from "./server/ada-events-view.ts";

const receipt = (id: string, changes: Partial<AdaEventView> = {}): AdaEventView => ({
  event_id: id,
  project_id: "project-a",
  site_key: "example.com",
  source: "ada",
  event_type: "ada.alert.queued",
  correlation_id: "incident-visible",
  sensitivity: "internal",
  reported_at: "2026-10-03T10:00:00Z",
  received_at: "2026-10-03T10:01:00Z",
  updated_at: "2026-10-03T10:02:00Z",
  state: "acknowledged",
  action_state: "informational",
  ...changes,
});
const rows = [
  receipt("event-1"),
  receipt("event-2", {
    state: "recorded",
    correlation_id: "proposal-visible",
    event_type: "ms_robot.action.proposal",
    action_state: "proposal_only",
  }),
];

test("status and proposal filters intersect search without mutating server ordering", () => {
  assert.deepEqual(
    filterAdaEvents(rows, "all", "").map((r) => r.event_id),
    ["event-1", "event-2"],
  );
  assert.deepEqual(
    filterAdaEvents(rows, "unconfirmed", "").map((r) => r.event_id),
    ["event-2"],
  );
  assert.deepEqual(
    filterAdaEvents(rows, "acknowledged", "").map((r) => r.event_id),
    ["event-1"],
  );
  assert.deepEqual(filterAdaEvents(rows, "proposals", " incident-visible "), []);
  assert.deepEqual(
    filterAdaEvents(rows, "proposals", "PROPOSAL-VISIBLE").map((r) => r.event_id),
    ["event-2"],
  );
  assert.deepEqual(
    rows.map((r) => r.event_id),
    ["event-1", "event-2"],
  );
});

test("search finds safe references, reported source and human event labels in either locale", () => {
  assert.equal(filterAdaEvents(rows, "all", "EVENT-1").length, 1);
  assert.equal(filterAdaEvents(rows, "all", "example.com").length, 2);
  assert.equal(filterAdaEvents(rows, "all", "Ada").length, 2);
  assert.equal(filterAdaEvents(rows, "all", "action proposal").length, 1);
  assert.equal(filterAdaEvents(rows, "all", "پیشنهاد اقدام").length, 1);
  assert.equal(filterAdaEvents(rows, "all", "ms_robot.action.proposal").length, 1);
  assert.equal(filterAdaEvents(rows, "all", "not present").length, 0);
});
