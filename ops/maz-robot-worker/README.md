# Maz Robot publication worker

This service executes durable social publication jobs. It is deliberately separate from ADA and Ms Robot analytics.

## Production prerequisites

Create `/etc/maz-robot-worker.env` as root-only configuration. Do not commit it.

Required:
- `DATABASE_URL`: durable Postgres/Neon database where migrations through `0005_social_runtime.sql` are applied.
- either `MAZ_ROBOT_VAULT_KEY` for the active version or `MAZ_ROBOT_VAULT_KEYS` as a JSON object of version -> base64 32-byte key.
- `MAZ_ROBOT_VAULT_ACTIVE_VERSION`: defaults to 1.

Optional:
- `MAZ_ROBOT_WORKER_ID`
- `MAZ_ROBOT_IDLE_MS` (default 2000)
- `MAZ_ROBOT_LEASE_SECONDS` (default 120)

The worker never accepts credentials in job payloads. It resolves the encrypted `credential_ref` within the job's project scope and records credential access in `operation_receipts`.

## Activation

Before enabling the service:

1. Apply reviewed migrations to the durable database.
2. Provision the vault key using a secure operator path.
3. Run the fail-closed preflight:
   `node-22 --experimental-strip-types ops/maz-robot-worker/worker.ts --check`
4. Only after preflight passes: enable/start `maz-robot-worker.service`.

On this VPS the service must remain disabled while `DATABASE_URL` or vault-key configuration is absent.

## Safety contract

- Atomic DB lease prevents concurrent double claims.
- Prior successful provider receipt suppresses republishing.
- Platform capability state is checked before provider mutation.
- Provider rate-limit retry hints are bounded and persisted.
- Exhausted jobs enter `dead`; they are not retried indefinitely.
- Telegram is the only implemented mutation adapter at this checkpoint.
- Other platforms remain gated until their own adapter + provider eligibility are verified.
