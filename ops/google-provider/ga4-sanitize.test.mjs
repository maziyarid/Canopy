import test from "node:test";
import assert from "node:assert/strict";
import { safeGa4Dimension, safeGa4Metric, validateGa4Property } from "./ga4-sanitize.mjs";

test("GA4 property references are explicit numeric properties", () => {
  assert.equal(validateGa4Property("123"), "properties/123");
  assert.equal(validateGa4Property("properties/987654"), "properties/987654");
  for (const value of ["", "0", "properties/0", "properties/demo", "../123"]) {
    assert.throws(() => validateGa4Property(value), /invalid_ga4_property/);
  }
});

test("GA4 dates are normalized and malformed values fail closed", () => {
  assert.equal(safeGa4Dimension("date", "20261005"), "2026-10-05");
  assert.throws(() => safeGa4Dimension("date", "2026-10-05"), /invalid_ga4_date/);
});

test("landing pages drop query fragments and redact identifier-shaped path segments", () => {
  assert.equal(safeGa4Dimension("landingPage", "/services/rhinoplasty?email=a@example.com#x"), "/services/rhinoplasty");
  assert.equal(safeGa4Dimension("landingPage", "/patient/a%40example.com/results"), "/patient/:redacted/results");
  assert.equal(safeGa4Dimension("landingPage", "/case/09121234567/view"), "/case/:redacted/view");
  assert.equal(safeGa4Dimension("landingPage", "/case/550e8400-e29b-41d4-a716-446655440000/view"), "/case/:redacted/view");
  assert.equal(safeGa4Dimension("landingPage", "/case/123456/view"), "/case/:redacted/view");
  assert.equal(safeGa4Dimension("landingPage", "/about/team"), "/about/team");
});

test("control characters are removed and dimensions are bounded", () => {
  assert.equal(safeGa4Dimension("sessionDefaultChannelGroup", " Organic\u0000 Search "), "Organic Search");
  assert.equal(safeGa4Dimension("x", "a".repeat(500)).length, 200);
});

test("metrics accept finite non-negative numeric values only", () => {
  assert.equal(safeGa4Metric("12.5"), 12.5);
  assert.equal(safeGa4Metric(0), 0);
  assert.equal(safeGa4Metric(-1), null);
  assert.equal(safeGa4Metric("not-a-number"), null);
});
