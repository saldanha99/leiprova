import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "./official-course-dossier";
import { parseOfficialOpportunityDocumentUrl } from "../opportunities/source-monitor-policy";

// Only these reviewed programmes. This operator neither admits another edition
// nor chooses a speciality in a notice containing several careers.
export const PROGRAMME_CLASSIFICATION_SCOPES = {
  "trf-5-juiz-federal-2026": "Juiz Federal Substituto",
  "sefaz-al-auditor-fiscal-2026": "Auditor Fiscal da Administração Tributária Estadual",
  "mpmt-promotor-substituto-2026-historico-objetiva": "Promotor de Justiça Substituto",
  "mprj-promotor-substituto-xxxix-2026-historico-objetiva": "Promotor de Justiça Substituto",
  "pgeac-procurador-classe-i-viii-2026-historico-objetiva": "Procurador do Estado — Classe I",
} as const;
export const PROGRAMME_SUBJECT_CLASSIFICATION_ACTION = "editorial.programme.subject_classified";
export const PROGRAMME_CLASSIFICATION_BATCH_LIMIT = 100;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const headingKey = (value: string) => normalize(value).toLocaleUpperCase("pt-BR");
// Numbered section labels are syntax, not a synonym. The complete original
// line is retained in headingQuote and proved against the official page.
export const programmeLiteralHeadingName = (line: string) => normalize(line).replace(/^\d+(?:\.\d+)*[.)]?\s*[–—-]?\s*/u, "").split(" - Ponto 1.", 1)[0];
const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const id = z.number().int().positive().safe();

// Deliberately no fuzzy aliases, combined subjects or "Legislação Especial"
// fallback. The active catalogue must have this exact canonical discipline.
export const PROGRAMME_CANONICAL_SUBJECTS = ["Direito Constitucional", "Direito Administrativo", "Direito Civil",
  "Direito Processual Civil", "Direito Penal", "Direito Processual Penal", "Direito do Trabalho",
  "Direito Processual do Trabalho", "Direito Tributário", "Direitos Humanos", "Direito Empresarial", "Direito Eleitoral"] as const;
// Actual headings observed in these five official programmes, including those
// not classifiable in the current catalogue. They close the previous section.
export const PROGRAMME_SECTION_HEADINGS = [...PROGRAMME_CANONICAL_SUBJECTS, "Direito Previdenciário", "Direito Econômico e de Proteção ao Consumidor",
  "Direito Financeiro e Tributário", "Direito Ambiental", "Direito Internacional Público e Privado", "Ética e Estatuto Jurídico da Magistratura Nacional",
  "F) Direito Digital", "H) Direito da Antidiscriminação", "Legislação Tributária Estadual", "Reforma Tributária", "Direito Civil e Empresarial",
  "Direito da Infância e Juventude", "Tutela Coletiva", "Teoria Geral do Ministério Público e Legislação Institucional", "Legislação Penal Extravagante",
  "Princípios Institucionais do Ministério Público", "Direito Civil e Direito Empresarial", "Direito de Pessoal e Direito Previdenciário Público",
  "Direito Tributário e Processo Tributário", "Direito Financeiro"] as const;
export function programmeCanonicalSubject(heading: string) {
  return PROGRAMME_CANONICAL_SUBJECTS.find(subject => headingKey(subject) === headingKey(heading)) ?? null;
}

