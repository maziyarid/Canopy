import test from "node:test";
import assert from "node:assert/strict";
import { clientEvidenceExportCsv, comparisonRows, reportCsv } from "./report-export.ts";
import type { ReportingSnapshot, SnapshotSection } from "./reporting-snapshot-core.ts";

const section = (value: number | null, complete = true): SnapshotSection => ({ key: "search", status: complete ? "ok" : "partial", freshness: "2026-10-01", lastSyncAt: "2026-10-02", warning: null, metrics: [{ name: "clicks", value, provider: "gsc", provenance: "first_party", dataDate: "2026-10-01", coverage: { start: "2026-09-27", end: "2026-10-03", complete, observedDates: ["2026-10-01"] } }] });
const snapshot = (current = section(30), previous = section(10)): ReportingSnapshot => ({ schemaVersion: "ms-robot.reporting.v1", projectId: "p1", site: "example.com", period: { start: "2026-09-27", end: "2026-10-03", label: "last_7d" }, comparison: { start: "2026-09-20", end: "2026-09-26", label: "prev_7d" }, sections: [current], comparisonSections: [{ ...previous, metrics: previous.metrics.map(metric => ({ ...metric, coverage: metric.coverage ? { ...metric.coverage, start: "2026-09-20", end: "2026-09-26" } : undefined })) }], providerHealth: { ...section(null), metrics: [], warning: "private diagnostic" }, etag: "etag", correlationId: "internal", generatedAt: "now", requestedAt: "now" });

test("comparison calculates independently measured change and never divides by a zero baseline", () => {
  assert.equal(comparisonRows(snapshot())[0].difference, 20);
  assert.equal(comparisonRows(snapshot())[0].relativeChange, 2);
  assert.equal(comparisonRows(snapshot(section(30), section(0)))[0].relativeChange, null);
  assert.equal(comparisonRows(snapshot(section(30), section(0)))[0].reason, "zero_baseline");
});

test("incomplete coverage and absent measurements suppress numerical growth claims", () => {
  assert.equal(comparisonRows(snapshot(section(30, false)))[0].difference, null);
  assert.equal(comparisonRows(snapshot(section(null)))[0].relativeChange, null);
  assert.equal(comparisonRows(snapshot(section(30, false)))[0].reason, "incomplete");
});

test("CSV exports measured provenance, periods and coverage without provider internals", () => {
  const csv = reportCsv(snapshot());
  assert.match(csv, /gsc/); assert.match(csv, /2026-09-20/); assert.match(csv, /first_party/);
  assert.doesNotMatch(csv, /private diagnostic|internal|p1/);
  assert.match(csv, /30/);
});

test("CSV neutralises spreadsheet formulas and escapes separators, quotes and newlines", () => {
  const data = snapshot(); data.site = "=SUM(A1:A2)";
  data.sections[0].metrics[0].name = '+cmd,"quoted"\nnext';
  const csv = reportCsv(data);
  assert.match(csv, /'=SUM/); assert.match(csv, /"'\+cmd,""quoted""\nnext"/);
});

test("third-party estimates are not compared with a first-party baseline", () => {
  const data = snapshot(); data.comparisonSections![0].metrics[0].provenance = "third_party_estimate";
  assert.equal(comparisonRows(data)[0].reason, "unavailable");
  assert.equal(comparisonRows(data)[0].relativeChange, null);
});

test("coverage for the wrong window cannot establish a measured comparison", () => {
  const data = snapshot(); data.comparisonSections![0].metrics[0].coverage!.end = "2026-10-03";
  assert.equal(comparisonRows(data)[0].difference, null);
  assert.equal(comparisonRows(data)[0].reason, "incomplete");
});

test("client evidence export keeps redacted metrics and visible note titles only", () => {
  const csv = clientEvidenceExportCsv({
    site: "example.com",
    periodStart: "2026-09-27",
    periodEnd: "2026-10-03",
    sections: [{
      key: "search",
      status: "ok",
      metrics: [{ name: "clicks", provider: "gsc", value: 3, provenance: "first_party", dataDate: "2026-10-01" }],
    }, {
      key: "providerHealth",
      status: "degraded",
      metrics: [{ name: "api_key=secret", provider: "gsc", value: 1, provenance: "first_party", dataDate: null }],
    }],
    evidenceTitles: ["Approved clicks note"],
  });
  assert.match(csv, /Approved clicks note/);
  assert.doesNotMatch(csv, /api_key/);
  assert.doesNotMatch(csv, /providerHealth/);
  assert.match(csv, /evidence_note/);
});

test("client evidence export redacts secret-like titles and neutralises formula titles", () => {
  const csv = clientEvidenceExportCsv({
    site: "example.com",
    periodStart: "2026-09-27",
    periodEnd: "2026-10-03",
    sections: [],
    evidenceTitles: ["api_key=supersecret", "=HYPERLINK(\"http://evil\")", "Approved clicks note", "   "],
  });
  assert.match(csv, /api_key=<redacted>/);
  assert.doesNotMatch(csv, /supersecret/);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /Approved clicks note/);
  assert.equal(csv.split("evidence_note").length - 1, 3);
});
