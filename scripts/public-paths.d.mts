export function normalizeAppBase(value?: string): string;
export function appPath(route?: string, base?: string): string;
export function safeAppReturnPath(value: unknown, base?: string): string | null;
export function validatePublicOrigin(value: string, options?: { allowLocalHttp?: boolean }): string;
