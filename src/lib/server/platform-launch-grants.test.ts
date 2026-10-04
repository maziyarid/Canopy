import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { pgliteDialect } from "../auth/pglite-dialect.ts";
import type { Sql } from "../db.ts";
import { LaunchError, type LaunchReceipt } from "./platform-launch.ts";
import { createProductLaunchSession } from "./platform-launch-session.server.ts";
import { currentLaunchMapping, launchSessionScope } from "./platform-launch-store.ts";
import { requestLaunchScope } from "./platform-launch-auth.server.ts";
import { runWithLaunchScope } from "./platform-launch-scope.server.ts";
import { resolveAccess } from "./access.ts";

const platformOrigin = "https://identity.example.test";
const productOrigin = "https://robot.example.test";
const userId = "mapped-member";
const intent = {
  principal_id: "member-principal",
  tenant_id: "platform-tenant",
  workspace_id: "platform-workspace-one",
};
const unrelatedIntent = {
  ...intent,
  principal_id: "other-principal",
  workspace_id: "platform-workspace-two",
};
const receipt = (): LaunchReceipt => ({
  receipt_id: randomUUID(),
  intent: {
    ...intent,
    product_id: "ms-robot",
    destination_origin: productOrigin,
    issued_at: Date.now() / 1000 - 1,
    expires_at: Date.now() / 1000 + 59,
  },
});
const form = () =>
  new Request(productOrigin + "/launch/accept", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: platformOrigin },
    body: new URLSearchParams({ code: randomBytes(32).toString("base64url") }),
  });

