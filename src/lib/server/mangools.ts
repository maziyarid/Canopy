import { createServerFn } from "@tanstack/react-start";
import { BASE_URL } from "@/lib/api-catalog";
import { getSql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { ownerMangoolsKey } from "./access";
import {
  bindStoredMangoolsKey,
  MangoolsFetchSchema,
  PublicMangoolsRequestSchema,
  type MangoolsRequestInput,
} from "./mangools-bind";

export {
  bindStoredMangoolsKey,
  PublicMangoolsRequestSchema,
  type MangoolsRequestInput,
  type PublicMangoolsRequestInput,
} from "./mangools-bind";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export async function mangoolsFetch(input: MangoolsRequestInput) {
  const data = MangoolsFetchSchema.parse(input);
  const url = new URL(data.path.startsWith("http") ? data.path : `${BASE_URL}${data.path}`);
  if (data.query) {
    for (const [key, value] of Object.entries(data.query)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
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

export const mangoolsRequest = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(PublicMangoolsRequestSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!context.userId) throw new Error("Unauthorized");
    const key = await ownerMangoolsKey(sql, context.userId);
    return mangoolsFetch(bindStoredMangoolsKey(data, key));
  });
