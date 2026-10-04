import type { Sql } from "../db.ts";
import type { PublicationContext, PublicationJob, PublicationStore } from "./publication-engine.ts";
import type { SocialPlatform } from "./contracts.ts";

export type ParkedPublication = {
  id: string;
  projectId: string;
  platform: SocialPlatform;
  attemptCount: number;
  maxAttempts: number;
  failureClass: string;
  lastError: string;
  updatedAt: string;
};

export type PublicationReconciliationDecision =
  | { outcome: "succeeded"; receipt: { providerPostIds: string[]; providerUrl?: string }; evidence: Record<string, unknown> }
  | { outcome: "not_published"; evidence: Record<string, unknown> }
  | { outcome: "dead"; reason: string; evidence: Record<string, unknown> };

export type PublicationReconciliationResult = {
  jobId: string;
  outcome: PublicationReconciliationDecision["outcome"];
};

type ReconciliationStore = {
  listParked(limit?: number): Promise<ParkedPublication[]>;
  reconcileParked(
    jobId: string,
    decision: PublicationReconciliationDecision,
    actorRef: string,
    now: Date,
  ): Promise<PublicationReconciliationResult>;
};

type JobRow = {
  id: string;
  project_id: string;
  social_connection_id: string;
  content_item_id: string;
  idempotency_key: string;
  platform: string;
  capability_state: string;
  attempt_count: number;
  max_attempts: number;
};

function toJob(row: JobRow): PublicationJob {
  return {
    id: row.id,
    projectId: row.project_id,
    connectionId: row.social_connection_id,
    contentItemId: row.content_item_id,
    idempotencyKey: row.idempotency_key,
    platform: row.platform as SocialPlatform,
    capabilityState: row.capability_state,
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
  };
}

