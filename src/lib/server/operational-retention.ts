/**
 * Fail-closed operational retention planner for AAX-55.
 *
 * This module never deletes rows and never activates medical retention.
 * A caller may request a dry-run count for thesis/other domains only.
 * Any execute/apply mode, unknown domain, or medical domain fails closed.
 */

export const OPERATIONAL_DOMAINS = new Set(["thesis", "other"] as const);

export class RetentionRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetentionRefused";
  }
}

export interface RetentionPlan {
  action: "none";
  executed: false;
  dataDomain: string;
  mode: "dry-run";
  candidateRows: number;
  medicalRetentionActivated: false;
}

export function planOperationalRetention(input: {
  dataDomain: string;
  mode: string;
  candidateRows: number;
}): RetentionPlan {
  const domain = String(input.dataDomain || "").trim().toLowerCase();
  const requested = String(input.mode || "").trim().toLowerCase();
  if (domain === "medical" || !OPERATIONAL_DOMAINS.has(domain as any)) {
    throw new RetentionRefused("retention_refused_domain");
  }
  if (requested !== "dry-run") {
    throw new RetentionRefused("retention_execution_disabled");
  }
  if (
    typeof input.candidateRows !== "number" ||
    !Number.isInteger(input.candidateRows) ||
    input.candidateRows < 0
  ) {
    throw new RetentionRefused("retention_row_count_invalid");
  }
  return {
    action: "none",
    executed: false,
    dataDomain: domain,
    mode: "dry-run",
    candidateRows: input.candidateRows,
    medicalRetentionActivated: false,
  };
}
