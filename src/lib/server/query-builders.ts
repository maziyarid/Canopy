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
  clickup_task_url?: string | null;
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
export const CLICKUP_PENDING_PREFIX = "pending:";
export const CLICKUP_CLAIM_TTL_MS = 5 * 60 * 1000;

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
    "SELECT id, keyword, status, volume, clickup_task_id, clickup_task_url FROM keywords WHERE project_id = $1";
  const filter = keywordFilter?.trim();
  if (filter) {
    params.push(filter);
    text += ` AND strpos(lower(keyword), lower($${params.length})) > 0`;
  }
  text += " ORDER BY created_at DESC LIMIT 50";
  return { text, params };
}

export function hasClickUpTaskLink(taskId: string | null | undefined) {
  return isDurableClickUpLink(taskId);
}

export function isPendingClickUpClaim(taskId: string | null | undefined) {
  return Boolean(taskId?.startsWith(CLICKUP_PENDING_PREFIX));
}

export function isDurableClickUpLink(taskId: string | null | undefined) {
  const value = taskId?.trim() ?? "";
  return Boolean(value) && !value.startsWith(CLICKUP_PENDING_PREFIX);
}

export function pendingClaimAgeMs(taskId: string, now = Date.now()) {
  const stamp = taskId.slice(CLICKUP_PENDING_PREFIX.length).split(":")[0];
  const parsed = Number(stamp);
  if (!Number.isFinite(parsed) || parsed < 1e12) return Number.POSITIVE_INFINITY;
  return now - parsed;
}

export function isFreshPendingClaim(taskId: string | null | undefined, now = Date.now()) {
  if (!isPendingClickUpClaim(taskId) || !taskId) return false;
  return pendingClaimAgeMs(taskId, now) < CLICKUP_CLAIM_TTL_MS;
}

export function newClickUpClaimId(now = Date.now()) {
  return `${CLICKUP_PENDING_PREFIX}${now}:${crypto.randomUUID()}`;
}

export function recoveredClickUpTaskId(row: ClickUpKeywordRow) {
  if (!isPendingClickUpClaim(row.clickup_task_id)) return "";
  const stored = row.clickup_task_url?.trim() ?? "";
  if (!stored || stored.startsWith(CLICKUP_PENDING_PREFIX)) return "";
  const fromUrl = stored.match(/\/t\/([^/?#]+)/i);
  if (fromUrl?.[1]) return fromUrl[1];
  if (stored.includes("://") || stored.startsWith("//") || stored.includes("/")) return "";
  return stored;
}

export function recoveredClickUpTaskUrl(row: ClickUpKeywordRow, remoteId: string) {
  const stored = row.clickup_task_url?.trim() ?? "";
  if (stored.startsWith("https://") || stored.startsWith("http://")) return stored;
  return remoteId ? `https://app.clickup.com/t/${remoteId}` : "";
}

export function partitionClickUpSyncKeywords(rows: ClickUpKeywordRow[], now = Date.now()) {
  const skippedLinked: ClickUpKeywordRow[] = [];
  const toCreate: ClickUpKeywordRow[] = [];
  for (const row of rows) {
    if (row.status !== "briefed" && row.status !== "new") continue;
    if (isDurableClickUpLink(row.clickup_task_id)) {
      skippedLinked.push(row);
      continue;
    }
    if (isFreshPendingClaim(row.clickup_task_id, now) && !recoveredClickUpTaskId(row)) {
      skippedLinked.push(row);
      continue;
    }
    toCreate.push(row);
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

export function buildClickUpClaimQuery(input: { id: string; claimId: string; previous?: string }) {
  return {
    text: `UPDATE keywords
           SET clickup_task_id = $1
           WHERE id = $2
             AND (
               coalesce(nullif(trim(clickup_task_id), ''), '') = ''
               OR (
                 clickup_task_id = $3
                 AND clickup_task_id LIKE 'pending:%'
               )
             )
           RETURNING id`,
    params: [input.claimId, input.id, input.previous ?? ""],
  };
}

export function buildClickUpRecoveryQuery(input: { id: string; remoteId: string; url: string }) {
  const recovery = input.url.trim() || input.remoteId;
  return {
    text: `UPDATE keywords
           SET clickup_task_url = $1
           WHERE id = $2
             AND clickup_task_id LIKE 'pending:%'`,
    params: [recovery, input.id],
  };
}

export function buildClickUpLinkQuery(input: {
  id: string;
  clickUpId: string;
  url: string;
}) {
  return {
    text: `UPDATE keywords
           SET clickup_task_id = $1, clickup_task_url = $2
           WHERE id = $3
             AND (
               coalesce(nullif(trim(clickup_task_id), ''), '') = ''
               OR clickup_task_id LIKE 'pending:%'
             )`,
    params: [input.clickUpId, input.url, input.id],
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
    const recoveredId = recoveredClickUpTaskId(kw);
    if (recoveredId) {
      const url = recoveredClickUpTaskUrl(kw, recoveredId);
      try {
        const link = buildClickUpLinkQuery({ id: kw.id, clickUpId: recoveredId, url });
        await sql.query(link.text, link.params);
        created.push({ keyword: kw.keyword, clickUpId: recoveredId, url });
      } catch (error) {
        failed.push({
          keyword: kw.keyword,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      continue;
    }

    const previous = isPendingClickUpClaim(kw.clickup_task_id) ? kw.clickup_task_id ?? "" : "";
    const claimId = (input.newClaimId ?? newClickUpClaimId)();
    const claim = buildClickUpClaimQuery({ id: kw.id, claimId, previous });
    const claimed = await sql.query<{ id: string }>(claim.text, claim.params);
    if (!claimed.length) {
      skipped += 1;
      continue;
    }
    let remote: { id: string; url: string } | null = null;
    try {
      const task = await input.createTask(kw);
      if (!task.id?.trim()) {
        throw new Error("ClickUp did not return a task id");
      }
      remote = {
        id: task.id.trim(),
        url: task.url?.trim() || `https://app.clickup.com/t/${task.id.trim()}`,
      };
      const recovery = buildClickUpRecoveryQuery({
        id: kw.id,
        remoteId: remote.id,
        url: remote.url,
      });
      await sql.query(recovery.text, recovery.params);
      const link = buildClickUpLinkQuery({
        id: kw.id,
        clickUpId: remote.id,
        url: remote.url,
      });
      await sql.query(link.text, link.params);
      created.push({ keyword: kw.keyword, clickUpId: remote.id, url: remote.url });
    } catch (error) {
      if (!remote) {
        const release = buildClickUpReleaseQuery({ id: kw.id, claimId });
        await sql.query(release.text, release.params);
      }
      failed.push({
        keyword: kw.keyword,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return summarizeClickUpSync({ created, failed, skipped });
}

export function buildSeoCacheUpsertQuery(input: {
  id: string;
  projectId: string;
  dataSource: string;
  keyword: string;
  url: string;
  metricName: string;
  metricValue: number;
  dataDate: string;
}) {
  return {
    text: `INSERT INTO seo_data_cache (
             id, project_id, data_source, keyword, url, metric_name, metric_value, data_date, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (project_id, data_source, keyword, url, metric_name, data_date)
           DO UPDATE SET metric_value = EXCLUDED.metric_value, created_at = NOW()`,
    params: [
      input.id,
      input.projectId,
      input.dataSource,
      input.keyword,
      input.url,
      input.metricName,
      input.metricValue,
      input.dataDate,
    ],
  };
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
