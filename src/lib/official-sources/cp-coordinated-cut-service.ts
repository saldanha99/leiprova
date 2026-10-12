import { randomUUID } from "node:crypto";
import { eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { approvedProductQuestionExists } from "../commerce/product-binding-query";
import { approvedProductQuestionCount } from "../commerce/minimum-course-content";
import { productPreviousExamRequirementMet } from "../commerce/previous-exam-content";
import { preparationProgramReviewSatisfied } from "../commerce/preparation-mode-query";
import { bindingFingerprint } from "../commerce/product-binding-policy";
import { currentQuestionContractExists, questionContractContentHash } from "../editorial/question-contract-query";
import { CAMARA_CP_CORRECTION, CP63_EXPECTED_HELD_IDS, parseCamaraCpCorrectionCapture, storedCpCorrectionFingerprint, compareCamaraCpCorrection, cpCorrectionSha256, type StoredCpCorrectionArticle, type fetchCamaraCpCorrectionEvidence } from "./camara-cp-correction-parser";
import { CP_CUT_ITEMS, CP_CUT_PRODUCT, CP_CUT_POLICY, CP_CUT_REFERENCE, CP_CUT_CONTRACT, CP_CUT_OPINION_HASH, CP_CUT_SCOPE_NOTE, assertCpCutImpact, assertCpCutFloors, assertCpCutFresh, cpCutFingerprint, cpCutReplacement, type CpCutFloor } from "./cp-coordinated-cut";

type Db = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Pick<Tx, "execute">;
type Json = Record<string, unknown>;
type Fresh = Awaited<ReturnType<typeof fetchCamaraCpCorrectionEvidence>>;
/** Cast through TEXT: postgres.js JSON OID serialization must not double-encode objects. */
const jsonSql = (value: unknown) => sql`${JSON.stringify(value)}::text::jsonb`;
const integerIds = (ids: readonly number[]) => sql`array[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::bigint[]`;
const bindingIds = CP_CUT_ITEMS.map(item => item[2]);
const textIds = (ids: readonly string[]) => sql`array[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[]`;
const number = (value: unknown) => { const result = Number(value); if (!Number.isSafeInteger(result)) throw new Error("Identificador/contagem inválida."); return result; };
const string = (value: unknown) => { if (typeof value !== "string") throw new Error("Campo textual ausente."); return value; };
const object = (value: unknown): Json => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Objeto de evidência inválido."); return value as Json; };

type Dossier = { question: Json; binding: Json; certificate: Json; contentHash: string; options: Json[]; eligible: boolean };
type Context = { act: Json; version: Json; articles: StoredCpCorrectionArticle[]; dossiers: Dossier[]; requirement: Json; sources: Json[]; organizers: Json[]; contract: Json; products: Json[]; floors: CpCutFloor[]; actor: { id: number; publicId: string; role: string }; };

async function floors(tx: Executor, cte: SQL = sql``) {
  return tx.execute<CpCutFloor>(sql`${cte} select p.slug, ${approvedProductQuestionCount(sql`p.slug`, sql`p.opportunity_id`)} as count,
    coalesce(p.status='released' and p.released_at is not null and p.released_by_user_id is not null
      and o.editorial_status='reviewed' and ${preparationProgramReviewSatisfied(sql`p.slug`)}
      and ${approvedProductQuestionCount(sql`p.slug`, sql`p.opportunity_id`)}>=68
      and ${productPreviousExamRequirementMet(sql`p.slug`, sql`p.opportunity_id`)},false) as ready
    from contest_store_products p left join contest_opportunities o on o.id=p.opportunity_id order by p.slug`);
}

async function lock(tx: Executor) {
  // Owner verifier takes act/version/source locks; the approval helper takes
  // question/article/version/act locks. Fence BOTH CP owner paths before either
  // order starts, avoiding a version <-> act upgrade cycle without changing APP helpers.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('leiprova:cp-owner-maintenance:v1',0))`);
  // Same product -> opportunity -> question order as binding review. All catalog rows
  // are locked to stabilize the required 3/285, without modifying commerce fields.
  await tx.execute(sql`select slug from contest_store_products order by slug for update`);
  await tx.execute(sql`select id from contest_opportunities order by id for update`);
  await tx.execute(sql`select public.lock_question_contract_context(array[${CP_CUT_CONTRACT}]::text[])`);
  await tx.execute(sql`select public.lock_editorial_approval_context(${integerIds(CP_CUT_ITEMS.map(item => item[0]))})`);
  await tx.execute(sql`select id from legal_acts where id=17 for update`);
  await tx.execute(sql`select id from legal_versions where legal_act_id=17 order by id for update`);
  await tx.execute(sql`select id from legal_source_snapshots where legal_act_id=17 order by id for update`);
  await tx.execute(sql`select id from legal_text_snapshots where legal_act_id=17 order by id for update`);
  await tx.execute(sql`select id from legal_articles where legal_version_id=63 order by id for update`);
  await tx.execute(sql`select id from contest_product_question_bindings where id=any(${textIds(bindingIds)}) order by id for update`);
  await tx.execute(sql`select id from opportunity_requirements where id=667 for update`);
  await tx.execute(sql`select id from opportunity_source_documents where opportunity_id=2 order by id for share`);
  await tx.execute(sql`select id from opportunity_document_snapshots where source_document_id in(select id from opportunity_source_documents where opportunity_id=2) order by id for share`);
  await tx.execute(sql`select id from exam_editions order by id for share`);
  await tx.execute(sql`select id from opportunity_organizer_assignments order by id for share`);
}

async function context(tx: Executor, actor: Context["actor"]): Promise<Context> {
  const [identity] = await tx.execute<{ database: string; role: string }>(sql`select current_database() as database,current_user as role`);
  if (identity?.database !== "leiprova" || identity.role !== "leiprova_owner") throw new Error("Identidade efetiva do banco divergente.");
  const [legal] = await tx.execute<{ act: Json; version: Json }>(sql`select to_jsonb(a) as act,to_jsonb(v) as version from legal_acts a join legal_versions v on v.legal_act_id=a.id where a.id=17 and v.id=63`);
  if (!legal || legal.act.slug !== "codigo-penal" || legal.act.urn !== "urn:lex:br:federal:decreto.lei:1940-12-07;2848" || legal.act.is_active !== true || legal.act.act_type !== "decreto-lei" || legal.act.act_number !== "2.848" || legal.act.act_year !== 1940 || legal.version.status !== "current" || legal.version.checksum_sha256 !== CAMARA_CP_CORRECTION.oldVersionChecksum || legal.version.source_url !== "https://legis.senado.leg.br/norma/527942/publicacao/39870011") throw new Error("Identidade/versão corrente CP63 divergente.");
  const articles = await tx.execute<StoredCpCorrectionArticle>(sql`select a.id::int as id,a.legal_version_id::int as "versionId",a.path,a.article_order as "articleOrder",a.heading,a.literal_text as "literalText",a.editorial_status as "editorialStatus",a.source_rights as "sourceRights",
    (select count(*)::int from questions q where q.legal_article_id=a.id) as "questionCount",
    (select count(*)::int from contest_product_question_bindings b where b.legal_article_id=a.id) as "bindingCount",
    (select count(*)::int from opportunity_requirements r where r.legal_article_id=a.id) as "primaryRequirementCount",
    (select count(*)::int from opportunity_requirement_articles r where r.legal_article_id=a.id) as "additionalRequirementCount"
    from legal_articles a where a.legal_version_id=63 order by a.article_order`);
  assertCpCutImpact(articles);
  const dossiers = await tx.execute<Dossier>(sql`select to_jsonb(q) as question,to_jsonb(b) as binding,to_jsonb(c) as certificate,
    ${questionContractContentHash(sql`q.id`)} as "contentHash",
    coalesce((select jsonb_agg(to_jsonb(opt) order by opt.sort_order) from question_options opt where opt.question_id=q.id),'[]'::jsonb) as options,
    ${approvedProductQuestionExists(sql`b.product_slug`, sql`q.id`, sql`b.opportunity_id`, sql`b.id`)} as eligible
    from questions q join contest_product_question_bindings b on b.question_id=q.id join question_contract_certifications c on c.binding_id=b.id
    where q.id=any(${integerIds(CP_CUT_ITEMS.map(item => item[0]))}) order by q.id,b.id`);
  if (dossiers.length !== 5) throw new Error("Cinco questões/vínculos/certificações exatos não encontrados.");
  for (const [index, dossier] of dossiers.entries()) {
    const item = CP_CUT_ITEMS[index], q = dossier.question, b = dossier.binding, cert = dossier.certificate;
    if (number(q.id) !== item[0] || dossier.contentHash !== item[3] || !dossier.eligible || q.legal_article_id !== 3733 || q.type !== "multiple_choice" || q.editorial_status !== "reviewed" || q.source_rights !== "original_authorial" || q.quiz_mode !== "original_style" || q.style_bank_id !== 2 || q.question_contract_id !== null || q.exam_edition_id !== null || q.clean_room_attested_at === null || q.created_by_user_id === null || q.reviewed_by_user_id === null || q.verified_at === null || q.source_url !== legal.version.source_url || b.id !== item[2] || b.product_slug !== CP_CUT_PRODUCT || b.opportunity_id !== 2 || b.requirement_id !== 667 || b.legal_article_id !== 3733 || b.legal_version_id !== 63 || b.status !== "approved" || b.source_document_id !== 4 || b.source_snapshot_id !== 5 || b.source_snapshot_checksum !== "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1" || cert.contract_id !== CP_CUT_CONTRACT || cert.question_content_hash !== item[3] || cert.status !== "approved" || cert.human_review !== false || cert.approval_reference !== CP_CUT_REFERENCE || dossier.options.length !== 5 || dossier.options.filter(o => o.is_correct === true).length !== 1 || dossier.options.find(o => o.is_correct === true)?.option_key !== item[1] || dossier.options.some((o, i) => o.option_key !== "ABCDE"[i] || o.sort_order !== i)) throw new Error("Uma das cinco inéditas/aderência/contrato divergiu do parecer privado.");
  }
  const [requirement] = await tx.execute<{ data: Json }>(sql`select to_jsonb(r) as data from opportunity_requirements r where id=667`);
  const [contract] = await tx.execute<{ data: Json; current: boolean }>(sql`select to_jsonb(c) as data,${currentQuestionContractExists(sql`c.id`, sql`c.opportunity_id`)} as current from opportunity_question_contracts c where id=${CP_CUT_CONTRACT}`);
  if (!requirement || requirement.data.legal_article_id !== 3733 || requirement.data.opportunity_id !== 2 || requirement.data.editorial_status !== "reviewed" || !contract?.current) throw new Error("Requisito/contrato oficial exato deixou de valer.");
  const sources = await tx.execute<{ data: Json }>(sql`select jsonb_build_object('source',to_jsonb(s),'snapshot',to_jsonb(n)) as data from opportunity_source_documents s left join opportunity_document_snapshots n on n.source_document_id=s.id where s.opportunity_id=2 order by s.id,n.id`);
  const organizers = await tx.execute<{ data: Json }>(sql`select jsonb_build_object('assignment',to_jsonb(a),'bank',to_jsonb(b),'profile',to_jsonb(p)) as data from opportunity_organizer_assignments a left join quiz_banks b on b.id=a.quiz_bank_id left join question_style_profiles p on p.quiz_bank_id=b.id where a.opportunity_id=2 order by a.id`);
  const products = await tx.execute<{ data: Json }>(sql`select jsonb_build_object('product',to_jsonb(p),'opportunity',to_jsonb(o)) as data from contest_store_products p left join contest_opportunities o on o.id=p.opportunity_id order by p.slug`);
  const counts = await floors(tx); assertCpCutFloors(counts);
  return { ...legal, articles, dossiers, requirement: requirement.data, contract: contract.data, sources: sources.map(s => s.data), organizers: organizers.map(s => s.data), products: products.map(s => s.data), floors: counts, actor };
}

function proposed(context: Context, fresh: Fresh, versionId: number, article351Id: number, timestamp: string) {
  const literal = fresh.parsed.articles.find(article => article.path === "art-351")?.literalText;
  if (!literal) throw new Error("Art351 não encontrado.");
  return context.dossiers.map(d => {
    const q = d.question, b = d.binding, replacement = cpCutReplacement(number(q.id), string(q.explanation), literal);
    const question = { ...q, id: number(q.id), explanation: replacement.explanation, legal_article_id: article351Id, source_url: CAMARA_CP_CORRECTION.url, updated_at: timestamp };
    const evidence = { ...object(b.evidence), purpose: "reviewed_product_scope", publicationAllowed: true, blockers: [],
      questionContent: { ...object(object(b.evidence).questionContent), explanation: replacement.explanation },
      legalArticleText: literal, legalSourceUrl: CAMARA_CP_CORRECTION.url,
      correctionPolicy: CP_CUT_POLICY, correctionOpinionHash: CP_CUT_OPINION_HASH, approvalReference: CP_CUT_REFERENCE, humanReview: false };
    // Preserve the exact product/program/source/bank scope; do not rewrite answers.
    const values = { productSlug: b.product_slug, opportunityId: b.opportunity_id, requirementId: b.requirement_id, questionId: q.id,
      sourceDocumentId: b.source_document_id, sourceSnapshotId: b.source_snapshot_id, sourceSnapshotChecksum: b.source_snapshot_checksum,
      legalArticleId: article351Id, legalVersionId: versionId, legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
      questionUpdatedAt: timestamp, requirementText: b.requirement_text, sourceLocator: b.source_locator, requirementQuote: b.requirement_quote,
      legalQuote: replacement.legalQuote, scopeNotes: CP_CUT_SCOPE_NOTE, evidence, proposedByUserId: context.actor.id };
    const id = bindingFingerprint(values);
    const binding = { ...b, id, legal_article_id: article351Id, legal_version_id: versionId, legal_version_checksum: CAMARA_CP_CORRECTION.canonicalSha256,
      question_updated_at: timestamp, legal_quote: replacement.legalQuote, scope_notes: CP_CUT_SCOPE_NOTE, evidence, proposed_by_user_id: context.actor.id,
      reviewed_by_user_id: context.actor.id, reviewed_at: timestamp, updated_at: timestamp, created_at: timestamp, review_notes: CP_CUT_POLICY, status: "approved" };
    const certificate = { ...d.certificate, binding_id: id, question_content_hash: replacement.expectedContentHash, reviewed_by_user_id: context.actor.id, reviewed_at: timestamp };
    return { question, binding, certificate, expectedContentHash: replacement.expectedContentHash, oldBindingId: string(b.id) };
  });
}

/** Keep every column/row, but expose unchanged keys directly to the planner.
 * Reconstructing whole existing rows through JSON hid indexes and spilled wide
 * CTEs for each correlated access check. Only the explicit cut fields differ. */
function projectedColumns(table: PgTable, alias: string, changed: Record<string, SQL>) {
  return sql.join(Object.values(getTableColumns(table)).map(column =>
    sql`${changed[column.name] ?? sql`${sql.identifier(alias)}.${sql.identifier(column.name)}`} as ${sql.identifier(column.name)}`), sql`, `);
}

function projection(context: Context, fresh: Fresh) {
  const timestamp = "2000-01-01T00:00:00.000Z";
  const articles = fresh.parsed.articles.map((a, i) => ({ id: -(i + 1), legal_version_id: -1, article_ref: a.articleRef, article_order: i + 1, heading: null, path: a.path, literal_text: a.literalText, editorial_status: "reviewed", source_rights: "official_text", created_at: timestamp, updated_at: timestamp }));
  const article351Id = articles.find(a => a.path === "art-351")!.id;
  const items = proposed(context, fresh, -1, article351Id, timestamp);
  const questionPatches = items.map(i => i.question), bindings = items.map(i => i.binding), certifications = items.map(i => i.certificate);
  const version = { ...context.version, id: -1, status: "current", source_url: CAMARA_CP_CORRECTION.url, checksum_sha256: CAMARA_CP_CORRECTION.canonicalSha256 };
  const changedQuestion = sql`q.id=any(${integerIds(CP_CUT_ITEMS.map(item => item[0]))})`;
  const explanation = sql`case q.id ${sql.join(questionPatches.map(q => sql`when ${number(q.id)} then ${string(q.explanation)}`), sql` `)} else q.explanation end`;
  const questionColumns = projectedColumns(schema.questions, "q", {
    legal_article_id: sql`case when ${changedQuestion} then ${article351Id}::bigint else q.legal_article_id end`,
    explanation,
    source_url: sql`case when ${changedQuestion} then ${CAMARA_CP_CORRECTION.url}::text else q.source_url end`,
    updated_at: sql`case when ${changedQuestion} then ${timestamp}::text::timestamptz else q.updated_at end`,
  });
  const versionColumns = projectedColumns(schema.legalVersions, "v", { status: sql`case when v.id=63 then 'superseded'::text else v.status end` });
  const requirementColumns = projectedColumns(schema.opportunityRequirements, "r", {
    legal_article_id: sql`case when r.id=667 then ${article351Id}::bigint else r.legal_article_id end`,
    editorial_status: sql`case when r.id=667 then 'reviewed'::text else r.editorial_status end`,
    reviewed_by_user_id: sql`case when r.id=667 then ${context.actor.id}::bigint else r.reviewed_by_user_id end`,
    reviewed_at: sql`case when r.id=667 then ${timestamp}::text::timestamptz else r.reviewed_at end`,
  });
  const bindingColumns = projectedColumns(schema.contestProductQuestionBindings, "b", {
    status: sql`case when b.id=any(${textIds(bindingIds)}) then 'suspended'::text else b.status end`,
  });
  const cte = sql`with questions as not materialized (select ${questionColumns} from public.questions q),
  legal_versions as not materialized (select ${versionColumns} from public.legal_versions v union all select ${projectedColumns(schema.legalVersions, "added_version", {})} from jsonb_populate_recordset(null::public.legal_versions,${jsonSql([version])}) added_version),
  legal_articles as not materialized (select * from public.legal_articles union all select * from jsonb_populate_recordset(null::public.legal_articles,${jsonSql(articles)})),
  opportunity_requirements as not materialized (select ${requirementColumns} from public.opportunity_requirements r),
  contest_product_question_bindings as not materialized (select ${bindingColumns} from public.contest_product_question_bindings b union all select ${projectedColumns(schema.contestProductQuestionBindings, "added_binding", {})} from jsonb_populate_recordset(null::public.contest_product_question_bindings,${jsonSql(bindings)}) added_binding),
  question_contract_certifications as not materialized (select * from public.question_contract_certifications union all select * from jsonb_populate_recordset(null::public.question_contract_certifications,${jsonSql(certifications)}))`;
  return { cte, items };
}

export async function previewCoordinatedCpCut(tx: Executor, fresh: Fresh, actor: Context["actor"]) {
  await tx.execute(sql`set local statement_timeout='25s'`);
  assertCpCutFresh(fresh.body.fetchedAt); assertCpCutFresh(fresh.amendment.fetchedAt);
  const verified=parseCamaraCpCorrectionCapture(fresh.body.bytes,CAMARA_CP_CORRECTION.url,fresh.body.mime);
  if(fresh.body.status!==200 || fresh.amendment.status!==200 || verified.canonicalSha256!==fresh.parsed.canonicalSha256) throw new Error("Captura HTTP/perfil não corresponde ao corpo oficial.");
  const current = await context(tx, actor);
  const diff = compareCamaraCpCorrection(current.articles, fresh.parsed, fresh.amendment.bytes);
  const simulation = projection(current, fresh);
  const projected = await floors(tx, simulation.cte); assertCpCutFloors(projected);
  const checks = await tx.execute<{ id: number; hash: string; eligible: boolean }>(sql`${simulation.cte}
    select q.id::int as id,${questionContractContentHash(sql`q.id`)} as hash,
    ${approvedProductQuestionExists(sql`${CP_CUT_PRODUCT}`, sql`q.id`, sql`2`)} as eligible from questions q where q.id=any(${integerIds(CP_CUT_ITEMS.map(item => item[0]))}) order by q.id`);
  if (checks.length !== 5 || checks.some((c, i) => c.id !== CP_CUT_ITEMS[i][0] || c.hash !== CP_CUT_ITEMS[i][4] || !c.eligible)) throw new Error("Projeção real de acesso/hash rejeitou uma das cinco correções.");
  const fingerprint = cpCutFingerprint({ policy: CP_CUT_POLICY, sourceRaw: fresh.parsed.rawSha256, sourceCanonical: fresh.parsed.canonicalSha256, amendmentRaw: cpCorrectionSha256(fresh.amendment.bytes), parser: fresh.parsed.parserVersion, context: current, proposedQuestionHashes: checks.map(c => [c.id,c.hash]), projected });
  return { current, diff, projected, fingerprint, checks };
}

/** Reviewed material cannot be changed in place (0020). Reopen, then decide the
 * exact same program scope against the corrected literal inside this one TX. */
async function rereviewCpRequirement(tx: Tx, previous: Json, articleId: number, actorId: number, timestamp: string, fingerprint: string) {
  if(previous.id!==667 || previous.editorial_status!=="reviewed" || previous.legal_article_id!==3733 || previous.legal_act_id!==17 || previous.source_document_id!==4 || previous.source_snapshot_id!==5) throw new Error("Requisito667 fora da revisão delimitada.");
  const reopened=await tx.execute<{state:Json}>(sql`update opportunity_requirements r
    set editorial_status='pending_review',reviewed_by_user_id=null,reviewed_at=null,review_notes=null,updated_at=${timestamp}::timestamptz
    where r.id=667 and r.editorial_status='reviewed' and r.legal_article_id=3733 and to_jsonb(r)=${jsonSql(previous)}
    returning to_jsonb(r) as state`);
  if(reopened.length!==1 || reopened[0].state.editorial_status!=="pending_review" || reopened[0].state.reviewed_by_user_id!==null || reopened[0].state.reviewed_at!==null || reopened[0].state.review_notes!==null) throw new Error("Reabertura exige exatamente um requisito com revisão anterior limpa; tudo revertido.");
  const shared={policy:CP_CUT_POLICY,fingerprint,approvalMode:"owner_standing_authorization",approvalReference:CP_CUT_REFERENCE,humanReview:false,
    requirementId:667,sourceDocumentId:4,sourceSnapshotId:5,requirementTextSha256:cpCorrectionSha256(string(previous.requirement_text)),sourceLocator:previous.source_locator,
    subjectId:previous.subject_id,topicId:previous.topic_id,legalActId:17,sourceAndProgrammeChanged:false,subjectAndTopicChanged:false,
    oldArticleId:3733,newArticleId:articleId,questionIds:CP_CUT_ITEMS.map(i=>i[0]),contractId:CP_CUT_CONTRACT};
  const [reopenAudit]=await tx.insert(schema.auditLogs).values({actorUserId:actorId,action:"editorial.notice_requirement.reopened_for_cp_correction",entityType:"opportunity_requirement",entityId:"667",metadata:{...shared,statusBefore:"reviewed",statusAfter:"pending_review",previousReviewerId:previous.reviewed_by_user_id,previousReviewedAt:previous.reviewed_at,previousReviewNotesSha256:cpCorrectionSha256(typeof previous.review_notes==="string"?previous.review_notes:""),reviewFieldsCleared:true}}).returning({id:schema.auditLogs.id});
  const note=`Revisão automatizada da aderência do requisito667 ao art.351 integral corrigido da Câmara; programa, fonte, matéria e tópico preservados; ${CP_CUT_REFERENCE}; sem revisão humana; conferência posterior pelo Maestro.`;
  // Only review fields/status/updatedAt differ after reopening. Even a hidden
  // change to another program field makes this conditional update affect zero rows.
  const reviewed=await tx.execute<{state:Json}>(sql`update opportunity_requirements r
    set legal_article_id=${articleId},editorial_status='reviewed',reviewed_by_user_id=${actorId},reviewed_at=${timestamp}::timestamptz,review_notes=${note},updated_at=${timestamp}::timestamptz
    where r.id=667 and r.editorial_status='pending_review' and r.legal_article_id=3733
      and r.reviewed_by_user_id is null and r.reviewed_at is null and r.review_notes is null
      and (to_jsonb(r)-array['editorial_status','reviewed_by_user_id','reviewed_at','review_notes','updated_at']::text[]) = (${jsonSql(previous)}-array['editorial_status','reviewed_by_user_id','reviewed_at','review_notes','updated_at']::text[])
    returning to_jsonb(r) as state`);
  if(reviewed.length!==1 || reviewed[0].state.editorial_status!=="reviewed" || reviewed[0].state.legal_article_id!==articleId || reviewed[0].state.reviewed_by_user_id!==actorId || reviewed[0].state.review_notes!==note || new Date(string(reviewed[0].state.reviewed_at)).getTime()!==new Date(timestamp).getTime()) throw new Error("Nova revisão exige exatamente um requisito correspondente; tudo revertido.");
  const [reviewAudit]=await tx.insert(schema.auditLogs).values({actorUserId:actorId,action:"editorial.notice_requirement.reviewed",entityType:"opportunity_requirement",entityId:"667",metadata:{...shared,statusBefore:"pending_review",statusAfter:"reviewed",reviewerId:actorId,reviewedAt:timestamp,reviewNotes:note,reopenAuditId:reopenAudit.id,mappingBasis:"same_official_programme_corrected_current_cp351",humanReviewConfirmed:false}}).returning({id:schema.auditLogs.id});
  return {reopenAuditId:reopenAudit.id,reviewAuditId:reviewAudit.id};
}

export async function applyCoordinatedCpCut(tx: Tx, fresh: Fresh, actor: Context["actor"], expectedFingerprint: string) {
  await lock(tx);
  const prepared = await previewCoordinatedCpCut(tx, fresh, actor);
  if (prepared.fingerprint !== expectedFingerprint) throw new Error("Contexto/fonte/dossiê mudou desde a prévia; transação revertida.");
  const [operator] = await tx.execute<{ id: number; publicId: string; role: string }>(sql`select id::int as id,public_id as "publicId",role from users where id=${actor.id} for share`);
  if (!operator || operator.publicId !== actor.publicId || operator.role !== "admin") throw new Error("Administrador único perdeu identidade/papel.");
  const [collision] = await tx.execute<{ id: number }>(sql`select id from legal_versions where legal_act_id=17 and checksum_sha256=${CAMARA_CP_CORRECTION.canonicalSha256}`);
  if (collision) throw new Error("Corpus402 já existe; verificar recibo específico, nunca restaurar automaticamente.");
  const now = new Date(), timestamp = now.toISOString();
  const canonical = fresh.parsed.articles.map(a => [a.path,"",a.literalText].join("\n")).join("\n\n");
  const notes = `${CP_CUT_POLICY}; fonte Câmara confrontada integralmente com Lei15.517; ${CP_CUT_REFERENCE}; humanReview:false.`;
  const [monitor] = await tx.insert(schema.legalSourceSnapshots).values({ publicId: randomUUID(), legalActId: 17, sourceUrl: CAMARA_CP_CORRECTION.url, checksumSha256: CAMARA_CP_CORRECTION.canonicalSha256, normalizedContent: canonical, contentLength: [...canonical].length, articleMarkerCount: 402, httpStatus: 200, status: "approved", initiatedByUserId: null, reviewedByUserId: actor.id, reviewedAt: now, reviewNotes: notes, fetchedAt: fresh.body.fetchedAt, lastSeenAt: fresh.body.fetchedAt }).returning();
  const [text] = await tx.insert(schema.legalTextSnapshots).values({ publicId: randomUUID(), legalActId: 17, monitorSnapshotId: monitor.id, sourceUrl: CAMARA_CP_CORRECTION.url, checksumSha256: CAMARA_CP_CORRECTION.canonicalSha256, normalizedContent: canonical, contentLength: [...canonical].length, articleCount: 402, parserVersion: fresh.parsed.parserVersion, status: "approved", initiatedByUserId: null, reviewedByUserId: actor.id, reviewedAt: now, reviewNotes: notes, fetchedAt: fresh.body.fetchedAt, lastSeenAt: fresh.body.fetchedAt }).returning();
  await tx.execute(sql`update legal_source_snapshots set status='superseded' where legal_act_id=17 and status='approved' and id<>${monitor.id}`);
  await tx.execute(sql`update legal_text_snapshots set status='superseded',updated_at=${timestamp}::timestamptz where legal_act_id=17 and status='approved' and id<>${text.id}`);
  await tx.update(schema.legalVersions).set({ status: "superseded" }).where(eq(schema.legalVersions.id, 63));
  const [version] = await tx.insert(schema.legalVersions).values({ legalActId: 17, sourceUrl: CAMARA_CP_CORRECTION.url, checksumSha256: CAMARA_CP_CORRECTION.canonicalSha256, verifiedAt: fresh.body.fetchedAt, status: "current" }).returning();
  const newArticles = await tx.insert(schema.legalArticles).values(fresh.parsed.articles.map((a, i) => ({ legalVersionId: version.id, articleRef: a.articleRef, articleOrder: i + 1, heading: null, path: a.path, literalText: a.literalText, editorialStatus: "reviewed" as const, sourceRights: "official_text" as const }))).returning({ id: schema.legalArticles.id, path: schema.legalArticles.path });
  const article351 = newArticles.find(a => a.path === "art-351");
  if (!article351 || newArticles.length !== 402) throw new Error("Versão integral não foi criada.");
  const items = proposed(prepared.current, fresh, version.id, article351.id, timestamp);
  const requirementReview=await rereviewCpRequirement(tx,prepared.current.requirement,article351.id,actor.id,timestamp,expectedFingerprint);
  for (const item of items) {
    const q = item.question, b = item.binding;
    await tx.update(schema.questions).set({ legalArticleId: article351.id, explanation: string(q.explanation), sourceUrl: CAMARA_CP_CORRECTION.url, updatedAt: now }).where(eq(schema.questions.id, number(q.id)));
    await tx.execute(sql`update contest_product_question_bindings set status='suspended',updated_at=${timestamp}::timestamptz,review_notes=${notes} where id=${item.oldBindingId} and status='approved'`);
    await tx.execute(sql`update question_contract_certifications set status='suspended' where binding_id=${item.oldBindingId} and status='approved'`);
    await tx.execute(sql`insert into contest_product_question_bindings select * from jsonb_populate_record(null::public.contest_product_question_bindings,${jsonSql(b)})`);
    await tx.execute(sql`insert into question_contract_certifications select * from jsonb_populate_record(null::public.question_contract_certifications,${jsonSql(item.certificate)})`);
  }
  const after = await floors(tx); assertCpCutFloors(after);
  const checked = await tx.execute<{ id: number; hash: string; eligible: boolean }>(sql`select q.id::int as id,${questionContractContentHash(sql`q.id`)} as hash,${approvedProductQuestionExists(sql`${CP_CUT_PRODUCT}`, sql`q.id`, sql`2`)} as eligible from questions q where q.id=any(${integerIds(CP_CUT_ITEMS.map(item => item[0]))}) order by q.id`);
  if (checked.length !== 5 || checked.some((q, i) => !q.eligible || q.hash !== CP_CUT_ITEMS[i][4])) throw new Error("Conferência final do acesso/certificados falhou; tudo revertido.");
  const held = await tx.execute<{ id: number }>(sql`select id::int as id from legal_articles where legal_version_id=63 and editorial_status='suspended' order by id`);
  if (JSON.stringify(held.map(a => a.id)) !== JSON.stringify([...CP63_EXPECTED_HELD_IDS].sort((a,b) => a-b))) throw new Error("Suspensões antigas não foram preservadas.");
  const metadata = { policy: CP_CUT_POLICY, fingerprint: expectedFingerprint, approvalMode: "owner_standing_authorization", approvalReference: CP_CUT_REFERENCE, humanReview: false,
    sourceUrl: CAMARA_CP_CORRECTION.url, rawSha256: fresh.parsed.rawSha256, checksum: fresh.parsed.canonicalSha256, parserVersion: fresh.parsed.parserVersion,
    amendmentUrl: CAMARA_CP_CORRECTION.amendmentUrl, amendmentRawSha256: cpCorrectionSha256(fresh.amendment.bytes), freshFetchedAt: fresh.body.fetchedAt.toISOString(), amendmentFetchedAt: fresh.amendment.fetchedAt.toISOString(),
    monitorId: monitor.id, textId: text.id, oldVersionId: 63, newVersionId: version.id, oldHeldIds: [...CP63_EXPECTED_HELD_IDS], articleMap: newArticles.map(a => ({ path:a.path,newId:a.id,oldId:prepared.current.articles.find(old => old.path===a.path)?.id ?? null })),
    requirementMapping: { requirementId:667,oldArticleId:3733,newArticleId:article351.id,additionalMappingsChanged:0,statusBefore:"reviewed",intermediateStatus:"pending_review",statusAfter:"reviewed",...requirementReview }, opinionHash: CP_CUT_OPINION_HASH, corrections: items.map(i => ({ questionId:i.question.id,oldBindingId:i.oldBindingId,newBindingId:i.binding.id,oldContentHash:CP_CUT_ITEMS.find(x => x[0]===i.question.id)![3],newContentHash:i.expectedContentHash })),
    before: prepared.current.floors, after, counts: prepared.diff.counts, productsReleased: 0, flagsChanged: 0, pricesChanged: 0 };
  const [audit] = await tx.insert(schema.auditLogs).values({ actorUserId: actor.id, action: "editorial.legal_cp.coordinated_cut", entityType: "legal_text_snapshot", entityId: text.publicId, metadata }).returning({ id:schema.auditLogs.id });
  // Dedicated provenance row stores the amendment as proof, not as CP literal or a fictitious Senate snapshot.
  await tx.execute(sql`insert into legal_cp_correction_evidence(public_id,legal_act_id,monitor_snapshot_id,text_snapshot_id,legal_version_id,cp_url,cp_raw_sha256,canonical_sha256,parser_version,amendment_url,amendment_raw_sha256,amendment_html,fetched_at,amendment_fetched_at,robots_sha256,fingerprint,status,reviewed_by_user_id,reviewed_at,approval_audit_id,approval_reference,human_review,metadata)
    values(${randomUUID()},17,${monitor.id},${text.id},${version.id},${CAMARA_CP_CORRECTION.url},${fresh.parsed.rawSha256},${fresh.parsed.canonicalSha256},${fresh.parsed.parserVersion},${CAMARA_CP_CORRECTION.amendmentUrl},${cpCorrectionSha256(fresh.amendment.bytes)},${new TextDecoder("utf-8",{fatal:true}).decode(fresh.amendment.bytes)},${fresh.body.fetchedAt.toISOString()}::timestamptz,${fresh.amendment.fetchedAt.toISOString()}::timestamptz,${cpCorrectionSha256(fresh.robots.bytes)},${expectedFingerprint},'approved',${actor.id},${timestamp}::timestamptz,${audit.id},${CP_CUT_REFERENCE},false,${jsonSql(metadata)})`);
  assertCpCutFresh(fresh.body.fetchedAt); assertCpCutFresh(fresh.amendment.fetchedAt);
  return { mode: "applied" as const, fingerprint: expectedFingerprint, versionId: version.id, monitorSnapshotId: monitor.publicId, textSnapshotId: text.publicId, auditId: audit.id, articles: 402, questionsCorrected: 5, bindingsCreated: 5, before: prepared.current.floors.filter(f => f.ready), after: after.filter(f => f.ready), humanReview: false, approvalReference: CP_CUT_REFERENCE };
}

/** A repeat requires the exact successful receipt and complete current state. Never repairs it. */
export async function verifyCompletedCpCut(tx: Executor, fresh: Fresh, expectedFingerprint: string) {
  const [record] = await tx.execute<{ id: number; versionId: number; metadata: Json; status: string; auditId: number; audit: Json }>(sql`select e.id::int as id,e.legal_version_id::int as "versionId",e.metadata,e.status,e.approval_audit_id::int as "auditId",to_jsonb(a) as audit from legal_cp_correction_evidence e join audit_logs a on a.id=e.approval_audit_id where e.fingerprint=${expectedFingerprint}`);
  if (!record) return null;
  const m = record.metadata;
  if (record.status !== "approved" || m.fingerprint !== expectedFingerprint || m.policy !== CP_CUT_POLICY || m.humanReview !== false || m.approvalReference !== CP_CUT_REFERENCE || cpCutFingerprint(record.audit.metadata) !== cpCutFingerprint(m) || record.audit.action !== "editorial.legal_cp.coordinated_cut" || object(record.audit.metadata).fingerprint !== expectedFingerprint || object(record.audit.metadata).humanReview !== false) throw new Error("Recibo existente divergente/suspenso; não restaurar.");
  const [source] = await tx.execute<{ sourceValid: boolean }>(sql`select coalesce(v.status='current' and v.legal_act_id=17 and v.source_url=${CAMARA_CP_CORRECTION.url} and v.checksum_sha256=${fresh.parsed.canonicalSha256} and s.status='approved' and t.status='approved' and s.legal_act_id=17 and t.legal_act_id=17 and t.monitor_snapshot_id=s.id and s.checksum_sha256=v.checksum_sha256 and t.checksum_sha256=v.checksum_sha256 and t.parser_version=${fresh.parsed.parserVersion},false) as "sourceValid" from legal_versions v join legal_source_snapshots s on s.id=${number(m.monitorId)} join legal_text_snapshots t on t.id=${number(m.textId)} where v.id=${record.versionId}`);
  const articles = await tx.execute<{ path: string; literal: string; status: string; rights: string }>(sql`select path,literal_text as literal,editorial_status as status,source_rights as rights from legal_articles where legal_version_id=${record.versionId} order by article_order`);
  if (!source?.sourceValid || articles.length !== 402 || articles.some((a,i) => a.path!==fresh.parsed.articles[i].path || a.literal!==fresh.parsed.articles[i].literalText || a.status!=="reviewed" || a.rights!=="official_text")) throw new Error("Corpus/fonte atual já difere do recibo; não reativar.");
  const corrections = m.corrections;
  if (!Array.isArray(corrections) || corrections.length !== 5) throw new Error("Recibo sem cinco correções.");
  for (const [index, value] of corrections.entries()) {
    const item = object(value), known = CP_CUT_ITEMS[index];
    if (item.questionId !== known[0] || item.oldBindingId !== known[2] || item.newContentHash !== known[4]) throw new Error("Manifesto das correções divergente.");
    const literal351=fresh.parsed.articles.find(a=>a.path==="art-351")!.literalText;
    const expectedQuote=cpCutReplacement(known[0],"Fonte: Código Penal, art. 351, corpus ID 3733, versão 63.",literal351).legalQuote;
    const [q] = await tx.execute<{ valid: boolean }>(sql`select coalesce(${approvedProductQuestionExists(sql`${CP_CUT_PRODUCT}`,sql`q.id`,sql`2`,sql`${string(item.newBindingId)}`)} and ${questionContractContentHash(sql`q.id`)}=${known[4]} and q.source_url=${CAMARA_CP_CORRECTION.url} and a.path='art-351' and b.legal_quote=${expectedQuote} and new_cert.contract_id=${CP_CUT_CONTRACT} and new_cert.approval_reference=${CP_CUT_REFERENCE} and not new_cert.human_review and b.legal_version_id=${record.versionId} and b.scope_notes=${CP_CUT_SCOPE_NOTE} and b.evidence->>'correctionOpinionHash'=${CP_CUT_OPINION_HASH} and b.evidence->'humanReview'='false'::jsonb and old.status='suspended' and old_cert.status='suspended',false) as valid from questions q join legal_articles a on a.id=q.legal_article_id join contest_product_question_bindings b on b.id=${string(item.newBindingId)} join question_contract_certifications new_cert on new_cert.binding_id=b.id join contest_product_question_bindings old on old.id=${known[2]} join question_contract_certifications old_cert on old_cert.binding_id=old.id where q.id=${known[0]}`);
    if (!q?.valid) throw new Error("Questão/vínculo/certificação posterior divergiu; sem reparo silencioso.");
  }
  const [old] = await tx.execute<{ status: string; checksum: string }>(sql`select status,checksum_sha256 as checksum from legal_versions where id=63`);
  const held = await tx.execute<{ id: number }>(sql`select id::int as id from legal_articles where legal_version_id=63 and editorial_status='suspended' order by id`);
  if (old?.status !== "superseded" || old.checksum !== CAMARA_CP_CORRECTION.oldVersionChecksum || JSON.stringify(held.map(a=>a.id))!==JSON.stringify([...CP63_EXPECTED_HELD_IDS].sort((a,b)=>a-b))) throw new Error("Histórico/suspensões63 divergentes.");
  const oldRows=await tx.execute<StoredCpCorrectionArticle>(sql`select id::int as id,legal_version_id::int as "versionId",path,article_order as "articleOrder",heading,literal_text as "literalText",source_rights as "sourceRights",editorial_status as "editorialStatus",0 as "questionCount",0 as "bindingCount",0 as "primaryRequirementCount",0 as "additionalRequirementCount" from legal_articles where legal_version_id=63 order by article_order`);
  if(oldRows.length!==423 || storedCpCorrectionFingerprint(oldRows)!==CAMARA_CP_CORRECTION.oldCorpusFingerprint) throw new Error("Literalidade/histórico integral63 foi alterado; não reparar automaticamente.");
  const requirementMapping=object(m.requirementMapping);
  const [requirementReceipt]=await tx.execute<{valid:boolean}>(sql`select coalesce(r.editorial_status='reviewed' and r.legal_act_id=17 and r.source_document_id=4 and r.source_snapshot_id=5 and a.path='art-351' and a.legal_version_id=${record.versionId}
    and r.reviewed_by_user_id=review.actor_user_id and r.reviewed_at=(review.metadata->>'reviewedAt')::timestamptz and r.review_notes=review.metadata->>'reviewNotes'
    and reopened.action='editorial.notice_requirement.reopened_for_cp_correction' and review.action='editorial.notice_requirement.reviewed'
    and reopened.entity_id='667' and review.entity_id='667' and reopened.metadata->>'fingerprint'=${expectedFingerprint} and review.metadata->>'fingerprint'=${expectedFingerprint}
    and reopened.metadata->>'statusBefore'='reviewed' and reopened.metadata->>'statusAfter'='pending_review'
    and review.metadata->>'statusBefore'='pending_review' and review.metadata->>'statusAfter'='reviewed'
    and reopened.metadata->'humanReview'='false'::jsonb and review.metadata->'humanReview'='false'::jsonb
    and review.metadata->>'approvalReference'=${CP_CUT_REFERENCE},false) as valid
    from opportunity_requirements r join legal_articles a on a.id=r.legal_article_id
    join audit_logs reopened on reopened.id=${number(requirementMapping.reopenAuditId)} join audit_logs review on review.id=${number(requirementMapping.reviewAuditId)} where r.id=667`);
  if(!requirementReceipt?.valid) throw new Error("Nova revisão do requisito667 não corresponde ao recibo; não restaurar.");
  const currentFloors = await floors(tx); assertCpCutFloors(currentFloors);
  assertCpCutFresh(fresh.body.fetchedAt); assertCpCutFresh(fresh.amendment.fetchedAt);
  return { mode: "unchanged" as const, fingerprint: expectedFingerprint, versionId: record.versionId, auditId: record.auditId, articles: 402, databaseWrites: 0, humanReview: false, after: currentFloors.filter(f=>f.ready) };
}
