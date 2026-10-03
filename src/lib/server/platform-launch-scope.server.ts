import { AsyncLocalStorage } from "node:async_hooks";
import { LaunchError } from "./platform-launch.ts";
import type { LaunchScope } from "./platform-launch-store.ts";
const scopeStorage = new AsyncLocalStorage<LaunchScope | null>();
export const getLaunchScope = () => scopeStorage.getStore() ?? null;
export function runWithLaunchScope<T>(scope: LaunchScope | null, fn: () => T): T {
  return scopeStorage.run(scope, fn);
}
export function assertLaunchProject(userId: string, projectId: string): void {
  const scope = getLaunchScope();
  if (scope && (scope.user_id !== userId || scope.project_id !== projectId))
    throw new LaunchError(403);
}
export function assertUnrestrictedSession(): void {
  if (getLaunchScope()) throw new LaunchError(403);
}
