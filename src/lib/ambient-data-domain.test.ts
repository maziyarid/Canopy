import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachAmbientDataDomain, parseAmbientDataDomain } from "./ambient-data-domain.ts";

describe("ambient data domain attachment", () => {
  it("rejects unknown workspace values", () => {
    assert.equal(parseAmbientDataDomain("clinic"), undefined);
    assert.equal(parseAmbientDataDomain(""), undefined);
  });

  it("omits ambient domain when the workspace context is unset", () => {
    assert.deepEqual(attachAmbientDataDomain({ projectId: "p1" }, undefined), { projectId: "p1" });
  });

  it("attaches a valid workspace domain without dropping other fields", () => {
    assert.deepEqual(
      attachAmbientDataDomain({ projectId: "p1", seeds: ["a"] }, "medical"),
      { projectId: "p1", seeds: ["a"], ambientDataDomain: "medical" },
    );
  });
});
