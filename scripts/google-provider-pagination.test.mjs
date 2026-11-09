import assert from "node:assert/strict";
import test from "node:test";
import { querySearchAnalytics } from "../ops/google-provider/search-analytics.mjs";

const request = {
  siteUrl: "sc-domain:example.com",
  startDate: "2026-10-01",
  endDate: "2026-10-07",
  dimensions: ["date", "query", "page"],
};

function fakeClient(rows = []) {
  const calls = [];
  return {
    calls,
    searchanalytics: {
      async query(input) {
        calls.push(input);
        return { data: { rows, responseAggregationType: "byPage" } };
      },
    },
  };
}

test("Search Analytics forwards the requested offset and page size to Google", async () => {
  const client = fakeClient([
    { keys: ["2026-10-01", "query", "https://example.com/page"], clicks: 2, impressions: 10, ctr: 0.2, position: 3 },
  ]);
  const result = await querySearchAnalytics(client, { ...request, startRow: 5000, rowLimit: 5000 });
  assert.deepEqual(client.calls, [{
    siteUrl: request.siteUrl,
    requestBody: {
      startDate: request.startDate,
      endDate: request.endDate,
      dimensions: request.dimensions,
      startRow: 5000,
      rowLimit: 5000,
      type: "web",
      dataState: "all",
    },
  }]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].clicks, 2);
  assert.equal(result.responseAggregationType, "byPage");
});

test("Search Analytics defaults to offset zero and preserves empty final pages", async () => {
  const client = fakeClient();
  const result = await querySearchAnalytics(client, request);
  assert.equal(client.calls[0].requestBody.startRow, 0);
  assert.equal(client.calls[0].requestBody.rowLimit, 1000);
  assert.deepEqual(result.rows, []);
});

test("Search Analytics permits the documented page-size boundaries", async () => {
  for (const rowLimit of [1, 25_000]) {
    const client = fakeClient();
    await querySearchAnalytics(client, { ...request, startRow: 0, rowLimit });
    assert.equal(client.calls[0].requestBody.rowLimit, rowLimit);
  }
});

test("Search Analytics rejects invalid offsets before making an upstream call", async () => {
  for (const startRow of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, true, false, null, "5000", "", {}, []]) {
    const client = fakeClient();
    await assert.rejects(querySearchAnalytics(client, { ...request, startRow }), { message: "invalid_start_row", code: 400 });
    assert.equal(client.calls.length, 0);
  }
});

test("Search Analytics rejects invalid page sizes before making an upstream call", async () => {
  for (const rowLimit of [0, -1, 1.5, 25_001, NaN, Infinity, -Infinity, true, false, null, "5000", "", {}, []]) {
    const client = fakeClient();
    await assert.rejects(querySearchAnalytics(client, { ...request, rowLimit }), { message: "invalid_row_limit", code: 400 });
    assert.equal(client.calls.length, 0);
  }
});

test("Search Analytics leaves upstream failures for the authenticated route to handle", async () => {
  const failure = new Error("upstream_unavailable");
  const client = { searchanalytics: { async query() { throw failure; } } };
  await assert.rejects(querySearchAnalytics(client, { ...request, startRow: 10_000 }), (error) => error === failure);
});
