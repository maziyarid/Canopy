# Ms Robot UX contract: Ada event receipts

Scope: the Ada event view within the existing provider workflow. This records the touched workflow's contract, not a claim that every legacy route has been audited. Visual ownership is in [DESIGN.md](DESIGN.md).

| Capability | Canonical owner                                        | Observable contract                                                        | Evidence                               |
| ---------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------- |
| Field      | `src/components/ui.tsx` Input                          | Visible label, native search semantics, local clear control restores focus | `scripts/ada-bridge-staging-smoke.mjs` |
| Filters    | Shared Button                                          | Single selected filter via aria-pressed; native keyboard activation        | same browser script                    |
| Disclosure | Native details/summary                                 | Enter/Space toggles; exact values remain accessible without hover          | same browser script                    |
| Feedback   | Inline status / existing Sonner for provider mutations | Refresh and result counts announce politely; failure has persistent retry  | same browser script                    |
| Scrollbar  | `src/styles.css`                                       | Global standards and WebKit baseline; forced-colours fallback              | browser computed-style checks          |
| Date       | Intl.DateTimeFormat                                    | Active fa-IR/en-GB and explicit Asia/Tehran; no input/date picker          | bilingual browser checks               |

## Business sources and permissions

`src/lib/server/access.ts`, `src/lib/server/provider-admin.ts`, and `src/lib/server/ada-events-view.ts` enforce owner and exact project/site scope. A client, editor, anonymous user or keyword-restricted owner does not receive Ada metadata. UI hiding complements server enforcement.

`ops/analytics-gateway/ada_bridge_receipts.py` defines durable metadata-only recorded/acknowledged states; `ada_bridge_consumer.py` defines fingerprint-bound ACK reconciliation. The paired Ada bridge contract is `maziyarid/AdaAI:ops/ms-robot-bridge/CONTRACT.md`. Raw payloads, secrets, fingerprint and idempotency keys do not enter this view.

`docs/ms-robot/promotion-readiness-20261001.md` and Agiflow AAX-42/AAX-69 retain production acceptance gates. A source-level UI improvement does not authorise queue intake or promotion.

## Reading and navigation

The server fetches up to the latest 50 receipts in its deterministic received-time/event-id order. Search and counts describe that bounded fetched window, never the whole history. Search is immediate and local; status/proposal filters intersect it. Twenty matching rows are initially disclosed; Show more reveals the next twenty within the same fetched window. A new search/filter resets disclosure to twenty. Refresh preserves search/filter and disclosed count; project identity changes remount the owner panel and clear local state.

Search can include operational references, so its state is transient in component memory. It is intentionally absent from URL, storage, telemetry and automatic clipboard operations. No remote search, composition-triggered submission or auto-polling occurs.

## Refresh and failure

Initial loading has an accessible text status in a stable region. Background refresh preserves same-project content, disables the refresh button and announces activity. Duplicate activation is blocked synchronously. A 20-second read timeout aborts the browser request and restores retry access. Unmount/project changes also abort the active request; a dispatched read-only server handler may still finish. Prior-generation responses cannot replace data.

A whole provider request failure clears protected metadata because current authorisation cannot be assumed; the error is localised and offers Check providers again. An Ada-only gateway outage returns an unavailable event panel with the existing check-again path while sibling provider data remains usable. Empty data, filtered no-results and unavailable are distinct states. No success toast or live-health claim is inferred from a receipt.

## Status and detail

Acknowledged means a durable receipt is confirmed against the bridge ACK. Unconfirmed does not mean the event failed or an action ran. Proposals retain a visible authorisation requirement. No execution, queue mutation or provider job is available from the event panel.

Cards show human event name, receipt state, reported source, recorded time and correlation reference. Native disclosure contains exact event/site/type references, source-reported time and receipt-update time. All times use Tehran time; absent timestamps show a dash. Source-reported time is separate from local recording time.

## Accessibility and locale

All controls use the active locale and shared visual focus. Status/filter state is conveyed in text and semantics as well as colour. Icons are decorative. Clear search restores input focus. Details are keyboard operated. Buttons and search have at least 44 CSS pixels of height. Long fa-IR and Latin references wrap inside their cards. Reduced motion retains textual loading feedback. Document scrolling remains the owner; sibling forms retain their natural height.

Verification includes authenticated owner, client/editor/anonymous refusal, foreign project/site isolation, local search/reset/filter/disclosure, slow refresh, read failure/retry, empty state, bounded large data, phone Persian, keyboard, reduced motion, reflow and computed scrollbar styles. This contract does not replace the application's existing route-title or broader CRUD conventions.
