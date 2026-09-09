import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Data source types
const DataSourceSchema = z.enum([
  "google-search-console",
  "bing-webmaster",
  "ubersuggest",
  "ahrefs",
  "moz",
  "semrush",
  "manual",
]);

// Search Console API schema
const SearchConsoleSchema = z.object({
  projectId: z.string(),
  siteUrl: z.string().url(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dimensions: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.string()).optional(),
});

// Ubersuggest API schema
const UbersuggestSchema = z.object({
  projectId: z.string(),
  apiKey: z.string().min(1),
  keyword: z.string().min(1).max(100),
  location: z.string().optional(),
  language: z.string().optional(),
});

// Bing Webmaster API schema
const BingWebmasterSchema = z.object({
  projectId: z.string(),
  apiKey: z.string().min(1),
  siteUrl: z.string().url(),
});

// Generic SEO data schema
const SEORecordSchema = z.object({
  projectId: z.string(),
  dataSource: DataSourceSchema,
  keyword: z.string().optional(),
  url: z.string().url().optional(),
  metricName: z.string().min(1),
  metricValue: z.number(),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Multi-source SEO data fetch
const MultiSourceSchema = z.object({
  projectId: z.string(),
  keyword: z.string().min(1).max(100),
  sources: z.array(DataSourceSchema).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Save SEO data from any source
export const saveSEOData = createServerFn({ method: "POST" })
  .validator(SEORecordSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    await sql`
      INSERT INTO seo_data_cache (id, project_id, data_source, keyword, url, metric_name, metric_value, data_date, created_at)
      VALUES (${crypto.randomUUID()}, ${data.projectId}, ${data.dataSource}, ${data.keyword || ""}, ${data.url || ""}, ${data.metricName}, ${data.metricValue}, ${data.dataDate}, NOW())
      ON CONFLICT (project_id, data_source, keyword, metric_name, data_date)
      DO UPDATE SET metric_value = ${data.metricValue}, created_at = NOW()
    `;

    return { ok: true as const, message: "SEO data saved" };
  });

// Get SEO data for a project
export const getSEOData = createServerFn({ method: "GET" })
  .validator(z.object({
    projectId: z.string(),
    keyword: z.string().optional(),
    dataSource: DataSourceSchema.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    let query = `
      SELECT * FROM seo_data_cache 
      WHERE project_id = ${data.projectId}
    `;

    const params: string[] = [];
    if (data.keyword) params.push(`keyword = ${data.keyword}`);
    if (data.dataSource) params.push(`data_source = ${data.dataSource}`);
    if (data.startDate) params.push(`data_date >= ${data.startDate}`);
    if (data.endDate) params.push(`data_date <= ${data.endDate}`);

    if (params.length > 0) {
      query += ` AND ${params.join(" AND ")}`;
    }

    query += ` ORDER BY data_date DESC, created_at DESC`;

    const rows = await sql<{
      id: string;
      project_id: string;
      data_source: string;
      keyword: string;
      url: string;
      metric_name: string;
      metric_value: number;
      data_date: string;
      created_at: string;
    }>`${query}`;

    // Group by keyword and metric for easier consumption
    const grouped = rows.reduce((acc, row) => {
      if (!acc[row.keyword || "global"]) {
        acc[row.keyword || "global"] = {};
      }
      if (!acc[row.keyword || "global"][row.metric_name]) {
        acc[row.keyword || "global"][row.metric_name] = {};
      }
      acc[row.keyword || "global"][row.metric_name][row.data_source] = {
        value: row.metric_value,
        date: row.data_date,
        url: row.url,
      };
      return acc;
    }, {} as Record<string, Record<string, Record<string, { value: number; date: string; url: string }>>>);

    return { ok: true as const, data: { rows, grouped } };
  });

// Fetch and aggregate data from multiple sources
export const aggregateSEOData = createServerFn({ method: "POST" })
  .validator(MultiSourceSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    // Get existing data from cache
    const cachedData = await getSEOData.handler({
      context,
      data: {
        projectId: data.projectId,
        keyword: data.keyword,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    // For now, return cached data
    // In production, this would make actual API calls to various SEO services
    return {
      ok: true as const,
      data: cachedData.data?.grouped || {},
      sources: data.sources || ["google-search-console", "bing-webmaster", "ubersuggest"],
      cached: true,
    };
  });

// Get trending data for dashboard
export const getSEOTimeline = createServerFn({ method: "GET" })
  .validator(z.object({
    projectId: z.string(),
    metricName: z.string().optional(),
    days: z.number().int().min(1).max(365).default(30),
  }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - data.days);
    const startDateStr = startDate.toISOString().split("T")[0];

    let query = `
      SELECT data_date, metric_name, metric_value, data_source 
      FROM seo_data_cache 
      WHERE project_id = ${data.projectId}
      AND data_date >= ${startDateStr}
    `;

    if (data.metricName) {
      query += ` AND metric_name = ${data.metricName}`;
    }

    query += ` ORDER BY data_date, metric_name, data_source`;

    const rows = await sql<{
      data_date: string;
      metric_name: string;
      metric_value: number;
      data_source: string;
    }>`${query}`;

    // Aggregate by date and metric
    const timeline = rows.reduce((acc, row) => {
      if (!acc[row.data_date]) {
        acc[row.data_date] = {};
      }
      if (!acc[row.data_date][row.metric_name]) {
        acc[row.data_date][row.metric_name] = {};
      }
      acc[row.data_date][row.metric_name][row.data_source] = row.metric_value;
      return acc;
    }, {} as Record<string, Record<string, Record<string, number>>>);

    return { ok: true as const, data: timeline };
  });

// Helper to fetch from external APIs (would be implemented with actual API keys)
async function fetchFromSearchConsole(apiKey: string, siteUrl: string, startDate: string, endDate: string) {
  // This is a placeholder - actual implementation would use Google Search Console API
  // Requires OAuth2 and proper service account setup
  return {
    ok: false as const,
    error: "Search Console API not configured",
  };
}

async function fetchFromUbersuggest(apiKey: string, keyword: string, location: string = "us") {
  // Placeholder for Ubersuggest API
  try {
    const url = `https://api.ubersuggest.io/v1/keywords?keyword=${encodeURIComponent(keyword)}&location=${location}`;
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      return { ok: false as const, error: "Ubersuggest API error" };
    }

    const data = await response.json();
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function fetchFromBing(apiKey: string, siteUrl: string) {
  // Placeholder for Bing Webmaster API
  return {
    ok: false as const,
    error: "Bing Webmaster API not configured",
  };
}