export const programmeClassificationInputSchema = z.object({
  opportunityId: id, opportunitySlug: z.enum(Object.keys(PROGRAMME_CLASSIFICATION_SCOPES) as [keyof typeof PROGRAMME_CLASSIFICATION_SCOPES, ...(keyof typeof PROGRAMME_CLASSIFICATION_SCOPES)[]]),
  roleName: z.string().min(1), cycleYear: z.number().int(), examEditionId: id.nullable(),
  requirements: z.array(z.object({ requirementId: id, expectedRequirementFingerprint: sha,
    subjectId: id, subjectName: z.string().min(1), heading: z.string().min(1).max(200), headingQuote: z.string().min(1).max(240), headingPage: id,
    pages: z.array(id).min(1).max(3), snapshotChecksum: sha,
    fragments: z.array(z.object({ page: id, startOffset: z.number().int().nonnegative(), endOffset: id,
      quote: z.string().min(1).max(4000) }).strict()).min(1).max(8).optional(),
  }).strict()).min(1).max(PROGRAMME_CLASSIFICATION_BATCH_LIMIT),
}).strict().superRefine((input, ctx) => {
  if (input.roleName !== PROGRAMME_CLASSIFICATION_SCOPES[input.opportunitySlug]) ctx.addIssue({ code: "custom", message: "Cargo não corresponde ao escopo delimitado." });
  if (new Set(input.requirements.map(row => row.requirementId)).size !== input.requirements.length) ctx.addIssue({ code: "custom", message: "Requisito repetido." });
});
export type ProgrammeClassificationInput = z.infer<typeof programmeClassificationInputSchema>;
export type ProgrammeRequirementState = {
  id: number; opportunityId: number; sourceDocumentId: number; snapshotId: number | null;
  subjectId: number | null; topicId: number | null; actId: number | null; articleId: number | null;
  text: string; locator: string; status: string; reviewedBy: number | null; reviewedAt: string | null;
  reviewNotes: string | null; updatedAt: string;
};
export const programmeRequirementFingerprint = (row: ProgrammeRequirementState) => digest({ id: row.id, opportunityId: row.opportunityId,
  sourceDocumentId: row.sourceDocumentId, snapshotId: row.snapshotId, subjectId: row.subjectId, topicId: row.topicId,
  actId: row.actId, articleId: row.articleId, text: row.text, locator: row.locator, status: row.status,
  reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, reviewNotes: row.reviewNotes, updatedAt: row.updatedAt });

