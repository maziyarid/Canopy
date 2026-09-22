export type PublicClickUpSettings = {
  hasApiKey: boolean;
  teamId: string;
  folderId: string;
  listId: string;
};

export type ClickUpSettingsRow = {
  api_key: string;
  team_id: string;
  folder_id: string;
  list_id: string;
};

export type ClickUpKeywordRow = {
  id: string;
  keyword: string;
  status: string;
  volume: number;
  clickup_task_id: string | null;
};

export type ClickUpSyncCreated = {
  keyword: string;
  clickUpId: string;
  url: string;
};

export type ClickUpSyncFailure = {
  keyword: string;
  error: string;
};

export type ClickUpSyncSummary = {
  ok: boolean;
  created: number;
  failed: number;
  skipped: number;
  totalTasks: number;
  createdTasks: ClickUpSyncCreated[];
  failures: ClickUpSyncFailure[];
  error: string;
};

const MASKED_SECRET = "••••••••";

export function toPublicClickUpSettings(row: ClickUpSettingsRow | null | undefined): PublicClickUpSettings {
  if (!row) {
    return { hasApiKey: false, teamId: "", folderId: "", listId: "" };
  }
  return {
    hasApiKey: Boolean(row.api_key?.trim()),
    teamId: row.team_id || "",
    folderId: row.folder_id || "",
    listId: row.list_id || "",
  };
}

export function mergeClickUpSettings(
  existing: ClickUpSettingsRow | null | undefined,
  incoming: { apiKey?: string; teamId?: string; folderId?: string; listId?: string },
): ClickUpSettingsRow {
  const nextKey = incoming.apiKey?.trim();
  const apiKey =
    nextKey && nextKey !== MASKED_SECRET ? nextKey : existing?.api_key?.trim() || "";
  if (!apiKey) {
    throw new Error("ClickUp is not configured");
  }
  return {
    api_key: apiKey,
    team_id: incoming.teamId?.trim() || existing?.team_id || "",
    folder_id: incoming.folderId?.trim() || existing?.folder_id || "",
    list_id: incoming.listId?.trim() || existing?.list_id || "",
  };
}

export function buildProjectKeywordQuery(projectId: string, keywordFilter?: string) {
  const params: unknown[] = [projectId];
  let text =
    "SELECT id, keyword, status, volume, clickup_task_id FROM keywords WHERE project_id = $1";
  const filter = keywordFilter?.trim();
  if (filter) {
    params.push(filter);
    text += ` AND strpos(lower(keyword), lower($${params.length})) > 0`;
  }
  text += " ORDER BY created_at DESC LIMIT 50";
  return { text, params };
}

export function hasClickUpTaskLink(taskId: string | null | undefined) {
  return Boolean(taskId?.trim());
}

export function partitionClickUpSyncKeywords(rows: ClickUpKeywordRow[]) {
  const skippedLinked: ClickUpKeywordRow[] = [];
  const toCreate: ClickUpKeywordRow[] = [];
  for (const row of rows) {
    if (row.status !== "briefed" && row.status !== "new") continue;
    if (hasClickUpTaskLink(row.clickup_task_id)) skippedLinked.push(row);
    else toCreate.push(row);
  }
  return { toCreate, skippedLinked };
}

export function summarizeClickUpSync(input: {
  created: ClickUpSyncCreated[];
  failed: ClickUpSyncFailure[];
  skipped: number;
}): ClickUpSyncSummary {
  const created = input.created.length;
  const failed = input.failed.length;
  const skipped = input.skipped;
  return {
    ok: failed === 0,
    created,
    failed,
    skipped,
    totalTasks: created + failed + skipped,
    createdTasks: input.created,
    failures: input.failed,
    error: failed > 0 ? `${failed} ClickUp task(s) failed` : "",
  };
}

export function buildClickUpClaimQuery(input: { id: string; claimId: string }) {
  return {
    text: `UPDATE keywords
           SET clickup_task_id = $1
           WHERE id = $2
             AND coalesce(nullif(trim(clickup_task_id), ''), '') = ''
           RETURNING id`,
    params: [input.claimId, input.id],
  };
}

export function buildClickUpLinkQuery(input: {
  id: string;
  claimId: string;
  clickUpId: string;
  url: string;
}) {
  return {
    text: `UPDATE keywords
           SET clickup_task_id = $1, clickup_task_url = $2
           WHERE id = $3 AND clickup_task_id = $4`,
    params: [input.clickUpId, input.url, input.id, input.claimId],
  };
}

export function buildClickUpReleaseQuery(input: { id: string; claimId: string }) {
  return {
    text: `UPDATE keywords
           SET clickup_task_id = ''
           WHERE id = $1 AND clickup_task_id = $2`,
    params: [input.id, input.claimId],
  };
}

