import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { resolveAccess } from "./access";
import { updateReportGrants } from "./report-grants-service";
import { REPORT_SECTIONS } from "./report-sections";

export const saveReportGrants = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(z.object({ projectId: z.string().min(1).max(80), memberId: z.string().min(1).max(80), sections: z.array(z.enum(REPORT_SECTIONS)).max(4) }))
  .handler(async ({ context, data }) => updateReportGrants({ sql: await getSql(), resolveAccess, userId: context.userId, email: context.email, ...data }));
