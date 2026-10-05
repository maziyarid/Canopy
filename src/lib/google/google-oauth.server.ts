import { z } from "zod";
import { type PreparedGoogleRequest } from "./google-actions.ts";

const OAuthCredentialSchema = z.object({
  refreshToken: z.string().min(20).max(4096),
}).strict();

export type GoogleOAuthCredential = z.infer<typeof OAuthCredentialSchema>;

export function parseGoogleOAuthCredential(plaintext: string): GoogleOAuthCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("google_oauth_credential_invalid");
  }
  const result = OAuthCredentialSchema.safeParse(parsed);
  if (!result.success) throw new Error("google_oauth_credential_invalid");
  return result.data;
}

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

export async function refreshGoogleAccessToken(
  credential: GoogleOAuthCredential,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const clientId = required(env, "GOOGLE_WRITE_OAUTH_CLIENT_ID");
  const clientSecret = required(env, "GOOGLE_WRITE_OAUTH_CLIENT_SECRET");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: credential.refreshToken,
    grant_type: "refresh_token",
  });
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new Error("google_oauth_refresh_unreachable");
  }
  if (!response.ok) throw new Error("google_oauth_refresh_failed_" + response.status);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("google_oauth_refresh_invalid_json");
  }
  const parsed = z.object({
    access_token: z.string().min(20).max(8192),
    expires_in: z.number().int().positive().optional(),
    token_type: z.string().optional(),
  }).safeParse(payload);
  if (!parsed.success) throw new Error("google_oauth_refresh_invalid_response");
  return {
    accessToken: parsed.data.access_token,
    expiresIn: parsed.data.expires_in ?? null,
  };
}

const GOOGLE_WRITE_HOSTS = new Set([
  "www.googleapis.com",
  "tagmanager.googleapis.com",
  "analyticsadmin.googleapis.com",
  "googleads.googleapis.com",
]);

function assertGoogleWriteUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !GOOGLE_WRITE_HOSTS.has(url.hostname)) {
    throw new Error("google_write_url_denied");
  }
  return url;
}

export function googleAdsDeveloperHeaders(
  request: PreparedGoogleRequest,
  env: NodeJS.ProcessEnv = process.env,
) {
  const host = new URL(request.url).hostname;
  if (host !== "googleads.googleapis.com") return {};
  const developerToken = required(env, "GOOGLE_ADS_DEVELOPER_TOKEN");
  const loginCustomerId = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") ?? "";
  return {
    "developer-token": developerToken,
    ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
  };
}

function requestId(headers: Headers) {
  return (
    headers.get("request-id") ||
    headers.get("x-request-id") ||
    headers.get("x-guploader-uploadid") ||
    ""
  ).slice(0, 200);
}

async function readBoundedJson(response: Response, maxBytes = 256_000): Promise<unknown> {
  const raw = await response.text();
  if (Buffer.byteLength(raw) > maxBytes) throw new Error("google_write_response_too_large");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("google_write_invalid_json");
  }
}

export function adsValidateOnlyRequest(request: PreparedGoogleRequest): PreparedGoogleRequest | null {
  if (new URL(request.url).hostname !== "googleads.googleapis.com" || !request.body || typeof request.body !== "object") {
    return null;
  }
  return {
    ...request,
    body: { ...(request.body as Record<string, unknown>), validateOnly: true },
  };
}

export async function executeGoogleHttpRequest(input: {
  request: PreparedGoogleRequest;
  accessToken: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}) {
  const env = input.env ?? process.env;
  const fetchImpl = input.fetchImpl ?? fetch;
  assertGoogleWriteUrl(input.request.url);
  if (!input.accessToken.trim()) throw new Error("google_access_token_missing");

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: "Bearer " + input.accessToken,
    ...googleAdsDeveloperHeaders(input.request, env),
    ...(input.request.extraHeaders ?? {}),
  };
  const body = input.request.body === undefined ? undefined : JSON.stringify(input.request.body);
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetchImpl(input.request.url, {
      method: input.request.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    throw new Error("google_write_unreachable");
  }

  if (!response.ok) {
    throw new Error("google_write_http_" + response.status);
  }
  return {
    requestId: requestId(response.headers),
    result: await readBoundedJson(response),
  };
}

export async function validateGoogleAdsMutation(input: {
  request: PreparedGoogleRequest;
  accessToken: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}) {
  const preflight = adsValidateOnlyRequest(input.request);
  if (!preflight) return null;
  return executeGoogleHttpRequest({ ...input, request: preflight });
}