export function assertProgrammeSubjectEvidence(row: ProgrammeRequirementState, item: ProgrammeClassificationInput["requirements"][number],
  source: { checksum: string; bytesChecksum: string; pageTexts: string[]; status: string; sourceStatus: string },
  subject: { id: number; name: string; active: boolean }) {
  if (programmeRequirementFingerprint(row) !== item.expectedRequirementFingerprint) throw new Error("Requisito mudou desde a evidência privada.");
  if (!["draft", "reviewed"].includes(row.status) || row.topicId !== null || row.actId !== null || row.articleId !== null ||
    (row.subjectId !== null && row.subjectId !== item.subjectId)) throw new Error("Só classifica requisito sem mapa/tópico, preservando disciplina já atribuída.");
  if (source.status !== "approved" || source.sourceStatus !== "approved" || source.checksum !== item.snapshotChecksum || source.bytesChecksum !== item.snapshotChecksum)
    throw new Error("Fonte, snapshot ou bytes oficiais divergentes.");
  const canonical = programmeCanonicalSubject(item.heading);
  if (!canonical || canonical !== item.subjectName || subject.name !== canonical || subject.id !== item.subjectId || !subject.active)
    throw new Error("Disciplina inexistente, composta ou sem regra canônica exata; classificação bloqueada.");
  const pages = item.pages;
  if (pages.some((page, index) => page > source.pageTexts.length || (index > 0 && page !== pages[index - 1] + 1)) ||
    item.headingPage < 1 || item.headingPage > pages[0] || item.headingPage > source.pageTexts.length ||
    headingKey(programmeLiteralHeadingName(item.headingQuote)) !== headingKey(item.heading) ||
    !source.pageTexts[item.headingPage - 1].split(/\r?\n/u).some(line => normalize(line) === normalize(item.headingQuote)) ||
    !headingKey(row.locator).includes(`· ${headingKey(item.heading)}`)) throw new Error("Cabeçalho literal e localizador da extração não concordam.");
  if (item.fragments) {
    if (normalize(item.fragments.map(fragment => fragment.quote).join(" ")) !== normalize(row.text)) throw new Error("Fragmentos não reproduzem exatamente todo requisito.");
    let previous: { page: number; endOffset: number } | null = null;
    const point = /^Ponto\s+(?:n[ºo.]?\s*)?(\d+)\.?$/iu.exec(normalize(item.fragments[0].quote))?.[1];
    for (const fragment of item.fragments) {
      const page = source.pageTexts[fragment.page - 1];
      if (!pages.includes(fragment.page) || !page || fragment.startOffset >= fragment.endOffset || fragment.endOffset > page.length ||
        (previous && (fragment.page < previous.page || (fragment.page === previous.page && fragment.startOffset < previous.endOffset))) ||
        normalize(page.slice(fragment.startOffset, fragment.endOffset)) !== normalize(fragment.quote)) throw new Error("Offsets UTF-16, ordem, sobreposição ou substring literal inválidos.");
      const prefix = [...source.pageTexts.slice(item.headingPage - 1, fragment.page - 1), page.slice(0, fragment.startOffset)].join("\n");
      const lineEnd = page.indexOf("\n", fragment.startOffset);
      const headingPrefix = [...source.pageTexts.slice(item.headingPage - 1, fragment.page - 1), page.slice(0, lineEnd < 0 ? page.length : lineEnd)].join("\n");
      const enclosing = headingPrefix.split(/\r?\n/u).map(programmeLiteralHeadingName).filter(line => PROGRAMME_SECTION_HEADINGS.some(heading => headingKey(heading) === headingKey(line))).at(-1);
      if (!enclosing || headingKey(enclosing) !== headingKey(item.heading)) throw new Error("Fragmento pertence a outra seção oficial.");
      if (point && fragment !== item.fragments[0]) {
        const lastPoint = [...prefix.matchAll(/\bPonto\s+(?:n[ºo.]?\s*)?(\d+)\b/giu)].at(-1)?.[1];
        if (lastPoint !== point) throw new Error("Alínea pertence a outro ponto oficial.");
      }
      previous = fragment;
    }
  } else {
    // Contiguous proof remains supported. Explicit fragments never claim it.
    const sourceText = normalize(pages.map(page => source.pageTexts[page - 1]).join(" "));
    if (!sourceText.includes(normalize(row.text))) throw new Error("Texto integral não é substring das páginas oficiais indicadas.");
    const contextLines = source.pageTexts.slice(item.headingPage - 1, pages.at(-1)).flatMap(page => page.split(/\r?\n/u)).map(normalize);
    const contextText = contextLines.join(" "), position = contextText.indexOf(normalize(row.text));
    if (position < 0 || position !== contextText.lastIndexOf(normalize(row.text))) throw new Error("Trecho repetido ou sem posição unívoca; exige revisão própria de extração.");
    let offset = 0, enclosingHeading: string | null = null;
    for (const line of contextLines) {
      if (offset > position) break;
      if (PROGRAMME_SECTION_HEADINGS.some(heading => headingKey(heading) === headingKey(programmeLiteralHeadingName(line)))) enclosingHeading = headingKey(programmeLiteralHeadingName(line));
      offset += line.length + 1;
    }
    if (enclosingHeading !== headingKey(item.heading)) throw new Error("Trecho pertence a outra seção oficial; não transferir disciplina.");
  }
  const locatorPages = /p\.\s*(\d+)(?:[–-](\d+))?/u.exec(row.locator);
  if (!locatorPages || Number(locatorPages[1]) !== pages[0] || (locatorPages[2] && Number(locatorPages[2]) !== pages.at(-1)))
    throw new Error("Páginas não correspondem ao localizador original.");
}

