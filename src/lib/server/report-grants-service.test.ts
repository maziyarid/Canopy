import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateReportGrants } from "./report-grants-service.ts";
import type { SnapshotSql, SnapshotAccess } from "./reporting-snapshot-service.ts";

const owner: SnapshotAccess = { role: "owner", filter: "", project: { id: "project-a", domain: "a.example" } };

function sqlFor(db: PGlite): SnapshotSql {
  const sql = async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, "");
    return (await db.query<T>(query, values)).rows;
  };
  sql.query = async <T>(text: string, values?: unknown[]) => (await db.query<T>(text, values)).rows;
  return sql;
}

test("report grants and their audit receipt persist across database restart and stay project scoped", async () => {
  const directory = await mkdtemp(join(tmpdir(), "report-grants-"));
  let db = new PGlite(directory);
  try {
    await db.exec(`create table project_access(id text primary key, project_id text, role text, report_sections text not null default '[]');
      create table operation_receipts(id text primary key, project_id text, actor_ref text, operation text, target_ref text, status text, evidence text);
      insert into project_access(id,project_id,role) values ('member-a','project-a','client'),('member-b','project-b','client');`);
    const opts = { sql: sqlFor(db), resolveAccess: async () => owner, userId: "owner-a", email: "", projectId: "project-a", memberId: "member-a", sections: ["search"] };
    await updateReportGrants(opts);
    await assert.rejects(updateReportGrants({ ...opts, memberId: "member-b" }), /Not found/);
    await assert.rejects(updateReportGrants({ ...opts, resolveAccess: async () => ({ ...owner, role: "editor" }) }), /Forbidden/);
    await assert.rejects(updateReportGrants({ ...opts, resolveAccess: async () => ({ ...owner, role: "client" }) }), /Forbidden/);
    await db.close();
    db = new PGlite(directory);
    const members = (await db.query<{ id: string; report_sections: string }>("select id,report_sections from project_access order by id")).rows;
    assert.deepEqual(members, [{ id: "member-a", report_sections: '["search"]' }, { id: "member-b", report_sections: '[]' }]);
    const receipts = (await db.query<{ project_id: string; target_ref: string }>("select project_id,target_ref from operation_receipts")).rows;
    assert.deepEqual(receipts, [{ project_id: "project-a", target_ref: "member-a" }]);
  } finally { await db.close(); await rm(directory, { recursive: true, force: true }); }
});
