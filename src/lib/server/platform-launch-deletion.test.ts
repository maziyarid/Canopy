import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { LaunchError } from "./platform-launch.ts";
import {
  LAUNCH_SESSION_MARKER,
  currentLaunchMapping,
  launchSessionScope,
} from "./platform-launch-store.ts";

test("mapped project deletion removes its mapping and denies retained launch sessions", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  const sql = Object.assign(
    () => {
      throw new Error("Tagged SQL is unused");
    },
    {
      query: async <T>(text: string, values: unknown[] = []) =>
        (await pg.query<T>(text, values)).rows,
    },
  ) as unknown as Sql;
  const intent = {
    principal_id: "deleted-principal",
    tenant_id: "platform-tenant",
    workspace_id: "deleted-workspace",
  };
  try {
    for (const file of [
      "0001_auth.sql",
      "0002_canopy.sql",
      "0004_unified_stack.sql",
      "0012_platform_launch.sql",
    ]) {
      await pg.exec(
        await readFile(new URL("../../../migrations/" + file, import.meta.url), "utf8"),
      );
    }
    await pg.exec(`
      insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values
        ('owner','Owner','owner@example.test',true,now(),now()),
        ('other-user','Other','other@example.test',true,now(),now());
      insert into tenants(id,owner_id) values('tenant','owner'),('other-tenant','other-user');
      insert into projects(id,owner_id,name,tenant_id) values
        ('mapped-project','owner','Mapped','tenant'),
        ('other-project','other-user','Other','other-tenant');
      insert into platform_launch_mappings(principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id) values
        ('deleted-principal','platform-tenant','deleted-workspace','owner','mapped-project','tenant'),
        ('other-principal','platform-tenant','other-workspace','other-user','other-project','other-tenant');
      insert into "session"(id,"expiresAt",token,"updatedAt","userAgent","userId") values
        ('retained-session',now()+interval '1 hour','fixture-token',now(),'${LAUNCH_SESSION_MARKER}fixture-receipt','owner');
      insert into platform_launch_sessions(session_id,receipt_id,principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id,expires_at) values
        ('retained-session','fixture-receipt','deleted-principal','platform-tenant','deleted-workspace','owner','mapped-project','tenant',now()+interval '1 hour');
    `);
    const childFixtures: Record<string, string> = {
      keywords: "(id,project_id,keyword) values('keyword',$1,'Fixture')",
      rank_history: "(id,project_id,keyword,checked_at) values('rank',$1,'Fixture','2026-10-03')",
      serp_rows:
        "(id,project_id,keyword,position,fetched_at) values('serp',$1,'Fixture',1,'2026-10-03')",
      competitors:
        "(id,project_id,domain,keyword) values('competitor',$1,'example.test','Fixture')",
      gaps: "(id,project_id,keyword,competitor) values('gap',$1,'Fixture','example.test')",
      briefs: "(id,project_id,keyword,content) values('brief',$1,'Fixture','Content')",
      agent_runs: "(id,project_id,agent,action) values('run',$1,'fixture','read')",
      activity_log: "(id,project_id,user_id,action) values('activity',$1,'owner','fixture')",
      monday_events: "(id,project_id,event_type,payload) values('event',$1,'fixture','{}')",
      project_access: "(id,project_id,email) values('access',$1,'client@example.test')",
    };
    for (const [table, fixture] of Object.entries(childFixtures)) {
      await pg.query("insert into " + table + fixture, ["mapped-project"]);
    }
    assert.equal((await currentLaunchMapping(sql, intent)).project_id, "mapped-project");
    assert.equal(
      (await launchSessionScope(sql, "retained-session", "owner"))?.project_id,
      "mapped-project",
    );

    // Execute the existing handler's SQL sequence against the actual migration.
    // Framework authentication is covered separately; this regression exercises
    // the nontransactional child deletes followed by its final project delete.
    const projectSource = await readFile(new URL("./projects.ts", import.meta.url), "utf8");
    const handler = projectSource.slice(
      projectSource.indexOf("export const deleteProject"),
      projectSource.indexOf("export const getProjectBundle"),
    );
    const deletes = [...handler.matchAll(/await sql`(delete from [^\x60]+)`/g)].map(
      (match) => match[1],
    );
    assert.equal(deletes.length, Object.keys(childFixtures).length + 1);
    for (const query of deletes) {
      const owned = query.includes("${context.userId}");
      await pg.query(
        query.replaceAll("${data.id}", "$1").replaceAll("${context.userId}", "$2"),
        owned ? ["mapped-project", "owner"] : ["mapped-project"],
      );
    }
    for (const table of Object.keys(childFixtures)) {
      assert.equal(
        (await pg.query("select id from " + table + " where project_id=$1", ["mapped-project"]))
          .rows.length,
        0,
      );
    }
    assert.equal(
      (await pg.query("select id from projects where id='mapped-project'")).rows.length,
      0,
    );
    assert.equal(
      (
        await pg.query(
          "select project_id from platform_launch_mappings where project_id='mapped-project'",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await pg.query("select id from \"session\" where id='retained-session'")).rows.length,
      1,
    );
    assert.equal(
      (
        await pg.query(
          "select session_id from platform_launch_sessions where session_id='retained-session'",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(() => currentLaunchMapping(sql, intent), LaunchError);
    await assert.rejects(() => launchSessionScope(sql, "retained-session", "owner"), LaunchError);
    assert.equal(
      (
        await currentLaunchMapping(sql, {
          principal_id: "other-principal",
          tenant_id: "platform-tenant",
          workspace_id: "other-workspace",
        })
      ).project_id,
      "other-project",
    );
    assert.equal((await pg.query('select id from "user" order by id')).rows.length, 2);
    assert.equal((await pg.query("select id from tenants order by id")).rows.length, 2);
  } finally {
    await pg.close();
  }
});
