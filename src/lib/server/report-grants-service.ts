import { parseReportSections } from "./report-sections.ts";
import { resolveSnapshotAccess, SnapshotAccessError, type AccessResolver, type SnapshotSql } from "./reporting-snapshot-service.ts";

export async function updateReportGrants(opts: {
  sql: SnapshotSql; resolveAccess: AccessResolver; userId: string; email: string;
  projectId: string; memberId: string; sections: string[];
}) {
  const access = await resolveSnapshotAccess(opts.resolveAccess, opts.sql, opts.userId, opts.email, opts.projectId);
  if (access.role !== "owner" || access.filter.trim()) throw new SnapshotAccessError(403, "Forbidden");
  const sections = parseReportSections(opts.sections);
  const evidence = JSON.stringify({ memberId: opts.memberId, sections });
  // Grant and audit receipt commit together; a member from another project updates nothing.
  const changed = await opts.sql<{ id: string }>`
    with changed as (
      update project_access set report_sections = ${JSON.stringify(sections)}
      where id = ${opts.memberId} and project_id = ${access.project.id} and role = 'client'
      returning id
    )
    insert into operation_receipts(id, project_id, actor_ref, operation, target_ref, status, evidence)
    select ${crypto.randomUUID()}, ${access.project.id}, ${opts.userId}, 'report.grants.update', id, 'completed', ${evidence}
    from changed returning id
  `;
  if (!changed.length) throw new SnapshotAccessError(404, "Not found");
  return { sections };
}
