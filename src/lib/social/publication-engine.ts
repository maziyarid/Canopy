import type { SocialPlatform } from "./contracts.ts";
import { canAttemptProductionPublish } from "./capabilities.ts";

export type PublicationJob = {
  id: string;
  projectId: string;
  connectionId: string;
  contentItemId: string;
  idempotencyKey: string;
  platform: SocialPlatform;
  capabilityState: string;
  attemptCount: number;
  maxAttempts: number;
};

export type PublicationContext = {
  credentialRef: string;
  accountRef: string;
  body: string;
  mediaManifest: unknown[];
};

export type PublishReceipt = {
  providerPostIds: string[];
  providerUrl?: string;
  retryAfterSeconds?: number;
};

export type PublicationAdapter = {
  publish(ctx: PublicationContext, credential: string): Promise<PublishReceipt>;
};

export type PublicationStore = {
  claim(workerId: string, now: Date): Promise<PublicationJob | null>;
  context(job: PublicationJob): Promise<PublicationContext>;
  priorSuccess(idempotencyKey: string): Promise<PublishReceipt | null>;
  beginDispatch(job: PublicationJob, now: Date): Promise<void>;
  failDispatch(job: PublicationJob, failureClass: string, error: string, now: Date): Promise<void>;
  succeed(job: PublicationJob, receipt: PublishReceipt, now: Date): Promise<void>;
  retry(job: PublicationJob, error: string, notBefore: Date, now: Date): Promise<void>;
  dead(job: PublicationJob, failureClass: string, error: string, now: Date): Promise<void>;
};

export type CredentialResolver = (credentialRef: string, job: PublicationJob) => Promise<string>;

function classifyError(error: unknown) {
  const e = error as { name?: string; message?: string; retryAfterSeconds?: number };
  return {
    failureClass: e?.name || "ProviderError",
    message: e?.message || String(error),
    retryAfterSeconds:
      Number.isFinite(Number(e?.retryAfterSeconds)) && Number(e?.retryAfterSeconds) > 0
        ? Number(e?.retryAfterSeconds)
        : undefined,
  };
}

export async function processOnePublication(input: {
  workerId: string;
  store: PublicationStore;
  adapters: Partial<Record<SocialPlatform, PublicationAdapter>>;
  resolveCredential: CredentialResolver;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const job = await input.store.claim(input.workerId, now);
  if (!job) return { state: "idle" as const };

  const prior = await input.store.priorSuccess(job.idempotencyKey);
  if (prior) {
    await input.store.succeed(job, prior, now);
    return { state: "deduplicated" as const, jobId: job.id, receipt: prior };
  }

  if (!canAttemptProductionPublish(job.platform, job.capabilityState)) {
    await input.store.dead(job, "CapabilityGate", `platform state ${job.capabilityState} is not AVAILABLE`, now);
    return { state: "dead" as const, jobId: job.id, failureClass: "CapabilityGate" };
  }

  const adapter = input.adapters[job.platform];
  if (!adapter) {
    await input.store.dead(job, "AdapterUnavailable", `no adapter for ${job.platform}`, now);
    return { state: "dead" as const, jobId: job.id, failureClass: "AdapterUnavailable" };
  }

  const context = await input.store.context(job);
  const credential = await input.resolveCredential(context.credentialRef, job);

  await input.store.beginDispatch(job, now);

  let receipt: PublishReceipt;
  try {
    receipt = await adapter.publish(context, credential);
  } catch (error) {
    const failure = classifyError(error);
    await input.store.failDispatch(job, failure.failureClass, failure.message, now);
    const nextAttempt = job.attemptCount + 1;
    if (nextAttempt >= job.maxAttempts) {
      await input.store.dead(job, failure.failureClass, failure.message, now);
      return { state: "dead" as const, jobId: job.id, failureClass: failure.failureClass };
    }
    const delay = failure.retryAfterSeconds ?? Math.min(900, 2 ** Math.max(1, nextAttempt));
    const notBefore = new Date(now.getTime() + delay * 1000);
    await input.store.retry(job, failure.message, notBefore, now);
    return { state: "retry" as const, jobId: job.id, notBefore, failureClass: failure.failureClass };
  }

  // Persist success outside the provider-error catch. If persistence fails
  // after remote acceptance, the dispatch marker remains ambiguous and the
  // expired lease is parked rather than automatically publishing again.
  await input.store.succeed(job, receipt, now);
  return { state: "succeeded" as const, jobId: job.id, receipt };
}
