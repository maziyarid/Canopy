import { appPath, normalizeAppBase, safeAppReturnPath } from '../../scripts/public-paths.mjs';

/** Vite/Start replace this with the same base in browser and server bundles. */
export const APP_BASE = normalizeAppBase(import.meta.env?.BASE_URL ?? '/');
export const appHref = (route = '/') => appPath(route, APP_BASE);
export function appReturnHref(value: string | undefined): string {
  return safeAppReturnPath(value, APP_BASE) ?? appHref('/');
}
