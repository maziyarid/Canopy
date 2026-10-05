import { APP_BASE } from "./public-paths.ts";
export type DataDomain = "medical" | "thesis" | "other";

const STORAGE_KEY = APP_BASE === "/" ? "ms-robot.ambientDataDomain" : "msrobot:v1:ambientDataDomain";

export function parseAmbientDataDomain(value: unknown): DataDomain | undefined {
  return value === "medical" || value === "thesis" || value === "other" ? value : undefined;
}

export function attachAmbientDataDomain<T extends Record<string, unknown>>(
  payload: T,
  ambient: DataDomain | null | undefined,
): T & { ambientDataDomain?: DataDomain } {
  const domain = parseAmbientDataDomain(ambient);
  if (!domain) return payload;
  return { ...payload, ambientDataDomain: domain };
}

export function readAmbientDataDomain(): DataDomain | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  return parseAmbientDataDomain(sessionStorage.getItem(STORAGE_KEY));
}

export function writeAmbientDataDomain(value: DataDomain | "" | null | undefined) {
  if (typeof sessionStorage === "undefined") return;
  const domain = parseAmbientDataDomain(value);
  if (!domain) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, domain);
}
