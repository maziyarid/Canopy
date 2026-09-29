import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approveForClient, createInsight, type EvidenceRef, type InsightDraft } from "./evidence-insights.ts";
import { mountInsightJournal } from "./insight-journal-mount.ts";
import type { ReportingSnapshotLike } from "./snapshot-insight-adapter.ts";

const clicks: EvidenceRef = {
  provider: "gsc",
  provenance: "first_party",
  kind: "metric",
  metricName: "clicks",
  site: "https://example.com/",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-28",
  value: 120,
};

function draft(over: Partial<InsightDraft> = {}): InsightDraft {
  return {
    projectId: "proj_a",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-28",
    type: "observation",
    title: "Approved clicks note",
    body: "Reviewed GSC clicks note.",
    evidenceRefs: [clicks],
    generatedBy: "human:editor",
    ...over,
  };
}

const snapshot: ReportingSnapshotLike = {
  projectId: "proj_a",
  site: "https://example.com/",
  period: { start: "2026-09-01", end: "2026-09-28" },
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
          dataDate: "2026-09-27",
        },
      ],
    },
    {
      key: "acquisition",
      status: "unavailable",
      metrics: [{ name: "sessions", value: null, provenance: "first_party", provider: "ga4", dataDate: null }],
    },
  ],
};

describe("AAX-82 insight journal mount", () => {
  it("hides snapshot-generated drafts from clients until approved", () => {
    const model = mountInsightJournal({
      snapshot,
      role: "client",
      now: new Date("2026-09-28T12:00:00Z"),
    });
    assert.equal(model.journal.days.length, 0);
    assert.equal(model.beside.length, 0);
    assert.match(model.warnings[0] ?? "", /GA4 is unavailable/);
  });

  it("shows approved notes beside the matching snapshot metric for clients", () => {
    const approved = approveForClient(
      createInsight(draft(), new Date("2026-09-20T10:00:00Z")),
      "human:editor",
    );
    const model = mountInsightJournal({
      insights: [approved],
      snapshot,
      role: "client",
      now: new Date("2026-09-28T12:00:00Z"),
    });
    assert.equal(model.journal.days.length, 1);
    assert.equal(model.journal.days[0].cards[0].title, "Approved clicks note");
    assert.equal(model.beside.length, 1);
    assert.equal(model.beside[0].metricName, "clicks");
    assert.equal(model.beside[0].cards[0].id, approved.id);
  });

  it("lets editors see snapshot observations without blending GA4 estimates", () => {
    const model = mountInsightJournal({
      snapshot,
      role: "editor",
      now: new Date("2026-09-28T12:00:00Z"),
    });
    const titles = model.journal.days.flatMap((day) => day.cards.map((card) => card.title));
    assert.ok(titles.some((title) => /Search Console clicks/i.test(title)));
    assert.ok(titles.some((title) => /GA4 section unavailable/i.test(title)));
    assert.equal(
      model.journal.days.flatMap((day) => day.cards).some((card) => /sessions=/.test(card.body)),
      false,
    );
  });

  it("does not place another site note beside this snapshot metric", () => {
    const other = approveForClient(
      createInsight(
        draft({
          title: "Other site",
          evidenceRefs: [{ ...clicks, site: "https://other.example/" }],
        }),
      ),
      "human:editor",
    );
    const model = mountInsightJournal({
      insights: [other],
      snapshot,
      role: "client",
    });
    assert.equal(model.beside.length, 0);
  });

  it("drops approved notes from a different project before journal or beside placement", () => {
    const foreign = approveForClient(
      createInsight(
        draft({
          projectId: "proj_b",
          title: "Foreign project clicks",
          body: "Must not appear on project A journal.",
        }),
        new Date("2026-09-20T10:00:00Z"),
      ),
      "human:editor",
    );
    const local = approveForClient(
      createInsight(draft({ title: "Local clicks" }), new Date("2026-09-20T11:00:00Z")),
      "human:editor",
    );
    const model = mountInsightJournal({
      insights: [foreign, local],
      snapshot,
      role: "client",
    });
    const titles = model.journal.days.flatMap((day) => day.cards.map((card) => card.title));
    assert.deepEqual(titles, ["Local clicks"]);
    assert.equal(model.beside.every((row) => row.cards.every((card) => card.title !== "Foreign project clicks")), true);
  });

  it("does not place a note beside a named metric with a null value", () => {
    const approved = approveForClient(
      createInsight(
        draft({
          title: "Sessions note",
          evidenceRefs: [{ ...clicks, metricName: "sessions", value: 40 }],
        }),
      ),
      "human:editor",
    );
    const model = mountInsightJournal({
      insights: [approved],
      snapshot,
      role: "client",
    });
    assert.equal(model.beside.some((row) => row.metricName === "sessions"), false);
    const titles = model.journal.days.flatMap((day) => day.cards.map((card) => card.title));
    assert.ok(titles.includes("Sessions note"));
  });

  it("keeps the GA4 warning when one GA4 section is unavailable even if another is ok with a null metric", () => {
    const mixed: ReportingSnapshotLike = {
      ...snapshot,
      sections: [
        snapshot.sections[0],
        {
          key: "acquisition",
          status: "unavailable",
          metrics: [{ name: "sessions", value: null, provenance: "first_party", provider: "ga4", dataDate: null }],
        },
        {
          key: "engagement",
          status: "ok",
          metrics: [{ name: "engagedSessions", value: null, provenance: "first_party", provider: "ga4", dataDate: null }],
        },
      ],
    };
    const model = mountInsightJournal({
      snapshot: mixed,
      role: "editor",
      now: new Date("2026-09-28T12:00:00Z"),
    });
    const titles = model.journal.days.flatMap((day) => day.cards.map((card) => card.title));
    assert.ok(titles.some((title) => /GA4 section unavailable/i.test(title)));
    assert.match(model.warnings[0] ?? "", /GA4 is unavailable/);
  });
});
