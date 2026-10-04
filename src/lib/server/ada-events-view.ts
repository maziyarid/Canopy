import { z } from "zod";

const secretValue =
  /(?:bearer\s+|-----BEGIN\s|\b\d{6,12}:[A-Za-z0-9_-]{30,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i;
const reference = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
    .refine((value) => !secretValue.test(value));
const EventSchema = z
  .object({
    event_id: reference(80),
    project_id: reference(128),
    site_key: reference(160),
    source: reference(80),
    event_type: z.enum([
      "ada.alert.queued",
      "ada.alert.recovered",
      "ada.operator.handoff",
      "ada.language_feedback.approved",
      "ms_robot.inquiry.created",
      "ms_robot.inquiry.routed",
      "ms_robot.analytics.signal",
      "ms_robot.medical_admin.event",
      "ms_robot.action.proposal",
      "ms_robot.delivery.failure",
    ]),
    correlation_id: reference(160).or(z.literal("")),
    sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
    reported_at: z.iso.datetime({ offset: true }).or(z.literal("")),
    received_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    state: z.enum(["recorded", "acknowledged"]),
    action_state: z.enum(["informational", "proposal_only"]),
  })
  .strip()
  .refine(
    (row) =>
      (row.event_type === "ms_robot.action.proposal") === (row.action_state === "proposal_only"),
  );

export type AdaEventView = z.infer<typeof EventSchema>;

export function canReadAdaEvents(role: string, keywordFilter: string) {
  return role === "owner" && !keywordFilter.trim();
}

export function projectAdaEvents(rows: unknown, projectId: string, site: string): AdaEventView[] {
  if (!Array.isArray(rows)) return [];
  const result: AdaEventView[] = [];
  for (const raw of rows.slice(0, 100)) {
    const parsed = EventSchema.safeParse(raw);
    if (parsed.success && parsed.data.project_id === projectId && parsed.data.site_key === site) {
      result.push(parsed.data);
    }
  }
  return result;
}
