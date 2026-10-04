import test from "node:test";
import assert from "node:assert/strict";
import { createReportingSnapshotHandler } from "./reporting-http.ts";
import {
  snapshotCache,
  type SnapshotSql,
  type SnapshotAccess,
} from "./reporting-snapshot-service.ts";

const now = new Date("2026-10-04T00:00:00Z");
const identity = { userId: "service-client", email: "" };
const binding = { projectId: "p1", site: "clinic.example" };
const sql = (async () => {
  throw new Error("Unexpected SQL write");
}) as unknown as SnapshotSql;
const row = {
  provider: "gsc",
  status: "ok",
  lastSuccess: "2026-10-03",
  lastAttempt: null,
  freshness: "2026-10-02",
  lastError: null,
  metricName: "clicks",
  metricValue: 12,
  dataDate: "2026-10-02",
};
const request = (query = "", init?: RequestInit) =>
  new Request(`https://msrobot.example/api/v1/reporting/snapshot${query}`, init);
function fixture() {
  snapshotCache.clear();
  const state = {
    authCalls: 0,
    bindingCalls: 0,
    accessCalls: 0,
    reads: 0,
    identity: identity as typeof identity | null,
    binding: binding as typeof binding | null,
    access: {
      role: "client",
      filter: "",
      reportSections: ["overview", "search"],
      project: { id: "p1", domain: "clinic.example", data_domain: "medical" },
    } as SnapshotAccess,
  };
  const deps = {
    authenticate: async () => {
      state.authCalls++;
      return state.identity;
    },
    resolveBinding: async () => {
      state.bindingCalls++;
      return state.binding;
    },
    resolveAccess: async () => {
      state.accessCalls++;
      return state.access;
    },
    sql,
    readLedger: async (projectId: string, site: string) => {
      state.reads++;
      assert.equal(projectId, "p1");
      assert.equal(site, "clinic.example");
      return { rows: [row], available: true };
    },
    now: () => now,
  };
  return { state, deps, handle: createReportingSnapshotHandler(deps) };
}

