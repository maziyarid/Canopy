import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InsightStore,
  InsightValidationError,
  approveForClient,
  createInsight,
  editManualInsight,
  normalizeRecommendationSafety,
  type EvidenceRef,
  type InsightDraft,
  type InsightRecord,
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


  it("requires a concrete action for recommendation records", () => {
    assert.throws(
      () =>
        createInsight(
          baseDraft({
            type: "recommendation",
            title: "Improve the landing page",
            body: "Evidence supports a review of the landing page.",
          }),
        ),
      /require a concrete recommendedAction/,
    );
  });

  it("keeps recommendations proposal-only through approval", () => {
    const recommendation = createInsight(
      baseDraft({
        type: "recommendation",
        title: "Review the landing page",
        body: "Observed search evidence supports a manual landing-page review.",
        recommendedAction: "  Review copy and internal links before any production change.  ",
      }),
    );
    assert.equal(recommendation.recommendedAction, "Review copy and internal links before any production change.");
    assert.equal(recommendation.recommendationDisposition, "proposal_only");

    const approved = approveForClient(recommendation, "human:editor");
    assert.equal(approved.recommendationDisposition, "proposal_only");
    assert.equal(approved.reviewState, "approved");
  });

  it("normalizes legacy recommendation records to proposal-only", () => {
    const current = createInsight(
      baseDraft({
        type: "recommendation",
        recommendedAction: "Review the page manually.",
      }),
    );
    const legacy = { ...current } as Partial<InsightRecord>;
    delete legacy.recommendationDisposition;
    const normalized = normalizeRecommendationSafety(legacy as InsightRecord);
    assert.equal(normalized.recommendationDisposition, "proposal_only");
  });


  it("does not approve a legacy recommendation until an action is supplied", () => {
    const current = createInsight(
      baseDraft({
        type: "recommendation",
        recommendedAction: "Review the page manually.",
      }),
    );
    const legacy = {
      ...current,
      recommendedAction: null,
      recommendationDisposition: undefined,
    } as unknown as InsightRecord;
    assert.throws(
      () => approveForClient(legacy, "human:editor"),
      /before approval/,
    );
  });


  it("keeps an already-approved actionless legacy recommendation out of client reads", () => {
    const store = new InsightStore();
    const current = createInsight(
      baseDraft({
        type: "recommendation",
        recommendedAction: "Review the page manually.",
      }),
    );
    const legacy = {
      ...current,
      recommendedAction: null,
      recommendationDisposition: undefined,
      reviewState: "approved",
      visibility: "client",
      reviewedBy: "human:legacy-reviewer",
    } as unknown as InsightRecord;
    store.put(legacy);
    assert.equal(store.listForProject("proj_a", "client").length, 0);
    assert.equal(store.listForProject("proj_a", "owner").length, 1);
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

  it("revokes client approval when an approved manual note is edited", () => {
    const store = new InsightStore();
    const original = store.put(
      approveForClient(
        createInsight(
          baseDraft({
            generatedBy: "human:client-admin",
            title: "Approved note",
            body: "Reviewed body.",
            visibility: "client",
          }),
        ),
        "human:editor",
      ),
    );
    assert.equal(store.listForProject("proj_a", "client").length, 1);
    const edited = store.put(
      editManualInsight(original, { body: "Unreviewed replacement." }, "human:client-admin"),
    );
    assert.equal(edited.reviewState, "pending_review");
    assert.equal(edited.reviewedBy, null);
    assert.equal(edited.visibility, "internal");
    assert.equal(store.listForProject("proj_a", "client").length, 0);
    assert.equal(store.listForProject("proj_a", "editor")[0].body, "Unreviewed replacement.");
  });

  it("does not expose pre-approval draft text in the client listing", () => {
    const store = new InsightStore();
    const draft = store.put(
      createInsight(
        baseDraft({
          generatedBy: "human:client-admin",
          title: "Draft title",
          body: "Unapproved draft body.",
        }),
      ),
    );
    const edited = store.put(editManualInsight(draft, { title: "Final title", body: "Final body." }, "human:client-admin"));
    store.put(approveForClient(edited, "human:editor"));
    const visible = store.listForProject("proj_a", "client");
    assert.equal(visible.length, 1);
    assert.equal(visible[0].title, "Final title");
    assert.equal(visible[0].body, "Final body.");
    assert.equal(visible[0].editHistory.length, 0);
    assert.equal(store.listForProject("proj_a", "editor")[0].editHistory[0].previousBody, "Unapproved draft body.");
  });
});
