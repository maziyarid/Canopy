/**
 * AAX-55 shared redaction for logs, provider errors and diagnostics.
 * - Credentials/tokens replaced with [REDACTED]
 * - PII removed; optional server-only keyed references support log correlation.
 * Medical inquiry retention is intentionally NOT activated here.
 */

import { createHmac } from "node:crypto";

const CREDENTIAL_RE =
  /(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|x-access-token)([\s:="']+)(?:bearer[\s]+)?[^\s&,;"']+/gi;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}/g;
const PII_RE = new RegExp(`${EMAIL_RE.source}|${PHONE_RE.source}`, "g");

function piiKey(): string | null {
  const pepper = process.env.MS_ROBOT_PII_PEPPER?.trim() ?? "";
  if (pepper.length >= 32) return pepper;

  if (process.env.NODE_ENV === "production") {
    throw new Error("MS_ROBOT_PII_PEPPER is required and must be at least 32 characters");
  }

  const legacyKey = process.env.PII_REDACTION_KEY?.trim() ?? "";
  if (legacyKey.length >= 32) return legacyKey;
  return null;
}

function stableHash(input: string): string {
  const key = piiKey();
  if (!key) return "[REDACTED_PII]";
  return `pii:${createHmac("sha256", key).update(input).digest("hex")}`;
}

export function redactCredentials(message: string): string {
  if (!message) return message;
  return message.replace(CREDENTIAL_RE, "$1$2[REDACTED]");
}

export function redactPii(message: string): string {
  if (!message) return message;
  return message.replace(PII_RE, (m) => stableHash(m));
}

export function redactForLog(message: string): string {
  return redactPii(redactCredentials(String(message ?? "")));
}

export function redactForClient(message: string): string {
  return redactCredentials(String(message ?? ""))
    .replace(/pii:[0-9a-f]{16,64}/gi, "[REDACTED_PII]")
    .replace(EMAIL_RE, "[REDACTED_PII]")
    .replace(PHONE_RE, "[REDACTED_PII]");
}
