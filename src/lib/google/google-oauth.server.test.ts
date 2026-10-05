import test from "node:test";
import assert from "node:assert/strict";
import {
  adsValidateOnlyRequest,
  executeGoogleHttpRequest,
  parseGoogleOAuthCredential,
  refreshGoogleAccessToken,
  validateGoogleAdsMutation,
} from "./google-oauth.server.ts";

test("OAuth credential contains only a refresh token and rejects extra fields", () => {
  assert.deepEqual(parseGoogleOAuthCredential(JSON.stringify({ refreshToken: "r".repeat(40) })), { refreshToken: "r".repeat(40) });
  assert.throws(() => parseGoogleOAuthCredential(JSON.stringify({ refreshToken: "r".repeat(40), clientSecret: "x" })), /invalid/);
});

test("token refresh uses protected client configuration and returns bounded metadata", async () => {
  let observed = "";
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    observed = String(init?.body);
    return new Response(JSON.stringify({ access_token: "a".repeat(40), expires_in: 3600, token_type: "Bearer" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  const result = await refreshGoogleAccessToken(
    { refreshToken: "r".repeat(40) },
    { GOOGLE_WRITE_OAUTH_CLIENT_ID: "client-id", GOOGLE_WRITE_OAUTH_CLIENT_SECRET: "client-secret" } as NodeJS.ProcessEnv,
    fetchImpl as typeof fetch,
  );
  assert.equal(result.accessToken, "a".repeat(40));
  assert.match(observed, /refresh_token=/);
  assert.match(observed, /client_secret=/);
});

test("write executor refuses arbitrary hosts and never echoes provider error bodies", async () => {
  await assert.rejects(
    () => executeGoogleHttpRequest({
      request: { method: "POST", url: "https://evil.example/mutate", body: {} },
      accessToken: "a".repeat(40),
      fetchImpl: (async () => new Response("{}")) as typeof fetch,
    }),
    /url_denied/,
  );

  const fetchImpl = async () => new Response(
    JSON.stringify({ error: "Bearer " + "s".repeat(40) }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
  await assert.rejects(
    () => executeGoogleHttpRequest({
      request: { method: "POST", url: "https://tagmanager.googleapis.com/tagmanager/v2/accounts/1/containers/2/workspaces", body: {} },
      accessToken: "a".repeat(40),
      fetchImpl: fetchImpl as typeof fetch,
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "google_write_http_403");
      assert.equal((error as Error).message.includes("ssss"), false);
      return true;
    },
  );
});

test("Google Ads requires developer token and validateOnly is separate from execution", async () => {
  const request = {
    method: "POST" as const,
    url: "https://googleads.googleapis.com/v25/customers/123/campaigns:mutate",
    body: { operations: [{ create: { name: "test", status: "PAUSED" } }], validateOnly: false },
  };
  const preflight = adsValidateOnlyRequest(request);
  assert.equal((preflight?.body as any).validateOnly, true);
  assert.equal((request.body as any).validateOnly, false);

  let seenBody: any;
  let seenHeaders: any;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    seenBody = JSON.parse(String(init?.body));
    seenHeaders = init?.headers;
    return new Response(JSON.stringify({ results: [] }), {
      status: 200, headers: { "Content-Type": "application/json", "request-id": "req-1" },
    });
  };
  const result = await validateGoogleAdsMutation({
    request,
    accessToken: "a".repeat(40),
    env: { GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "123-456-7890" } as NodeJS.ProcessEnv,
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert.equal(seenBody.validateOnly, true);
  assert.equal(seenHeaders["developer-token"], "dev-token");
  assert.equal(seenHeaders["login-customer-id"], "1234567890");
  assert.equal(result?.requestId, "req-1");
});
