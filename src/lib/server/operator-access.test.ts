import test from "node:test";
import assert from "node:assert/strict";
import { assertOperatorAccess } from "./operator-access.ts";

test("raw metrics and paid research require a full project operator grant", () => {
  for (const role of ["owner", "editor"]) assert.doesNotThrow(() => assertOperatorAccess({ role, filter: "" }));
  for (const access of [{ role: "client", filter: "" }, { role: "client", filter: "allowed" }, { role: "editor", filter: "allowed" }, { role: "unknown", filter: "" }]) assert.throws(() => assertOperatorAccess(access), /Forbidden/);
});
