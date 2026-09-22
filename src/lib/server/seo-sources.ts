import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioAuth } from "./studio-auth";
import { buildSeoCacheUpsertQuery, buildSeoDataQuery, buildSeoTimelineQuery } from "./query-builders";

const DataSourceSchema = z.enum([
  "google-search-console",
  "bing-webmaster",
  "ubersuggest",
  "ahrefs",
  "moz",
  "semrush",
  "manual",
]);

const SEORecordSchema = z.object({
  projectId: z.string(),
  dataSource: DataSourceSchema,
  keyword: z.string().optional(),
  url: z.string().url().optional(),
  metricName: z.string().min(1),
  metricValue: z.number(),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const MultiSourceSchema = z.object({
  projectId: z.string(),
  keyword: z.string().min(1).max(100),
  sources: z.array(DataSourceSchema).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const saveSEOData = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(SEORecordSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const query = buildSeoCacheUpsertQuery({
      id: crypto.randomUUID(),
      projectId: data.projectId,
      dataSource: data.dataSource,
      keyword: data.keyword || "",
      url: data.url || "",
      metricName: data.metricName,
      metricValue: data.metricValue,
      dataDate: data.dataDate,
    });
    await sql.query(query.text, query.params);

    return { ok: true as const, message: "SEO data saved" };
  });

export const getSEOData = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(z.object({
    projectId: z.string(),
    keyword: z.string().optional(),
    dataSource: DataSourceSchema.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const query = buildSeoDataQuery(data);
    const rows = await sql.query<{
      id: string;
      project_id: string;
      data_source: string;
      keyword: string;
      url: string;
      metric_name: string;
      metric_value: number;
      data_date: string;
      created_at: string;
    }>(query.text, query.params);

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

export const aggregateSEOData = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(MultiSourceSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const cachedData = await getSEOData({
      data: {
        projectId: data.projectId,
        keyword: data.keyword,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    return {
      ok: true as const,
      data: cachedData.data?.grouped || {},
      sources: data.sources || ["google-search-console", "bing-webmaster", "ubersuggest"],
      cached: true,
    };
  });

export const getSEOTimeline = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(z.object({
    projectId: z.string(),
    metricName: z.string().optional(),
    days: z.number().int().min(1).max(365).default(30),
  }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - data.days);
    const startDateStr = startDate.toISOString().split("T")[0];
    const query = buildSeoTimelineQuery({
      projectId: data.projectId,
      startDate: startDateStr,
      metricName: data.metricName,
    });

    const rows = await sql.query<{
      data_date: string;
      metric_name: string;
      metric_value: number;
      data_source: string;
    }>(query.text, query.params);

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
