import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { NOTICE_QUESTION_GENERATOR_VERSION } from "@/lib/editorial/notice-question-generator";

type Database = PostgresJsDatabase<typeof schema>;
export type EditorialJobKind = "draft_generation" | "source_capture";
export type ClaimedEditorialJob = Readonly<{
  jobKey: string;
  subjectId: number;
  inputHash: string;
  attempts: number;
  leaseToken: string;
}>;

export const EDITORIAL_MAX_ATTEMPTS = 5;
export const EDITORIAL_LEASE_MS = 10 * 60_000;

export function editorialRetryAt(attempt: number, now: Date) {
  const minutes = Math.min(360, 5 * 2 ** Math.max(0, attempt - 1));
  return new Date(now.getTime() + minutes * 60_000);
}

/** Enfileira só entradas novas/alteradas; revisão pendente não consome todas as rodadas. */
export async function enqueueReviewedRequirementJobs(db: Database, now = new Date(), opportunityId?: number) {
  const rows = await db.execute<{ job_key: string }>(sql`
    insert into editorial_automation_jobs (
      job_key, kind, subject_id, input_hash, status, attempts, next_attempt_at
    )
    select 'draft:' || r.id, 'draft_generation', r.id,
      encode(sha256(convert_to(jsonb_build_object(
        'generator', ${NOTICE_QUESTION_GENERATOR_VERSION}::text,
        'requirement', to_jsonb(r),
        'opportunity', jsonb_build_array(o.editorial_status, o.updated_at),
        'document', jsonb_build_array(d.status, d.reviewed_at, d.checksum_sha256, d.source_url),
        'snapshot', jsonb_build_array(s.status, s.checksum_sha256, s.updated_at),
        'article', jsonb_build_array(a.id, a.literal_text, a.editorial_status, a.source_rights, a.updated_at),
        'version', jsonb_build_array(v.id, v.status, v.checksum_sha256, v.valid_from, v.valid_until, v.verified_at),
        'act', jsonb_build_array(l.is_active, l.updated_at),
        'assignments', coalesce((
          select jsonb_agg(jsonb_build_object('assignment', to_jsonb(oa), 'profile', to_jsonb(p),
            'bank_active', b.is_active) order by oa.id)
          from opportunity_organizer_assignments oa
          left join quiz_banks b on b.id = oa.quiz_bank_id
          left join question_style_profiles p on p.quiz_bank_id = oa.quiz_bank_id
          where oa.opportunity_id = r.opportunity_id
        ), '[]'::jsonb)
      )::text, 'UTF8')), 'hex'),
      'pending', 0, ${now.toISOString()}::timestamptz
    from opportunity_requirements r
    join contest_opportunities o on o.id = r.opportunity_id
    join opportunity_source_documents d on d.id = r.source_document_id
    left join opportunity_document_snapshots s on s.id = r.source_snapshot_id
    left join legal_articles a on a.id = r.legal_article_id
    left join legal_versions v on v.id = a.legal_version_id
    left join legal_acts l on l.id = v.legal_act_id
    where r.editorial_status = 'reviewed'
      and ${opportunityId === undefined ? sql`true` : sql`r.opportunity_id = ${opportunityId}`}
    on conflict (job_key) do update set
      input_hash = excluded.input_hash, status = 'pending', attempts = 0,
      next_attempt_at = excluded.next_attempt_at, lease_token = null, lease_expires_at = null,
      last_error_code = null, result = null, updated_at = excluded.next_attempt_at
    where editorial_automation_jobs.input_hash <> excluded.input_hash
      and (editorial_automation_jobs.status <> 'running'
        or editorial_automation_jobs.lease_expires_at <= excluded.next_attempt_at)
    returning job_key
  `);
  return rows.length;
}

