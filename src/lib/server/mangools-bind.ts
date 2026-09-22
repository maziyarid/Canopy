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

export const PublicMangoolsRequestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  path: z.string().min(1),
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
