import assert from "node:assert/strict";
import test from "node:test";
import { aggregateMeasurementKind, measurementKindFromGatewayRow, readGatewayLedger, type GatewayMetricRow } from "./reporting-ledger.ts";

const day = (extra: Partial<GatewayMetricRow> = {}): GatewayMetricRow => ({
  provider: "gsc",
  site: "example.com",
  dataset: "site_daily",
  data_date: "2026-10-01",
  metrics: { clicks: 2, impressions: 10, position: 4 },
  ...extra,
});

test("gateway sampling metadata becomes a refused measurement kind", () => {
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { samplingMetadatas: [{ samplesReadCount: "1" }] } })), "sampled");
  assert.equal(measurementKindFromGatewayRow(day({ metrics: { clicks: 1, impressions: 1, position: 1, qualityFlags: ["thresholded"] } })), "thresholded");
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { measurement_kind: " modeled " } })), "modeled");
  assert.equal(measurementKindFromGatewayRow(day()), null);
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { samplingMetadatas: { samplesReadCount: "1" } } })), "sampled");
  assert.equal(measurementKindFromGatewayRow(day({ metrics: { clicks: 1, impressions: 1, position: 1, qualityFlags: { flag: "thresholded" } } })), "unknown");
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { qualityFlags: ["observed"] } })), null);
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { metadata: { samplingMetadatas: [{ samplesReadCount: "1" }] } } })), "sampled");
  assert.equal(measurementKindFromGatewayRow(day({ metrics: { clicks: 1, impressions: 1, position: 1, metadata: { dataLossFromOtherRow: true } } })), "data_loss");
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { subjectToThresholding: "true" } })), "thresholded");
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { subjectToThresholding: false } })), null);
  assert.equal(measurementKindFromGatewayRow(day({ dimensions: { subjectToThresholding: "maybe" } })), "unknown");
  assert.equal(aggregateMeasurementKind([day({ dimensions: { measurementKind: "observed" } }), day({ dimensions: { measurementKind: "sampled" } })]), "sampled");
});

test("ledger rows carry sampled kind and omit absent kind", async () => {
  const period = { start: "2026-10-01", end: "2026-10-01", label: "last_1d" };
  const states = async () => ({ providers: [{ provider: "gsc", status: "ok", last_success: "2026-10-01", last_attempt: "2026-10-01", last_error: null, freshness: "2026-10-01" }] });
  const sampled = await readGatewayLedger("p1", "example.com", period, {
    states,
    metrics: async () => ({ rows: [day({ dimensions: { samplingMetadatas: [{}] } })], coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-01" }] } }),
  });
  assert.equal(sampled.rows.find((row) => row.metricName === "clicks")?.measurementKind, "sampled");
  const plain = await readGatewayLedger("p1", "example.com", period, {
    states,
    metrics: async () => ({ rows: [day()], coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-01" }] } }),
  });
  assert.equal(plain.rows.find((row) => row.metricName === "clicks")?.measurementKind, undefined);
});

test("truncated or unpadded search rows are not complete first-party coverage", async () => {
  const period = { start: "2026-10-01", end: "2026-10-01", label: "last_1d" };
  const states = async () => ({ providers: [{ provider: "gsc", status: "ok", last_success: "2026-10-01", last_attempt: "2026-10-01", last_error: null, freshness: "2026-10-01" }] });
  const truncated = await readGatewayLedger("p1", "example.com", period, {
    states,
    metrics: async () => ({ rows: [day()], truncated: true, coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-01" }] } }),
  });
  const clicks = truncated.rows.find((row) => row.metricName === "clicks");
  assert.equal(clicks?.status, "partial");
  assert.equal(clicks?.coverage?.complete, false);
  assert.match(clicks?.coverageWarning ?? "", /truncated/);
  const unpadded = await readGatewayLedger("p1", "example.com", period, {
    states,
    metrics: async () => ({ rows: [day({ data_date: "2026-10-1" })], coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-01" }] } }),
  });
  assert.equal(unpadded.rows[0]?.status, "error");
  assert.equal(unpadded.rows.some((row) => row.metricName === "clicks"), false);
  const emptyTruncated = await readGatewayLedger("p1", "example.com", period, {
    states,
    metrics: async () => ({ rows: [], truncated: true, coverage: { ranges: [{ start: "2026-10-01", end: "2026-10-01" }] } }),
  });
  assert.equal(emptyTruncated.rows[0]?.status, "partial");
  assert.equal(emptyTruncated.rows[0]?.coverage?.complete, false);
  assert.equal(emptyTruncated.rows.some((row) => row.metricName === "clicks"), false);
  assert.match(emptyTruncated.rows[0]?.coverageWarning ?? "", /truncated/);
});
