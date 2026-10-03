import type { Sql } from "../db.ts";
import { LaunchError, type LaunchIntent, type LaunchMapping } from "./platform-launch.ts";
export const LAUNCH_SESSION_MARKER = "maziyarid-platform-launch:";
/** Explicit mapping AND existing grants are required. Email is deliberately absent. */
export async function currentLaunchMapping(
  sql: Sql,
  intent: Pick<LaunchIntent, "principal_id" | "tenant_id" | "workspace_id">,
): Promise<LaunchMapping> {
  const rows = await sql.query<LaunchMapping>(
    `
    select m.* from platform_launch_mappings m
    join "user" u on u.id=m.user_id
    join projects p on p.id=m.project_id and p.tenant_id=m.tenant_id
    join tenants t on t.id=m.tenant_id and t.status='active'
    where m.principal_id=$1 and m.platform_tenant_id=$2 and m.platform_workspace_id=$3
      and m.status='active' and p.status='active'
      and (t.owner_id=m.user_id or exists(select 1 from tenant_members tm where tm.tenant_id=t.id and tm.user_id=m.user_id))
      and (p.owner_id=m.user_id or exists(select 1 from project_access pa where pa.project_id=p.id and pa.user_id=m.user_id and pa.role in ('editor','client')))
  `,
    [intent.principal_id, intent.tenant_id, intent.workspace_id],
  );
  if (rows.length !== 1) throw new LaunchError(403);
  return rows[0];
}
export type LaunchScope = LaunchMapping & { session_id: string; receipt_id: string };
export async function launchSessionScope(
  sql: Sql,
  sessionId: string,
  userId: string,
): Promise<LaunchScope | null> {
  const rows = await sql.query<{ userAgent: string; userId: string }>(
    'select "userAgent","userId" from "session" where id=$1 and "expiresAt">now()',
    [sessionId],
  );
  if (rows.length !== 1 || rows[0].userId !== userId) throw new LaunchError(401);
  if (!rows[0].userAgent?.startsWith(LAUNCH_SESSION_MARKER)) return null;
  const scopes = await sql.query<LaunchScope>(
    `select session_id,receipt_id,principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id
    from platform_launch_sessions where session_id=$1 and user_id=$2 and expires_at>now() and revoked_at is null`,
    [sessionId, userId],
  );
  const scope = scopes[0];
  if (
    !scope ||
    scopes.length !== 1 ||
    rows[0].userAgent !== LAUNCH_SESSION_MARKER + scope.receipt_id
  )
    throw new LaunchError(401);
  const mapping = await currentLaunchMapping(sql, {
    principal_id: scope.principal_id,
    tenant_id: scope.platform_tenant_id,
    workspace_id: scope.platform_workspace_id,
  });
  if (
    mapping.user_id !== scope.user_id ||
    mapping.project_id !== scope.project_id ||
    mapping.tenant_id !== scope.tenant_id
  )
    throw new LaunchError(403);
  return scope;
}