type QuerySql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export async function executeClickUpKeywordSync(
  sql: QuerySql,
  input: {
    keywords: ClickUpKeywordRow[];
    createTask: (kw: ClickUpKeywordRow) => Promise<{ id: string; url: string }>;
    newClaimId?: () => string;
  },
): Promise<ClickUpSyncSummary> {
  const { toCreate, skippedLinked } = partitionClickUpSyncKeywords(input.keywords);
  const created: ClickUpSyncCreated[] = [];
  const failed: ClickUpSyncFailure[] = [];
  let skipped = skippedLinked.length;

  for (const kw of toCreate) {
    const claimId = (input.newClaimId ?? (() => `pending:${crypto.randomUUID()}`))();
    const claim = buildClickUpClaimQuery({ id: kw.id, claimId });
    const claimed = await sql.query<{ id: string }>(claim.text, claim.params);
    if (!claimed.length) {
      skipped += 1;
      continue;
    }
    try {
      const task = await input.createTask(kw);
      if (!task.id?.trim()) {
        throw new Error("ClickUp did not return a task id");
      }
      const link = buildClickUpLinkQuery({
        id: kw.id,
        claimId,
        clickUpId: task.id,
        url: task.url || "",
      });
      await sql.query(link.text, link.params);
      created.push({ keyword: kw.keyword, clickUpId: task.id, url: task.url || "" });
    } catch (error) {
      const release = buildClickUpReleaseQuery({ id: kw.id, claimId });
      await sql.query(release.text, release.params);
      failed.push({
        keyword: kw.keyword,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return summarizeClickUpSync({ created, failed, skipped });
}

export function buildSeoDataQuery(input: {
  projectId: string;
  keyword?: string;
  dataSource?: string;
  startDate?: string;
  endDate?: string;
}) {
  const params: unknown[] = [input.projectId];
  let text = `SELECT id, project_id, data_source, keyword, url, metric_name, metric_value, data_date, created_at
              FROM seo_data_cache
              WHERE project_id = $1`;
  if (input.keyword) {
    params.push(input.keyword);
    text += ` AND keyword = $${params.length}`;
  }
  if (input.dataSource) {
    params.push(input.dataSource);
    text += ` AND data_source = $${params.length}`;
  }
  if (input.startDate) {
    params.push(input.startDate);
    text += ` AND data_date >= $${params.length}`;
  }
  if (input.endDate) {
    params.push(input.endDate);
    text += ` AND data_date <= $${params.length}`;
  }
  text += " ORDER BY data_date DESC, created_at DESC";
  return { text, params };
}

export function buildSeoTimelineQuery(input: {
  projectId: string;
  startDate: string;
  metricName?: string;
}) {
  const params: unknown[] = [input.projectId, input.startDate];
  let text = `SELECT data_date, metric_name, metric_value, data_source
              FROM seo_data_cache
              WHERE project_id = $1
              AND data_date >= $2`;
  if (input.metricName) {
    params.push(input.metricName);
    text += ` AND metric_name = $${params.length}`;
  }
  text += " ORDER BY data_date, metric_name, data_source";
  return { text, params };
}

export function buildPublishedContentListQuery(input: {
  projectId: string;
  keyword?: string;
  contentType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}) {
  const params: unknown[] = [input.projectId];
  let text = `SELECT id, project_id, url, title, keyword, content_type, publish_date,
                     author, status, backlinks, social_shares, notes, created_at
              FROM published_content
              WHERE project_id = $1`;
  if (input.keyword) {
    params.push(input.keyword);
    text += ` AND strpos(lower(keyword), lower($${params.length})) > 0`;
  }
  if (input.contentType) {
    params.push(input.contentType);
    text += ` AND content_type = $${params.length}`;
  }
  if (input.status) {
    params.push(input.status);
    text += ` AND status = $${params.length}`;
  }
  if (input.startDate) {
    params.push(input.startDate);
    text += ` AND publish_date >= $${params.length}::date`;
  }
  if (input.endDate) {
    params.push(input.endDate);
    text += ` AND publish_date < ($${params.length}::date + interval '1 day')`;
  }
  params.push(input.limit, input.offset);
  text += ` ORDER BY publish_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  return { text, params };
}

export function buildPublishedContentUpdateQuery(input: {
  id: string;
  projectId: string;
  url?: string;
  title?: string;
  keyword?: string;
  contentType?: string;
  publishDate?: string;
  author?: string;
  status?: string;
  backlinks?: number;
  socialShares?: number;
  notes?: string;
}) {
  const sets: string[] = [];
  const params: unknown[] = [];
  const fields: Array<[keyof typeof input, string]> = [
    ["url", "url"],
    ["title", "title"],
    ["keyword", "keyword"],
    ["contentType", "content_type"],
    ["publishDate", "publish_date"],
    ["author", "author"],
    ["status", "status"],
    ["backlinks", "backlinks"],
    ["socialShares", "social_shares"],
    ["notes", "notes"],
  ];
  for (const [key, column] of fields) {
    if (input[key] !== undefined) {
      params.push(input[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (!sets.length) return null;
  params.push(input.id, input.projectId);
  return {
    text: `UPDATE published_content SET ${sets.join(", ")} WHERE id = $${params.length - 1} AND project_id = $${params.length}`,
    params,
  };
}
