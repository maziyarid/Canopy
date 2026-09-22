import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioAuth } from "./studio-auth";

const ClickUpAPIKeySchema = z.object({
  apiKey: z.string().min(1),
  teamId: z.string().min(1).optional(),
  folderId: z.string().min(1).optional(),
  listId: z.string().min(1).optional(),
});

const CreateTaskSchema = z.object({
  apiKey: z.string().min(1),
  listId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const GetTasksSchema = z.object({
  apiKey: z.string().min(1),
  listId: z.string().min(1),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const ClickUpListSchema = z.object({
  apiKey: z.string().min(1),
});

// Base URL for ClickUp API
const CLICKUP_API_URL = "https://api.clickup.com/api/v2";

export const saveClickUpSettings = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ClickUpAPIKeySchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Check if user has access
    if (!context.userId) {
      throw new Error("Unauthorized");
    }

    await sql`
      INSERT INTO clickup_settings (user_id, api_key, team_id, folder_id, list_id, created_at, updated_at)
      VALUES (${context.userId}, ${data.apiKey}, ${data.teamId || ""}, ${data.folderId || ""}, ${data.listId || ""}, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        api_key = ${data.apiKey},
        team_id = ${data.teamId || ""},
        folder_id = ${data.folderId || ""},
        list_id = ${data.listId || ""},
        updated_at = NOW()
    `;

    return { ok: true as const, message: "ClickUp settings saved successfully" };
  });

export const getClickUpSettings = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .handler(async ({ context }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    if (!context.userId) {
      throw new Error("Unauthorized");
    }

    const rows = await sql<{
      api_key: string;
      team_id: string;
      folder_id: string;
      list_id: string;
    }>`
      SELECT api_key, team_id, folder_id, list_id 
      FROM clickup_settings 
      WHERE user_id = ${context.userId}
      LIMIT 1
    `;

    return rows[0] || null;
  });

export const getClickUpLists = createServerFn({ method: "POST" })
  .validator(ClickUpListSchema)
  .handler(async ({ data }) => {
    try {
      const response = await fetch(`${CLICKUP_API_URL}/team`, {
        headers: {
          Authorization: data.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ClickUp API error: ${response.status} - ${error}`);
      }

      const json = await response.json();
      return { ok: true as const, data: json };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });

export const getClickUpTasks = createServerFn({ method: "POST" })
  .validator(GetTasksSchema)
  .handler(async ({ data }) => {
    try {
      const url = new URL(`${CLICKUP_API_URL}/list/${data.listId}/task`);
      url.searchParams.set("archived", "false");
      if (data.status) {
        url.searchParams.set("statuses[]", data.status);
      }
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", String(data.limit));
      url.searchParams.set("order_by", "createdate");
      url.searchParams.set("subtasks", "false");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: data.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ClickUp API error: ${response.status} - ${error}`);
      }

      const json = await response.json();
      return { ok: true as const, data: json };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });

export const createClickUpTask = createServerFn({ method: "POST" })
  .validator(CreateTaskSchema)
  .handler(async ({ data }) => {
    try {
      const response = await fetch(`${CLICKUP_API_URL}/list/${data.listId}/task`, {
        method: "POST",
        headers: {
          Authorization: data.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.title,
          description: data.description || "",
          priority: data.priority || 3,
          due_date: data.dueDate ? new Date(data.dueDate).getTime() : undefined,
          custom_fields: data.customFields || [],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ClickUp API error: ${response.status} - ${error}`);
      }

      const json = await response.json();
      return { ok: true as const, data: json };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });

export const syncClickUpWithProject = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({
    projectId: z.string(),
    apiKey: z.string().min(1),
    listId: z.string().min(1),
    keywordFilter: z.string().optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    
    // Verify project access
    const { resolveAccess } = await import("./access");
    await resolveAccess(sql, context.userId || "", context.email || "", data.projectId);

    // Get keywords from project
    const keywords = await sql<{ keyword: string; status: string; volume: number }>`
      SELECT keyword, status, volume FROM keywords 
      WHERE project_id = ${data.projectId}
      ${data.keywordFilter ? `AND keyword ILIKE '%${data.keywordFilter}%'` : ""}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Create tasks for each keyword that needs attention
    const tasksToCreate = keywords.filter(kw => kw.status === "briefed" || kw.status === "new");
    
    const createdTasks = [];
    for (const kw of tasksToCreate) {
      const taskResponse = await createClickUpTask({
        data: {
          apiKey: data.apiKey,
          listId: data.listId,
          title: `SEO: ${kw.keyword} (Volume: ${kw.volume})`,
          description: `Keyword research task for: ${kw.keyword}\n\nVolume: ${kw.volume}\nStatus: ${kw.status}`,
          priority: kw.status === "briefed" ? 2 : 3,
        },
      });

      if (taskResponse.ok) {
        createdTasks.push({
          keyword: kw.keyword,
          clickUpId: taskResponse.data?.id,
          url: taskResponse.data?.url,
        });

        // Update keyword with ClickUp task reference
        await sql`
          UPDATE keywords 
          SET clickup_task_id = ${taskResponse.data?.id || ""}, 
              clickup_task_url = ${taskResponse.data?.url || ""}
          WHERE project_id = ${data.projectId} AND keyword = ${kw.keyword}
        `;
      }
    }

    return {
      ok: true as const,
      createdTasks,
      totalTasks: tasksToCreate.length,
    };
  });
