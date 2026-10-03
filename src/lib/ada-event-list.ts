import type { AdaEventView } from "./server/ada-events-view.ts";

export const ADA_EVENT_LABELS: Record<AdaEventView["event_type"], { en: string; fa: string }> = {
  "ada.alert.queued": { en: "Alert queued", fa: "هشدار در صف" },
  "ada.alert.recovered": { en: "Alert resolved", fa: "هشدار برطرف شده" },
  "ada.operator.handoff": { en: "Operator handoff", fa: "ارجاع به مسئول" },
  "ada.language_feedback.approved": {
    en: "Language feedback approved",
    fa: "بازخورد زبانی تایید شده",
  },
  "ms_robot.inquiry.created": { en: "Inquiry received", fa: "درخواست دریافت شده" },
  "ms_robot.inquiry.routed": { en: "Inquiry routed", fa: "درخواست ارجاع شده" },
  "ms_robot.analytics.signal": { en: "Analytics signal", fa: "نشانه تحلیلی" },
  "ms_robot.medical_admin.event": { en: "Medical administration event", fa: "رویداد مدیریت پزشکی" },
  "ms_robot.action.proposal": { en: "Action proposal", fa: "پیشنهاد اقدام" },
  "ms_robot.delivery.failure": { en: "Delivery failure", fa: "خطا در تحویل" },
};

export type AdaEventFilter = "all" | "unconfirmed" | "acknowledged" | "proposals";

// Only searches already authorised metadata. No requests, persistence or identity normalisation.
export function filterAdaEvents(items: AdaEventView[], filter: AdaEventFilter, query: string) {
  const search = query.trim().toLocaleLowerCase("en-GB");
  return items.filter((event) => {
    if (filter === "unconfirmed" && event.state !== "recorded") return false;
    if (filter === "acknowledged" && event.state !== "acknowledged") return false;
    if (filter === "proposals" && event.action_state !== "proposal_only") return false;
    const label = ADA_EVENT_LABELS[event.event_type];
    return (
      !search ||
      [
        event.event_id,
        event.event_type,
        event.source,
        event.correlation_id,
        event.site_key,
        label.en,
        label.fa,
      ].some((value) => value.toLocaleLowerCase("en-GB").includes(search))
    );
  });
}
