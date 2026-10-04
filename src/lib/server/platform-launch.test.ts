import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { pgliteDialect } from "../auth/pglite-dialect.ts";
import type { Sql } from "../db.ts";
import {
  LaunchError,
  launchConfig,
  validateReceipt,
  redeemLaunch,
  type LaunchReceipt,
} from "./platform-launch.ts";
import { createProductLaunchSession } from "./platform-launch-session.server.ts";
import { currentLaunchMapping, launchSessionScope } from "./platform-launch-store.ts";
import {
  runWithLaunchScope,
  assertUnrestrictedSession,
  assertLaunchProject,
} from "./platform-launch-scope.server.ts";
import { guardLaunchAuthRequest, requestLaunchAuthority } from "./platform-launch-auth.server.ts";
import { resolveAccess } from "./access.ts";

const config = {
  platformOrigin: "https://identity.example.test",
  productOrigin: "https://robot.example.test",
  serviceToken: randomBytes(32).toString("base64url"),
};
const receipt = (): LaunchReceipt => ({
  receipt_id: randomUUID(),
  intent: {
    principal_id: "fixture-principal",
    tenant_id: "platform-tenant",
    workspace_id: "platform-workspace",
    product_id: "ms-robot",
    destination_origin: config.productOrigin,
    issued_at: Date.now() / 1000 - 1,
    expires_at: Date.now() / 1000 + 59,
  },
});
const form = (
  origin: string | null = config.platformOrigin,
  code = randomBytes(32).toString("base64url"),
) =>
  new Request(config.productOrigin + "/launch/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(origin === null ? {} : { Origin: origin }),
    },
    body: new URLSearchParams({ code }),
  });
