import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioAuth } from "./studio-auth";

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
    
    // Verify project access
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

    // Save links if provided
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

    // Update keyword with content reference
    await sql`
      UPDATE keywords 
      SET last_published = NOW()
      WHERE project_id = ${data.projectId} AND keyword = ${data.keyword}
    `;

    return { ok: true as const, id, message: "Content published successfully" };
  });

export const updatePublishedContent = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(UpdateContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    // Check if content exists and belongs to project
    const existing = await sql<{ project_id: string }>`
      SELECT project_id FROM published_content WHERE id = ${data.id}
    `;

    if (!existing[0] || existing[0].project_id !== data.projectId) {
      throw new Error("Content not found or access denied");
    }

    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (data.url !== undefined) {
      updates.push(`url = $${values.length + 1}`);
      values.push(data.url);
    }
    if (data.title !== undefined) {
      updates.push(`title = $${values.length + 1}`);
      values.push(data.title);
    }
    if (data.keyword !== undefined) {
      updates.push(`keyword = $${values.length + 1}`);
      values.push(data.keyword);
    }
    if (data.contentType !== undefined) {
      updates.push(`content_type = $${values.length + 1}`);
      values.push(data.contentType);
    }
    if (data.publishDate !== undefined) {
      updates.push(`publish_date = $${values.length + 1}`);
      values.push(data.publishDate);
    }
    if (data.author !== undefined) {
      updates.push(`author = $${values.length + 1}`);
      values.push(data.author || "");
    }
    if (data.status !== undefined) {
      updates.push(`status = $${values.length + 1}`);
      values.push(data.status);
    }
    if (data.backlinks !== undefined) {
      updates.push(`backlinks = $${values.length + 1}`);
      values.push(data.backlinks);
    }
    if (data.socialShares !== undefined) {
      updates.push(`social_shares = $${values.length + 1}`);
      values.push(data.socialShares);
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${values.length + 1}`);
      values.push(data.notes || "");
    }

    if (updates.length > 0) {
      await sql`
        UPDATE published_content 
        SET ${updates.join(", ")} 
        WHERE id = ${data.id}
      `;
    }

    return { ok: true as const, message: "Content updated successfully" };
  });

export const listPublishedContent = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ListContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    let query = `
      SELECT * FROM published_content 
      WHERE project_id = ${data.projectId}
    `;

    const params: string[] = [];
    if (data.keyword) params.push(`keyword ILIKE '%${data.keyword}%'`);
    if (data.contentType) params.push(`content_type = ${data.contentType}`);
    if (data.status) params.push(`status = ${data.status}`);
    if (data.startDate) params.push(`publish_date >= ${data.startDate}`);
    if (data.endDate) params.push(`publish_date <= ${data.endDate}`);

    if (params.length > 0) {
      query += ` AND ${params.join(" AND ")}`;
    }

    query += ` ORDER BY publish_date DESC, created_at DESC LIMIT ${data.limit} OFFSET ${data.offset}`;

    const rows = await sql<{
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
    }>`${query}`;

    // Get link counts for each content
    const contentIds = rows.map(r => r.id);
    const linkCounts = await sql<{ content_id: string; count: number }>`
      SELECT content_id, COUNT(*)::int as count 
      FROM content_links 
      WHERE content_id = ANY(${contentIds})
      GROUP BY content_id
    `;

    const linkCountMap = new Map(linkCounts.map(lc => [lc.content_id, lc.count]));

    const result = rows.map(row => ({
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
    
    // Verify project access
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
        internalLinks: links.filter(l => l.is_internal),
        externalLinks: links.filter(l => !l.is_internal),
      } 
    };
  });

export const deletePublishedContent = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(DeleteContentSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
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
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - data.days);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Total content published
    const totalContent = await sql<{ count: number }>`
      SELECT COUNT(*)::int as count FROM published_content 
      WHERE project_id = ${data.projectId}
    `;

    // Content by type
    const contentByType = await sql<{ content_type: string; count: number }>`
      SELECT content_type, COUNT(*)::int as count 
      FROM published_content 
      WHERE project_id = ${data.projectId}
      GROUP BY content_type
    `;

    // Content by status
    const contentByStatus = await sql<{ status: string; count: number }>`
      SELECT status, COUNT(*)::int as count 
      FROM published_content 
      WHERE project_id = ${data.projectId}
      GROUP BY status
    `;

    // Recently published (last N days)
    const recentContent = await sql<{ count: number }>`
      SELECT COUNT(*)::int as count FROM published_content 
      WHERE project_id = ${data.projectId}
      AND publish_date >= ${startDateStr}
    `;

    // Total backlinks
    const totalBacklinks = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(backlinks), 0)::int as sum 
      FROM published_content 
      WHERE project_id = ${data.projectId}
    `;

    // Total social shares
    const totalSocialShares = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(social_shares), 0)::int as sum 
      FROM published_content 
      WHERE project_id = ${data.projectId}
    `;

    // Total links
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
    
    // Verify project access
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

    // Fill in missing dates
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