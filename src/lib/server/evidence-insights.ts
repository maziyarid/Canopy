export type InsightKind = "observation" | "anomaly" | "hypothesis" | "recommendation";
export type InsightProvenance = "first_party" | "third_party_estimate" | "mixed_blocked";
export type InsightVisibility = "internal" | "client" | "restricted";
export type InsightReviewState = "draft" | "pending_review" | "approved" | "rejected";
export type RecommendationDisposition = "proposal_only";
export type EvidenceProvider = "gsc" | "ga4" | "mangools" | "other";
export type EvidenceKind = "metric" | "query" | "page" | "snapshot";

export type InsightRole = "owner" | "editor" | "client" | "service";

export interface EvidenceRef {
  provider: EvidenceProvider;
  provenance: "first_party" | "third_party_estimate";
  kind: EvidenceKind;
  metricName?: string;
  query?: string;
  page?: string;
  site?: string;
  periodStart?: string;
  periodEnd?: string;
  snapshotId?: string;
  value?: number | string | null;
  /** Measurement date when distinct from the reporting window periodStart/periodEnd. */
  dataDate?: string;
  coverage?: { start: string; end: string; complete: boolean; observedDates: string[] };
}

export interface InsightDraft {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  type: InsightKind;
  title: string;
  body: string;
  evidenceRefs: readonly EvidenceRef[];
  confidence?: number;
  limitation?: string;
  recommendedAction?: string;
  generatedBy: string;
  visibility?: InsightVisibility;
}

export interface InsightEditEntry {
  editedAt: string;
  editedBy: string;
  previousTitle: string;
  previousBody: string;
}

export interface InsightRecord {
  id: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  type: InsightKind;
  title: string;
  body: string;
  evidenceRefs: readonly EvidenceRef[];
  provenance: InsightProvenance;
  confidence: number;
  limitation: string;
  recommendedAction: string | null;
  recommendationDisposition: RecommendationDisposition | null;
  generatedBy: string;
  generatedAt: string;
  reviewedBy: string | null;
  reviewState: InsightReviewState;
  visibility: InsightVisibility;
  linkedTaskId: string | null;
  editHistory: readonly InsightEditEntry[];
}

export interface InsightJournalDay {
  date: string;
  insights: InsightRecord[];
}

export class InsightValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsightValidationError";
  }
}

const FIRST_PARTY: ReadonlySet<EvidenceProvider> = new Set(["gsc", "ga4"]);

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function cloneEvidenceRefs(refs: readonly EvidenceRef[]): EvidenceRef[] {
  return refs.map((ref) => ({ ...ref }));
}

export function assertIdentifiableEvidence(ref: EvidenceRef): void {
  const hasMetric = hasText(ref.metricName);
  const hasQuery = hasText(ref.query);
  const hasPage = hasText(ref.page);
  const hasSnapshot = hasText(ref.snapshotId);
  const hasSitePeriod = hasText(ref.site) && hasText(ref.periodStart) && hasText(ref.periodEnd);

  switch (ref.kind) {
    case "metric":
      if (!hasMetric || !(hasSitePeriod || hasSnapshot || hasQuery || hasPage)) {
        throw new InsightValidationError(
          "metric evidence requires metricName plus a site/period, snapshot, query, or page identifier",
        );
      }
      break;
    case "query":
      if (!hasQuery) {
        throw new InsightValidationError("query evidence requires a query identifier");
      }
      break;
    case "page":
      if (!hasPage) {
        throw new InsightValidationError("page evidence requires a page identifier");
      }
      break;
    case "snapshot":
      if (!hasSnapshot) {
        throw new InsightValidationError("snapshot evidence requires snapshotId");
      }
      break;
    default:
      throw new InsightValidationError("unknown evidence kind");
  }
}

export function classifyProvenance(refs: readonly EvidenceRef[]): InsightProvenance {
  const kinds = new Set(refs.map((ref) => ref.provenance));
  if (kinds.has("first_party") && kinds.has("third_party_estimate")) {
    return "mixed_blocked";
  }
  if (kinds.has("third_party_estimate")) return "third_party_estimate";
  return "first_party";
}


export function normalizeRecommendationSafety(insight: InsightRecord): InsightRecord {
  const disposition: RecommendationDisposition | null =
    insight.type === "recommendation" ? "proposal_only" : null;
  if (insight.recommendationDisposition === disposition) return insight;
  return { ...insight, recommendationDisposition: disposition };
}


export function recommendationCanBeClientVisible(insight: InsightRecord): boolean {
  if (insight.type !== "recommendation") return true;
  const safeInsight = normalizeRecommendationSafety(insight);
  return (
    Boolean(safeInsight.recommendedAction?.trim()) &&
    safeInsight.recommendationDisposition === "proposal_only"
  );
}


export function assertRecommendationReadyForApproval(insight: InsightRecord): void {
  if (insight.type !== "recommendation") return;
  if (!insight.recommendedAction?.trim()) {
    throw new InsightValidationError(
      "recommendations require a concrete recommendedAction before approval",
    );
  }
  if (!recommendationCanBeClientVisible(normalizeRecommendationSafety(insight))) {
    throw new InsightValidationError("recommendations must remain proposal_only");
  }
}

export function assertCompatibleEvidence(refs: readonly EvidenceRef[]): void {
  if (!refs.length) {
    throw new InsightValidationError("generated claims require at least one evidenceRef");
  }
  for (const ref of refs) {
    assertIdentifiableEvidence(ref);
    if (FIRST_PARTY.has(ref.provider) && ref.provenance !== "first_party") {
      throw new InsightValidationError(`${ref.provider} evidence must be first_party`);
    }
    if (ref.provider === "mangools" && ref.provenance !== "third_party_estimate") {
      throw new InsightValidationError("mangools evidence must be third_party_estimate");
    }
  }
  if (classifyProvenance(refs) === "mixed_blocked") {
    throw new InsightValidationError(
      "first-party facts cannot be blended with third-party estimates in one insight",
    );
  }
}

