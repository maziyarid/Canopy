import { createHash } from "node:crypto";
import { approveForClient, createInsight, editManualInsight, redactInsightForRole, type InsightRecord } from "./evidence-insights.ts";
import { evidenceFromSnapshot, insightsFromSnapshot } from "./snapshot-insight-adapter.ts";
import { SnapshotAccessError, type SnapshotAccess, type SnapshotSql } from "./reporting-snapshot-service.ts";
import type { ReportingSnapshot, SnapshotPeriod } from "./reporting-snapshot-core.ts";
import { parseReportSections } from "./report-sections.ts";
import { redactForClient } from "./redact.ts";

function assertWriter(access: SnapshotAccess) {
  if (access.role === "client" || access.filter.trim()) throw new SnapshotAccessError(403, "Forbidden");
}

function safeStoredNote(payload: string, access: SnapshotAccess): InsightRecord | null {
  const note = JSON.parse(payload) as InsightRecord;
  if (note.projectId !== access.project.id || !Array.isArray(note.evidenceRefs) || note.evidenceRefs.some(ref => ref.site !== access.project.domain)) return null;
  return note;
}

async function insertNote(sql: SnapshotSql, access: SnapshotAccess, note: InsightRecord) {
  await sql`insert into report_insights(id,project_id,site,period_start,period_end,generated_at,payload)
    values (${note.id},${access.project.id},${access.project.domain},${note.periodStart},${note.periodEnd},${note.generatedAt},${JSON.stringify(note)})
    on conflict(id) do nothing`;
}

async function loadNotePage(
  sql: SnapshotSql,
  access: SnapshotAccess,
  period: SnapshotPeriod,
  pageSize: number,
  cursorGeneratedAt: string | null,
  cursorId: string | null,
  clientOnly: boolean,
) {
  if (clientOnly && (cursorGeneratedAt == null || cursorId == null)) {
    return sql<{ payload: string; revision: number; generated_at: string; id: string }>`select payload,revision,generated_at,id from report_insights
      where project_id=${access.project.id} and site=${access.project.domain} and period_end>=${period.start} and period_start<=${period.end}
        and payload::json->>'visibility'='client' and payload::json->>'reviewState'='approved'
      order by generated_at desc,id asc limit ${pageSize}`;
  }
  if (clientOnly) {
    return sql<{ payload: string; revision: number; generated_at: string; id: string }>`select payload,revision,generated_at,id from report_insights
      where project_id=${access.project.id} and site=${access.project.domain} and period_end>=${period.start} and period_start<=${period.end}
        and payload::json->>'visibility'='client' and payload::json->>'reviewState'='approved'
        and (generated_at < ${cursorGeneratedAt} or (generated_at = ${cursorGeneratedAt} and id > ${cursorId}))
      order by generated_at desc,id asc limit ${pageSize}`;
  }
  if (cursorGeneratedAt == null || cursorId == null) {
    return sql<{ payload: string; revision: number; generated_at: string; id: string }>`select payload,revision,generated_at,id from report_insights
      where project_id=${access.project.id} and site=${access.project.domain} and period_end>=${period.start} and period_start<=${period.end}
      order by generated_at desc,id asc limit ${pageSize}`;
  }
  return sql<{ payload: string; revision: number; generated_at: string; id: string }>`select payload,revision,generated_at,id from report_insights
    where project_id=${access.project.id} and site=${access.project.domain} and period_end>=${period.start} and period_start<=${period.end}
      and (generated_at < ${cursorGeneratedAt} or (generated_at = ${cursorGeneratedAt} and id > ${cursorId}))
    order by generated_at desc,id asc limit ${pageSize}`;
}

export async function persistSnapshotInsights(sql: SnapshotSql, access: SnapshotAccess, snapshot: ReportingSnapshot) {
  assertWriter(access);
  if (snapshot.projectId !== access.project.id || snapshot.site !== access.project.domain) throw new SnapshotAccessError(404, "Not found");
  for (const generated of insightsFromSnapshot(snapshot)) {
    const identity = { projectId: generated.projectId, periodStart: generated.periodStart, periodEnd: generated.periodEnd, title: generated.title, body: generated.body, evidenceRefs: generated.evidenceRefs };
    const note = { ...generated, id: `snapshot_${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}` };
    await insertNote(sql, access, note);
  }
}

