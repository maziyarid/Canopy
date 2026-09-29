import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftsFromSnapshot, insightsFromSnapshot, type ReportingSnapshotLike } from "./snapshot-insight-adapter.ts";

function gscOnlyUnavailableGa4(): ReportingSnapshotLike {
  return {
    projectId: "proj_a",
    site: "https://example.com/",
    period: { start: "2026-09-01", end: "2026-09-28", label: "last_28d" },
    sections: [
      {
        key: "search",
        status: "ok",
        metrics: [
          { name: "clicks", value: 120, provenance: "first_party", provider: "gsc", dataDate: "2026-09-28" },
          { name: "impressions", value: 900, provenance: "first_party", provider: "gsc", dataDate: "2026-09-28" },
        ],
      },
      { key: "acquisition", status: "unavailable", warning: "GA4 not configured", metrics: [] },
    ],
  };
}

describe("AAX-82 snapshot-to-insight adapter", () => {
  it("builds GSC observations from first-party snapshot metrics only", () => {
    const insights = insightsFromSnapshot(gscOnlyUnavailableGa4(), "assistant:snapshot", new Date("2026-09-29T06:30:00Z"));
    const gsc = insights.find((row) => row.title.includes("Search Console"));
    assert.ok(gsc);
    assert.equal(gsc.provenance, "first_party");
    assert.equal(gsc.evidenceRefs.every((ref) => ref.provider === "gsc"), true);
    assert.equal(gsc.evidenceRefs[0]?.value, 120);
    assert.match(gsc.body, /clicks=120/);
  });

  it("keeps GSC usable when GA4 is unavailable and cites GA4 snapshot evidence only", () => {
    const insights = insightsFromSnapshot(gscOnlyUnavailableGa4());
    assert.ok(insights.some((row) => row.title.includes("Search Console")));
    const ga4Note = insights.find((row) => row.title.includes("GA4"));
    assert.ok(ga4Note);
    assert.match(ga4Note.body, /unavailable/i);
    assert.equal(ga4Note.evidenceRefs.length, 1);
    assert.equal(ga4Note.evidenceRefs[0]?.provider, "ga4");
    assert.equal(ga4Note.evidenceRefs[0]?.kind, "snapshot");
    assert.match(ga4Note.evidenceRefs[0]?.snapshotId ?? "", /:ga4:/);
  });

  it("does not invent a GA4 unavailable claim when the snapshot has no GA4 section", () => {
    const insights = insightsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        {
          key: "search",
          status: "ok",
          metrics: [{ name: "clicks", value: 40, provenance: "first_party", provider: "gsc", dataDate: "2026-09-10" }],
        },
      ],
    });
    assert.equal(insights.some((row) => /GA4/i.test(row.title) || /GA4/i.test(row.body)), false);
  });

  it("does not emit third-party estimate metrics as first-party facts", () => {
    const drafts = draftsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        {
          key: "seo",
          status: "ok",
          metrics: [{ name: "kd", value: 38, provenance: "third_party_estimate", provider: "mangools", dataDate: "2026-09-28" }],
        },
      ],
    });
    assert.equal(drafts.some((draft) => draft.evidenceRefs.some((ref) => ref.provider === "mangools")), false);
  });

  it("keeps the reporting window for journal placement and preserves metric dataDate", () => {
    const insights = insightsFromSnapshot(gscOnlyUnavailableGa4());
    const gsc = insights.find((row) => row.title.includes("Search Console"));
    assert.equal(gsc?.evidenceRefs[0]?.site, "https://example.com/");
    assert.equal(gsc?.evidenceRefs[0]?.periodStart, "2026-09-01");
    assert.equal(gsc?.evidenceRefs[0]?.periodEnd, "2026-09-28");
    assert.equal(gsc?.evidenceRefs[0]?.dataDate, "2026-09-28");
  });

  it("preserves distinct in-window measurement dates on same-named metrics", () => {
    const insights = insightsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        {
          key: "search",
          status: "ok",
          metrics: [
            { name: "clicks", value: 10, provenance: "first_party", provider: "gsc", dataDate: "2026-09-12" },
            { name: "clicks", value: 20, provenance: "first_party", provider: "gsc", dataDate: "2026-09-27" },
          ],
        },
      ],
    });
    const gsc = insights.find((row) => row.title.includes("Search Console"));
    const dates = gsc?.evidenceRefs.map((ref) => ref.dataDate);
    assert.deepEqual(dates, ["2026-09-12", "2026-09-27"]);
    assert.equal(gsc?.evidenceRefs.every((ref) => ref.periodStart === "2026-09-01" && ref.periodEnd === "2026-09-28"), true);
  });

  it("drops metrics whose dataDate is outside the requested period", () => {
    const insights = insightsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        {
          key: "search",
          status: "ok",
          metrics: [{ name: "clicks", value: 999, provenance: "first_party", provider: "gsc", dataDate: "2026-08-15" }],
        },
      ],
    });
    assert.equal(insights.some((row) => row.title.includes("Search Console")), false);
  });

  it("keeps usable GA4 metrics when another GA4 section is unavailable", () => {
    const insights = insightsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        { key: "acquisition", status: "unavailable", metrics: [] },
        {
          key: "engagement",
          status: "ok",
          metrics: [{ name: "sessions", value: 44, provenance: "first_party", provider: "ga4", dataDate: "2026-09-12" }],
        },
      ],
    });
    const ga4Obs = insights.find((row) => row.title.includes("Observed GA4"));
    assert.ok(ga4Obs);
    assert.equal(ga4Obs.evidenceRefs[0]?.value, 44);
    assert.equal(ga4Obs.evidenceRefs[0]?.periodStart, "2026-09-01");
    assert.equal(ga4Obs.evidenceRefs[0]?.periodEnd, "2026-09-28");
    assert.equal(ga4Obs.evidenceRefs[0]?.dataDate, "2026-09-12");
    assert.equal(insights.some((row) => row.title === "GA4 section unavailable"), false);
  });

  it("does not treat empty GA4 no_data as unavailable", () => {
    const insights = insightsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        { key: "acquisition", status: "no_data", metrics: [] },
      ],
    });
    assert.equal(insights.some((row) => row.title === "GA4 section unavailable"), false);
    assert.equal(insights.some((row) => /unavailable/i.test(row.body ?? "")), false);
  });

  it("emits a GA4 unavailable warning when acquisition is unavailable and another GA4 section is empty no_data", () => {
    const insights = insightsFromSnapshot({
      projectId: "proj_a",
      site: "https://example.com/",
      period: { start: "2026-09-01", end: "2026-09-28" },
      sections: [
        { key: "acquisition", status: "unavailable", metrics: [] },
        { key: "engagement", status: "no_data", metrics: [] },
      ],
    });
    assert.equal(insights.some((row) => row.title === "GA4 section unavailable"), true);
    assert.equal(insights.some((row) => row.title.includes("Observed GA4")), false);
    const warning = insights.find((row) => row.title === "GA4 section unavailable");
    assert.equal(warning?.evidenceRefs[0]?.provider, "ga4");
    assert.equal(warning?.evidenceRefs[0]?.kind, "snapshot");
  });
});
