import { describe, it, expect } from "vitest";
import {
  planOperationalRetention,
  RetentionRefused,
  OPERATIONAL_DOMAINS,
} from "./operational-retention";

describe("planOperationalRetention", () => {
  it("returns a dry-run plan for operational domains and never executes", () => {
    for (const domain of OPERATIONAL_DOMAINS) {
      const plan = planOperationalRetention({
        dataDomain: domain,
        mode: "dry-run",
        candidateRows: 7,
      });
      expect(plan).toEqual({
        action: "none",
        executed: false,
        dataDomain: domain,
        mode: "dry-run",
        candidateRows: 7,
        medicalRetentionActivated: false,
      });
    }
  });

  it("refuses execute/apply modes", () => {
    expect(() =>
      planOperationalRetention({
        dataDomain: "thesis",
        mode: "execute",
        candidateRows: 1,
      }),
    ).toThrow(RetentionRefused);
    expect(() =>
      planOperationalRetention({
        dataDomain: "other",
        mode: "apply",
        candidateRows: 1,
      }),
    ).toThrow(/retention_execution_disabled/);
  });

  it("refuses medical and unknown domains", () => {
    expect(() =>
      planOperationalRetention({
        dataDomain: "medical",
        mode: "dry-run",
        candidateRows: 1,
      }),
    ).toThrow(/retention_refused_domain/);
    expect(() =>
      planOperationalRetention({
        dataDomain: "unknown",
        mode: "dry-run",
        candidateRows: 1,
      }),
    ).toThrow(RetentionRefused);
  });

  it("normalises case and whitespace then refuses non-operational", () => {
    expect(() =>
      planOperationalRetention({
        dataDomain: "  MEDICAL  ",
        mode: "dry-run",
        candidateRows: 0,
      }),
    ).toThrow(/retention_refused_domain/);
  });

  it("fails closed on invalid row counts", () => {
    expect(() =>
      planOperationalRetention({
        dataDomain: "thesis",
        mode: "dry-run",
        candidateRows: -1,
      }),
    ).toThrow(/retention_row_count_invalid/);
    expect(() =>
      planOperationalRetention({
        dataDomain: "other",
        mode: "dry-run",
        candidateRows: 1.5,
      }),
    ).toThrow(RetentionRefused);
  });
});
