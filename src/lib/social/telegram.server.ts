export type TelegramButton = { text: string; url: string };
export type TelegramMedia = { kind: "image" | "video" | "document"; url: string; caption?: string };

export type TelegramPublishInput = {
  chatId: string;
  text?: string;
  media?: TelegramMedia[];
  buttons?: TelegramButton[];
};

export type TelegramPublishResult = {
  providerMessageIds: string[];
  retryAfterSeconds?: number;
  readBackSupported: false;
};

export class TelegramAdapterError extends Error {
  retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number) {
    super(message); this.name = "TelegramAdapterError"; this.retryAfterSeconds = retryAfterSeconds;
  }
}

function keyboard(buttons?: TelegramButton[]) {
  if (!buttons?.length) return undefined;
  return { inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))] };
}
export function buildTelegramRequest(input: TelegramPublishInput) {
  if (!input.chatId.trim()) throw new Error("Telegram chatId is required");
  const media = input.media ?? [];
  if (media.length > 1) {
    if (input.buttons?.length) throw new Error("Buttons are not supported on Telegram media groups");
    if (media.some((m) => m.kind === "document")) throw new Error("Documents must be published separately");
    return { method: "sendMediaGroup", body: {
      chat_id: input.chatId,
      media: media.map((m, i) => ({
        type: m.kind === "image" ? "photo" : "video",
        media: m.url,
        ...(m.caption || (i === 0 && input.text) ? { caption: m.caption || input.text } : {}),
      })),
    }};
  }
  const reply_markup = keyboard(input.buttons);
  if (media.length === 1) {
    const m = media[0];
    const key = m.kind === "image" ? "photo" : m.kind;
    const method = m.kind === "image" ? "sendPhoto" : m.kind === "video" ? "sendVideo" : "sendDocument";
    return { method, body: { chat_id: input.chatId, [key]: m.url,
      ...(m.caption || input.text ? { caption: m.caption || input.text } : {}),
      ...(reply_markup ? { reply_markup } : {}),
    }};
  }
  if (!input.text?.trim()) throw new Error("Telegram text or media is required");
  return { method: "sendMessage", body: {
    chat_id: input.chatId, text: input.text, ...(reply_markup ? { reply_markup } : {}),
  }};
}

export async function publishTelegram(
  botToken: string, input: TelegramPublishInput, fetchImpl: typeof fetch = fetch,
): Promise<TelegramPublishResult> {
  if (!botToken.trim()) throw new Error("Telegram bot credential is required");
  const req = buildTelegramRequest(input);
  const res = await fetchImpl(`https://api.telegram.org/bot${botToken}/${req.method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body),
  });
  let data: any;
  try { data = await res.json(); } catch { throw new TelegramAdapterError(`Telegram ${res.status}: invalid JSON response`); }
  if (!res.ok || !data?.ok) {
    const retry = Number(data?.parameters?.retry_after) || undefined;
    throw new TelegramAdapterError(`Telegram ${res.status}: ${String(data?.description || "request failed")}`, retry);
  }
  const rows = Array.isArray(data.result) ? data.result : [data.result];
  const ids = rows.map((x: any) => x?.message_id).filter((x: unknown) => x != null).map(String);
  return { providerMessageIds: ids, readBackSupported: false };
}
