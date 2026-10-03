/** Server-side protocol only. Never return credentials/codes/tokens to app data. */
export class LaunchError extends Error {
  readonly status: number;
  constructor(status: number, message = "Launch unavailable") {
    super(message);
    this.status = status;
  }
}
export type LaunchConfig = { platformOrigin: string; productOrigin: string; serviceToken: string };
export type LaunchIntent = {
  principal_id: string;
  tenant_id: string;
  workspace_id: string;
  product_id: string;
  destination_origin: string;
  issued_at: number;
  expires_at: number;
};
export type LaunchReceipt = { receipt_id: string; intent: LaunchIntent };
export type LaunchMapping = {
  principal_id: string;
  platform_tenant_id: string;
  platform_workspace_id: string;
  user_id: string;
  project_id: string;
  tenant_id: string;
};
export function exactOrigin(value: unknown, test = false): string {
  if (typeof value !== "string") throw new LaunchError(503);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LaunchError(503);
  }
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        test &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new LaunchError(503);
  return value;
}
export function launchConfig(env: Record<string, string | undefined>): LaunchConfig | null {
  if (env.MAZIYARID_LAUNCH_ENABLED !== "true") return null;
  const test = env.NODE_ENV === "test";
  const platformOrigin = exactOrigin(env.MAZIYARID_PLATFORM_ORIGIN, test);
  const productOrigin = exactOrigin(env.BETTER_AUTH_URL, test);
  const serviceToken = env.MAZIYARID_LAUNCH_SERVICE_TOKEN;
  if (!serviceToken || serviceToken.length < 32 || /\s/.test(serviceToken))
    throw new LaunchError(503);
  if (platformOrigin === productOrigin) throw new LaunchError(503);
  return { platformOrigin, productOrigin, serviceToken };
}
export function validateReceipt(
  value: unknown,
  config: LaunchConfig,
  now = Date.now() / 1000,
): LaunchReceipt {
  if (!value || typeof value !== "object") throw new LaunchError(502);
  const r = value as LaunchReceipt,
    i = r.intent;
  const id = (x: unknown) =>
    typeof x === "string" && x.length > 0 && x.length <= 191 && /^[A-Za-z0-9._:@-]+$/.test(x);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.receipt_id) ||
    !i ||
    !id(i.principal_id) ||
    !id(i.tenant_id) ||
    !id(i.workspace_id) ||
    i.product_id !== "ms-robot" ||
    i.destination_origin !== config.productOrigin ||
    typeof i.issued_at !== "number" ||
    typeof i.expires_at !== "number" ||
    !Number.isFinite(i.issued_at) ||
    !Number.isFinite(i.expires_at) ||
    i.issued_at < 0 ||
    i.issued_at > now ||
    i.expires_at <= now ||
    i.expires_at <= i.issued_at ||
    i.expires_at - i.issued_at > 60
  )
    throw new LaunchError(403);
  return r;
}
export async function boundedText(request: Request | Response, limit: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw new LaunchError(413);
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function redeemLaunch(
  request: Request,
  config: LaunchConfig,
  fetcher: typeof fetch = fetch,
): Promise<LaunchReceipt> {
  const url = new URL(request.url);
  if (
    request.method !== "POST" ||
    url.origin !== config.productOrigin ||
    url.pathname !== "/launch/accept" ||
    url.search ||
    request.headers.get("origin") !== config.platformOrigin
  )
    throw new LaunchError(403);
  const type = request.headers.get("content-type")?.split(";")[0].trim();
  if (type !== "application/x-www-form-urlencoded") throw new LaunchError(415);
  const fields = new URLSearchParams(await boundedText(request, 2048));
  if ([...fields.keys()].some((k) => k !== "code") || fields.getAll("code").length !== 1)
    throw new LaunchError(400);
  const code = fields.get("code");
  if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new LaunchError(400);
  let response: Response;
  try {
    response = await fetcher(config.platformOrigin + "/launch/redeem", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.serviceToken,
      },
      body: JSON.stringify({ code }),
    });
  } catch {
    throw new LaunchError(502);
  }
  if (!response.ok) throw new LaunchError(response.status >= 500 ? 502 : 403);
  let value: unknown;
  try {
    value = JSON.parse(await boundedText(response, 8192));
  } catch {
    throw new LaunchError(502);
  }
  return validateReceipt(value, config);
}