export async function readPeriodNotes(sql: SnapshotSql, access: SnapshotAccess, period: SnapshotPeriod): Promise<Array<InsightRecord & { revision: number }>> {
  if (access.filter.trim()) throw new SnapshotAccessError(403, "Forbidden");
  const out: Array<InsightRecord & { revision: number }> = [];
  const grants = new Set(parseReportSections(access.reportSections));
  const pageSize = 100;
  const clientOnly = access.role === "client";
  let cursorGeneratedAt: string | null = null;
  let cursorId: string | null = null;
  while (out.length < 100) {
    const rows = await loadNotePage(sql, access, period, pageSize, cursorGeneratedAt, cursorId, clientOnly);
    if (!rows.length) break;
    for (const row of rows) {
      cursorGeneratedAt = row.generated_at;
      cursorId = row.id;
      const stored = safeStoredNote(row.payload, access);
      if (!stored) continue;
      if (access.role === "client") {
        if (!stored.evidenceRefs.length || !stored.evidenceRefs.every(ref => ref.provider === "gsc" ? grants.has("search") : ref.provider === "ga4" ? grants.has(ref.metricName === "conversions" || ref.metricName === "keyEvents" ? "conversions" : "acquisition") : false)) continue;
      }
      const note = redactInsightForRole(stored, access.role);
      if (!note) continue;
      if (access.role === "client") {
        note.title = redactForClient(note.title); note.body = redactForClient(note.body);
        note.limitation = redactForClient(note.limitation);
        note.recommendedAction = note.recommendedAction ? redactForClient(note.recommendedAction) : null;
      }
      out.push({ ...note, revision: row.revision });
      if (out.length >= 100) break;
    }
    if (rows.length < pageSize) break;
  }
  return out;
}

export async function createManualNote(sql: SnapshotSql, access: SnapshotAccess, snapshot: ReportingSnapshot, input: { title: string; body: string; provider: string; metricName: string }, actorId: string) {
  assertWriter(access);
  if (access.project.data_domain === "medical") throw new SnapshotAccessError(403, "Manual notes are unavailable for this project");
  if (snapshot.projectId !== access.project.id || snapshot.site !== access.project.domain) throw new SnapshotAccessError(404, "Not found");
  const refs = evidenceFromSnapshot(snapshot).filter(ref => ref.provider === input.provider && ref.metricName === input.metricName);
  if (!refs.length) throw new SnapshotAccessError(400, "Measured evidence is required");
  const note = { ...createInsight({ projectId: access.project.id, periodStart: snapshot.period.start, periodEnd: snapshot.period.end, type: "observation", title: input.title.trim(), body: input.body.trim(), evidenceRefs: refs, generatedBy: `human:${actorId}` }), id: crypto.randomUUID() };
  await insertNote(sql, access, note);
  return note;
}

export async function changeNote(sql: SnapshotSql, access: SnapshotAccess, noteId: string, revision: number, input: { action: "approve" | "edit" | "hide"; title?: string; body?: string }, actorId: string) {
  assertWriter(access);
  if (input.action === "edit" && access.project.data_domain === "medical") throw new SnapshotAccessError(403, "Manual notes are unavailable for this project");
  const rows = await sql<{ payload: string; revision: number }>`select payload,revision from report_insights where id=${noteId} and project_id=${access.project.id} and site=${access.project.domain}`;
  const stored = rows[0] && safeStoredNote(rows[0].payload, access);
  if (!stored) throw new SnapshotAccessError(404, "Not found");
  if (rows[0].revision !== revision) throw new SnapshotAccessError(409, "This note changed. Reload before editing.");
  const note = input.action === "approve" ? approveForClient(stored, actorId) : input.action === "hide" ? { ...stored, visibility: "internal" as const, reviewState: "pending_review" as const, reviewedBy: null } : editManualInsight(stored, { title: input.title, body: input.body }, actorId);
  const changed = await sql<{ id: string }>`with changed as (
      update report_insights set payload=${JSON.stringify(note)},revision=revision+1
      where id=${noteId} and project_id=${access.project.id} and revision=${revision} returning id
    ) insert into operation_receipts(id,project_id,actor_ref,operation,target_ref,status,evidence)
    select ${crypto.randomUUID()},${access.project.id},${actorId},${`insight.${input.action}`},id,'completed',${JSON.stringify({ revision: revision + 1 })} from changed returning id`;
  if (!changed.length) throw new SnapshotAccessError(409, "This note changed. Reload before editing.");
  return { ...note, revision: revision + 1 };
}
