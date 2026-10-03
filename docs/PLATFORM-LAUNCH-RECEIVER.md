# Ms Robot platform launch receiver

Status: isolated implementation; disabled by default. No production migration or activation.

POST `/launch/accept` accepts one form field `code` only. The browser must send the exact configured platform Origin; null, missing, foreign, URL-code and non-form requests fail closed. The code is redeemed via backend POST `/launch/redeem`, with the protected runtime service credential, a five-second timeout, no redirect and bounded response. Returned audience must be `ms-robot`, destination must match the product's configured exact origin and the current finite timestamps must satisfy an unexpired lifetime of at most 60 seconds.

The receiver does not link by email or create users, owner grants or memberships. Operators must explicitly provision `platform_launch_mappings` to an existing BetterAuth user, product tenant and project after reviewed linking. The mapping is checked against current active tenant/project and existing explicit tenant/project user grants. Product workspaces retain existing `projects.id` identifiers.

The existing BetterAuth adapter creates and signs a new one-hour product session using the existing Secure, HttpOnly, Path=/, host-only cookie. A persistent session binding contains the platform principal/tenant/workspace, local user/tenant/project and unique receipt. The browser receives an empty 303 to a local project path; codes and service/session tokens are not returned in JSON, URLs or logs by this receiver. The marked product session cannot become unrestricted if its binding disappears.

Studio middleware rechecks persistent bindings and grants on each data request. Workspace access is constrained to the bound project, including owners who normally have multiple projects. Project lists are filtered and invite email linking is skipped. User-global settings, seeding, raw provider requests and ClickUp functions fail closed because their current contracts are not scoped to a workspace. Scoped auth requests permit get-session and sign-out only, and forbid gate identity headers. Native user identity and launch scope come from the same uncached persisted session read. Delegated auth requests strip the configured signed session cache and its chunks, so stale cookies cannot revive a deleted session. Exact POST sign-out clears revoked launch sessions while BetterAuth retains its Origin checks. Normal product sessions retain their established behaviour.

Runtime configuration (server only, never VITE variables):

- `MAZIYARID_LAUNCH_ENABLED=true` (absent/other values leave receiver disabled).
- `MAZIYARID_PLATFORM_ORIGIN`: reviewed exact HTTPS platform origin.
- `BETTER_AUTH_URL`: existing exact HTTPS product origin.
- `MAZIYARID_LAUNCH_SERVICE_TOKEN`: existing protected runtime credential for the product service principal. No credential material belongs in source, Git, browser state or task comments.

Tests: `npm run test:launch`. Uses real BetterAuth 1.6.30, the existing PGLite dialect, synthetic users/grants and a temporary persistent database, including restart, revocation, receipt replay, cross-project denial, stale cache/unknown bearer rejection, revoked-session sign-out and separate non-owner tenant/project grant revocation. Mapped-project deletion cascades its mapping; retained sessions then fail current mapping validation.

Isolated cross-process harness: `node --experimental-transform-types scripts/platform-launch-fixture.ts <private-config-path>`. Its JSON config, permissions600, contains `platformOrigin,productOrigin,serviceToken,secret,dbDir,port,principalId,platformTenantId,platformWorkspaceId`. It creates synthetic fixture-product-user / fixture-product-tenant, projects fixture-project-one/two, and an explicit mapping to project-one. It serves the real receiver, BetterAuth and protected read endpoints on loopback. `/protected/fixture-project-one` succeeds with the launch cookie; project-two is denied. Only readiness and port are logged. HTTP origins are accepted solely in this NODE_ENV=test fixture. Never use the fixture server, synthetic mapping or test keys in production.

Built-application harness: `node scripts/platform-launch-built-fixture.mjs <private-config-path>` imports the current built Vercel fetch handler after seeding all actual migrations into a disposable PGlite database. It uses the same protected config shape and existing bundled auth plugins, API routes and Studio middleware. The companion platform browser suite calls the actual bundled client RPC and checks scoped data, global-write denial, logout, stale cookies and desktop/mobile rendering. Both harnesses are acceptance fixtures, and never deployment entry points.

Before activation: review canonical product release, provision real explicit mappings, protect service credentials with existing runtime controls, apply additive migration after backup, verify actual platform-to-product browser handoff and current release rendering, configure request/log redaction and limits at existing gateway, and complete deployment/rollback review. ADA agents and approvals remain separate.
