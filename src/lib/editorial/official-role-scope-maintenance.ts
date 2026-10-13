import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "./official-course-dossier";

// These are two known incidents, not a general-purpose editor or equivalence rule.
export const ROLE_SCOPE_RECIPES = {
  "pp-ma-inspetor-2026": { opportunityId: 12, editionId: 30, documentId: 15, snapshotId: 456, assignmentId: 12,
    institution: "SEAP-MA", role: "Inspetor de Polícia Penal", sha: "a1385f92fe8b3868429bae651cf071494e1a64e981f20f1a61fdbef1478ad66b",
    sourceUrl: "https://www.cebraspe.org.br/concursos/SEAP_MA_26_INSPETOR_MONITOR",
    documentUrl: "https://cdn.cebraspe.org.br/concursos/SEAP_MA_26_INSPETOR_MONITOR/arquivos/F4128FEF48467ECD44F454AF1C39E7723829034486E0BE2BF1D1B803914B8742.pdf" },
  "pc-ma-investigador-2026": { opportunityId: 11, editionId: 29, documentId: 14, snapshotId: 458, assignmentId: 11,
    institution: "PC-MA", role: "Investigador de Polícia", sha: "4a5bb8bae4ba36778303ff7028acb4c7b6ec39b7012eac473ce703237fbae94a",
    sourceUrl: "https://www.cebraspe.org.br/concursos/PC_MA_26_INVESTIGADOR",
    documentUrl: "https://cdn.cebraspe.org.br/concursos/PC_MA_26_INVESTIGADOR/arquivos/9EE70E72CE79EB274C5319BEEB5B9B7D8519FF48DA21986A0830B5DB02C4F8B0.pdf" },
} as const;
export type RoleScopeRecipe = keyof typeof ROLE_SCOPE_RECIPES;
const inputSchema = z.object({ recipe: z.enum(["pp-ma-inspetor-2026", "pc-ma-investigador-2026"]) }).strict();
const normalized = (text: string) => text.normalize("NFKC").replace(/\s+/gu, " ").trim();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Requirement = { id: number; opportunityId: number; documentId: number; snapshotId: number | null;
  text: string; locator: string; status: string; data: Record<string, unknown> };
type Job = { key: string; status: string; requirementId: string | null; data: Record<string, unknown> };
export type RoleScopeState = {
  source: { opportunityId: number; editionId: number; documentId: number; snapshotId: number; assignmentId: number;
    institution: string; role: string; year: number; notice: string; specializationId: number | null;
    opportunityStatus: string; documentStatus: string; snapshotStatus: string; assignmentStatus: string;
    bankId: number; bankCurrent: boolean; sourceUrl: string; documentUrl: string; sha: string; bytesSha: string;
    newerApproved: boolean; pages: string[]; data: Record<string, unknown> } | null;
  requirements: Requirement[]; jobs: Job[];
  dependencies: { contracts: number; questions: number; bindings: number };
};

