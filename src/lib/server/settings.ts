import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { mapQuota } from "@/lib/map-api";
import { studioAuth } from "./studio-auth";
import { mangoolsFetch } from "./mangools";
import type { QuotaState, StudioSettings } from "@/lib/types";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .handler(async ({ context }): Promise<StudioSettings> => {
    const sql = await getSql();
    const rows = await sql<{
      mangools_key: string;
      monday_webhook: string;
      default_location_id: number;
      default_language_id: number;
    }>`select * from studio_settings where user_id = ${context.userId}`;
    const row = rows[0];
    return {
      hasKey: Boolean(row?.mangools_key),
      mondayWebhook: row?.monday_webhook ?? "",
      defaultLocationId: Number(row?.default_location_id ?? 2840),
      defaultLanguageId: Number(row?.default_language_id ?? 1000),
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(
    z.object({
      mangoolsKey: z.string().max(200).optional(),
      mondayWebhook: z.string().max(500).optional(),
      defaultLocationId: z.number().int().optional(),
      defaultLanguageId: z.number().int().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<{ mangools_key: string; monday_webhook: string }>`
      select mangools_key, monday_webhook from studio_settings where user_id = ${context.userId}
    `;
    const key =
      data.mangoolsKey && data.mangoolsKey !== "••••••••"
        ? data.mangoolsKey.trim()
        : (existing[0]?.mangools_key ?? "");
    const hook = data.mondayWebhook ?? existing[0]?.monday_webhook ?? "";
    const loc = data.defaultLocationId ?? 2840;
    const lang = data.defaultLanguageId ?? 1000;
    if (existing[0]) {
      await sql`
        update studio_settings
        set mangools_key = ${key}, monday_webhook = ${hook},
            default_location_id = ${loc}, default_language_id = ${lang}
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into studio_settings (user_id, mangools_key, monday_webhook, default_location_id, default_language_id)
        values (${context.userId}, ${key}, ${hook}, ${loc}, ${lang})
      `;
    }
    return { ok: true as const, hasKey: Boolean(key) };
  });

export const testQuota = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .handler(async ({ context }): Promise<QuotaState> => {
    const sql = await getSql();
    const rows = await sql<{ mangools_key: string }>`
      select mangools_key from studio_settings where user_id = ${context.userId}
    `;
    const key = rows[0]?.mangools_key?.trim();
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const res = await mangoolsFetch({ apiKey: key, path: "/kwfinder/limits" });
    if (!res.ok) throw new Error(res.error);
    return mapQuota(res.data);
  });
