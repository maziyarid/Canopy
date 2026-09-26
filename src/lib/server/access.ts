import type { Sql } from "@/lib/db";
import type { Project, Role } from "@/lib/types";

export function nid() {
  return crypto.randomUUID();
}

export type DataDomain = "medical" | "thesis" | "other";

export type DbProject = {
  id: string;
  owner_id: string;
  name: string;
  domain: string;
  data_domain: DataDomain;
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

export function canAdminProviders(role: Role, keywordFilter: string) {
  return canWrite(role) && !keywordFilter.trim();
}

/**
 * Hard deny when a *context* project's data_domain does not match the
 * *target* project's data_domain (e.g. cross-domain data-plane read).
 * Structurally identical to cross-project denial (indistinguishable "Project not found").
 *
 * Policy (AAX-134 / AAX-55):
 * - Multi-domain *membership* is allowed: a principal may own/edit both a
 *   medical and a thesis project. resolveAccess does NOT call this helper.
 * - Domain isolation is enforced at the data-plane boundary when a request
 *   carries an ambient context domain that must match the target.
 * - Call assertSameDataDomain only when such a context exists; do not use it
 *   to forbid independent project grants.
 */
export function assertSameDataDomain(
  ctxDomain: DataDomain,
  targetDomain: DataDomain,
): void {
  if (ctxDomain !== targetDomain) {
    throw new Error("Project not found");
  }
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
  // Ensure data_domain is always a valid enum even on pre-migration rows.
  const domain = (project.data_domain ?? "other") as DataDomain;
  const normalized: DbProject = { ...project, data_domain: domain };
  if (normalized.owner_id === userId) {
    return { role: "owner", filter: "", project: normalized };
  }
  const rows = await sql<{ role: Role; keyword_filter: string }>`
    select role, keyword_filter from project_access
    where project_id = ${projectId}
      and (user_id = ${userId} or (${email} <> '' and email = ${email}))
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Forbidden");
  return { role: row.role, filter: row.keyword_filter ?? "", project: normalized };
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
    dataDomain: p.data_domain ?? "other",
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
