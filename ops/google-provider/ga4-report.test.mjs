import test from "node:test";
import assert from "node:assert/strict";
import * as ga4 from "./ga4-sanitize.mjs";

const landingSpec = {
  dimensions: ["landingPage"],
  metrics: ["sessions", "activeUsers"],
};

function report(paths, options = {}) {
  return {
    dimensionHeaders: [{ name: "landingPage" }],
    metricHeaders: [{ name: "sessions" }, { name: "activeUsers" }],
    rows: paths.map((path, index) => ({
      dimensionValues: [{ value: path }],
      metricValues: [{ value: String(index + 10) }, { value: "7" }],
    })),
    rowCount: paths.length,
    ...options,
  };
}

function normalize(data, spec = landingSpec) {
  assert.equal(typeof ga4.normalizeGa4Report, "function", "the provider needs a pure report normalizer");
  return ga4.normalizeGa4Report(data, spec);
}

test("normalization returns only configured sanitized dimensions and numeric metrics", () => {
  const data = report(["/about?email=a@example.com#private"]);
  data.dimensionHeaders.unshift({ name: "unrequestedPrivateId" });
  data.rows[0].dimensionValues.unshift({ value: "private-patient-id" });
  data.metricHeaders.reverse();
  const result = normalize(data);
  assert.deepEqual(result.rows, [{ dimensions: { landingPage: "/about" }, metrics: { sessions: 7, activeUsers: 10 } }]);
  assert.equal(result.rowCount, 1);
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("a complete report carries explicit zero omissions and false truncation", () => {
  assert.deepEqual(normalize(report(["/about", "/services"])).coverage, {
    complete: true,
    omittedRows: 0,
    truncated: false,
    reasons: [],
  });
});

test("all sanitized landing-page collisions are omitted without summing unique users", () => {
  const result = normalize(report([
    "/patient/alice%40example.com/results",
    "/patient/bob%40example.com/results",
    "/about?email=alice@example.com",
    "/about?email=bob@example.com",
    "/services",
  ]));
  assert.deepEqual(result.rows, [{ dimensions: { landingPage: "/services" }, metrics: { sessions: 14, activeUsers: 7 } }]);
  assert.deepEqual(result.coverage, {
    complete: false,
    omittedRows: 4,
    truncated: false,
    reasons: ["landing_page_collisions"],
  });
  assert.equal(result.rowCount, 5);
  assert.doesNotMatch(JSON.stringify(result), /alice|bob|example\.com|patient/);
});

test("path-length collisions and repeated identical landing keys are also omitted", () => {
  const longPrefix = `/services/${"a-".repeat(260)}`;
  const result = normalize(report([`${longPrefix}x`, `${longPrefix}y`, "/about", "/about"]));
  assert.deepEqual(result.rows, []);
  assert.equal(result.coverage.omittedRows, 4);
  assert.equal(result.coverage.complete, false);
});

test("truncation compares provider rowCount with raw count before collision omission", () => {
  const result = normalize(report(["/about?one", "/about?two"], { rowCount: 1001 }));
  assert.equal(result.rowCount, 1001);
  assert.equal(result.coverage.truncated, true);
  assert.equal(result.coverage.omittedRows, 2);
  assert.equal(result.coverage.complete, false);
  assert.ok(result.coverage.reasons.includes("row_limit"));
});

test("missing or malformed requested metrics remain null and make coverage incomplete", () => {
  for (const value of [null, undefined, "", false, "unknown", -1]) {
    const data = report(["/about"]);
    data.rows[0].metricValues[0] = { value };
    const result = normalize(data);
    assert.deepEqual(result.rows[0].metrics, { sessions: null, activeUsers: 7 });
    assert.deepEqual(result.coverage, { complete: false, omittedRows: 0, truncated: false, reasons: ["invalid_metrics"] });
  }
});

test("missing requested metric headers do not silently produce a complete report", () => {
  const result = normalize(report(["/about"], { metricHeaders: [{ name: "sessions" }] }));
  assert.equal(result.rows[0].metrics.activeUsers, null);
  assert.equal(result.coverage.complete, false);
  assert.ok(result.coverage.reasons.includes("invalid_metrics"));
});

test("all GA4 quality signals produce fixed safe incomplete reasons", () => {
  for (const [metadata, reason, truncated] of [
    [{ dataLossFromOtherRow: true }, "data_loss_from_other_row", false],
    [{ subjectToThresholding: true }, "thresholding", false],
    [{ samplingMetadatas: [{ samplesReadCount: "50", samplingSpaceSize: "100" }] }, "sampling", false],
    [{ dataTruncationReasons: [{ dataTruncationMessage: "private-patient-id" }] }, "provider_truncation", true],
  ]) {
    const result = normalize(report(["/about"], { metadata }));
    assert.deepEqual(result.coverage, { complete: false, omittedRows: 0, truncated, reasons: [reason] });
    assert.equal(JSON.stringify(result).includes("private-patient-id"), false);
  }
});

test("false flags and empty sampling metadata do not invent a quality problem", () => {
  const result = normalize(report(["/about"], {
    metadata: { dataLossFromOtherRow: false, subjectToThresholding: false, samplingMetadatas: [], dataTruncationReasons: [] },
  }));
  assert.equal(result.coverage.complete, true);
});

test("invalid or missing dimensions are omitted with only a safe reason", () => {
  const data = { dimensionHeaders: [{ name: "date" }], metricHeaders: [{ name: "sessions" }], rowCount: 3, rows: [
    { dimensionValues: [{ value: "private-person-id" }], metricValues: [{ value: "4" }] },
    { dimensionValues: [], metricValues: [{ value: "4" }] },
    { dimensionValues: [{ value: "20261005" }], metricValues: [{ value: "4" }] },
  ] };
  const result = normalize(data, { dimensions: ["date"], metrics: ["sessions"] });
  assert.deepEqual(result.rows, [{ dimensions: { date: "2026-10-05" }, metrics: { sessions: 4 } }]);
  assert.deepEqual(result.coverage, { complete: false, omittedRows: 2, truncated: false, reasons: ["invalid_dimensions"] });
});

test("summary and empty reports normalize without inventing metric values", () => {
  const spec = { dimensions: [], metrics: ["activeUsers"] };
  const result = normalize({ metricHeaders: [{ name: "activeUsers" }], rows: [{ metricValues: [{ value: "0" }] }], rowCount: 1 }, spec);
  assert.deepEqual(result.rows, [{ dimensions: {}, metrics: { activeUsers: 0 } }]);
  assert.equal(result.coverage.complete, true);
  const empty = normalize({ rowCount: 0 }, spec);
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.rowCount, 0);
  assert.equal(empty.coverage.complete, true);
});

test("unverifiable row counts cannot claim complete coverage", () => {
  for (const rowCount of [null, undefined, "", false, -1, 1.5, 0]) {
    const result = normalize(report(["/about"], { rowCount }));
    assert.equal(result.rowCount, 1);
    assert.equal(result.coverage.complete, false);
    assert.ok(result.coverage.reasons.includes("invalid_row_count"));
  }
});
