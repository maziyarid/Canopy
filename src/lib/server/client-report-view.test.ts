import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySectionFreshness,
  buildClientReportView,
  buildGatedClientDashboard,
  DISABLED_REPORTING_ROUTE,
  channelMeasuredTotal,
  classifyChannel,
  clientLabelForStatus,
  freshnessStatus,
  groupAcquisitionChannels,
  newestMeasurementStamp,
  normalizeClientStatus,
  parseTimestamp,
  redactClientText,
  staleAfterMs,
  toClientSectionView,
  visibleSectionKeys,
  type SnapshotSection,
} from "./client-report-view.ts";

const NOW = Date.parse("2026-09-28T15:30:00Z");

function section(partial: Partial<SnapshotSection>): SnapshotSection {
  return {
    key: "search",
    status: "ok",
    freshness: "2026-09-27T00:00:00Z",
    lastSyncAt: "2026-09-27T00:00:00Z",
    warning: null,
    metrics: [
      {
        name: "clicks",
        value: 12,
        provenance: "first_party",
        provider: "gsc",
        dataDate: "2026-09-27",
      },
    ],
    ...partial,
  };
}

describe("AAX-80 client report view", () => {
  it("uses a longer stale window for GSC than GA4", () => {
    assert.equal(staleAfterMs("gsc") > staleAfterMs("ga4"), true);
    assert.equal(freshnessStatus("gsc", "2026-09-26T15:30:00Z", NOW), "ok");
    assert.equal(freshnessStatus("ga4", "2026-09-26T15:30:00Z", NOW), "stale");
  });

  it("treats date-only stamps as end of the UTC reporting day", () => {
    const startOfToday = Date.parse("2026-09-28T00:00:01Z");
    assert.equal(freshnessStatus("ga4", "2026-09-27", startOfToday), "ok");
    assert.ok((parseTimestamp("2026-09-27") ?? 0) > Date.parse("2026-09-27T00:00:00Z"));
  });

  it("does not mark unavailable sections stale", () => {
    const next = applySectionFreshness(
      section({ status: "unavailable", lastSyncAt: "2026-01-01T00:00:00Z" }),
      "ga4",
      NOW,
    );
    assert.equal(next.status, "unavailable");
  });

  it("treats missing timestamps on otherwise-ok sections as unavailable", () => {
    const next = applySectionFreshness(
      section({ lastSyncAt: null, freshness: null, metrics: [{ name: "clicks", value: 1, provenance: "first_party", provider: "gsc", dataDate: null }] }),
      "gsc",
      NOW,
    );
    assert.equal(next.status, "unavailable");
  });

  it("marks recently synced sections stale when the newest measurement exceeds the window", () => {
    const next = applySectionFreshness(
      section({
        lastSyncAt: "2026-09-28T12:00:00Z",
        freshness: "2026-09-28T12:00:00Z",
        metrics: [{ name: "clicks", value: 4, provenance: "first_party", provider: "gsc", dataDate: "2026-09-18" }],
      }),
      "gsc",
      NOW,
    );
    assert.equal(next.status, "stale");
  });

  it("does not mark a completed 28-day GSC window stale because older rows exist", () => {
    const next = applySectionFreshness(
      section({
        lastSyncAt: "2026-09-28T12:00:00Z",
        freshness: "2026-09-27T00:00:00Z",
        metrics: [
          { name: "clicks", value: 1, provenance: "first_party", provider: "gsc", dataDate: "2026-08-31" },
          { name: "clicks", value: 9, provenance: "first_party", provider: "gsc", dataDate: "2026-09-27" },
        ],
      }),
      "gsc",
      NOW,
    );
    assert.equal(newestMeasurementStamp(next), "2026-09-27");
    assert.equal(next.status, "ok");
  });

  it("does not mark mixed current measurements stale because header freshness uses GSC lag", () => {
    const next = applySectionFreshness(
      section({
        lastSyncAt: "2026-09-28T12:00:00Z",
        freshness: "2026-09-26T12:00:00Z",
        metrics: [
          { name: "clicks", value: 4, provenance: "first_party", provider: "gsc", dataDate: "2026-09-26" },
          { name: "sessions", value: 8, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27T18:00:00Z" },
        ],
      }),
      undefined,
      NOW,
    );
    assert.equal(next.status, "ok");
  });

  it("uses the stricter provider threshold when a section mixes GSC and GA4", () => {
    const next = applySectionFreshness(
      section({
        lastSyncAt: "2026-09-27T12:00:00Z",
        freshness: "2026-09-26T12:00:00Z",
        metrics: [
          { name: "clicks", value: 4, provenance: "first_party", provider: "gsc", dataDate: "2026-09-26" },
          { name: "sessions", value: 8, provenance: "first_party", provider: "ga4", dataDate: "2026-09-26T12:00:00Z" },
        ],
      }),
      undefined,
      NOW,
    );
    assert.equal(next.status, "stale");
  });

  it("marks stale when header freshness is ten days old even if one metric is recent", () => {
    const next = applySectionFreshness(
      section({
        lastSyncAt: "2026-09-28T12:00:00Z",
        freshness: "2026-09-18T00:00:00Z",
        metrics: [{ name: "clicks", value: 4, provenance: "first_party", provider: "gsc", dataDate: "2026-09-27" }],
      }),
      undefined,
      NOW,
    );
    assert.equal(next.status, "stale");
    assert.equal(next.freshness, "2026-09-18T00:00:00Z");
  });

  it("hides reason codes from client role and keeps them for owners", () => {
    const raw = section({ reasonCode: "gsc_quota_exhausted", warning: "Bearer abc.def leaked" });
    const client = toClientSectionView(raw, "client");
    const owner = toClientSectionView(raw, "owner");
    assert.equal(client.reasonCode, null);
    assert.equal(owner.reasonCode, "gsc_quota_exhausted");
    assert.match(String(client.warning), /redacted/i);
    assert.equal(client.clientLabel, "ok");
  });

  it("maps degraded internals to a plain unavailable client label and status", () => {
    assert.equal(clientLabelForStatus("degraded"), "unavailable");
    assert.equal(normalizeClientStatus("unknown"), "unavailable");
    const client = toClientSectionView(section({ status: "degraded" }), "client");
    assert.equal(client.status, "unavailable");
    assert.equal(client.clientLabel, "unavailable");
    const owner = toClientSectionView(section({ status: "degraded" }), "owner");
    assert.equal(owner.status, "degraded");
  });

  it("separates acquisition channels instead of collapsing into search", () => {
    const grouped = groupAcquisitionChannels([
      { name: "organic", value: 40, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27" },
      { name: "direct", value: 10, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27" },
      { name: "paid search", value: 5, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27" },
      { name: "referral", value: 3, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27" },
    ]);
    assert.equal(grouped.organic[0]?.value, 40);
    assert.equal(grouped.direct[0]?.value, 10);
    assert.equal(grouped.paid[0]?.value, 5);
    assert.equal(grouped.referral[0]?.value, 3);
    assert.equal(classifyChannel("mystery-source"), "other");
  });

  it("does not treat missing channel values as measured zero", () => {
    assert.equal(
      channelMeasuredTotal([{ name: "organic", value: null, provenance: "first_party", provider: "ga4", dataDate: null }]),
      null,
    );
    assert.equal(
      channelMeasuredTotal([
        { name: "organic", value: null, provenance: "first_party", provider: "ga4", dataDate: null },
        { name: "organic", value: 4, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27" },
      ]),
      4,
    );
  });

  it("lets clients see only granted sections and never providerHealth by default", () => {
    assert.deepEqual(visibleSectionKeys("client", ["overview", "search"]), ["overview", "search"]);
    assert.equal(visibleSectionKeys("owner", []).includes("providerHealth"), true);
    assert.equal(visibleSectionKeys("client", undefined).includes("providerHealth"), false);
  });

  it("builds a partial dashboard when GA4 is unavailable and GSC is ok", () => {
    const view = buildClientReportView({
      projectId: "proj_a",
      site: "https://example.com",
      periodLabel: "last_28d",
      role: "client",
      sections: [
        section({ key: "search", status: "ok" }),
        section({
          key: "acquisition",
          status: "unavailable",
          metrics: [{ name: "organic", value: null, provenance: "first_party", provider: "ga4", dataDate: null }],
        }),
        section({ key: "overview", status: "partial" }),
        section({ key: "providerHealth", status: "degraded", reasonCode: "internal_timeout" }),
      ],
      now: NOW,
    });
    const keys = view.sections.map((item) => item.key);
    assert.deepEqual(keys.includes("providerHealth"), false);
    assert.equal(view.sections.find((item) => item.key === "search")?.status, "ok");
    assert.equal(view.sections.find((item) => item.key === "acquisition")?.clientLabel, "unavailable");
    assert.equal(view.acquisitionStatus, "unavailable");
    assert.equal(channelMeasuredTotal(view.channels.organic), null);
    assert.equal(view.projectId, "proj_a");
  });

  it("redacts credential-shaped strings", () => {
    assert.equal(redactClientText("api_key=sk_live_example"), "api_key=<redacted>");
  });
});

describe("AAX-80 gated client dashboard", () => {
  it("rejects a client-supplied project id that differs from the server binding", () => {
    assert.throws(
      () =>
        buildGatedClientDashboard({
          access: {
            role: "client",
            boundProjectId: "project-a",
            requestedProjectId: "project-b",
            reportingConfigured: true,
          },
          site: "example.com",
          periodLabel: "2026-09-01..2026-09-28",
          sections: [section({})],
          now: NOW,
        }),
      /client_supplied_scope_rejected/,
    );
  });

  it("fails closed and does not call the disabled reporting route when unconfigured", async () => {
    let called = 0;
    const view = buildGatedClientDashboard({
      access: { role: "client", boundProjectId: "project-a", reportingConfigured: false },
      site: "example.com",
      periodLabel: "2026-09-01..2026-09-28",
      sections: [section({ reasonCode: "provider_secret_ref" })],
      now: NOW,
      fetchImpl: undefined,
    });
    assert.equal(view.reportingConfigured, false);
    assert.equal(view.remoteRoute, null);
    assert.equal(view.transport, "local_view_model_only");
    assert.equal(view.sections.length, 0);
    assert.equal(view.acquisitionStatus, "unavailable");
    assert.equal(called, 0);
    assert.equal(DISABLED_REPORTING_ROUTE, "/api/v1/reporting/snapshot");
  });

  it("refuses a fetch implementation so the disabled route cannot be activated here", () => {
    assert.throws(
      () =>
        buildGatedClientDashboard({
          access: { role: "client", boundProjectId: "project-a", reportingConfigured: true },
          site: "example.com",
          periodLabel: "2026-09-01..2026-09-28",
          sections: [section({})],
          fetchImpl: async () => ({ ok: true }),
        }),
      /client_dashboard_remote_route_forbidden/,
    );
  });


  it("rejects a missing or padded server project binding", () => {
    assert.throws(
      () =>
        buildGatedClientDashboard({
          access: { role: "client", boundProjectId: "  ", reportingConfigured: true },
          site: "example.com",
          periodLabel: "2026-09-01..2026-09-28",
          sections: [section({})],
        }),
      /client_supplied_scope_rejected/,
    );
  });

  it("does not widen a keyword-restricted grant into acquisition", () => {
    const view = buildGatedClientDashboard({
      access: { role: "client", boundProjectId: "project-a", reportingConfigured: true },
      site: "example.com",
      periodLabel: "2026-09-01..2026-09-28",
      grants: ["search"],
      sections: [
        section({ key: "search" }),
        section({ key: "acquisition", metrics: [{ name: "organic", value: 9, provenance: "first_party", provider: "ga4", dataDate: "2026-09-27" }] }),
      ],
      now: NOW,
    });
    assert.deepEqual(view.sections.map((item) => item.key), ["search"]);
    assert.equal(view.acquisitionStatus, null);
    assert.equal(view.channels.organic.length, 0);
  });
  it("strips reason codes and provider health from the client role", () => {
    const view = buildGatedClientDashboard({
      access: { role: "client", boundProjectId: "project-a", requestedProjectId: "project-a", reportingConfigured: true },
      site: "example.com",
      periodLabel: "2026-09-01..2026-09-28",
      grants: ["search", "providerHealth"],
      sections: [
        section({ reasonCode: "quota_state_internal", warning: "bearer secret-token" }),
        section({ key: "providerHealth", status: "degraded", reasonCode: "sync_ledger" }),
      ],
      now: NOW,
    });
    assert.equal(view.projectId, "project-a");
    assert.equal(view.sections.some((item) => item.key === "providerHealth"), false);
    assert.equal(view.sections.every((item) => item.reasonCode === null), true);
    assert.equal(view.sections[0]?.warning?.includes("secret-token"), false);
  });
});
