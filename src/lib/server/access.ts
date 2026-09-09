import type { Sql } from "@/lib/db";
import type { Project, Role } from "@/lib/types";

export function nid() {
  return crypto.randomUUID();
}

export type DbProject = {
  id: string;
  owner_id: string;
  name: string;
  domain: string;
  location_id: number;
  language_id: number;
  platform_id: number;
  competitors: string;
  tracking_id: string;
  notes: string;
  status: string;
  created_at: string;
};

export type AccessCtx = {
  role: Role;
  filter: string;
  project: DbProject;
};

export function canWrite(role: Role) {
  return role === "owner" || role === "editor";
}

export async function linkInvites(sql: Sql, userId: string, email: string) {
  if (!email) return;
  await sql`update project_access set user_id = ${userId} where email = ${email} and (user_id is null or user_id = '')`;
}

export async function resolveAccess(
  sql: Sql,
  userId: string,
  email: string,
  projectId: string,
): Promise<AccessCtx> {
  const projects = await sql<DbProject>`select * from projects where id = ${projectId}`;
  const project = projects[0];
  if (!project) throw new Error("Project not found");
  if (project.owner_id === userId) {
    return { role: "owner", filter: "", project };
  }
  const rows = await sql<{ role: Role; keyword_filter: string }>`
    select role, keyword_filter from project_access
    where project_id = ${projectId}
      and (user_id = ${userId} or (${email} <> '' and email = ${email}))
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Forbidden");
  return { role: row.role, filter: row.keyword_filter ?? "", project };
}

export function filterKeywords<T extends { keyword: string }>(rows: T[], filter: string) {
  const allowed = filter
    .split(/[,،\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return rows;
  return rows.filter((r) => allowed.includes(r.keyword.toLowerCase()));
}

export function toProject(
  p: DbProject,
  extra: { role: Role; keywordFilter: string; keywordCount: number; memberCount: number; avgRank: number | null; top10: number },
): Project {
  return {
    id: p.id,
    ownerId: p.owner_id,
    name: p.name,
    domain: p.domain,
    locationId: Number(p.location_id),
    languageId: Number(p.language_id),
    platformId: Number(p.platform_id),
    competitors: p.competitors,
    trackingId: p.tracking_id,
    notes: p.notes,
    status: p.status,
    createdAt: String(p.created_at),
    role: extra.role,
    keywordFilter: extra.keywordFilter,
    keywordCount: extra.keywordCount,
    memberCount: extra.memberCount,
    avgRank: extra.avgRank,
    top10: extra.top10,
  };
}

export async function ownerMangoolsKey(sql: Sql, ownerId: string) {
  const rows = await sql<{ mangools_key: string }>`
    select mangools_key from studio_settings where user_id = ${ownerId}
  `;
  return rows[0]?.mangools_key?.trim() ?? "";
}

export async function ownerMondayHook(sql: Sql, ownerId: string) {
  const rows = await sql<{ monday_webhook: string }>`
    select monday_webhook from studio_settings where user_id = ${ownerId}
  `;
  return rows[0]?.monday_webhook?.trim() ?? "";
}
