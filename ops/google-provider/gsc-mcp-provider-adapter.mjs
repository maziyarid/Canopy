#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  providerRequest,
  formatInspection,
  formatSearchAnalytics,
  formatSites,
  formatSitemaps,
} from "./gsc-mcp-provider-client.mjs";

const server = new McpServer({
  name: "maziyar-google-search-console-mcp",
  version: "2.0.0",
});

function text(value) {
  return { content: [{ type: "text", text: value }] };
}

function safeFailure(label, error) {
  const code = error instanceof Error ? error.message : "google_provider_error";
  const safe = /^google_provider_(?:http_\d{3}|unreachable|invalid_json|token_missing|url_must_be_loopback)$/.test(code)
    ? code
    : "google_provider_error";
  return text(`${label}: ${safe}`);
}

server.tool(
  "list_sites",
  "List all Search Console properties authorised for the existing server-side Google identity.",
  {},
  async () => {
    try {
      return text(formatSites(await providerRequest("/v1/sites")));
    } catch (error) {
      return safeFailure("Error listing sites", error);
    }
  },
);

server.tool(
  "search_analytics",
  "Query read-only Search Console performance data for an authorised property.",
  {
    siteUrl: z.string().min(1).max(500).describe("Search Console property URL exactly as listed by list_sites"),
    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().describe("End date in YYYY-MM-DD format"),
    dimensions: z.string().optional().describe("Comma-separated dimensions: query, page, country, device, searchAppearance, date"),
    rowLimit: z.number().int().min(1).max(25000).optional().default(100),
    searchType: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional().default("web"),
    queryFilter: z.string().max(1000).optional().describe("Filter by query. Prefix with regex: for RE2 matching."),
    pageFilter: z.string().max(1000).optional().describe("Filter by page URL. Prefix with regex: for RE2 matching."),
    countryFilter: z.string().max(3).optional().describe("ISO 3166-1 alpha-3 country code"),
    deviceFilter: z.enum(["DESKTOP", "MOBILE", "TABLET"]).optional(),
  },
  async ({
    siteUrl,
    startDate,
    endDate,
    dimensions,
    rowLimit,
    searchType,
    queryFilter,
    pageFilter,
    countryFilter,
    deviceFilter,
  }) => {
    try {
      const dimensionList = dimensions
        ? dimensions.split(",").map((item) => item.trim()).filter(Boolean)
        : ["query"];
      const payload = await providerRequest("/v1/gsc/search-analytics", {
        method: "POST",
        body: {
          siteUrl,
          startDate,
          endDate,
          dimensions: dimensionList,
          rowLimit,
          type: searchType,
          queryFilter,
          pageFilter,
          countryFilter,
          deviceFilter,
        },
      });
      return text(formatSearchAnalytics(payload));
    } catch (error) {
      return safeFailure("Error querying search analytics", error);
    }
  },
);

server.tool(
  "inspect_url",
  "Inspect an authorised URL's Search Console index status.",
  {
    siteUrl: z.string().min(1).max(500).describe("Search Console property URL"),
    inspectionUrl: z.string().url().max(2000).describe("Full URL to inspect; it must belong to the property"),
  },
  async ({ siteUrl, inspectionUrl }) => {
    try {
      const payload = await providerRequest("/v1/gsc/inspect", {
        method: "POST",
        body: { siteUrl, inspectionUrl, languageCode: "en-US" },
      });
      return text(formatInspection(payload));
    } catch (error) {
      return safeFailure("Error inspecting URL", error);
    }
  },
);

server.tool(
  "list_sitemaps",
  "List submitted sitemaps for an authorised Search Console property.",
  {
    siteUrl: z.string().min(1).max(500).describe("Search Console property URL"),
  },
  async ({ siteUrl }) => {
    try {
      const payload = await providerRequest(`/v1/gsc/sitemaps?siteUrl=${encodeURIComponent(siteUrl)}`);
      return text(formatSitemaps(payload));
    } catch (error) {
      return safeFailure("Error listing sitemaps", error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
