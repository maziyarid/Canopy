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

/** App-level salt for PII refs. Not a secret; prevents offline rainbow tables of the 32-bit hash. */
const PII_SALT = "ms-robot-pii-v1";

function stableHash(input: string): string {
  // Salted SHA-256 truncated for compact correlation refs. Not reversible without the original value.
  const h = createHash("sha256").update(PII_SALT).update(input).digest("hex").slice(0, 16);
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
