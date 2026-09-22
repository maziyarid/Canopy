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

export function buildProjectKeywordQuery(projectId: string, keywordFilter?: string) {
  const params: unknown[] = [projectId];
  let text = "SELECT keyword, status, volume FROM keywords WHERE project_id = $1";
  const filter = keywordFilter?.trim();
  if (filter) {
    params.push(filter);
    text += ` AND strpos(lower(keyword), lower($${params.length})) > 0`;
  }
  text += " ORDER BY created_at DESC LIMIT 50";
  return { text, params };
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
    text += ` AND publish_date >= $${params.length}`;
  }
  if (input.endDate) {
    params.push(input.endDate);
    text += ` AND publish_date <= $${params.length}`;
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