export function createPublicationStore(sql: Sql, leaseSeconds = 120): PublicationStore & ReconciliationStore {
  return {
    async claim(workerId, now) {
      const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);

      // If a worker crashes after dispatch starts, the provider may already
      // have accepted the post. Reclaiming that lease automatically can
      // duplicate publication, so park ambiguous outcomes for reconciliation.
      await sql.query(
        `update social_publication_jobs j
         set status='parked',
             locked_by='',
             lease_until=null,
             failure_class='AmbiguousProviderOutcome',
             last_error='provider dispatch outcome requires reconciliation before retry',
             updated_at=$1
         where j.status='running'
           and j.lease_until is not null
           and j.lease_until < $1
           and exists (
             select 1 from social_publication_results r
             where r.job_id=j.id
               and r.attempt_no=j.attempt_count
               and r.status='dispatching'
           )`,
        [now.toISOString()],
      );

      const rows = await sql.query<JobRow>(
        `with candidate as (
           select j.id
           from social_publication_jobs j
           join social_content_items ci
             on ci.id=j.content_item_id and ci.project_id=j.project_id
           where ci.status='ready'
             and ci.approval_state='approved'
             and (
               j.status = 'pending'
               or (j.status = 'running' and j.lease_until is not null and j.lease_until < $1)
             )
             and (j.not_before is null or j.not_before <= $1)
             and j.attempt_count < j.max_attempts
           order by j.created_at, j.id
           for update skip locked
           limit 1
         )
         update social_publication_jobs j
         set status='running',
             locked_by=$2,
             lease_until=$3,
             attempt_count=j.attempt_count+1,
             updated_at=$1
         from candidate c, social_connections sc
         where j.id=c.id and sc.id=j.social_connection_id
         returning j.id,j.project_id,j.social_connection_id,j.content_item_id,
                   j.idempotency_key,sc.platform,sc.capability_state,
                   j.attempt_count,j.max_attempts`,
        [now.toISOString(), workerId, leaseUntil.toISOString()],
      );
      return rows[0] ? toJob(rows[0]) : null;
    },

    async context(job) {
      const rows = await sql.query<{
        credential_ref: string;
        account_ref: string;
        body: string;
        media_manifest: string;
      }>(
        `select sc.credential_ref,sc.account_ref,ci.body,ci.media_manifest
         from social_connections sc
         join social_content_items ci on ci.id=$2 and ci.project_id=$3
         where sc.id=$1 and sc.project_id=$3
         limit 1`,
        [job.connectionId, job.contentItemId, job.projectId],
      );
      const row = rows[0];
      if (!row) throw new Error("publication context not found");
      let media: unknown[] = [];
      try {
        const parsed = JSON.parse(row.media_manifest || "[]");
        media = Array.isArray(parsed) ? parsed : [];
      } catch {
        throw new Error("invalid media manifest");
      }
      return {
        credentialRef: row.credential_ref,
        accountRef: row.account_ref,
        body: row.body,
        mediaManifest: media,
      } satisfies PublicationContext;
    },

    async priorSuccess(idempotencyKey) {
      const rows = await sql.query<{
        provider_post_id: string;
        provider_url: string;
        response_receipt: string;
      }>(
        `select r.provider_post_id,r.provider_url,r.response_receipt
         from social_publication_jobs j
         join social_publication_results r on r.job_id=j.id
         where j.idempotency_key=$1 and r.status='succeeded'
         order by r.attempt_no desc
         limit 1`,
        [idempotencyKey],
      );
      const row = rows[0];
      if (!row) return null;
      let ids = row.provider_post_id ? [row.provider_post_id] : [];
      try {
        const receipt = JSON.parse(row.response_receipt || "{}");
        if (Array.isArray(receipt.providerPostIds)) ids = receipt.providerPostIds.map(String);
      } catch {
        // Provider ID column remains the safe fallback.
      }
      return { providerPostIds: ids, providerUrl: row.provider_url || undefined };
    },

    async listParked(limit = 100) {
      const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 500));
      const rows = await sql.query<{
        id: string;
        project_id: string;
        platform: string;
        attempt_count: number;
        max_attempts: number;
        failure_class: string;
        last_error: string;
        updated_at: string;
      }>(
        `select j.id,j.project_id,sc.platform,j.attempt_count,j.max_attempts,
                j.failure_class,j.last_error,j.updated_at
         from social_publication_jobs j
         join social_connections sc on sc.id=j.social_connection_id
         where j.status='parked'
         order by j.updated_at,j.id
         limit $1`,
        [boundedLimit],
      );
      return rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        platform: row.platform as SocialPlatform,
        attemptCount: Number(row.attempt_count),
        maxAttempts: Number(row.max_attempts),
        failureClass: row.failure_class,
        lastError: row.last_error,
        updatedAt: String(row.updated_at),
      }));
    },

    async reconcileParked(jobId, decision, actorRef, now) {
      const actor = actorRef.trim();
      if (!actor) throw new Error("reconciliation actor is required");
      if (!decision.evidence || Object.keys(decision.evidence).length === 0) {
        throw new Error("reconciliation evidence is required");
      }

      const nowIso = now.toISOString();
      const auditEvidence = JSON.stringify({
        outcome: decision.outcome,
        evidence: decision.evidence,
        reconciledAt: nowIso,
      });
      const operationId = crypto.randomUUID();
      const receiptKey = `reconcile:${jobId}:${nowIso}`;

      if (decision.outcome === "succeeded") {
        const providerPostIds = decision.receipt.providerPostIds.map(String).filter(Boolean);
        const providerUrl = decision.receipt.providerUrl?.trim() ?? "";
        if (!providerPostIds.length && !providerUrl) {
          throw new Error("confirmed publication requires a provider post id or URL");
        }
        const responseReceipt = JSON.stringify({
          providerPostIds,
          ...(providerUrl ? { providerUrl } : {}),
          reconciliation: {
            actorRef: actor,
            evidence: decision.evidence,
            reconciledAt: nowIso,
          },
        });
        const rows = await sql.query<{ target_ref: string }>(
          `with target as (
             select id,project_id,attempt_count
             from social_publication_jobs
             where id=$1 and status='parked'
             for update
           ),
           result_row as (
             insert into social_publication_results
               (id,job_id,attempt_no,provider_post_id,provider_url,status,response_receipt,published_at,readback_at)
             select $2,t.id,t.attempt_count,$3,$4,'succeeded',$5,$6,$6
             from target t
             on conflict (job_id,attempt_no) do update
               set provider_post_id=excluded.provider_post_id,
                   provider_url=excluded.provider_url,
                   status='succeeded',
                   response_receipt=excluded.response_receipt,
                   published_at=excluded.published_at,
                   readback_at=excluded.readback_at
             returning job_id
           ),
           resolved_job as (
             update social_publication_jobs j
             set status='succeeded',locked_by='',lease_until=null,completed_at=$6,
                 last_error='',failure_class='',updated_at=$6
             from target t,result_row r
             where j.id=t.id and r.job_id=t.id
             returning j.id,j.project_id
           )
           insert into operation_receipts
             (id,project_id,actor_ref,operation,target_ref,status,idempotency_key,evidence,created_at)
           select $7,j.project_id,$8,'social_publication_reconcile',j.id,'succeeded',$9,$10,$6
           from resolved_job j
           returning target_ref`,
          [
            jobId,
            crypto.randomUUID(),
            providerPostIds[0] ?? "",
            providerUrl,
            responseReceipt,
            nowIso,
            operationId,
            actor,
            receiptKey,
            auditEvidence,
          ],
        );
        if (!rows[0]) throw new Error("parked publication not found");
      } else if (decision.outcome === "not_published") {
        const resultEvidence = JSON.stringify({
          outcome: decision.outcome,
          actorRef: actor,
          evidence: decision.evidence,
          reconciledAt: nowIso,
        });
        const rows = await sql.query<{ target_ref: string }>(
          `with target as (
             select id,project_id,attempt_count
             from social_publication_jobs
             where id=$1 and status='parked' and attempt_count < max_attempts
             for update
           ),
           result_row as (
             update social_publication_results r
             set status='confirmed_not_published',response_receipt=$2,readback_at=$3
             from target t
             where r.job_id=t.id and r.attempt_no=t.attempt_count and r.status='dispatching'
             returning r.job_id
           ),
           resolved_job as (
             update social_publication_jobs j
             set status='pending',locked_by='',lease_until=null,not_before=$3,
                 completed_at=null,dead_lettered_at=null,last_error='',failure_class='',updated_at=$3
             from target t,result_row r
             where j.id=t.id and r.job_id=t.id
             returning j.id,j.project_id
           )
           insert into operation_receipts
             (id,project_id,actor_ref,operation,target_ref,status,idempotency_key,evidence,created_at)
           select $4,j.project_id,$5,'social_publication_reconcile',j.id,'requeued',$6,$7,$3
           from resolved_job j
           returning target_ref`,
          [jobId, resultEvidence, nowIso, operationId, actor, receiptKey, auditEvidence],
        );
        if (!rows[0]) {
          throw new Error("parked publication not found, has no dispatch receipt, or has exhausted attempts");
        }
      } else {
        const reason = decision.reason.trim();
        if (!reason) throw new Error("terminal reconciliation reason is required");
        const resultEvidence = JSON.stringify({
          outcome: decision.outcome,
          actorRef: actor,
          reason,
          evidence: decision.evidence,
          reconciledAt: nowIso,
        });
        const rows = await sql.query<{ target_ref: string }>(
          `with target as (
             select id,project_id,attempt_count
             from social_publication_jobs
             where id=$1 and status='parked'
             for update
           ),
           result_row as (
             update social_publication_results r
             set status='reconciled_dead',response_receipt=$2,readback_at=$3
             from target t
             where r.job_id=t.id and r.attempt_no=t.attempt_count and r.status='dispatching'
             returning r.job_id
           ),
           resolved_job as (
             update social_publication_jobs j
             set status='dead',locked_by='',lease_until=null,dead_lettered_at=$3,completed_at=$3,
                 failure_class='ReconciledAmbiguousOutcome',last_error=$4,updated_at=$3
             from target t,result_row r
             where j.id=t.id and r.job_id=t.id
             returning j.id,j.project_id
           )
           insert into operation_receipts
             (id,project_id,actor_ref,operation,target_ref,status,idempotency_key,evidence,created_at)
           select $5,j.project_id,$6,'social_publication_reconcile',j.id,'dead',$7,$8,$3
           from resolved_job j
           returning target_ref`,
          [jobId, resultEvidence, nowIso, reason.slice(0, 2000), operationId, actor, receiptKey, auditEvidence],
        );
        if (!rows[0]) throw new Error("parked publication not found or has no dispatch receipt");
      }

      return { jobId, outcome: decision.outcome };
    },

    async beginDispatch(job, now) {
      await sql.query(
        `insert into social_publication_results
           (id,job_id,attempt_no,status,request_receipt)
         values ($1,$2,$3,'dispatching',$4)
         on conflict (job_id,attempt_no) do update
           set status=case
             when social_publication_results.status='succeeded' then social_publication_results.status
             else 'dispatching'
           end,
               request_receipt=excluded.request_receipt`,
        [
          crypto.randomUUID(),
          job.id,
          job.attemptCount,
          JSON.stringify({ idempotencyKey: job.idempotencyKey, dispatchedAt: now.toISOString() }),
        ],
      );
    },

    async failDispatch(job, failureClass, error, now) {
      await sql.query(
        `update social_publication_results
         set status='failed',response_receipt=$3
         where job_id=$1 and attempt_no=$2 and status='dispatching'`,
        [
          job.id,
          job.attemptCount,
          JSON.stringify({
            failureClass: failureClass.slice(0, 120),
            error: error.slice(0, 2000),
            failedAt: now.toISOString(),
          }),
        ],
      );
    },

    async succeed(job, receipt, now) {
      const providerPostId = receipt.providerPostIds[0] ?? "";
      await sql.query(
        `insert into social_publication_results
           (id,job_id,attempt_no,provider_post_id,provider_url,status,response_receipt,published_at,readback_at)
         values ($1,$2,$3,$4,$5,'succeeded',$6,$7,$7)
         on conflict (job_id,attempt_no) do update
           set provider_post_id=excluded.provider_post_id,
               provider_url=excluded.provider_url,
               status='succeeded',
               response_receipt=excluded.response_receipt,
               published_at=excluded.published_at,
               readback_at=excluded.readback_at`,
        [
          crypto.randomUUID(), job.id, job.attemptCount, providerPostId, receipt.providerUrl ?? "",
          JSON.stringify(receipt), now.toISOString(),
        ],
      );
      await sql.query(
        `update social_publication_jobs
         set status='succeeded',locked_by='',lease_until=null,completed_at=$2,last_error='',failure_class='',updated_at=$2
         where id=$1`,
        [job.id, now.toISOString()],
      );
    },

    async retry(job, error, notBefore, now) {
      await sql.query(
        `update social_publication_jobs
         set status='pending',locked_by='',lease_until=null,not_before=$2,last_error=$3,failure_class='',
             updated_at=$4
         where id=$1`,
        [job.id, notBefore.toISOString(), error.slice(0, 2000), now.toISOString()],
      );
    },

    async dead(job, failureClass, error, now) {
      await sql.query(
        `update social_publication_jobs
         set status='dead',locked_by='',lease_until=null,dead_lettered_at=$2,completed_at=$2,
             failure_class=$3,last_error=$4,updated_at=$2
         where id=$1`,
        [job.id, now.toISOString(), failureClass.slice(0, 120), error.slice(0, 2000)],
      );
    },
  };
}
