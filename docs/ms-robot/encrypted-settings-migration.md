# Encrypted integration settings

Source checkpoint: 9 November 2026, based on main `920ccd7` (PR #32). This change
adds migration `0013_encrypted_settings.sql` and its shared application data hook.
It has been exercised against disposable fixtures; no live migration or
deployment was performed.

## Storage and access

The three legacy integration secrets move into the existing `credential_vault`:

| Legacy column | Encrypted provider field |
| --- | --- |
| `studio_settings.mangools_key` | `mangools` |
| `studio_settings.monday_webhook` | `monday_webhook` |
| `clickup_settings.api_key` | `clickup` |

The Monday webhook is treated as a capability credential. Location/language
defaults and ClickUp team/folder/list identifiers remain ordinary SQL settings.
Authentication's session/account tables are outside this migration's scope.

Settings credentials have an explicit `owner_user_id` scope with empty
tenant/project fields. Owners without projects are supported; no project or
tenant is inferred. Existing project-scoped social vault records retain their
format and behaviour. A partial unique index permits one encrypted setting per
owner/provider. AES-256-GCM uses fresh nonces and JSON associated data binding the
user-settings scope, owner, provider and ciphertext row identifier. Copying a
record across those boundaries fails authentication.

Public settings responses contain `hasKey`/`hasApiKey` and the existing masked
Monday placeholder. Actual credentials are resolved only for server-side
provider requests. Omitted/masked saves preserve the stored credentials; an
explicitly empty Monday field clears that credential. New Mangools keys must
pass the existing provider validation before a settings transaction starts.
There is no runtime fallback to the old plaintext columns.

## Migration behaviour

Both the PostgreSQL migration command and PGLite startup use
`applyApplicationMigration`. For migration 0013, one pinned transaction:

1. Adds owner scope, its index and unvalidated blank-only checks on the legacy
   columns. Old values remain available only to the data hook in this transaction.
2. Locks the legacy settings tables, reads existing non-empty values, encrypts
   them into the vault and verifies each persisted record by decrypting it with
   its exact associated data. Existing encrypted/plaintext conflicts fail closed.
3. Clears all three plaintext columns, preserving preferences and identifiers,
   and validates the blank-only constraints.
4. Records the migration in `_migrations` and commits.

Missing/malformed keys, ciphertext verification failures, SQL errors or failure
to write the marker roll back the schema, ciphertext and plaintext changes
together. The marker prevents another normal migration pass. Repeating the data
hook after completion changes no ciphertext and migrates zero values. New writes
to the old secret columns are rejected by PostgreSQL constraints.

Apply this through the repository migration command/bootstrap, which includes
the JavaScript data hook. Running the SQL file alone does not encrypt existing
values. The command now enables Node's TypeScript stripping; Node 22+ is required.
PGLite transactions and PostgreSQL transactions use their own connection-bound
client. Issuing `BEGIN` through the shared PostgreSQL pool is not a transaction.

## Keys and a later reviewed rollout

The application and migration process use the existing protected vault key
configuration:

- `MAZ_ROBOT_VAULT_KEY`: canonical base64 for a 32-byte active key; or
  `MAZ_ROBOT_VAULT_KEYS`: a JSON map of positive integer versions to those keys.
- `MAZ_ROBOT_VAULT_ACTIVE_VERSION`: positive integer; defaults to `1`.
- If the map and single-key value both specify the active version, they must
  agree. All configured key entries are validated with fixed, secret-free errors.

Provision the reviewed key through the operator secret store for both the
migrator and application runtime. Never use a `VITE_` variable, source file,
command argument, log, browser state or authentication secret as key storage.
The migration never generates a replacement key. A fresh database without
legacy secrets needs no key until an integration credential is saved.

A valid arbitrary key can encrypt plaintext; plaintext cannot establish that an
operator has selected or safely retained the intended key. Key custody and
recoverability need separate operator verification. Retain every version still
referenced by ciphertext. Replacing a credential uses the configured active
version; changing the active version alone does not rotate older records.

Before a later rollout, rehearse against a protected copy with the intended key,
review counts and configured metadata only, verify private provider access and
confirm the rollback/backup procedure. Rollback requires a matching encrypted
database and retained keys. Reverting to an older binary will not restore the
cleared plaintext and its old writes are deliberately rejected.

Logical SQL clearing does not erase old PostgreSQL/PGLite pages, WAL, snapshots
or backups. Protect and expire those through the established storage-retention
process; this PR does not claim forensic erasure. Neither the migration nor its
errors log credentials, provider responses or value-bearing SQL diagnostics.

## Verification

The regression suites use generated synthetic secrets and keys. They check the
real schema/data migration and marker transaction, round-trips for each field,
owners without projects, wrong keys and modified scope, failed writes, corrupted
persisted ciphertext, missing configuration, reruns, constraints, public masking,
provider use after migration and atomic settings updates. The new 26 tests are
registered in `npm test`; the existing Mangools storage test now exercises the
encrypted save path as well.

Final checks used Node `v24.19.0` and Python-free application fixtures. Every
command below exited 0:

```text
npm test
  script suite:      tests 205, pass 205, fail 0, skipped 0
  TypeScript suite:  tests 268, pass 268, fail 0, skipped 0

npm run test:launch
  tests 24, pass 24, fail 0, skipped 0

npm run lint
  > eslint .
  no diagnostics

npm run typecheck
  > tsc --noEmit
  no diagnostics

env -u DATABASE_URL npm run build
  [nitro] ✔ Generated public .vercel/output/static
  [pglite-assets] copied pglite.data
  [pglite-assets] copied pglite.wasm
  [pglite-assets] copied initdb.wasm
  [migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).

git diff --check
  no diagnostics
```

Total: **497 tests passed, zero failures or skips**. The build had its external
database URL explicitly removed; no live migration was run. The two Python
operations/analytics suites were unchanged and were not rerun for this change.
An independent review reran all 26 focused encryption/transaction tests and found
no material correctness or security issues.

Controlled browser checks served the exact built Vercel handler and used fresh
disposable PGLite databases without vault keys. Desktop/mobile rendered HTTP 200
with visible content, no page/console errors and no horizontal overflow;
screenshots were visually inspected. Reopening the dev and built fixture
databases confirmed migration 0013 was recorded, all three plaintext constraints
were validated and the old secret columns contained no non-empty values. The
compiled browser JavaScript contained none of the vault module/key-environment,
associated-data or data-migration implementation symbols.

The unmodified browser smoke was also attempted: external font/platform
certificate errors remain. Controlled rendering fulfilled those external
resources locally; it is not a clean external-resource smoke pass. Development
rendered matching content but its isolated auth request returned the previously
observed 403. No authenticated production or live provider acceptance is claimed.
