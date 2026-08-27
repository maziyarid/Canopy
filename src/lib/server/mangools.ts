import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BASE_URL } from "@/lib/api-catalog";

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

const RequestSchema = z.object({
  apiKey: z.string().min(8),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  path: z.string().min(1),
  query: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  body: jsonSchema.optional(),
});

export const mangoolsRequest = createServerFn({ method: "POST" })
  .validator(RequestSchema)
  .handler(async ({ data }) => {
    const url = new URL(data.path.startsWith("http") ? data.path : `${BASE_URL}${data.path}`);
    if (data.query) {
      for (const [k, v] of Object.entries(data.query)) {
        if (v === undefined || v === "") continue;
        url.searchParams.set(k, String(v));
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
      return { ok: false as const, status: res.status, error: `Mangools ${res.status}: ${err}` };
    }
    return { ok: true as const, status: res.status, data: json };
  });
