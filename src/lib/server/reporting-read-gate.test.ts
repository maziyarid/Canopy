import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadProjectReport, readIfReportingConfigured } from "./reporting-read-gate.ts";
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

  it("returns the empty client view without snapshot or note reads", async () => {
    let reads = 0;
    const view = await loadProjectReport("client", { notes: [], journal: [] }, async () => {
      reads += 1;
      return { notes: ["raw note"], journal: ["raw insight"] };
    });
    assert.equal(reads, 0);
    assert.deepEqual(view, { notes: [], journal: [] });
  });

  it("loads the owner report only through the configured callback", async () => {
    let reads = 0;
    const view = await loadProjectReport("owner", { notes: [], journal: [] }, async () => {
      reads += 1;
      return { notes: ["ledger note"], journal: ["approved insight"] };
    });
    assert.equal(reads, 1);
    assert.deepEqual(view.notes, ["ledger note"]);
  });

  it("rejects a search read before the reader runs when reporting is disabled", async () => {
    let reads = 0;
    await assert.rejects(
      () => readIfReportingConfigured("client", async () => {
        reads += 1;
        return { rows: [{ query: "patient name" }] };
      }),
      (error: unknown) => error instanceof SnapshotAccessError && error.message === "Reporting unavailable",
    );
    assert.equal(reads, 0);
  });

});
