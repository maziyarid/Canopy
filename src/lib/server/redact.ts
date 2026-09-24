/**
 * AAX-55 shared redaction for logs, provider errors and diagnostics.
 * - Credentials/tokens replaced with [REDACTED]
 * - Free-text medical/PII-like strings replaced with stable hash refs so
 *   correlation remains possible without exposing values.
 * Medical inquiry retention is intentionally NOT activated here.
 */

const CREDENTIAL_RE =
  /(?i)(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|x-access-token)([\s:="']+)(?:bearer[\s]+)?[^\s&,;"']+/g;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}/g;

function stableHash(input: string): string {
  // Simple non-crypto fingerprint for correlation only; not a security hash.
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return `pii:${(h >>> 0).toString(16)}`;
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
