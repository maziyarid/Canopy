import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySectionFreshness,
  buildClientReportView,
  classifyChannel,
  clientLabelForStatus,
  freshnessStatus,
  groupAcquisitionChannels,
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

  it("does not mark unavailable sections stale", () => {
    const next = applySectionFreshness(
      section({ status: "unavailable", lastSyncAt: "2026-01-01T00:00:00Z" }),
      "ga4",
      NOW,
    );
    assert.equal(next.status, "unavailable");
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

  it("maps degraded internals to a plain unavailable client label", () => {
    assert.equal(clientLabelForStatus("degraded"), "unavailable");
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
    assert.equal(view.projectId, "proj_a");
  });

  it("redacts credential-shaped strings", () => {
    assert.equal(redactClientText("api_key=sk_live_example"), "api_key=<redacted>");
  });
});
