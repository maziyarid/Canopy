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
          {
            name: "clicks",
            value: 120,
            provenance: "first_party",
            provider: "gsc",
            dataDate: "2026-09-28",
          },
          {
            name: "impressions",
            value: 900,
            provenance: "first_party",
            provider: "gsc",
            dataDate: "2026-09-28",
          },
        ],
      },
      {
        key: "acquisition",
        status: "unavailable",
        warning: "GA4 not configured",
        metrics: [],
      },
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

  it("keeps GSC usable when GA4 is unavailable and does not invent GA4 numbers", () => {
    const insights = insightsFromSnapshot(gscOnlyUnavailableGa4());
    assert.ok(insights.some((row) => row.title.includes("Search Console")));
    const ga4Note = insights.find((row) => row.title.includes("GA4"));
    assert.ok(ga4Note);
    assert.match(ga4Note.body, /unavailable/i);
    assert.equal(
      ga4Note.evidenceRefs.some((ref) => ref.provider === "ga4"),
      false,
    );
    assert.equal(
      insights.some((row) => row.evidenceRefs.some((ref) => ref.provider === "ga4")),
      false,
    );
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
          metrics: [
            {
              name: "kd",
              value: 38,
              provenance: "third_party_estimate",
              provider: "mangools",
              dataDate: "2026-09-28",
            },
          ],
        },
      ],
    });
    assert.equal(
      drafts.some((draft) => draft.evidenceRefs.some((ref) => ref.provider === "mangools")),
      false,
    );
  });

  it("places snapshot evidence on the snapshot site and period", () => {
    const insights = insightsFromSnapshot(gscOnlyUnavailableGa4());
    const gsc = insights.find((row) => row.title.includes("Search Console"));
    assert.equal(gsc?.evidenceRefs[0]?.site, "https://example.com/");
    assert.equal(gsc?.evidenceRefs[0]?.periodStart, "2026-09-01");
    assert.equal(gsc?.evidenceRefs[0]?.periodEnd, "2026-09-28");
  });
});
