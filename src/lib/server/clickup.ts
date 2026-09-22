import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Sql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { canWrite, resolveAccess } from "./access";
import {
  buildProjectKeywordQuery,
  toPublicClickUpSettings,
  type ClickUpSettingsRow,
  type PublicClickUpSettings,
} from "./query-builders";
export type { PublicClickUpSettings } from "./query-builders";

const CLICKUP_API_URL = "https://api.clickup.com/api/v2";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

function jsonString(value: Json, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const field = value[key];
  return typeof field === "string" ? field : "";
}


const ClickUpAPIKeySchema = z.object({
  apiKey: z.string().min(1),
  teamId: z.string().min(1).optional(),
  folderId: z.string().min(1).optional(),
  listId: z.string().min(1).optional(),
});

const CreateTaskSchema = z.object({
  listId: z.string().min(1).optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

const GetTasksSchema = z.object({
  listId: z.string().min(1).optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

async function loadStoredClickUpSettings(sql: Sql, userId: string): Promise<ClickUpSettingsRow> {
  const rows = await sql<ClickUpSettingsRow>`
    SELECT api_key, team_id, folder_id, list_id
    FROM clickup_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.api_key?.trim()) {
    throw new Error("ClickUp is not configured");
  }
  return row;
}

async function clickUpRequest(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`${CLICKUP_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }
  return response.json() as Promise<Json>;
}

async function createClickUpTaskInternal(
  apiKey: string,
  input: {
    listId: string;
    title: string;
    description?: string;
    priority?: number;
    dueDate?: string;
    customFields?: Record<string, Json> | Json[];
  },
): Promise<Json> {
  return clickUpRequest(apiKey, `/list/${encodeURIComponent(input.listId)}/task`, {
    method: "POST",
    body: JSON.stringify({
      name: input.title,
      description: input.description || "",
      priority: input.priority || 3,
      due_date: input.dueDate ? new Date(input.dueDate).getTime() : undefined,
      custom_fields: input.customFields || [],
    }),
  });
}

export const saveClickUpSettings = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ClickUpAPIKeySchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
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
  .handler(async ({ context }): Promise<PublicClickUpSettings> => {
    const sql = await (await import("@/lib/db")).getSql();
    if (!context.userId) {
      throw new Error("Unauthorized");
    }

    const rows = await sql<ClickUpSettingsRow>`
      SELECT api_key, team_id, folder_id, list_id
      FROM clickup_settings
      WHERE user_id = ${context.userId}
      LIMIT 1
    `;

    return toPublicClickUpSettings(rows[0]);
  });

export const getClickUpLists = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .handler(async ({ context }) => {
    const sql = await (await import("@/lib/db")).getSql();
    if (!context.userId) {
      throw new Error("Unauthorized");
    }
    try {
      const settings = await loadStoredClickUpSettings(sql, context.userId);
      const json = await clickUpRequest(settings.api_key, "/team");
      return { ok: true as const, data: json };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });

export const getClickUpTasks = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(GetTasksSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    if (!context.userId) {
      throw new Error("Unauthorized");
    }
    try {
      const settings = await loadStoredClickUpSettings(sql, context.userId);
      const listId = (data.listId || settings.list_id).trim();
      if (!listId) {
        throw new Error("ClickUp list is not configured");
      }
      const search = new URLSearchParams({
        archived: "false",
        page: "1",
        limit: String(data.limit),
        order_by: "createdate",
        subtasks: "false",
      });
      if (data.status) search.set("statuses[]", data.status);
      const json = await clickUpRequest(
        settings.api_key,
        `/list/${encodeURIComponent(listId)}/task?${search.toString()}`,
      );
      return { ok: true as const, data: json };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });

export const createClickUpTask = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(CreateTaskSchema)
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    if (!context.userId) {
      throw new Error("Unauthorized");
    }
    try {
      const settings = await loadStoredClickUpSettings(sql, context.userId);
      const listId = (data.listId || settings.list_id).trim();
      if (!listId) {
        throw new Error("ClickUp list is not configured");
      }
      const json = await createClickUpTaskInternal(settings.api_key, { ...data, listId });
      return { ok: true as const, data: json as Json };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });

export const syncClickUpWithProject = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({
    projectId: z.string(),
    listId: z.string().min(1).optional(),
    keywordFilter: z.string().max(200).optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await (await import("@/lib/db")).getSql();
    if (!context.userId) {
      throw new Error("Unauthorized");
    }

    const access = await resolveAccess(sql, context.userId, context.email || "", data.projectId);
    if (!canWrite(access.role)) {
      throw new Error("Forbidden");
    }

    const settings = await loadStoredClickUpSettings(sql, context.userId);
    const listId = (data.listId || settings.list_id).trim();
    if (!listId) {
      throw new Error("ClickUp list is not configured");
    }

    const query = buildProjectKeywordQuery(data.projectId, data.keywordFilter);
    const keywords = await sql.query<{ keyword: string; status: string; volume: number }>(query.text, query.params);
    const scoped = access.filter.trim()
      ? keywords.filter((kw) =>
          access.filter
            .split(/[,،\n]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
            .includes(kw.keyword.toLowerCase()),
        )
      : keywords;

    const tasksToCreate = scoped.filter((kw) => kw.status === "briefed" || kw.status === "new");
    const createdTasks = [];
    for (const kw of tasksToCreate) {
      try {
        const task = await createClickUpTaskInternal(settings.api_key, {
          listId,
          title: `SEO: ${kw.keyword} (Volume: ${kw.volume})`,
          description: `Keyword research task for: ${kw.keyword}\n\nVolume: ${kw.volume}\nStatus: ${kw.status}`,
          priority: kw.status === "briefed" ? 2 : 3,
        });
        createdTasks.push({
          keyword: kw.keyword,
          clickUpId: jsonString(task, "id"),
          url: jsonString(task, "url"),
        });
        await sql`
          UPDATE keywords
          SET clickup_task_id = ${jsonString(task, "id")},
              clickup_task_url = ${jsonString(task, "url")}
          WHERE project_id = ${data.projectId} AND keyword = ${kw.keyword}
        `;
      } catch {
        createdTasks.push({
          keyword: kw.keyword,
          clickUpId: "",
          url: "",
        });
      }
    }

    return {
      ok: true as const,
      createdTasks,
      totalTasks: tasksToCreate.length,
    };
  });