export function buildRoleScopePlan(recipe: RoleScopeRecipe, state: RoleScopeState) {
  const expected = ROLE_SCOPE_RECIPES[recipe], s = state.source, blockers: string[] = [];
  const suspend: number[] = [], preserve: number[] = [], evidence: { requirementId: number; page: number; scope: string }[] = [];
  const renamedRole = recipe === "pc-ma-investigador-2026" ? "Oficial Investigador de Polícia" : null;
  if (!s || s.opportunityId !== expected.opportunityId || s.editionId !== expected.editionId ||
      s.documentId !== expected.documentId || s.snapshotId !== expected.snapshotId || s.assignmentId !== expected.assignmentId ||
      s.institution !== expected.institution || s.role !== expected.role || s.year !== 2026 || s.notice !== "1/2026" ||
      s.specializationId !== null || s.bankId !== 4 || !s.bankCurrent || s.newerApproved ||
      s.opportunityStatus !== "reviewed" || s.documentStatus !== "approved" || s.snapshotStatus !== "approved" ||
      s.assignmentStatus !== "reviewed" || s.sha !== expected.sha || s.bytesSha !== expected.sha ||
      s.sourceUrl !== expected.sourceUrl || s.documentUrl !== expected.documentUrl) blockers.push("source_identity_or_bytes_changed");
  if (Object.values(state.dependencies).some(n => n !== 0)) blockers.push("dependent_contract_question_or_binding");
  if (state.jobs.some(j => j.status === "running")) blockers.push("existing_reservation");
  if (!state.requirements.length || state.requirements.some(r => r.opportunityId !== expected.opportunityId ||
      r.documentId !== expected.documentId || r.snapshotId !== expected.snapshotId || r.status !== "draft")) blockers.push("programme_not_unreviewed_exact_source");
  if (!s) return { blockers, suspend, preserve, evidence, renamedRole, supersede: [] as string[] };
  if (recipe === "pp-ma-inspetor-2026") {
    const general = "22.2.3 CONHECIMENTOS GERAIS PARA TODOS OS CARGOS";
    const own = "CARGO 1: INSPETOR DE POLÍCIA PENAL", other = "CARGO 2: MONITOR DE RESSOCIALIZAÇÃO";
    const identity = normalized(s.pages[1] ?? ""), page68 = normalized(s.pages[67] ?? ""),
      page69 = normalized(s.pages[68] ?? ""), page71 = normalized(s.pages[70] ?? "");
    const start = page68.indexOf(general), ownStart = page69.indexOf(own), boundary = page71.indexOf(other);
    if (!identity.includes(own) || start < 0 || ownStart < 0 || boundary < 0 || page71.indexOf(other, boundary + 1) >= 0) blockers.push("official_role_boundaries_missing");
    const ownPages = [page68.slice(Math.max(0, start)), page69, normalized(s.pages[69] ?? ""), page71.slice(0, Math.max(0, boundary))];
    const otherPages = [page71.slice(Math.max(0, boundary)), ...s.pages.slice(71).map(normalized)];
    if (state.requirements.length !== 84 || new Set(state.requirements.map(r => r.id)).size !== 84 ||
        state.requirements.some(r => r.id < 1321 || r.id > 1404)) blockers.push("unexpected_programme_rows");
    for (const r of state.requirements) {
      const match = /(?:^|\s)p\.\s*(\d+)\b/u.exec(r.locator), page = match ? Number(match[1]) : 0;
      const ownRow = r.id <= 1380;
      // Match from the locator page forward; permit literal evidence across page breaks.
      // The p.71 boundary is sliced before matching: page-only matching mixes both roles.
      const parts = ownRow ? ownPages.slice(page - 68) : otherPages.slice(page - 71);
      const lower = ownRow ? 68 : 71, upper = ownRow ? 71 : s.pages.length;
      if (page < lower || page > upper || !r.text.trim() || !normalized(parts.join(" ")).includes(normalized(r.text))) {
        blockers.push(`programme_scope_unproved:${r.id}`); continue;
      }
      (ownRow ? preserve : suspend).push(r.id);
      evidence.push({ requirementId: r.id, page, scope: ownRow ? "cargo_1_inspetor" : "cargo_2_monitor" });
    }
    if (preserve.length !== 60 || suspend.length !== 24) blockers.push("scope_counts_not_60_and_24");
  } else {
    const heading = "CONCURSO PÚBLICO PARA O PROVIMENTO DE VAGAS E A FORMAÇÃO DE CADASTRO DE RESERVA NO CARGO DE OFICIAL INVESTIGADOR DE POLÍCIA";
    const identity = normalized(s.pages[0] ?? "");
    if (!identity.includes(normalized(heading)) || !identity.includes(normalized("EDITAL Nº 1 – PCMA – INVESTIGADOR, DE 13 DE JULHO DE 2026"))) blockers.push("official_exact_role_identity_missing");
    if (state.requirements.length !== 71) blockers.push("unexpected_programme_rows");
    preserve.push(...state.requirements.map(r => r.id));
  }
  const affected = new Set(recipe === "pp-ma-inspetor-2026" ? suspend.map(String) : state.requirements.map(r => String(r.id)));
  const supersede = state.jobs.filter(j => j.status === "pending" &&
    (recipe === "pc-ma-investigador-2026" || (j.requirementId !== null && affected.has(j.requirementId)))).map(j => j.key);
  return { blockers: [...new Set(blockers)], suspend, preserve, evidence, renamedRole, supersede };
}

