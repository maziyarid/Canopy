import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readIfReportingConfigured } from "./reporting-read-gate.ts";
import { SnapshotAccessError } from "./reporting-snapshot-service.ts";

describe("AAX-80 reporting read gate", () => {
  it("does not call the snapshot reader for an unconfigured client", async () => {
    let reads = 0;
    await assert.rejects(
      () => readIfReportingConfigured("client", async () => {
        reads += 1;
        return { rows: ["secret"] };
      }),
      (error: unknown) => error instanceof SnapshotAccessError && error.status === 503,
    );
    assert.equal(reads, 0);
  });

  it("calls the reader only after an owner or editor gate passes", async () => {
    let reads = 0;
    const snapshot = await readIfReportingConfigured("owner", async () => {
      reads += 1;
      return { projectId: "project-a" };
    });
    assert.equal(reads, 1);
    assert.equal(snapshot.projectId, "project-a");
    await readIfReportingConfigured("editor", async () => {
      reads += 1;
      return { projectId: "project-a" };
    });
    assert.equal(reads, 2);
  });
});
