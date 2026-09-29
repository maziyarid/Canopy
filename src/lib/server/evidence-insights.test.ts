import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InsightStore,
  InsightValidationError,
  approveForClient,
  createInsight,
  editManualInsight,
  type EvidenceRef,
  type InsightDraft,
} from "./evidence-insights.ts";

const gscRef: EvidenceRef = {
  provider: "gsc",
  provenance: "first_party",
  kind: "query",
  query: "seo report",
  page: "/blog",
  site: "https://example.com/",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-28",
  value: 120,
};

const mangoolsRef: EvidenceRef = {
  provider: "mangools",
  provenance: "third_party_estimate",
  kind: "metric",
  metricName: "kd",
  site: "https://example.com/",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-28",
  value: 38,
};

function baseDraft(over: Partial<InsightDraft> = {}): InsightDraft {
  return {
    projectId: "proj_a",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-28",
    type: "observation",
    title: "Organic queries rose",
    body: "Observed GSC clicks increased for seo report.",
    evidenceRefs: [gscRef],
    generatedBy: "assistant:sg1",
    ...over,
  };
}

describe("AAX-82 evidence-linked insights", () => {
  it("rejects generated claims without evidenceRefs", () => {
    assert.throws(() => createInsight(baseDraft({ evidenceRefs: [] })), InsightValidationError);
  });

  it("rejects blending first-party GSC with third-party estimates", () => {
    assert.throws(
      () => createInsight(baseDraft({ evidenceRefs: [gscRef, mangoolsRef] })),
      /cannot be blended/,
    );
  });

  it("rejects metric evidence that has no identifying details", () => {
    assert.throws(
      () =>
        createInsight(
          baseDraft({
            evidenceRefs: [{ provider: "gsc", provenance: "first_party", kind: "metric" }],
          }),
        ),
      /metric evidence requires/,
    );
  });

  it("snapshots evidence so later draft mutation cannot change provenance", () => {
    const mutable: EvidenceRef = { ...gscRef };
    const insight = createInsight(baseDraft({ evidenceRefs: [mutable] }));
    mutable.provider = "mangools";
    mutable.provenance = "third_party_estimate";
    mutable.kind = "metric";
    mutable.metricName = "kd";
    assert.equal(insight.provenance, "first_party");
    assert.equal(insight.evidenceRefs[0].provider, "gsc");
    const approved = approveForClient(insight, "human:editor");
    assert.equal(approved.provenance, "first_party");
    assert.equal(approved.evidenceRefs[0].provider, "gsc");
  });

  it("keeps first-party observation client-hidden until approved", () => {
    const store = new InsightStore();
    const draft = store.put(createInsight(baseDraft()));
    assert.equal(store.listForProject("proj_a", "client").length, 0);
    store.put(approveForClient(draft, "human:editor"));
    const visible = store.listForProject("proj_a", "client");
    assert.equal(visible.length, 1);
    assert.equal(visible[0].reviewState, "approved");
    assert.equal(visible[0].linkedTaskId, null);
    assert.equal(visible[0].generatedBy, "assistant");
    assert.equal(visible[0].reviewedBy, "reviewer");
  });

  it("does not leak another project insight", () => {
    const store = new InsightStore();
    store.put(createInsight(baseDraft({ projectId: "proj_b" })));
    assert.equal(store.listForProject("proj_a", "owner").length, 0);
  });

  it("allows a third-party estimate insight when evidence is estimate-only", () => {
    const insight = createInsight(
      baseDraft({
        type: "hypothesis",
        title: "Keyword difficulty estimate",
        body: "Likely competitive based on Mangools KD only.",
        evidenceRefs: [mangoolsRef],
        limitation: "Third-party estimate; not a first-party fact.",
      }),
    );
    assert.equal(insight.provenance, "third_party_estimate");
  });

  it("does not approve a rejected insight", () => {
    const rejected = { ...createInsight(baseDraft()), reviewState: "rejected" as const };
    assert.throws(() => approveForClient(rejected, "human:editor"), /rejected insights cannot be approved/);
  });

  it("does not invent numeric facts inside the model", () => {
    const insight = createInsight(baseDraft());
    assert.equal(insight.evidenceRefs[0].value, 120);
    assert.match(insight.limitation, /not proven/i);
  });

  it("groups visible insights into a dated journal newest first", () => {
    const store = new InsightStore();
    const older = store.put(
      createInsight(baseDraft({ title: "Older note" }), new Date("2026-09-20T10:00:00Z")),
    );
    store.put(approveForClient(older, "human:editor"));
    const newer = store.put(
      createInsight(baseDraft({ title: "Newer note" }), new Date("2026-09-28T08:00:00Z")),
    );
    store.put(approveForClient(newer, "human:editor"));
    store.put(
      createInsight(
        baseDraft({ title: "Internal only", visibility: "internal" }),
        new Date("2026-09-28T12:00:00Z"),
      ),
    );
    const journal = store.journalForProject("proj_a", "client");
    assert.deepEqual(
      journal.map((day) => day.date),
      ["2026-09-28", "2026-09-20"],
    );
    assert.deepEqual(
      journal[0].insights.map((row) => row.title),
      ["Newer note"],
    );
    assert.equal(journal[1].insights[0].title, "Older note");
  });

  it("preserves audit metadata when editing a manual note", () => {
    const store = new InsightStore();
    const original = store.put(
      createInsight(
        baseDraft({
          generatedBy: "human:client-admin",
          title: "Manual note",
          body: "First draft body.",
        }),
      ),
    );
    assert.equal(original.editHistory.length, 0);
    const edited = store.put(
      editManualInsight(original, { body: "Revised body." }, "human:client-admin", new Date("2026-09-29T01:00:00Z")),
    );
    assert.equal(edited.id, original.id);
    assert.equal(edited.generatedBy, "human:client-admin");
    assert.equal(edited.generatedAt, original.generatedAt);
    assert.equal(edited.body, "Revised body.");
    assert.equal(edited.editHistory.length, 1);
    assert.equal(edited.editHistory[0].previousBody, "First draft body.");
    assert.equal(edited.editHistory[0].editedBy, "human:client-admin");
    assert.throws(
      () => editManualInsight(createInsight(baseDraft()), { body: "nope" }, "human:editor"),
      /human-authored/,
    );
  });
});
