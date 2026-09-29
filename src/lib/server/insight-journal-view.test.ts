import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InsightStore,
  approveForClient,
  createInsight,
  type EvidenceRef,
  type InsightDraft,
} from "./evidence-insights.ts";
import { buildInsightJournalView, insightsBesideMetric } from "./insight-journal-view.ts";

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
    title: "Clicks rose",
    body: "Observed GSC clicks increased.",
    evidenceRefs: [clicks],
    generatedBy: "assistant:sg1",
    ...over,
  };
}

describe("AAX-82 insight journal view-model", () => {
  it("places notes beside the matching metric and in a dated journal", () => {
    const store = new InsightStore();
    const first = store.put(
      approveForClient(
        createInsight(draft(), new Date("2026-09-20T10:00:00Z")),
        "human:editor",
      ),
    );
    store.put(
      approveForClient(
        createInsight(
          draft({
            title: "Impressions note",
            evidenceRefs: [{ ...clicks, metricName: "impressions", value: 900 }],
          }),
          new Date("2026-09-28T08:00:00Z"),
        ),
        "human:editor",
      ),
    );

    const listed = store.listForProject("proj_a", "client");
    const besideClicks = insightsBesideMetric(listed, "clicks");
    assert.equal(besideClicks.length, 1);
    assert.equal(besideClicks[0].id, first.id);

    const view = buildInsightJournalView(store.journalForProject("proj_a", "client"));
    assert.deepEqual(
      view.days.map((day) => day.date),
      ["2026-09-28", "2026-09-20"],
    );
    assert.equal(view.days[0].cards[0].title, "Impressions note");
    assert.deepEqual(view.days[0].cards[0].metricNames, ["impressions"]);
    assert.equal(view.days[1].cards[0].evidenceCount, 1);
    assert.match(view.days[1].cards[0].limitation, /not proven/i);
  });

  it("does not attach another project's notes to a metric", () => {
    const store = new InsightStore();
    store.put(approveForClient(createInsight(draft({ projectId: "proj_b" })), "human:editor"));
    const listed = store.listForProject("proj_a", "owner");
    assert.equal(insightsBesideMetric(listed, "clicks").length, 0);
    assert.equal(buildInsightJournalView(store.journalForProject("proj_a", "owner")).days.length, 0);
  });
});
