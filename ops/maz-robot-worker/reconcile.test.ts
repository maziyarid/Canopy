import test from "node:test";
import assert from "node:assert/strict";
import { parseReconcileArgs } from "./reconcile.ts";

test("reconciliation CLI lists parked jobs with bounded limit", () => {
  assert.deepEqual(parseReconcileArgs(["--list-parked","--limit","25"]), {
    mode: "list",
    limit: 25,
  });
  assert.throws(
    () => parseReconcileArgs(["--list-parked","--limit","0"]),
    /integer from 1 to 500/,
  );
});

test("reconciliation CLI requires explicit evidence for safe requeue", () => {
  const parsed=parseReconcileArgs([
    "--reconcile","job-1",
    "--outcome","not-published",
    "--actor","operator:test",
    "--evidence-json",JSON.stringify({source:"provider-readback",confirmed:false}),
  ]);
  assert.equal(parsed.mode,"reconcile");
  if (parsed.mode!=="reconcile") return;
  assert.equal(parsed.decision.outcome,"not_published");
  assert.deepEqual(parsed.decision.evidence,{source:"provider-readback",confirmed:false});
});

test("reconciliation CLI captures provider receipt for confirmed success", () => {
  const parsed=parseReconcileArgs([
    "--reconcile","job-2",
    "--outcome","succeeded",
    "--actor","operator:test",
    "--evidence-json",JSON.stringify({source:"provider-readback"}),
    "--provider-post-id","42",
    "--provider-url","https://example.invalid/post/42",
  ]);
  assert.equal(parsed.mode,"reconcile");
  if (parsed.mode!=="reconcile" || parsed.decision.outcome!=="succeeded") return;
  assert.deepEqual(parsed.decision.receipt.providerPostIds,["42"]);
  assert.equal(parsed.decision.receipt.providerUrl,"https://example.invalid/post/42");
});

test("terminal reconciliation requires an explicit reason", () => {
  assert.throws(
    () => parseReconcileArgs([
      "--reconcile","job-3",
      "--outcome","dead",
      "--actor","operator:test",
      "--evidence-json",JSON.stringify({source:"manual-review"}),
    ]),
    /requires --reason/,
  );
});
