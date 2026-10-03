# Ms Robot integration plan — 30 September 2026

Scope: integrate the reviewed recovery/provider, ClickUp, privacy, reporting,
dashboard and insight slices into one verifiable branch. This is a beta
integration checkpoint, not completion of all nine stages in the supplied
direct-gateway and unified-stack implementation specifications.

1. Recover current GitHub heads, Agiflow state and live provider evidence.
2. Integrate PRs 4–9 on an independent checkout, preserving existing dirty work.
3. Connect reporting to the scoped SQLite gateway; enforce client grants before
   serialization; correct aggregation, conversion classification and cache dates.
4. Replace public-salt PII references with keyed server-only correlation and
   complete removal from client errors.
5. Persist report grants and reviewed narrative records separately from metrics,
   including audit receipts and optimistic edit concurrency.
6. Support durable local application storage; refuse volatile production storage.
7. Verify migrations, restart recovery, isolation, build and desktop/mobile UI on
   loopback staging. Obtain one independent branch review before promotion.

Review focus: tenant/project/site boundaries, keyword-scoped aggregate access,
overview and note bypasses of section grants, cache/replay partitioning, numeric
aggregation/provenance, secret leakage, persistence and concurrent edits, and
preservation of unmapped legacy SQLite data. Inspect surrounding auth and provider
admin code rather than treating hidden UI as authorization.

Remaining product stages require their own evidence: real GA4 reporting, GTM
configuration reads and controlled writes, Bing/Clarity/SEO adapters, provider
queue/retries/checkpoints, ADA state UI, optimized approved art, comparison/table
reports, export/deletion/retention and public production launch acceptance.