for (const role of ["client", "editor"] as const) {
  for (const revokedGrant of ["tenant membership", "project grant"] as const) {
    test(`non-owner ${role}: revoking ${revokedGrant} immediately denies retained session and relaunch`, async () => {
      const dir = await mkdtemp(join(tmpdir(), "ms-robot-launch-grants-"));
      const pg = new PGlite(dir);
      try {
        await pg.waitReady;
        for (const file of [
          "0001_auth.sql",
          "0002_canopy.sql",
          "0004_unified_stack.sql",
          "0010_report_section_grants.sql",
          "0012_platform_launch.sql",
        ]) {
          await pg.exec(
            await readFile(new URL("../../../migrations/" + file, import.meta.url), "utf8"),
          );
        }
        for (const id of ["project-owner", userId, "other-member"]) {
          await pg.query(
            'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$1,$2,true,now(),now())',
            [id, id + "@example.test"],
          );
        }
        await pg.exec(`
          insert into tenants(id,owner_id) values('product-tenant','project-owner');
          insert into projects(id,owner_id,name,tenant_id) values
            ('project-one','project-owner','One','product-tenant'),
            ('project-two','project-owner','Two','product-tenant');
          insert into tenant_members(id,tenant_id,user_id) values
            ('member-membership','product-tenant','mapped-member'),
            ('other-membership','product-tenant','other-member');
          insert into platform_launch_mappings(principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id) values
            ('member-principal','platform-tenant','platform-workspace-one','mapped-member','project-one','product-tenant'),
            ('other-principal','platform-tenant','platform-workspace-two','other-member','project-two','product-tenant');
        `);
        await pg.query(
          `insert into project_access(id,project_id,email,user_id,role) values
          ('member-project-one','project-one','mapped-member@example.test','mapped-member',$1),
          ('member-project-two','project-two','mapped-member@example.test','mapped-member',$1),
          ('other-project-two','project-two','other-member@example.test','other-member','client')`,
          [role],
        );
        const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
          let text = strings[0];
          for (let n = 0; n < values.length; n++) text += "$" + (n + 1) + strings[n + 1];
          return (await pg.query(text, values)).rows;
        }) as Sql;
        sql.query = async <T>(text: string, params: unknown[] = []) =>
          (await pg.query<T>(text, params)).rows;
        const auth = betterAuth({
          baseURL: productOrigin,
          secret: randomBytes(32).toString("base64url"),
          database: { dialect: pgliteDialect(() => pg), type: "postgres" },
          session: { cookieCache: { enabled: true, maxAge: 300 } },
          advanced: {
            useSecureCookies: false,
            defaultCookieAttributes: { secure: true, httpOnly: true, path: "/", sameSite: "lax" },
            cookies: {
              session_token: { name: "__Host-grok-auth.session_token" },
              session_data: { name: "__Host-grok-auth.session_data" },
            },
          },
        });
        const grants = async () => ({
          tenant: (await pg.query("select * from tenant_members order by id")).rows,
          project: (await pg.query("select * from project_access order by id")).rows,
          mapping: (await pg.query("select * from platform_launch_mappings order by principal_id"))
            .rows,
        });
        const beforeLaunch = await grants();
        const response = await createProductLaunchSession(auth, sql, receipt(), form());
        assert.equal(response.status, 303);
        assert.equal(response.headers.get("Location"), "/p/project-one");
        const cookies = response.headers.getSetCookie();
        assert.ok(cookies.length > 0);
        const headers = new Headers({
          cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; "),
        });
        const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
        assert.equal(session?.user.id, userId);
        assert.ok(session?.session.id);
        const sessionId = session!.session.id;
        const scope = await requestLaunchScope(auth, sql, headers);
        assert.equal(scope?.project_id, "project-one");
        assert.deepEqual(
          await grants(),
          beforeLaunch,
          "launch must use existing grants without writing grants",
        );
        await runWithLaunchScope(scope, async () => {
          assert.equal(
            (await resolveAccess(sql, userId, "mapped-member@example.test", "project-one")).role,
            role,
          );
          await assert.rejects(
            () => resolveAccess(sql, userId, "mapped-member@example.test", "project-two"),
            LaunchError,
          );
        });
        await assert.rejects(
          () => currentLaunchMapping(sql, { ...intent, workspace_id: "platform-workspace-two" }),
          LaunchError,
        );

        if (revokedGrant === "tenant membership") {
          await pg.query("delete from tenant_members where id=$1", ["member-membership"]);
        } else {
          await pg.query("delete from project_access where id=$1", ["member-project-one"]);
        }
        const afterRevocation = await grants();
        const sessionsAfterRevocation = (await pg.query('select * from "session" order by id'))
          .rows;
        const bindingsAfterRevocation = (
          await pg.query("select * from platform_launch_sessions order by session_id")
        ).rows;
        assert.equal(
          sessionsAfterRevocation.length,
          1,
          "retained cookie still identifies the persisted native session",
        );
        await assert.rejects(() => launchSessionScope(sql, sessionId, userId), LaunchError);
        await assert.rejects(() => requestLaunchScope(auth, sql, headers), LaunchError);
        let relaunchResponse: Response | null = null;
        await assert.rejects(async () => {
          relaunchResponse = await createProductLaunchSession(auth, sql, receipt(), form());
        }, LaunchError);
        assert.equal(
          relaunchResponse,
          null,
          "denied relaunch must not return a response containing cookies",
        );
        assert.deepEqual(
          (await pg.query('select * from "session" order by id')).rows,
          sessionsAfterRevocation,
        );
        assert.deepEqual(
          (await pg.query("select * from platform_launch_sessions order by session_id")).rows,
          bindingsAfterRevocation,
        );
        assert.deepEqual(
          await grants(),
          afterRevocation,
          "denied relaunch must not recreate revoked grants",
        );
        assert.equal((await currentLaunchMapping(sql, unrelatedIntent)).user_id, "other-member");
        assert.equal(
          (await pg.query("select id from tenant_members where id='other-membership'")).rows.length,
          1,
        );
        assert.equal(
          (await pg.query("select id from project_access where id='other-project-two'")).rows
            .length,
          1,
        );
        assert.equal(
          (await pg.query("select id from project_access where id='member-project-two'")).rows
            .length,
          1,
        );
      } finally {
        await pg.close();
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
}
