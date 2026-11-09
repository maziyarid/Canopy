import { assertUnrestrictedSession } from "./platform-launch-scope.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { mapQuota } from "@/lib/map-api";
import { studioAuth } from "./studio-auth";
import { mangoolsFetch } from "./mangools";
import { ownerMangoolsKey } from "./access";
import { publicStudioSettings, saveStudioSettingsRecord } from "./integration-settings-service";
import type { QuotaState, StudioSettings } from "@/lib/types";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .handler(async ({ context }): Promise<StudioSettings> => {
    assertUnrestrictedSession();
    const sql = await getSql();
    return publicStudioSettings(sql, context.userId);
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
    assertUnrestrictedSession();
    const sql = await getSql();
    return saveStudioSettingsRecord(sql, context.userId, data, async (candidate) => {
      const res = await mangoolsFetch({ apiKey: candidate, path: "/kwfinder/limits" });
      return res.ok;
    });
  });

export const testQuota = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .handler(async ({ context }): Promise<QuotaState> => {
    assertUnrestrictedSession();
    const sql = await getSql();
    const key = await ownerMangoolsKey(sql, context.userId);
    if (!key) throw new Error("Add your Mangools API key in Connect.");
    const res = await mangoolsFetch({ apiKey: key, path: "/kwfinder/limits" });
    if (!res.ok) throw new Error(res.error);
    return mapQuota(res.data);
  });