/** Reserva atômica: workers concorrentes não recebem o mesmo trabalho. */
export async function claimEditorialJob(
  db: Database,
  kind: EditorialJobKind,
  now = new Date(),
): Promise<ClaimedEditorialJob | null> {
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + EDITORIAL_LEASE_MS);
  // A quinta queda do processo encerra o trabalho em vez de deixá-lo preso em running.
  await db.execute(sql`
    update editorial_automation_jobs
    set status = 'failed', lease_token = null, lease_expires_at = null,
      last_error_code = 'lease_attempts_exhausted', updated_at = ${now.toISOString()}::timestamptz
    where kind = ${kind} and status = 'running'
      and lease_expires_at <= ${now.toISOString()}::timestamptz
      and attempts >= ${EDITORIAL_MAX_ATTEMPTS}
  `);
  const rows = await db.execute<ClaimedEditorialJob>(sql`
    update editorial_automation_jobs j set
      status = 'running', attempts = j.attempts + 1,
      lease_token = ${leaseToken}, lease_expires_at = ${leaseExpiresAt.toISOString()}::timestamptz,
      updated_at = ${now.toISOString()}::timestamptz
    where j.job_key = (
      select candidate.job_key from editorial_automation_jobs candidate
      where candidate.kind = ${kind}
        and candidate.attempts < ${EDITORIAL_MAX_ATTEMPTS}
        and ((candidate.status in ('pending', 'retry')
            and candidate.next_attempt_at <= ${now.toISOString()}::timestamptz)
          or (candidate.status = 'running'
            and candidate.lease_expires_at <= ${now.toISOString()}::timestamptz))
      order by candidate.next_attempt_at, candidate.created_at, candidate.job_key
      for update skip locked limit 1
    )
    returning j.job_key as "jobKey", j.subject_id::integer as "subjectId",
      j.input_hash as "inputHash", j.attempts, j.lease_token as "leaseToken"
  `);
  return rows[0] ?? null;
}

/** Só o dono da reserva vigente pode concluir; resposta atrasada não sobrescreve outra rodada. */
export async function finishEditorialJob(
  db: Database,
  job: ClaimedEditorialJob,
  result: Readonly<Record<string, unknown>>,
  now = new Date(),
) {
  const rows = await db.execute<{ job_key: string }>(sql`
    update editorial_automation_jobs set status = 'succeeded',
      lease_token = null, lease_expires_at = null, last_error_code = null,
      result = ${JSON.stringify(result)}::jsonb, updated_at = ${now.toISOString()}::timestamptz
    where job_key = ${job.jobKey} and status = 'running'
      and lease_token = ${job.leaseToken} and input_hash = ${job.inputHash}
      and lease_expires_at > ${now.toISOString()}::timestamptz
    returning job_key
  `);
  return rows.length === 1;
}

export async function failEditorialJob(
  db: Database,
  job: ClaimedEditorialJob,
  blocked: boolean,
  now = new Date(),
) {
  const status = blocked ? "blocked" : job.attempts >= EDITORIAL_MAX_ATTEMPTS ? "failed" : "retry";
  const rows = await db.execute<{ job_key: string }>(sql`
    update editorial_automation_jobs set status = ${status},
      lease_token = null, lease_expires_at = null,
      last_error_code = ${blocked ? "editorial_prerequisite_or_quality" : "execution_failed"},
      next_attempt_at = ${editorialRetryAt(job.attempts, now).toISOString()}::timestamptz,
      updated_at = ${now.toISOString()}::timestamptz
    where job_key = ${job.jobKey} and status = 'running'
      and lease_token = ${job.leaseToken} and input_hash = ${job.inputHash}
      and lease_expires_at > ${now.toISOString()}::timestamptz
    returning job_key
  `);
  return rows.length === 1;
}

export async function editorialQueueSummary(db: Database) {
  return db.execute<{ kind: string; status: string; count: number }>(sql`
    select kind, status, count(*)::integer as count from editorial_automation_jobs
    group by kind, status order by kind, status
  `);
}
