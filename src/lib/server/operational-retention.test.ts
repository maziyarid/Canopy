import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planOperationalRetention,
  RetentionRefused,
} from "./operational-retention.ts";

describe("AAX-55 operational retention planner", () => {
  it("dry-run does not execute for operational domains", () => {
    for (const domain of ["thesis", "other"] as const) {
      const plan = planOperationalRetention({
        dataDomain: domain,
        mode: "dry-run",
        candidateRows: 3,
      });
      assert.equal(plan.executed, false);
      assert.equal(plan.action, "none");
      assert.equal(plan.medicalRetentionActivated, false);
      assert.equal(plan.candidateRows, 3);
      assert.equal(plan.dataDomain, domain);
      assert.equal(plan.mode, "dry-run");
    }
  });

  it("medical domain is refused", () => {
    assert.throws(
      () =>
        planOperationalRetention({
          dataDomain: "medical",
          mode: "dry-run",
          candidateRows: 1,
        }),
      (err: unknown) =>
        err instanceof RetentionRefused &&
        err.message === "retention_refused_domain",
    );
  });

  it("execute mode is refused", () => {
    for (const mode of ["execute", "apply", "delete", ""]) {
      assert.throws(
        () =>
          planOperationalRetention({
            dataDomain: "other",
            mode,
            candidateRows: 1,
          }),
        (err: unknown) =>
          err instanceof RetentionRefused &&
          err.message === "retention_execution_disabled",
      );
    }
  });

  it("unknown domain and bad count fail closed", () => {
    assert.throws(
      () =>
        planOperationalRetention({
          dataDomain: "unknown",
          mode: "dry-run",
          candidateRows: 1,
        }),
      (err: unknown) =>
        err instanceof RetentionRefused &&
        err.message === "retention_refused_domain",
    );
    assert.throws(
      () =>
        planOperationalRetention({
          dataDomain: "thesis",
          mode: "dry-run",
          candidateRows: -1,
        }),
      (err: unknown) =>
        err instanceof RetentionRefused &&
        err.message === "retention_row_count_invalid",
    );
    assert.throws(
      () =>
        planOperationalRetention({
          dataDomain: "thesis",
          mode: "dry-run",
          candidateRows: 1.5,
        }),
      (err: unknown) =>
        err instanceof RetentionRefused &&
        err.message === "retention_row_count_invalid",
    );
  });
});