export async function reconcileOfficialRoleScope(db: PostgresJsDatabase<typeof schema>, request: {
  input: unknown; actorPublicId: string; approvalReference: string; mode: "preview" | "apply"; expectedFingerprint?: string;
}) {
  const { recipe } = inputSchema.parse(request.input), expected = ROLE_SCOPE_RECIPES[recipe];
  const actorPublicId = z.uuid().parse(request.actorPublicId);
  if (!["preview", "apply"].includes(request.mode) || request.approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE ||
      (request.mode === "apply" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? ""))) throw new Error("Invalid maintenance authorization or preview fingerprint.");
  return db.transaction(async tx => {
    await tx.execute(sql`set local statement_timeout='30s'`);
    await tx.execute(sql`set local lock_timeout='5s'`);
    const [actor] = await tx.execute<{ id: number; role: string; data: Record<string, unknown> }>(sql`
      select id::int id,role,jsonb_build_object('id',id,'publicId',public_id,'role',role) data from users where public_id=${actorPublicId}
      ${request.mode === "apply" ? sql`for share` : sql``}`);
    if (!actor || actor.role !== "admin") throw new Error("Explicit authorized administrator required.");
    if (request.mode === "apply") {
      await tx.execute(sql`select pg_advisory_xact_lock(621743,37)`);
      await tx.execute(sql`select id from contest_opportunities where id=${expected.opportunityId} for update`);
      await tx.execute(sql`select id from exam_editions where id=${expected.editionId} for share`);
      await tx.execute(sql`select id from opportunity_source_documents where id=${expected.documentId} for share`);
      await tx.execute(sql`select id from opportunity_document_snapshots where id=${expected.snapshotId} for share`);
      await tx.execute(sql`select id from opportunity_organizer_assignments where id=${expected.assignmentId} for share`);
      await tx.execute(sql`select id from quiz_banks where id=4 for share`);
      await tx.execute(sql`select id from opportunity_requirements where opportunity_id=${expected.opportunityId} order by id for update`);
    }
    const [source] = await tx.execute<NonNullable<RoleScopeState["source"]>>(sql`
      select o.id::int as "opportunityId",o.exam_edition_id::int as "editionId",d.id::int as "documentId",s.id::int as "snapshotId",
        a.id::int as "assignmentId",o.institution_acronym institution,o.role_name role,o.cycle_year as "year",o.official_notice_number notice,
        o.specialization_id::int as "specializationId",o.editorial_status as "opportunityStatus",d.status as "documentStatus",
        s.status as "snapshotStatus",a.status as "assignmentStatus",a.quiz_bank_id::int as "bankId",
        (b.is_active and e.bank_id=a.quiz_bank_id and e.status not in('draft','canceled','archived')
          and e.career_track_id=o.career_track_id and e.specialization_id is not distinct from o.specialization_id
          and a.valid_from<=(now() at time zone 'America/Sao_Paulo')::date and a.valid_until is null
          and (a.role='examination_provider' or (a.role='primary_responsible' and not exists(
            select 1 from opportunity_organizer_assignments examiner where examiner.opportunity_id=o.id
            and examiner.role='examination_provider' and examiner.status='reviewed' and examiner.valid_until is null)))) as "bankCurrent",
        d.source_url as "sourceUrl",s.document_url as "documentUrl",s.checksum_sha256 sha,
        encode(sha256(s.document_bytes),'hex') as "bytesSha",s.page_texts pages,
        exists(select 1 from opportunity_document_snapshots newer where newer.source_document_id=d.id and newer.status='approved' and newer.id>s.id) as "newerApproved",
        jsonb_build_object('opportunity',to_jsonb(o),'edition',to_jsonb(e),'document',to_jsonb(d),
          'snapshot',to_jsonb(s)-'document_bytes','assignment',to_jsonb(a),'bank',to_jsonb(b)) data
      from contest_opportunities o join exam_editions e on e.id=o.exam_edition_id
      join opportunity_source_documents d on d.opportunity_id=o.id and d.id=${expected.documentId}
      join opportunity_document_snapshots s on s.source_document_id=d.id and s.id=${expected.snapshotId}
      join opportunity_organizer_assignments a on a.opportunity_id=o.id and a.id=${expected.assignmentId}
      join quiz_banks b on b.id=a.quiz_bank_id where o.id=${expected.opportunityId}`);
    const requirements = [...await tx.execute<Requirement>(sql`select id::int id,opportunity_id::int as "opportunityId",
      source_document_id::int as "documentId",source_snapshot_id::int as "snapshotId",requirement_text text,
      source_locator locator,editorial_status status,to_jsonb(r) data from opportunity_requirements r
      where opportunity_id=${expected.opportunityId} order by id`)];
    const jobs = [...await tx.execute<Job>(sql`select job_key key,status,payload->>'requirementId' as "requirementId",to_jsonb(w) data
      from editorial_agent_work w where payload->>'opportunityId'=${String(expected.opportunityId)}
      or payload->>'requirementId' in(select id::text from opportunity_requirements where opportunity_id=${expected.opportunityId})
      order by job_key ${request.mode === "apply" ? sql`for update` : sql``}`)];
    const [dependencies] = await tx.execute<RoleScopeState["dependencies"]>(sql`select
      (select count(*)::int from opportunity_question_contracts where opportunity_id=${expected.opportunityId}) contracts,
      (select count(*)::int from questions q where q.exam_edition_id=${expected.editionId} or exists(
        select 1 from question_opportunities qo where qo.question_id=q.id and qo.opportunity_id=${expected.opportunityId})) questions,
      (select count(*)::int from contest_product_question_bindings where opportunity_id=${expected.opportunityId}) bindings`);
    const state: RoleScopeState = { source: source ?? null, requirements, jobs, dependencies };
    const plan = buildRoleScopePlan(recipe, state);
    const fingerprint = digest({ recipe, state, actor: actor.data, actorPublicId, approvalReference: request.approvalReference });
    let auditId: number | null = null;
    if (request.mode === "apply") {
      if (plan.blockers.length || request.expectedFingerprint !== fingerprint) throw new Error("Blocked or changed maintenance scope; obtain a new preview.");
      if (plan.suspend.length) {
        const changed = await tx.execute<{ id: number }>(sql`update opportunity_requirements set editorial_status='suspended',
          reviewed_by_user_id=null,reviewed_at=null,review_notes=${`owner_standing_authorization; humanReview:false; cargo2 Monitor fora do cargo1 Inspetor; snapshot456; ${request.approvalReference}`},updated_at=now()
          where opportunity_id=${expected.opportunityId} and id in(${sql.join(plan.suspend.map(id => sql`${id}`), sql`,`)})
          and editorial_status='draft' returning id::int id`);
        if (changed.length !== 24) throw new Error("Unexpected suspension scope; rolled back.");
      }
      if (plan.renamedRole) {
        // Reviewed identity is immutable. Return it to review and revalidate the
        // bounded official evidence in this same transaction, without disabling
        // the database's mutation/publication guards or exposing an interim state.
        const changed = await tx.execute(sql`update contest_opportunities set role_name=${plan.renamedRole},
          editorial_status='pending_review',reviewed_by_user_id=null,reviewed_at=null,updated_at=now()
          where id=${expected.opportunityId} and role_name=${expected.role} and editorial_status='reviewed' returning id`);
        if (changed.length !== 1) throw new Error("Unexpected role correction scope; rolled back.");
        const revalidated = await tx.execute(sql`update contest_opportunities set editorial_status='reviewed',
          reviewed_by_user_id=${actor.id},reviewed_at=now(),updated_at=now(),
          review_notes=${`owner_standing_authorization; humanReview:false; revisão automatizada exclusivamente do nome oficial p.1 snapshot458; ${request.approvalReference}`}
          where id=${expected.opportunityId} and role_name=${plan.renamedRole} and editorial_status='pending_review' returning id`);
        if (revalidated.length !== 1) throw new Error("Role revalidation did not complete; rolled back.");
      }
      if (plan.supersede.length) {
        const changed = await tx.execute(sql`update editorial_agent_work set status='superseded',last_error_code='official_role_scope_corrected',updated_at=now()
          where job_key in(${sql.join(plan.supersede.map(key => sql`${key}`), sql`,`)}) and status='pending' returning job_key`);
        if (changed.length !== plan.supersede.length) throw new Error("Unexpected queue correction scope; rolled back.");
      }
      const [audit] = await tx.insert(schema.auditLogs).values({ actorUserId: actor.id, action: "editorial.official_role_scope.corrected",
        entityType: "contest_opportunity", entityId: String(expected.opportunityId), metadata: {
          recipe, fingerprint, approvalReference: request.approvalReference, approvalBasis: "owner_standing_authorization", humanReview: false,
          sourceSnapshotId: expected.snapshotId, sourceSnapshotChecksum: expected.sha, plan,
          reviewTransition: plan.renamedRole ? ["reviewed", "pending_review", "reviewed"] : null,
          before: { role: expected.role, opportunity: plan.renamedRole ? source?.data.opportunity : null,
            requirements: requirements.filter(r => plan.suspend.includes(r.id)).map(r => r.data),
            pendingJobs: jobs.filter(j => plan.supersede.includes(j.key)).map(j => ({ key: j.key, inputHash: j.data.input_hash })) },
          after: { role: plan.renamedRole ?? expected.role, suspendedRequirements: plan.suspend, supersededJobs: plan.supersede }, publicationAllowed: false,
        } }).returning({ id: schema.auditLogs.id });
      auditId = audit.id;
    }
    return { mode: request.mode, recipe, fingerprint, plan, auditId, approvalBasis: "owner_standing_authorization", humanReview: false, publicationAllowed: false };
  }, request.mode === "preview" ? { isolationLevel: "repeatable read", accessMode: "read only" } : { isolationLevel: "serializable" });
}
