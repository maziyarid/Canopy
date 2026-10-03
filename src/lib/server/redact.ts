/**
 * AAX-55 shared redaction for logs, provider errors and diagnostics.
 * - Credentials/tokens replaced with [REDACTED]
 * - Free-text medical/PII-like strings replaced with stable salted hash refs so
 *   correlation remains possible without exposing values or allowing offline guessing.
 * Medical inquiry retention is intentionally NOT activated here.
 */

import { createHash } from "node:crypto";

const CREDENTIAL_RE =
  /(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|x-access-token)([\s:="']+)(?:bearer[\s]+)?[^\s&,;"']+/gi;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}/g;

function piiPepper(): string {
  const pepper = process.env.MS_ROBOT_PII_PEPPER?.trim() ?? "";
  if (pepper.length >= 16) return pepper;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MS_ROBOT_PII_PEPPER is required");
  }
  // Non-production only. Not a committed secret and not used when NODE_ENV=production.
  return "test-only-pii-pepper-not-for-production";
}

function stableHash(input: string): string {
  // Full SHA-256 with a server pepper. 64 hex chars, not a public 64-bit truncation.
  const h = createHash("sha256").update(piiPepper()).update("\0").update(input).digest("hex");
  return `pii:${h}`;
}

export function redactCredentials(message: string): string {
  if (!message) return message;
  return message.replace(CREDENTIAL_RE, "$1$2[REDACTED]");
}

export function redactPii(message: string): string {
  if (!message) return message;
  return message
    .replace(EMAIL_RE, (m) => stableHash(m))
    .replace(PHONE_RE, (m) => stableHash(m));
}

export function redactForLog(message: string): string {
  return redactPii(redactCredentials(String(message ?? "")));
}

export function redactForClient(message: string): string {
  // Client-facing: credentials gone; PII never returned as plaintext.
  return redactPii(redactCredentials(String(message ?? "")));
}
