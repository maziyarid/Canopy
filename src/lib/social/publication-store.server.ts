import type { Sql } from "../db.ts";
import type { PublicationContext, PublicationJob, PublicationStore } from "./publication-engine.ts";
import type { SocialPlatform } from "./contracts.ts";

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

export function createPublicationStore(sql: Sql, leaseSeconds = 120): PublicationStore {
  return {
    async claim(workerId, now) {
      const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);
      const rows = await sql.query<JobRow>(
        `with candidate as (
           select j.id
           from social_publication_jobs j
           where (
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
