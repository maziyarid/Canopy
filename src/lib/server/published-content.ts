import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioAuth } from "./studio-auth";
import { buildPublishedContentListQuery, buildPublishedContentUpdateQuery } from "./query-builders";

const ContentTypeSchema = z.enum(["blog", "page", "product", "video", "podcast", "other"]);

const CreateContentSchema = z.object({
  projectId: z.string(),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  keyword: z.string().min(1).max(200),
  contentType: ContentTypeSchema.default("blog"),
  publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  author: z.string().max(200).optional(),
  status: z.enum(["draft", "published", "updated", "archived"]).default("published"),
  backlinks: z.number().int().min(0).default(0),
  socialShares: z.number().int().min(0).default(0),
  notes: z.string().max(5000).optional(),
  links: z.array(z.object({
    url: z.string().url(),
    anchorText: z.string().max(500).optional(),
    targetUrl: z.string().url().optional(),
    isInternal: z.boolean().default(true),
    isDofollow: z.boolean().default(true),
  })).optional(),
});

const UpdateContentSchema = CreateContentSchema.omit({ projectId: true }).partial().extend({
  projectId: z.string(),
  id: z.string(),
});

const ListContentSchema = z.object({
  projectId: z.string(),
  keyword: z.string().optional(),
  contentType: ContentTypeSchema.optional(),
  status: z.enum(["draft", "published", "updated", "archived"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const DeleteContentSchema = z.object({
  projectId: z.string(),
  id: z.string(),
});

const ContentStatsSchema = z.object({
  projectId: z.string(),
  days: z.number().int().min(1).max(365).default(30),
});

export const createPublishedContent = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(CreateContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const id = crypto.randomUUID();
    const publishDate = data.publishDate || new Date().toISOString().split("T")[0];

    await sql`
      INSERT INTO published_content (
        id, project_id, url, title, keyword, content_type, publish_date,
        author, status, backlinks, social_shares, notes, created_at
      )
      VALUES (
        ${id}, ${data.projectId}, ${data.url}, ${data.title}, ${data.keyword},
        ${data.contentType}, ${publishDate}, ${data.author || ""}, ${data.status},
        ${data.backlinks}, ${data.socialShares}, ${data.notes || ""}, NOW()
      )
    `;

    if (data.links && data.links.length > 0) {
      for (const link of data.links) {
        await sql`
          INSERT INTO content_links (
            id, content_id, url, anchor_text, target_url, is_internal, is_dofollow, created_at
          )
          VALUES (
            ${crypto.randomUUID()}, ${id}, ${link.url}, ${link.anchorText || ""},
            ${link.targetUrl || link.url}, ${link.isInternal}, ${link.isDofollow}, NOW()
          )
        `;
      }
    }

    return { ok: true as const, id, message: "Content published successfully" };
  });

export const updatePublishedContent = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(UpdateContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const existing = await sql<{ project_id: string }>`
      SELECT project_id FROM published_content WHERE id = ${data.id} AND project_id = ${data.projectId}
    `;

    if (!existing[0]) {
      throw new Error("Content not found or access denied");
    }

    const query = buildPublishedContentUpdateQuery({
      id: data.id,
      projectId: data.projectId,
      url: data.url,
      title: data.title,
      keyword: data.keyword,
      contentType: data.contentType,
      publishDate: data.publishDate,
      author: data.author,
      status: data.status,
      backlinks: data.backlinks,
      socialShares: data.socialShares,
      notes: data.notes,
    });
    if (query) {
      await sql.query(query.text, query.params);
    }

    return { ok: true as const, message: "Content updated successfully" };
  });

export const listPublishedContent = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ListContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const query = buildPublishedContentListQuery(data);
    const rows = await sql.query<{
      id: string;
      project_id: string;
      url: string;
      title: string;
      keyword: string;
      content_type: string;
      publish_date: string;
      author: string;
      status: string;
      backlinks: number;
      social_shares: number;
      notes: string;
      created_at: string;
    }>(query.text, query.params);

    const contentIds = rows.map((r) => r.id);
    const linkCounts = contentIds.length
      ? await sql<{ content_id: string; count: number }>`
          SELECT content_id, COUNT(*)::int as count
          FROM content_links
          WHERE content_id = ANY(${contentIds})
          GROUP BY content_id
        `
      : [];

    const linkCountMap = new Map(linkCounts.map((lc) => [lc.content_id, lc.count]));
    const result = rows.map((row) => ({
      ...row,
      linkCount: linkCountMap.get(row.id) || 0,
    }));

    return { ok: true as const, data: result };
  });

