import test from "node:test";
import assert from "node:assert/strict";
import { buildGscSearchRequest, validateGscDate, validateGscDimensions } from "./gsc-filter.mjs";

test("GSC request preserves bounded read-only filters", () => {
  const result = buildGscSearchRequest({
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    dimensions: ["date", "query", "page"],
    rowLimit: 99999,
    type: "web",
    queryFilter: "regex:^seo",
    pageFilter: "/services/",
    countryFilter: "GBR",
    deviceFilter: "MOBILE",
  });
  assert.equal(result.rowLimit, 25000);
  assert.deepEqual(result.requestBody.dimensionFilterGroups, [{
    filters: [
      { dimension: "query", operator: "includingRegex", expression: "^seo" },
      { dimension: "page", operator: "contains", expression: "/services/" },
      { dimension: "country", operator: "equals", expression: "GBR" },
      { dimension: "device", operator: "equals", expression: "MOBILE" },
    ],
  }]);
});

test("GSC validation fails closed on invalid dates, dimensions and filters", () => {
  assert.throws(() => validateGscDate("2026-02-30", "start_date"), /invalid_start_date/);
  assert.throws(() => validateGscDimensions(["query", "evil"]), /invalid_dimensions/);
  assert.throws(() => buildGscSearchRequest({ startDate: "2026-10-02", endDate: "2026-10-01" }), /invalid_date_range/);
  assert.throws(() => buildGscSearchRequest({ startDate: "2026-10-01", endDate: "2026-10-02", deviceFilter: "PHONE" }), /invalid_device_filter/);
  assert.throws(() => buildGscSearchRequest({ startDate: "2026-10-01", endDate: "2026-10-02", countryFilter: "UNITED KINGDOM" }), /invalid_country_filter/);
  assert.throws(() => buildGscSearchRequest({ startDate: "2026-10-01", endDate: "2026-10-02", queryFilter: "regex:" }), /invalid_query_filter/);
});

test("default GSC request stays compatible with date grouping and web search", () => {
  const result = buildGscSearchRequest({ startDate: "2026-10-01", endDate: "2026-10-02" });
  assert.deepEqual(result.dimensions, ["date"]);
  assert.equal(result.rowLimit, 1000);
  assert.equal(result.type, "web");
  assert.equal("dimensionFilterGroups" in result.requestBody, false);
});
