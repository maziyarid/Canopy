# Next five small steps

These are source changes and tests in Canopy; each should have a separate review.
Provider access and any later rollout require their own acceptance evidence.

1. **Unify manual GSC property authorisation with portfolio safeguards.** Reject
   restricted/missing permissions and ambiguous same-host properties before data
   retrieval. Test both paths with exact authorised URLs and no-data-write refusals.
2. **Reconcile the client reporting gate candidate (PR #26) against current
   main.** Review its focused diff and run owner/client, raw snapshot, export and
   search denial tests. Record outstanding review findings without merging it.
3. **Persist provider retry eligibility with the sync receipt.** Store the
   existing bounded checkpoint and verify process-restart read-back, retaining
   site/window/project identity. Keep automatic replay and timers disabled.
4. **Add a project-scoped Provider Admin connection-test operation.** Filter
   discovery to the authorised project's resource and return a safe status and
   timestamp. Test that other sites/accounts and credentials never reach the UI.
5. **Add a dry-run migration plan for legacy Mangools credentials.** Inventory
   counts/references only, target the existing encrypted vault and test missing-key,
   wrong-project and rollback behaviour. Do not migrate real credentials or print
   their values as part of that source change.
