import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { resolveAccess } from "./access";
import { studioAuth } from "./studio-auth";
import { loadReportingSnapshot, refreshReportingSnapshotRecord } from "./reporting-snapshot-service";

const GetSchema = z.object({
  projectId: z.string().min(1).max(80),
  period: z.string().max(40).optional(),
  comparison: z.string().max(40).optional(),
  correlationId: z.string().max(80).optional(),
});

const RefreshSchema = z.object({
  projectId: z.string().min(1).max(80),
  period: z.string().max(40).optional(),
  comparison: z.string().max(40).optional(),
  idempotencyKey: z.string().min(8).max(120),
  correlationId: z.string().max(80).optional(),
});

export const getReportingSnapshot = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(GetSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return loadReportingSnapshot({
      sql,
      resolveAccess,
      userId: context.userId,
      email: context.email,
      projectId: data.projectId,
      periodLabel: data.period,
      comparisonLabel: data.comparison,
      correlationId: data.correlationId,
    });
  });

export const refreshReportingSnapshot = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(RefreshSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return refreshReportingSnapshotRecord({
      sql,
      resolveAccess,
      userId: context.userId,
      email: context.email,
      projectId: data.projectId,
      idempotencyKey: data.idempotencyKey,
      periodLabel: data.period,
      comparisonLabel: data.comparison,
      correlationId: data.correlationId,
    });
  });