export async function classifyStandingProgrammeSubjects(db: PostgresJsDatabase<typeof schema>, request: {
  input: unknown; actorPublicId: string; approvalReference: string; mode: "preview" | "apply"; expectedFingerprint?: string;
}) {
  if (!["preview", "apply"].includes(request.mode) || request.approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE ||
    (request.mode === "apply" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? ""))) throw new Error("Autorização, modo ou fingerprint inválidos.");
  const input = programmeClassificationInputSchema.parse(request.input), actorPublicId = z.uuid().parse(request.actorPublicId);
  const ids = input.requirements.map(row => row.requirementId).sort((a, b) => a - b);
  const list = sql.join(ids.map(value => sql`${value}`), sql`, `);
  return db.transaction(async tx => {
    await tx.execute(sql`set local statement_timeout='30s'`);
    await tx.execute(sql`set local lock_timeout='5s'`);
    if (request.mode === "preview") await tx.execute(sql`set transaction read only`);
    const [actor] = await tx.execute<{ id: number; role: string }>(sql`select id::int id,role from users where public_id=${actorPublicId} ${request.mode === "apply" ? sql`for share` : sql``}`);
    if (!actor || actor.role !== "admin") throw new Error("Administrador explícito obrigatório.");
    if (request.mode === "apply") {
      // Claim takes this same reservation lock. Work rows precede opportunity
      // and requirement locks, matching completion. Never replace a live lease.
      await tx.execute(sql`select pg_advisory_xact_lock(621743,37)`);
      await tx.execute(sql`select job_key from editorial_agent_work where job_key in
        (${sql.join(ids.flatMap(value => [sql`${`mapping:${value}`}`, sql`${`author:${value}`}`]), sql`, `)}) order by job_key for update`);
      await tx.execute(sql`select id from contest_opportunities where id=${input.opportunityId} for update`);
      await tx.execute(sql`select id from opportunity_requirements where id in(${list}) order by id for update`);
      await tx.execute(sql`select d.id from opportunity_source_documents d where d.id in
        (select source_document_id from opportunity_requirements where id in(${list})) order by d.id for share`);
      await tx.execute(sql`select s.id from opportunity_document_snapshots s where s.id in
        (select source_snapshot_id from opportunity_requirements where id in(${list})) order by s.id for share`);
      await tx.execute(sql`select id from quiz_subjects where id in(${sql.join(input.requirements.map(row => sql`${row.subjectId}`), sql`, `)}) order by id for share`);
    }
    const [opportunity] = await tx.execute<{ id: number; slug: string; role: string; year: number; edition: number | null; status: string; updatedAt: string }>(sql`
      select id::int id,slug,role_name role,cycle_year as "year",exam_edition_id::int edition,editorial_status status,updated_at::text as "updatedAt"
      from contest_opportunities where id=${input.opportunityId}`);
    if (!opportunity || opportunity.slug !== input.opportunitySlug || opportunity.role !== input.roleName || opportunity.year !== input.cycleYear ||
      opportunity.edition !== input.examEditionId || opportunity.status !== "reviewed") throw new Error("Cargo/edição/programa mudou; não classificar outro escopo.");
    const [used] = await tx.execute<{ used: boolean }>(sql`select exists(select 1 from question_opportunities where opportunity_id=${input.opportunityId})
      or exists(select 1 from contest_product_question_bindings where opportunity_id=${input.opportunityId}) as used`);
    if (used.used) throw new Error("Escopo já tem questões ou vínculos; exige fluxo próprio de revisão material.");
    const jobs = await tx.execute<{ key: string; status: string; hash: string }>(sql`select job_key key,status,input_hash hash from editorial_agent_work
      where job_key in(${sql.join(ids.flatMap(value => [sql`${`mapping:${value}`}`, sql`${`author:${value}`}`]), sql`, `)}) order by job_key`);
    if (jobs.some(job => job.status === "running")) throw new Error("Existe reserva ativa; preservar lease e aguardar conclusão.");
    const rows = await tx.execute<ProgrammeRequirementState>(sql`select id::int id,opportunity_id::int as "opportunityId",source_document_id::int as "sourceDocumentId",
      source_snapshot_id::int as "snapshotId",subject_id::int as "subjectId",topic_id::int as "topicId",legal_act_id::int as "actId",legal_article_id::int as "articleId",
      requirement_text text,source_locator locator,editorial_status status,reviewed_by_user_id::int as "reviewedBy",reviewed_at::text as "reviewedAt",review_notes as "reviewNotes",updated_at::text as "updatedAt"
      from opportunity_requirements where id in(${list}) order by id`);
    if (rows.length !== ids.length || rows.some(row => row.opportunityId !== input.opportunityId)) throw new Error("Requisitos não pertencem integralmente ao alvo.");
    const [additional] = await tx.execute<{ used: boolean }>(sql`select exists(select 1 from opportunity_requirement_articles where requirement_id in(${list})) as used`);
    if (additional.used) throw new Error("Requisito já tem artigos adicionais; exige revisão de mapas própria.");
    const sources = await tx.execute<{ id: number; sourceDocumentId: number; checksum: string; bytesChecksum: string; pageTexts: string[]; status: string; sourceStatus: string; policy: string; sourcePolicy: string; url: string; updatedAt: string; sourceStateFingerprint: string }>(sql`
      select s.id::int id,s.source_document_id::int as "sourceDocumentId",s.checksum_sha256 checksum,encode(sha256(s.document_bytes),'hex') as "bytesChecksum",s.page_texts as "pageTexts",s.status,d.status as "sourceStatus",
        s.source_policy policy,d.source_policy as "sourcePolicy",s.document_url url,s.updated_at::text as "updatedAt",encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex') as "sourceStateFingerprint"
      from opportunity_document_snapshots s join opportunity_source_documents d on d.id=s.source_document_id and d.opportunity_id=${input.opportunityId}
      where s.id in(select source_snapshot_id from opportunity_requirements where id in(${list}))`);
    const subjects = await tx.execute<{ id: number; name: string; active: boolean }>(sql`select id::int id,name,is_active active from quiz_subjects
      where id in(${sql.join(input.requirements.map(row => sql`${row.subjectId}`), sql`, `)})`);
    for (const item of input.requirements) {
      const row = rows.find(row => row.id === item.requirementId)!, source = sources.find(source => source.id === row.snapshotId), subject = subjects.find(subject => subject.id === item.subjectId);
      if (!source || source.sourceDocumentId !== row.sourceDocumentId || !subject || source.policy !== "official_document" || source.sourcePolicy !== "official_document" || !Array.isArray(source.pageTexts)) throw new Error("Snapshot/catálogo oficial ausente.");
      parseOfficialOpportunityDocumentUrl(source.url, input.opportunitySlug === "sefaz-al-auditor-fiscal-2026" ? "cebraspe" : "fgv-conhecimento");
      assertProgrammeSubjectEvidence(row, item, source, subject);
    }
    const changed = rows.filter(row => row.subjectId === null || row.status === "reviewed");
    const fingerprint = digest({ input, actorPublicId, approvalReference: request.approvalReference, opportunity, rows,
      sources: sources.map(({ pageTexts, ...source }) => ({ ...source, pageTextsChecksum: digest(pageTexts) })).sort((a, b) => a.id - b.id), subjects: subjects.sort((a, b) => a.id - b.id), jobs });
    if (request.mode === "apply") {
      if (request.expectedFingerprint !== fingerprint) throw new Error("Fonte, classificação, fila ou requisito mudou desde o preview.");
      if (changed.length) {
        for (const before of changed) {
          const item = input.requirements.find(row => row.requirementId === before.id)!;
          const updated = await tx.execute(sql`update opportunity_requirements set subject_id=${item.subjectId},editorial_status='draft',
            reviewed_by_user_id=null,reviewed_at=null,review_notes=null,updated_at=now() where id=${before.id} and opportunity_id=${input.opportunityId} returning id`);
          if (updated.length !== 1) throw new Error("Requisito não atualizado exatamente uma vez.");
          await tx.insert(schema.auditLogs).values({ actorUserId: actor.id, action: PROGRAMME_SUBJECT_CLASSIFICATION_ACTION,
            entityType: "opportunity_requirement", entityId: String(before.id), metadata: { approvalBasis: "owner_standing_authorization", approvalReference: request.approvalReference,
              humanReview: false, priorReviewPreservedInClassificationAudit: true, before, sourceProof: item, operationFingerprint: fingerprint,
              after: { subjectId: item.subjectId, topicId: null, legalActId: null, legalArticleId: null, editorialStatus: "draft" },
              legalMappingsApproved: 0, questionsApproved: 0, productsReleased: 0, newMaterialReviewRequired: true } });
        }
      }
    }
    return { mode: request.mode, fingerprint, opportunityId: input.opportunityId, examined: rows.length, changed: changed.length,
      beforeFingerprints: rows.map(row => ({ requirementId: row.id, fingerprint: programmeRequirementFingerprint(row) })),
      humanReview: false, legalMappingsApproved: 0, questionsApproved: 0, productsReleased: 0, newMaterialReviewRequired: true };
  }, { isolationLevel: request.mode === "apply" ? "serializable" : "repeatable read" });
}