export function clientMaySee(insight: InsightRecord, role: InsightRole): boolean {
  if (role === "owner" || role === "editor") return true;
  if (role === "service") return insight.visibility !== "restricted";
  return (
    insight.visibility === "client" &&
    insight.reviewState === "approved" &&
    recommendationCanBeClientVisible(insight)
  );
}

export function redactInsightForRole(insight: InsightRecord, role: InsightRole): InsightRecord | null {
  if (!clientMaySee(insight, role)) return null;
  const safeInsight = normalizeRecommendationSafety(insight);
  if (role !== "client") return safeInsight;
  return {
    ...safeInsight,
    generatedBy: safeInsight.generatedBy.startsWith("human:") ? "human" : "assistant",
    reviewedBy: safeInsight.reviewedBy ? "reviewer" : null,
    linkedTaskId: null,
    // Draft/previous text is operator audit only. Clients see the approved body.
    editHistory: Object.freeze([]),
  };
}

let seq = 0;

export function createInsight(draft: InsightDraft, now = new Date()): InsightRecord {
  assertCompatibleEvidence(draft.evidenceRefs);
  if (!draft.projectId.trim()) {
    throw new InsightValidationError("projectId is required");
  }
  if (!draft.title.trim() || !draft.body.trim()) {
    throw new InsightValidationError("title and body are required");
  }
  const evidenceRefs = Object.freeze(cloneEvidenceRefs(draft.evidenceRefs));
  const confidence = draft.confidence ?? (draft.type === "observation" ? 0.8 : 0.4);
  const recommendedAction = draft.recommendedAction?.trim() || null;
  if (draft.type === "recommendation" && !recommendedAction) {
    throw new InsightValidationError("recommendations require a concrete recommendedAction");
  }
  seq += 1;
  return {
    id: `ins_${seq.toString().padStart(4, "0")}`,
    projectId: draft.projectId,
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    type: draft.type,
    title: draft.title,
    body: draft.body,
    evidenceRefs,
    provenance: classifyProvenance(evidenceRefs),
    confidence,
    limitation: draft.limitation ?? "Causality is not proven; treat as observed or likely.",
    recommendedAction,
    recommendationDisposition: draft.type === "recommendation" ? "proposal_only" : null,
    generatedBy: draft.generatedBy,
    generatedAt: now.toISOString(),
    reviewedBy: null,
    reviewState: "draft",
    visibility: draft.visibility ?? "internal",
    linkedTaskId: null,
    editHistory: Object.freeze([]),
  };
}

export function isManualInsight(insight: InsightRecord): boolean {
  return insight.generatedBy.startsWith("human:");
}

export function editManualInsight(
  insight: InsightRecord,
  patch: { title?: string; body?: string },
  editorId: string,
  now = new Date(),
): InsightRecord {
  if (!isManualInsight(insight)) {
    throw new InsightValidationError("only human-authored notes can be edited in place");
  }
  if (!editorId.trim()) {
    throw new InsightValidationError("editorId is required");
  }
  const title = patch.title !== undefined ? patch.title : insight.title;
  const body = patch.body !== undefined ? patch.body : insight.body;
  if (!title.trim() || !body.trim()) {
    throw new InsightValidationError("title and body are required");
  }
  if (title === insight.title && body === insight.body) {
    return insight;
  }
  const entry: InsightEditEntry = {
    editedAt: now.toISOString(),
    editedBy: editorId,
    previousTitle: insight.title,
    previousBody: insight.body,
  };
  const needsReReview = insight.reviewState === "approved" || insight.visibility === "client";
  return {
    ...insight,
    title,
    body,
    editHistory: Object.freeze([...insight.editHistory, entry]),
    reviewState: needsReReview ? "pending_review" : insight.reviewState,
    reviewedBy: needsReReview ? null : insight.reviewedBy,
    visibility: needsReReview && insight.visibility === "client" ? "internal" : insight.visibility,
  };
}

export function approveForClient(insight: InsightRecord, reviewerId: string): InsightRecord {
  if (insight.reviewState === "rejected") {
    throw new InsightValidationError("rejected insights cannot be approved without a new draft");
  }
  assertCompatibleEvidence(insight.evidenceRefs);
  const safeInsight = normalizeRecommendationSafety(insight);
  assertRecommendationReadyForApproval(safeInsight);
  return {
    ...safeInsight,
    evidenceRefs: Object.freeze(cloneEvidenceRefs(safeInsight.evidenceRefs)),
    provenance: classifyProvenance(safeInsight.evidenceRefs),
    reviewedBy: reviewerId,
    reviewState: "approved",
    visibility: "client",
  };
}

export class InsightStore {
  private readonly byId = new Map<string, InsightRecord>();

  put(insight: InsightRecord): InsightRecord {
    this.byId.set(insight.id, insight);
    return insight;
  }

  listForProject(projectId: string, role: InsightRole): InsightRecord[] {
    return [...this.byId.values()]
      .filter((row) => row.projectId === projectId)
      .map((row) => redactInsightForRole(row, role))
      .filter((row): row is InsightRecord => row !== null)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  journalForProject(projectId: string, role: InsightRole): InsightJournalDay[] {
    const byDay = new Map<string, InsightRecord[]>();
    for (const insight of this.listForProject(projectId, role)) {
      const day = insight.generatedAt.slice(0, 10);
      const bucket = byDay.get(day) ?? [];
      bucket.push(insight);
      byDay.set(day, bucket);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, insights]) => ({ date, insights }));
  }
}