test("configuration defaults disabled and requires exact secure distinct origins", () => {
  assert.equal(launchConfig({}), null);
  for (const url of [
    "https://identity.example.test/",
    "http://identity.example.test",
    "https://identity.example.test/path",
    "https://user@identity.example.test",
  ]) {
    assert.throws(
      () =>
        launchConfig({
          MAZIYARID_LAUNCH_ENABLED: "true",
          MAZIYARID_PLATFORM_ORIGIN: url,
          BETTER_AUTH_URL: config.productOrigin,
          MAZIYARID_LAUNCH_SERVICE_TOKEN: config.serviceToken,
        }),
      LaunchError,
    );
  }
});
test("receipt rejects foreign audience, bad binding, future/expired/long lifetime", () => {
  for (const change of [
    { product_id: "ada" },
    { destination_origin: "https://foreign.example.test" },
    { principal_id: "" },
    { tenant_id: "bad tenant" },
    { issued_at: Date.now() / 1000 + 1 },
    { expires_at: Date.now() / 1000 - 1 },
    { expires_at: Date.now() / 1000 + 120 },
    { issued_at: NaN },
  ]) {
    const r = receipt();
    Object.assign(r.intent, change);
    assert.throws(() => validateReceipt(r, config), LaunchError);
  }
  assert.throws(() => validateReceipt({ ...receipt(), receipt_id: "bad" }, config), LaunchError);
  assert.equal(validateReceipt(receipt(), config).intent.product_id, "ms-robot");
});
test("null, missing and foreign browser origins are denied before redemption", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls++;
    return Response.json(receipt());
  };
  for (const origin of [null, "null", "https://foreign.example.test"]) {
    await assert.rejects(() => redeemLaunch(form(origin), config, fake), LaunchError);
  }
  assert.equal(calls, 0);
});
test("backend redemption is exact origin authenticated POST and redirects fail closed", async () => {
  const r = receipt();
  let called = false;
  const fake: typeof fetch = async (input, init) => {
    assert.equal(input, config.platformOrigin + "/launch/redeem");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer " + config.serviceToken);
    assert.match(JSON.parse(String(init?.body)).code, /^[A-Za-z0-9_-]{43}$/);
    called = true;
    return Response.json(r);
  };
  assert.deepEqual(await redeemLaunch(form(), config, fake), r);
  assert.equal(called, true);
  await assert.rejects(
    () => redeemLaunch(form(), config, async () => new Response("", { status: 409 })),
    LaunchError,
  );
  await assert.rejects(
    () =>
      redeemLaunch(form(), config, async () => {
        throw new Error("redirect");
      }),
    LaunchError,
  );
});
test("reject oversized and duplicate form fields", async () => {
  const requests = [
    new Request(config.productOrigin + "/launch/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: config.platformOrigin,
      },
      body:
        "code=" +
        randomBytes(32).toString("base64url") +
        "&code=" +
        randomBytes(32).toString("base64url"),
    }),
    new Request(config.productOrigin + "/launch/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: config.platformOrigin,
      },
      body: "code=" + "a".repeat(3000),
    }),
  ];
  for (const request of requests)
    await assert.rejects(
      () => redeemLaunch(request, config, async () => Response.json(receipt())),
      LaunchError,
    );
});
test("real BetterAuth persisted session: host cookie, replay, restart, revocation and workspace scope", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ms-robot-launch-"));
  let pg = new PGlite(dir);
  await pg.waitReady;
  const openSql = (): Sql => {
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = strings[0];
      for (let n = 0; n < values.length; n++) text += "$" + (n + 1) + strings[n + 1];
      return (await pg.query(text, values)).rows;
    }) as Sql;
    sql.query = async <T>(text: string, params: unknown[] = []) =>
      (await pg.query<T>(text, params)).rows;
    return sql;
  };
  const authFactory = () =>
    betterAuth({
      baseURL: config.productOrigin,
      secret: config.serviceToken,
      database: { dialect: pgliteDialect(() => pg), type: "postgres" },
      session: { cookieCache: { enabled: true, maxAge: 300 } },
      plugins: [bearer()],
      advanced: {
        useSecureCookies: false,
        defaultCookieAttributes: { secure: true, httpOnly: true, path: "/", sameSite: "lax" },
        cookies: {
          session_token: { name: "__Host-grok-auth.session_token" },
          session_data: { name: "__Host-grok-auth.session_data" },
        },
      },
    });
  try {
    for (const f of [
      "0001_auth.sql",
      "0002_canopy.sql",
      "0004_unified_stack.sql",
      "0010_report_section_grants.sql",
      "0012_platform_launch.sql",
    ])
      await pg.exec(
        await readFile(new URL("../../.." + "/migrations/" + f, import.meta.url), "utf8"),
      );
    await pg.query(
      'insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',
      ["product-user", "Fixture", "fixture@example.test"],
    );
    await pg.exec(
      "insert into tenants(id,owner_id) values('product-tenant','product-user');insert into projects(id,owner_id,name,tenant_id) values('project-one','product-user','One','product-tenant'),('project-two','product-user','Two','product-tenant');",
    );
    await pg.exec(
      "insert into platform_launch_mappings(principal_id,platform_tenant_id,platform_workspace_id,user_id,project_id,tenant_id) values('fixture-principal','platform-tenant','platform-workspace','product-user','project-one','product-tenant');",
    );
    let auth = authFactory(),
      sql = openSql();
    const r = receipt();
    const response = await createProductLaunchSession(auth, sql, r, form());
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/p/project-one");
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const cookies = response.headers.getSetCookie();
    assert.ok(cookies.length > 0);
    for (const cookie of cookies) {
      assert.doesNotMatch(cookie, /;\s*Domain=/i);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Secure/i);
    }
    const headers = new Headers({ cookie: cookies.map((c) => c.split(";")[0]).join("; ") });
    let session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    assert.equal(session?.user.id, "product-user");
    assert.ok(session?.session.id);
    const sessionId = session!.session.id;
    const scope = await launchSessionScope(sql, sessionId, "product-user");
    assert.equal(scope?.project_id, "project-one");
    await runWithLaunchScope(scope, async () => {
      assert.throws(() => assertLaunchProject("product-user", "project-two"), LaunchError);
      assert.throws(() => assertUnrestrictedSession(), LaunchError);
      assert.equal((await resolveAccess(sql, "product-user", "", "project-one")).role, "owner");
      await assert.rejects(
        () => resolveAccess(sql, "product-user", "", "project-two"),
        LaunchError,
      );
    });
    const guarded = async (request: Request) => {
      const accepted = await guardLaunchAuthRequest(auth, sql, request);
      return auth.handler(accepted ?? request);
    };
    await t.test("unknown bearer cannot resurrect cached launch identity", async () => {
      const unknown = new Headers(headers);
      unknown.set("Authorization", "Bearer unknown-fixture-session-token");
      assert.equal(await requestLaunchAuthority(auth, sql, unknown), null);
      const response = await guarded(
        new Request(config.productOrigin + "/api/auth/get-session", { headers: unknown }),
      );
      assert.equal((await response.json()) === null, true);
    });
    await assert.rejects(() => createProductLaunchSession(auth, sql, r, form()), LaunchError);
    assert.equal((await pg.query('select id from "session"')).rows.length, 1);
    await assert.rejects(() =>
      guardLaunchAuthRequest(
        auth,
        sql,
        new Request(config.productOrigin + "/api/auth/update-user", { headers }),
      ),
    );
    await t.test("issuance rechecks authority after real native session creation", async (race) => {
      const context = await auth.$context;
      const adapter = context.internalAdapter;
      const originalCreate = adapter.createSession;
      const cases = [
        { name: "mapping revoked", change: "update platform_launch_mappings set status='revoked'" },
        {
          name: "mapping moved to another project",
          change: "update platform_launch_mappings set project_id='project-two'",
        },
        {
          name: "existing non-owner project grant revoked",
          change: "delete from project_access where id='fixture-issuance-race-grant'",
        },
      ];
      for (const item of cases)
        await race.test(item.name, async () => {
          if (item.name === "existing non-owner project grant revoked") {
            await pg.exec(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values('fixture-issuance-owner','Owner','issuance-owner@example.test',true,now(),now());
            update projects set owner_id='fixture-issuance-owner' where id='project-one';
            insert into project_access(id,project_id,user_id,email,role) values('fixture-issuance-race-grant','project-one','product-user','fixture@example.test','editor');`);
          }
          const beforeSessions = (await pg.query('select id from "session" order by id')).rows;
          const beforeBindings = (
            await pg.query(
              "select session_id,receipt_id from platform_launch_sessions order by session_id",
            )
          ).rows;
          const beforeGrants = (
            await pg.query(
              "select * from project_access where id<>'fixture-issuance-race-grant' order by id",
            )
          ).rows;
          const racedReceipt = receipt();
          let createdId: string | undefined;
          let returned: Response | undefined;
          let creates = 0;
          adapter.createSession = async (...args: Parameters<typeof originalCreate>) => {
            const created = await originalCreate.apply(adapter, args);
            creates++;
            assert.ok(created);
            createdId = created!.id;
            assert.equal(
              (await pg.query('select id from "session" where id=$1', [createdId])).rows.length,
              1,
            );
            await pg.exec(item.change);
            return created;
          };
          try {
            await assert.rejects(async () => {
              returned = await createProductLaunchSession(auth, sql, racedReceipt, form());
            }, LaunchError);
            assert.equal(creates, 1);
            assert.equal(returned, undefined, "no response or cookies escape rejected issuance");
            assert.ok(createdId);
            assert.equal(
              (await pg.query('select id from "session" where id=$1', [createdId])).rows.length,
              0,
            );
            assert.equal(
              (
                await pg.query(
                  "select session_id from platform_launch_sessions where session_id=$1 or receipt_id=$2",
                  [createdId, racedReceipt.receipt_id],
                )
              ).rows.length,
              0,
            );
            assert.deepEqual(
              (await pg.query('select id from "session" order by id')).rows,
              beforeSessions,
            );
            assert.deepEqual(
              (
                await pg.query(
                  "select session_id,receipt_id from platform_launch_sessions order by session_id",
                )
              ).rows,
              beforeBindings,
            );
            assert.deepEqual(
              (
                await pg.query(
                  "select * from project_access where id<>'fixture-issuance-race-grant' order by id",
                )
              ).rows,
              beforeGrants,
            );
          } finally {
            adapter.createSession = originalCreate;
            await pg.exec(
              "update platform_launch_mappings set status='active',project_id='project-one';update projects set owner_id='product-user' where id='project-one';delete from project_access where id='fixture-issuance-race-grant'",
            );
          }
        });
    });
    await pg.close();
    pg = new PGlite(dir);
    await pg.waitReady;
    sql = openSql();
    auth = authFactory();
    session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    assert.equal(session?.session.id, sessionId);
    assert.equal(
      (await launchSessionScope(sql, sessionId, "product-user"))?.project_id,
      "project-one",
    );
    await t.test("identity and scope use one fresh native authority result", async () => {
      let reads = 0;
      const reader = {
        api: {
          getSession: async (input: Parameters<typeof auth.api.getSession>[0]) => {
            reads++;
            assert.equal(input?.query?.disableCookieCache, true);
            return auth.api.getSession(input);
          },
        },
      };
      const authority = await requestLaunchAuthority(reader, sql, headers);
      assert.equal(authority?.user.id, "product-user");
      assert.equal(authority?.scope?.project_id, "project-one");
      assert.equal(reads, 1);
    });
    await t.test(
      "mapping and binding revocation between native and scope reads deny authority",
      async () => {
        for (const revoke of [
          "update platform_launch_mappings set status='revoked'",
          "update platform_launch_sessions set revoked_at=now()",
        ]) {
          let reads = 0;
          const reader = {
            api: {
              getSession: async (input: Parameters<typeof auth.api.getSession>[0]) => {
                reads++;
                const session = await auth.api.getSession(input);
                await pg.exec(revoke);
                return session;
              },
            },
          };
          try {
            await assert.rejects(() => requestLaunchAuthority(reader, sql, headers), LaunchError);
            assert.equal(reads, 1);
          } finally {
            await pg.exec(
              "update platform_launch_mappings set status='active';update platform_launch_sessions set revoked_at=null",
            );
          }
        }
      },
    );
    await t.test(
      "project grant revocation between native and scope reads denies authority",
      async () => {
        await pg.exec(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values('fixture-other-owner','Owner','owner@example.test',true,now(),now());
        update projects set owner_id='fixture-other-owner' where id='project-one';
        insert into project_access(id,project_id,user_id,email,role) values('fixture-grant-race','project-one','product-user','fixture@example.test','editor');`);
        try {
          const reader = {
            api: {
              getSession: async (input: Parameters<typeof auth.api.getSession>[0]) => {
                const session = await auth.api.getSession(input);
                await pg.exec(
                  "delete from project_access where project_id='project-one' and user_id='product-user'",
                );
                return session;
              },
            },
          };
          await assert.rejects(() => requestLaunchAuthority(reader, sql, headers), LaunchError);
        } finally {
          await pg.exec(
            "update projects set owner_id='product-user' where id='project-one';delete from project_access where project_id='project-one' and user_id='product-user'",
          );
        }
      },
    );
    await t.test("delegated auth drops configured cache cookie and chunks", async () => {
      const chunked = new Headers(headers);
      const cacheName = (await auth.$context).authCookies.sessionData.name;
      chunked.set(
        "cookie",
        chunked.get("cookie") +
          `; ${cacheName}.0=fixture-cache-chunk; ${cacheName}.1=fixture-cache-chunk; unrelated=preserved`,
      );
      const fresh = await guardLaunchAuthRequest(
        auth,
        sql,
        new Request(config.productOrigin + "/api/auth/get-session", { headers: chunked }),
      );
      assert.equal((fresh.headers.get("cookie") ?? "").includes(cacheName), false);
      assert.equal((fresh.headers.get("cookie") ?? "").includes("unrelated=preserved"), true);
      const response = await auth.handler(fresh);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).user.id, "product-user");
    });
    await t.test("ordinary native sessions and anonymous sign-in remain usable", async () => {
      const ordinaryResponse = await createProductLaunchSession(auth, sql, receipt(), form());
      const ordinaryHeaders = new Headers({
        cookie: ordinaryResponse.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
      });
      const ordinarySession = await auth.api.getSession({
        headers: ordinaryHeaders,
        query: { disableCookieCache: true },
      });
      await pg.query('update "session" set "userAgent"=$1 where id=$2', [
        "ordinary-browser",
        ordinarySession!.session.id,
      ]);
      const authority = await requestLaunchAuthority(auth, sql, ordinaryHeaders);
      assert.equal(authority?.user.id, "product-user");
      assert.equal(authority?.scope, null);
      const allowed = await guardLaunchAuthRequest(
        auth,
        sql,
        new Request(config.productOrigin + "/api/auth/update-user", {
          method: "POST",
          headers: ordinaryHeaders,
        }),
      );
      assert.equal(allowed.method, "POST");
      const gateHeaders = new Headers({ "x-grok-identity": "verified-by-existing-gate-plugin" });
      let nativeReads = 0,
        gateReads = 0;
      const gateReader = {
        api: {
          getSession: async (input: Parameters<typeof auth.api.getSession>[0]) => {
            if (!new Headers(input?.headers).has("x-grok-identity")) {
              nativeReads++;
              return null;
            }
            gateReads++;
            return auth.api.getSession({
              headers: ordinaryHeaders,
              query: { disableCookieCache: true },
            });
          },
        },
      };
      assert.equal(await requestLaunchAuthority(gateReader, sql, gateHeaders), null);
      assert.equal(gateReads, 0);
      const gateAuthority = await requestLaunchAuthority(gateReader, sql, gateHeaders, true);
      assert.equal(gateAuthority?.user.id, "product-user");
      assert.equal(gateAuthority?.scope, null);
      assert.equal(nativeReads, 2);
      assert.equal(gateReads, 1);
      const anonymous = new Request(config.productOrigin + "/api/auth/sign-in/social", {
        method: "POST",
        headers: { Origin: config.productOrigin },
      });
      assert.equal((await guardLaunchAuthRequest(auth, sql, anonymous)).url, anonymous.url);
    });
    await t.test("deleted persisted session cannot resurrect cached identity", async () => {
      const staleResponse = await createProductLaunchSession(auth, sql, receipt(), form());
      const staleHeaders = new Headers({
        cookie: staleResponse.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
      });
      const stale = await auth.api.getSession({
        headers: staleHeaders,
        query: { disableCookieCache: true },
      });
      await pg.query('delete from "session" where id=$1', [stale!.session.id]);
      assert.equal(await requestLaunchAuthority(auth, sql, staleHeaders), null);
      const response = await guarded(
        new Request(config.productOrigin + "/api/auth/get-session", { headers: staleHeaders }),
      );
      assert.equal((await response.json()) === null, true);
    });
    await t.test("revoked launch mapping still permits safe sign-out", async () => {
      const logoutResponse = await createProductLaunchSession(auth, sql, receipt(), form());
      const logoutHeaders = new Headers({
        cookie: logoutResponse.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
        Origin: config.productOrigin,
      });
      const logoutSession = await auth.api.getSession({
        headers: logoutHeaders,
        query: { disableCookieCache: true },
      });
      await pg.exec("update platform_launch_mappings set status='revoked'");
      try {
        const foreign = new Headers(logoutHeaders);
        foreign.set("Origin", "https://foreign.example.test");
        assert.equal(
          (
            await guarded(
              new Request(config.productOrigin + "/api/auth/sign-out", {
                method: "POST",
                headers: foreign,
              }),
            )
          ).status,
          403,
        );
        assert.equal(
          (await pg.query('select id from "session" where id=$1', [logoutSession!.session.id])).rows
            .length,
          1,
        );
        const gate = new Headers(logoutHeaders);
        gate.set("x-grok-identity", "untrusted-fixture-header");
        await assert.rejects(() =>
          guarded(
            new Request(config.productOrigin + "/api/auth/sign-out", {
              method: "POST",
              headers: gate,
            }),
          ),
        );
        await assert.rejects(() =>
          guarded(
            new Request(config.productOrigin + "/api/auth/sign-out", { headers: logoutHeaders }),
          ),
        );
        const response = await guarded(
          new Request(config.productOrigin + "/api/auth/sign-out", {
            method: "POST",
            headers: logoutHeaders,
          }),
        );
        assert.equal(response.status, 200);
        assert.ok(response.headers.getSetCookie().some((c) => c.includes("Max-Age=0")));
        assert.equal(
          (await pg.query('select id from "session" where id=$1', [logoutSession!.session.id])).rows
            .length,
          0,
        );
      } finally {
        await pg.exec("update platform_launch_mappings set status='active'");
      }
    });
    await t.test("missing launch binding still permits sign-out", async () => {
      const response = await createProductLaunchSession(auth, sql, receipt(), form());
      const boundHeaders = new Headers({
        cookie: response.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
        Origin: config.productOrigin,
      });
      const boundSession = await auth.api.getSession({
        headers: boundHeaders,
        query: { disableCookieCache: true },
      });
      await pg.query("delete from platform_launch_sessions where session_id=$1", [
        boundSession!.session.id,
      ]);
      await assert.rejects(() => requestLaunchAuthority(auth, sql, boundHeaders), LaunchError);
      const cleared = await guarded(
        new Request(config.productOrigin + "/api/auth/sign-out", {
          method: "POST",
          headers: boundHeaders,
        }),
      );
      assert.equal(cleared.status, 200);
      assert.ok(cleared.headers.getSetCookie().some((c) => c.includes("Max-Age=0")));
    });
    await pg.exec("update platform_launch_mappings set status='revoked'");
    await assert.rejects(() => launchSessionScope(sql, sessionId, "product-user"), LaunchError);
    await pg.exec(
      "update platform_launch_mappings set status='active';delete from platform_launch_sessions",
    );
    await assert.rejects(() => launchSessionScope(sql, sessionId, "product-user"), LaunchError);
    await assert.rejects(
      () =>
        currentLaunchMapping(sql, {
          principal_id: "other-principal",
          tenant_id: "platform-tenant",
          workspace_id: "platform-workspace",
        }),
      LaunchError,
    );
  } finally {
    await pg.close();
    await rm(dir, { recursive: true, force: true });
  }
});
