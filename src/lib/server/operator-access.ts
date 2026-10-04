/** Raw provider/cache and model operations are not client reporting surfaces. */
export function assertOperatorAccess(access: { role: string; filter: string }): void {
  if (!["owner", "editor"].includes(access.role) || access.filter.trim()) throw new Error("Forbidden");
}