export const getPublishedContent = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string(), id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const content = await sql<{
      id: string;
      project_id: string;
      url: string;
      title: string;
      keyword: string;
      content_type: string;
      publish_date: string;
      author: string;
      status: string;
      backlinks: number;
      social_shares: number;
      notes: string;
      created_at: string;
    }>`
      SELECT * FROM published_content
      WHERE id = ${data.id} AND project_id = ${data.projectId}
      LIMIT 1
    `;

    if (!content[0]) {
      throw new Error("Content not found");
    }

    const links = await sql<{
      id: string;
      content_id: string;
      url: string;
      anchor_text: string;
      target_url: string;
      is_internal: boolean;
      is_dofollow: boolean;
      created_at: string;
    }>`
      SELECT * FROM content_links
      WHERE content_id = ${data.id}
      ORDER BY created_at
    `;

    return {
      ok: true as const,
      data: {
        ...content[0],
        links,
        internalLinks: links.filter((l) => l.is_internal),
        externalLinks: links.filter((l) => !l.is_internal),
      },
    };
  });

export const deletePublishedContent = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(DeleteContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess, canWrite } = await import("./access");
    const access = await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);
    if (!canWrite(access.role)) {
      throw new Error("Forbidden: Only owners and editors can delete content");
    }

    await sql`
      DELETE FROM content_links WHERE content_id = ${data.id}
    `;

    await sql`
      DELETE FROM published_content WHERE id = ${data.id} AND project_id = ${data.projectId}
    `;

    return { ok: true as const, message: "Content deleted successfully" };
  });

export const getContentStats = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ContentStatsSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - data.days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const totalContent = await sql<{ count: number }>`
      SELECT COUNT(*)::int as count FROM published_content
      WHERE project_id = ${data.projectId}
    `;

    const contentByType = await sql<{ content_type: string; count: number }>`
      SELECT content_type, COUNT(*)::int as count
      FROM published_content
      WHERE project_id = ${data.projectId}
      GROUP BY content_type
    `;

    const contentByStatus = await sql<{ status: string; count: number }>`
      SELECT status, COUNT(*)::int as count
      FROM published_content
      WHERE project_id = ${data.projectId}
      GROUP BY status
    `;

    const recentContent = await sql<{ count: number }>`
      SELECT COUNT(*)::int as count FROM published_content
      WHERE project_id = ${data.projectId}
      AND publish_date >= ${startDateStr}
    `;

    const totalBacklinks = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(backlinks), 0)::int as sum
      FROM published_content
      WHERE project_id = ${data.projectId}
    `;

    const totalSocialShares = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(social_shares), 0)::int as sum
      FROM published_content
      WHERE project_id = ${data.projectId}
    `;

    const totalLinks = await sql<{ count: number }>`
      SELECT COUNT(*)::int as count FROM content_links
      WHERE content_id IN (
        SELECT id FROM published_content WHERE project_id = ${data.projectId}
      )
    `;

    return {
      ok: true as const,
      data: {
        totalContent: totalContent[0]?.count || 0,
        recentContent: recentContent[0]?.count || 0,
        contentByType: contentByType.reduce((acc, row) => ({ ...acc, [row.content_type]: row.count }), {} as Record<string, number>),
        contentByStatus: contentByStatus.reduce((acc, row) => ({ ...acc, [row.status]: row.count }), {} as Record<string, number>),
        totalBacklinks: totalBacklinks[0]?.sum || 0,
        totalSocialShares: totalSocialShares[0]?.sum || 0,
        totalLinks: totalLinks[0]?.count || 0,
      },
    };
  });

export const getContentTimeline = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ContentStatsSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - data.days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const rows = await sql<{ publish_date: string; count: number }>`
      SELECT
        publish_date,
        COUNT(*)::int as count
      FROM published_content
      WHERE project_id = ${data.projectId}
      AND publish_date >= ${startDateStr}
      GROUP BY publish_date
      ORDER BY publish_date
    `;

    const timeline: Record<string, number> = {};
    for (let i = 0; i < data.days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      timeline[dateStr] = 0;
    }

    for (const row of rows) {
      timeline[row.publish_date] = row.count;
    }

    return { ok: true as const, data: timeline };
  });
