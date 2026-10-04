import { z } from "zod";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

export const MANGOOLS_ORIGIN = "https://api.mangools.com";
export const MANGOOLS_API_BASE = "https://api.mangools.com/v3";
export const MANGOOLS_INVALID_PATH = "Mangools path must be a canonical relative API path";
const MASKED_SECRET = "••••••••";
const ALLOWED_PATH_PREFIXES = ["/kwfinder/", "/serpchecker/", "/serpwatcher/", "/mangools/"];

function hasControlOrWhitespace(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 32 || code === 127) return true;
  }
  return false;
}

function hasForbiddenPathForm(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return true;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return true;
  if (value.includes("\\") || hasControlOrWhitespace(value)) return true;
  if (value.includes("://") || value.includes("?") || value.includes("#") || value.includes("@")) return true;
  if (value.split("/").slice(1).some((segment) => segment === ".." || segment === "." || segment === "")) return true;
  return false;
}

function fullyDecodePath(value: string) {
  let current = value;
  for (let i = 0; i < 5; i++) {
    let next: string;
    try {
      next = decodeURIComponent(current.replace(/\+/g, "%2B"));
    } catch {
      throw new Error(MANGOOLS_INVALID_PATH);
    }
    if (next === current) return current;
    current = next;
  }
  throw new Error(MANGOOLS_INVALID_PATH);
}

export function resolveMangoolsUrl(
  path: string,
  query?: Record<string, string | number>,
): URL {
  if (typeof path !== "string" || path.trim() !== path || !path) {
    throw new Error(MANGOOLS_INVALID_PATH);
  }
  if (hasForbiddenPathForm(path)) {
    throw new Error(MANGOOLS_INVALID_PATH);
  }

  const decoded = fullyDecodePath(path);
  if (decoded !== path || decoded.includes("%") || hasForbiddenPathForm(decoded)) {
    throw new Error(MANGOOLS_INVALID_PATH);
  }
  if (!ALLOWED_PATH_PREFIXES.some((prefix) => decoded.startsWith(prefix))) {
    throw new Error(MANGOOLS_INVALID_PATH);
  }

  const url = new URL(`${MANGOOLS_API_BASE}${decoded}`);
  if (
    url.protocol !== "https:" ||
    url.origin !== MANGOOLS_ORIGIN ||
    url.hostname !== "api.mangools.com" ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Mangools destination origin is not allowed");
  }
  const expectedPath = `/v3${decoded}`;
  if (url.pathname !== expectedPath || !url.pathname.startsWith("/v3/")) {
    throw new Error("Mangools destination origin is not allowed");
  }
  const rest = url.pathname.slice("/v3".length);
  if (!ALLOWED_PATH_PREFIXES.some((prefix) => rest.startsWith(prefix))) {
    throw new Error(MANGOOLS_INVALID_PATH);
  }

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export const PublicMangoolsRequestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  path: z
    .string()
    .min(1)
    .max(500)
    .superRefine((value, ctx) => {
      try {
        resolveMangoolsUrl(value);
      } catch {
        ctx.addIssue({ code: "custom", message: MANGOOLS_INVALID_PATH });
      }
    }),
  query: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  body: jsonSchema.optional(),
});

export const MangoolsFetchSchema = PublicMangoolsRequestSchema.extend({
  apiKey: z.string().min(8),
});

export type PublicMangoolsRequestInput = z.input<typeof PublicMangoolsRequestSchema>;
export type MangoolsRequestInput = z.input<typeof MangoolsFetchSchema>;

export function bindStoredMangoolsKey(
  input: z.infer<typeof PublicMangoolsRequestSchema>,
  storedKey: string,
): z.infer<typeof MangoolsFetchSchema> {
  const apiKey = storedKey.trim();
  if (!apiKey) throw new Error("Add your Mangools API key in Connect.");
  return { ...input, apiKey };
}

export async function commitMangoolsKey(input: {
  existingKey: string;
  candidateKey?: string;
  validate: (candidate: string) => Promise<true | false | { ok: false; error?: string }>;
}): Promise<string> {
  const candidate = input.candidateKey?.trim() ?? "";
  if (!candidate || candidate === MASKED_SECRET) return input.existingKey;
  if (candidate === input.existingKey) return input.existingKey;
  if (candidate.length < 8) {
    throw new Error("Mangools key is invalid");
  }
  const result = await input.validate(candidate);
  if (result === true) return candidate;
  const error =
    result && typeof result === "object" && result.error
      ? result.error
      : "Mangools key is invalid";
  throw new Error(error);
}

export async function mangoolsFetchWith(
  input: MangoolsRequestInput,
  fetchImpl: typeof fetch,
) {
  const data = MangoolsFetchSchema.parse(input);
  const url = resolveMangoolsUrl(data.path, data.query);
  const res = await fetchImpl(url, {
    method: data.method,
    headers: {
      "X-Access-Token": data.apiKey,
      Accept: "application/json",
      ...(data.body ? { "Content-Type": "application/json" } : {}),
    },
    body: data.body ? JSON.stringify(data.body) : undefined,
  });

  const text = await res.text();
  let json: Json = null;
  try {
    json = text ? (JSON.parse(text) as Json) : null;
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  if (!res.ok) {
    const obj = json && typeof json === "object" && !Array.isArray(json) ? json : {};
    const err =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.error === "string" && obj.error) ||
      text.slice(0, 400);
    return {
      ok: false as const,
      status: res.status,
      error: `Mangools ${res.status}: ${err}`,
    };
  }

  return { ok: true as const, status: res.status, data: json };
}
