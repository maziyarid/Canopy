import { isReportingConfiguredForRole } from "./client-report-view.ts";
import { SnapshotAccessError } from "./reporting-snapshot-service.ts";

/**
 * Fail closed before any reporting read.
 * An unconfigured role must not invoke the reader, even if a later branch
 * would have returned an empty view.
 */
export async function readIfReportingConfigured<T>(role: string, read: () => Promise<T>): Promise<T> {
  if (!isReportingConfiguredForRole(role)) {
    throw new SnapshotAccessError(503, "Reporting unavailable");
  }
  return read();
}
