import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gateProjectExport, gateProjectSearch } from "./project-export-gate.ts";

describe("AAX-80 project export gate", () => {
  it("returns only the resolved project id when request and snapshot match", () => {
    assert.equal(
      gateProjectExport({
        role: "client",
        resolvedProjectId: "project-a",
        requestedProjectId: "project-a",
        snapshotProjectId: "project-a",
      }),
      "project-a",
    );
  });

  it("fails closed when the requested project differs from the resolved binding", () => {
    assert.throws(
      () =>
        gateProjectExport({
          role: "client",
          resolvedProjectId: "project-a",
          requestedProjectId: "project-b",
          snapshotProjectId: "project-a",
        }),
      /client_supplied_scope_rejected/,
    );
  });

  it("fails closed when the snapshot project differs from the resolved binding", () => {
    assert.throws(
      () =>
        gateProjectExport({
          role: "editor",
          resolvedProjectId: "project-a",
          requestedProjectId: "project-a",
          snapshotProjectId: "project-b",
        }),
      /client_supplied_scope_rejected/,
    );
  });

  it("fails closed on a blank or padded resolved project id", () => {
    assert.throws(
      () =>
        gateProjectExport({
          role: "owner",
          resolvedProjectId: " project-a ",
          requestedProjectId: " project-a ",
          snapshotProjectId: " project-a ",
        }),
      /client_supplied_scope_rejected/,
    );
  });
});

  it("search gate returns only the resolved project id", () => {
    assert.equal(
      gateProjectSearch({ role: "client", resolvedProjectId: "project-a", requestedProjectId: "project-a" }),
      "project-a",
    );
  });

  it("search gate fails closed on a client-supplied project id", () => {
    assert.throws(
      () => gateProjectSearch({ role: "client", resolvedProjectId: "project-a", requestedProjectId: "project-b" }),
      /client_supplied_scope_rejected/,
    );
  });
