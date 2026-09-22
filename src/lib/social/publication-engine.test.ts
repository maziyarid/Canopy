import test from "node:test";
import assert from "node:assert/strict";
import { processOnePublication, type PublicationContext, type PublicationJob, type PublicationStore, type PublishReceipt } from "./publication-engine.ts";

class MemoryStore implements PublicationStore {
  queue: PublicationJob[] = [];
  contexts = new Map<string, PublicationContext>();
  successes = new Map<string, PublishReceipt>();
  retries: string[] = [];
  deadJobs: string[] = [];
  publishState = new Map<string,string>();

  async claim() { return this.queue.shift() ?? null; }
  async context(job: PublicationJob) { return this.contexts.get(job.id)!; }
  async priorSuccess(key: string) { return this.successes.get(key) ?? null; }
  async succeed(job: PublicationJob, receipt: PublishReceipt) {
    this.successes.set(job.idempotencyKey, receipt);
    this.publishState.set(job.id, "succeeded");
  }
  async retry(job: PublicationJob) {
    this.retries.push(job.id);
    this.publishState.set(job.id, "retry");
  }
  async dead(job: PublicationJob) {
    this.deadJobs.push(job.id);
    this.publishState.set(job.id, "dead");
  }
}

function job(id:string, key:string, platform:"telegram"|"pinterest", attemptCount=0): PublicationJob {
  return {id,projectId:"p1",connectionId:id+"-c",contentItemId:"content-1",idempotencyKey:key,platform,capabilityState:"AVAILABLE",attemptCount,maxAttempts:3};
}

test("successful platform is not duplicated when sibling platform fails and retries", async () => {
  const store = new MemoryStore();
  const telegram = job("tg","content-1:telegram","telegram");
  const pinterest = job("pin","content-1:pinterest","pinterest");
  store.queue.push(telegram,pinterest);
  store.contexts.set("tg",{credentialRef:"cred-tg",accountRef:"@c",body:"hello",mediaManifest:[]});
  store.contexts.set("pin",{credentialRef:"cred-pin",accountRef:"board",body:"hello",mediaManifest:[]});
  let tgCalls=0, pinCalls=0;
  const adapters = {
    telegram:{publish:async()=>{tgCalls++; return {providerPostIds:["42"]};}},
    pinterest:{publish:async()=>{pinCalls++; throw Object.assign(new Error("temporary"),{name:"ProviderTemporaryError"});}},
  };
  const resolveCredential=async()=> "secret";

  assert.equal((await processOnePublication({workerId:"w",store,adapters,resolveCredential})).state,"succeeded");
  assert.equal((await processOnePublication({workerId:"w",store,adapters,resolveCredential})).state,"retry");
  assert.equal(tgCalls,1);
  assert.equal(pinCalls,1);

  store.queue.push({...telegram,attemptCount:1});
  const replay=await processOnePublication({workerId:"w",store,adapters,resolveCredential});
  assert.equal(replay.state,"deduplicated");
  assert.equal(tgCalls,1);
});

test("capability gate fails closed before adapter invocation", async () => {
  const store = new MemoryStore();
  const blocked={...job("x1","k","pinterest"),capabilityState:"TRIAL_OR_SANDBOX"};
  store.queue.push(blocked);
  store.contexts.set("x1",{credentialRef:"c",accountRef:"a",body:"x",mediaManifest:[]});
  let calls=0;
  const result=await processOnePublication({
    workerId:"w",store,
    adapters:{pinterest:{publish:async()=>{calls++; return {providerPostIds:["x"]};}}},
    resolveCredential:async()=> "secret",
  });
  assert.equal(result.state,"dead");
  assert.equal(calls,0);
});

test("provider retry_after schedules bounded retry and max attempts dead-letter", async () => {
  const store = new MemoryStore();
  store.queue.push(job("tg","k1","telegram",0));
  store.contexts.set("tg",{credentialRef:"c",accountRef:"a",body:"x",mediaManifest:[]});
  const err=Object.assign(new Error("rate limited"),{name:"TelegramAdapterError",retryAfterSeconds:9});
  const result=await processOnePublication({
    workerId:"w",store,
    adapters:{telegram:{publish:async()=>{throw err;}}},
    resolveCredential:async()=> "secret",
    now:new Date("2026-09-21T20:00:00Z"),
  });
  assert.equal(result.state,"retry");
  assert.equal(result.notBefore?.toISOString(),"2026-09-21T20:00:09.000Z");

  store.queue.push(job("tg2","k2","telegram",2));
  store.contexts.set("tg2",{credentialRef:"c",accountRef:"a",body:"x",mediaManifest:[]});
  const final=await processOnePublication({
    workerId:"w",store,
    adapters:{telegram:{publish:async()=>{throw err;}}},
    resolveCredential:async()=> "secret",
  });
  assert.equal(final.state,"dead");
});