test("unconfigured facade has no dependencies and returns an inert generic 503", async () => {
  const response = await createReportingSnapshotHandler()(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "reporting_unconfigured" });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("facade rejects mutation methods before authentication or provider reads", async () => {
  const { handle, state } = fixture();
  const response = await handle(request("", { method: "POST" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
  assert.equal(state.authCalls + state.reads, 0);
});

test("invalid identity receives no scope lookup and no data", async () => {
  const { handle, state } = fixture();
  state.identity = null;
  const response = await handle(request());
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
  assert.equal(state.bindingCalls + state.reads, 0);
});

test("missing and unauthorized bindings have identical responses", async () => {
  const absent = fixture();
  absent.state.binding = null;
  const forbidden = fixture();
  forbidden.deps.resolveAccess = async () => {
    throw new Error("Forbidden");
  };
  const a = await absent.handle(request());
  const b = await createReportingSnapshotHandler(forbidden.deps)(request());
  assert.equal(a.status, 404);
  assert.equal(b.status, 404);
  assert.equal(await a.text(), await b.text());
  assert.equal(absent.state.reads + forbidden.state.reads, 0);
});

test("explicit project and site mapping must exactly match fresh grants", async () => {
  for (const project of [
    { id: "p2", domain: "clinic.example" },
    { id: "p1", domain: "foreign.example" },
  ]) {
    const { handle, state } = fixture();
    state.access.project = project;
    assert.equal((await handle(request())).status, 404);
    assert.equal(state.reads, 0);
  }
});

test("owner, editor and keyword-restricted identities cannot export client aggregates", async () => {
  for (const access of [
    { role: "owner" as const, filter: "" },
    { role: "editor" as const, filter: "" },
    { role: "client" as const, filter: "query" },
  ]) {
    const { handle, state } = fixture();
    Object.assign(state.access, access);
    assert.equal((await handle(request())).status, 404);
    assert.equal(state.reads, 0);
  }
});

test("strict bounded query rejects scope injection, duplicates and invalid windows", async () => {
  for (const query of [
    "?projectId=p2",
    "?site=foreign.example",
    "?period=last_7d&period=last_90d",
    "?period=7d",
    "?comparison=year",
    "?endDate=2026-02-30",
    "?endDate=2026-10-05",
    "?endDate=",
    "?endDate=0000-01-01",
    "?endDate=0001-01-01",
  ]) {
    const { handle, state } = fixture();
    const response = await handle(request(query));
    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), { error: "invalid_request" });
    assert.equal(state.reads, 0);
  }
});

test("real snapshot service preserves canonical schema and client-safe sections", async () => {
  const { handle } = fixture();
  const response = await handle(request("?period=last_7d&comparison=previous&endDate=2026-10-03"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaVersion, "ms-robot.reporting.v1");
  assert.equal(body.projectId, "p1");
  assert.equal(body.site, "clinic.example");
  assert.deepEqual(body.period, { start: "2026-09-27", end: "2026-10-03", label: "last_7d" });
  assert.deepEqual(body.comparison, { start: "2026-09-20", end: "2026-09-26", label: "previous" });
  assert.deepEqual(
    body.sections.map((s: { key: string }) => s.key),
    ["overview", "search"],
  );
  assert.deepEqual(
    body.comparisonSections.map((s: { key: string }) => s.key),
    ["overview", "search"],
  );
  assert.equal(body.sections[1].metrics[0].provenance, "first_party");
  assert.equal(body.sections[1].metrics[0].dataDate, "2026-10-02");
  assert.equal(body.providerHealth.status, "unavailable");
  assert.equal(response.headers.get("ETag"), `W/${body.etag}`);
  assert.equal(response.headers.get("Cache-Control"), "private, no-cache");
  assert.equal(response.headers.get("Vary"), "Authorization");
});

test("comparison none avoids loading the prior window", async () => {
  const { handle, state } = fixture();
  const body = await (await handle(request("?comparison=none"))).json();
  assert.equal(body.comparison, null);
  assert.equal(body.comparisonSections, undefined);
  assert.equal(state.reads, 1);
  assert.equal(body.period.label, "last_28d");
});

test("conditional response rechecks current identity, exact mapping and grants", async () => {
  const { handle, state } = fixture();
  const first = await handle(request());
  const etag = first.headers.get("ETag")!;
  const next = await handle(request("", { headers: { "If-None-Match": etag } }));
  assert.equal(next.status, 304);
  assert.equal(await next.text(), "");
  assert.equal(state.authCalls, 2);
  assert.equal(state.accessCalls, 2);
  state.access.reportSections = ["overview"];
  const reduced = await handle(request("", { headers: { "If-None-Match": etag } }));
  assert.equal(reduced.status, 200);
  assert.notEqual(reduced.headers.get("ETag"), etag);
  state.binding = null;
  assert.equal((await handle(request("", { headers: { "If-None-Match": "*" } }))).status, 404);
});

test("weak and list validators match only after authorization", async () => {
  const { handle } = fixture();
  const etag = (await handle(request())).headers.get("ETag")!;
  assert.equal(
    (await handle(request("", { headers: { "If-None-Match": `"other", ${etag}` } }))).status,
    304,
  );
  assert.equal(
    (await handle(request("", { headers: { "If-None-Match": etag.replace(/^W\//, "") } }))).status,
    304,
  );
});

test("semantic HTTP ETag is weak when timestamps change but facts stay the same", async () => {
  const { deps } = fixture();
  let instant = new Date("2026-10-04T00:00:00Z");
  deps.now = () => instant;
  const handle = createReportingSnapshotHandler(deps);
  const first = await handle(request());
  const firstBody = await first.text();
  instant = new Date("2026-10-04T00:00:01Z");
  const second = await handle(request());
  const secondBody = await second.text();
  assert.notEqual(firstBody, secondBody);
  assert.equal(first.headers.get("ETag"), second.headers.get("ETag"));
  assert.match(first.headers.get("ETag")!, /^W\/"[a-f0-9]{64}"$/);
  assert.equal(JSON.parse(firstBody).etag, first.headers.get("ETag")!.slice(2));
});

test("earliest positive-year windows are accepted only when both periods remain valid", async () => {
  const { handle } = fixture();
  assert.equal(
    (await handle(request("?period=last_7d&comparison=none&endDate=0001-01-07"))).status,
    200,
  );
  assert.equal(
    (await handle(request("?period=last_7d&comparison=previous&endDate=0001-01-07"))).status,
    400,
  );
  assert.equal(
    (await handle(request("?period=last_7d&comparison=previous&endDate=0001-01-14"))).status,
    200,
  );
});

test("authentication and ledger exceptions never echo upstream secrets", async () => {
  for (const dependency of ["authenticate", "readLedger"] as const) {
    const { deps } = fixture();
    deps[dependency] = async () => {
      throw new Error("Bearer SECRET patient@example.test");
    };
    const response = await createReportingSnapshotHandler(deps)(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "reporting_unavailable" });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("partial provider failure remains a readable canonical partial report", async () => {
  const { deps } = fixture();
  deps.readLedger = async () => ({
    available: true,
    rows: [row, { ...row, provider: "ga4", status: "unavailable", metricName: "", metricValue: 0 }],
  });
  const response = await createReportingSnapshotHandler(deps)(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sections.find((s: { key: string }) => s.key === "search").metrics[0].value, 12);
});
