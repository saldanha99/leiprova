import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { approvedProductQuestionCount } from "../commerce/minimum-course-content";
import { approvedProductQuestionExists } from "../commerce/product-binding-query";
import { parseConsolidatedLegalArticles } from "../official-sources/legal-text";

/**
 * Transição de versão de lei sem tirar questão de produto no meio da troca (decisão do proprietário,
 * 23/11/2026). Numa transação serializável:
 * - aprova a fotografia de texto pendente (já conferida contra a recaptura oficial fora da transação),
 *   cria a versão nova e supera a antiga sem editar seus artigos;
 * - artigos com literal idêntico: vínculos e questões passam para o artigo novo no lugar (o certificado
 *   se liga ao vínculo e ao conteúdo da questão, que não mudam; `updated_at` da questão é preservado);
 * - artigos alterados: vínculos e certificados suspensos e questões de volta a `draft`, para a fila normal
 *   (aprovador da fábrica contra o texto novo e nova proposta de vínculo); as questões listadas em
 *   `retire` ficam `suspended`;
 * - requisitos não são editados (a revisão e o hash de contexto ficam intactos): o artigo novo entra como
 *   artigo adicional do requisito, que é o que o filtro da loja aceita.
 * Antes de gravar, confere por produto: depois = antes − questões dos artigos alterados válidas antes.
 */
export const LEGAL_VERSION_TRANSITION_POLICY = "legal-version-transition-v1";

type Db = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ids = (values: readonly number[]) => sql`(${sql.join((values.length ? values : [0]).map((v) => sql`${v}`), sql`,`)})`;

export type TransitionRequest = Readonly<{
  actSlug: string; textChecksum: string; actorId: number; approvalReference: string;
  retireQuestionIds: readonly number[]; mode: "preview" | "apply"; expectedFingerprint?: string;
}>;

export async function transitionLegalVersion(tx: Tx, request: TransitionRequest) {
  await tx.execute(sql`set local lock_timeout='10s'`);
  await tx.execute(sql`set local statement_timeout='300s'`);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('leiprova:legal-version-transition:v1',0))`);
  const [act] = await tx.execute<{ id: number; slug: string }>(sql`select id::int id, slug from legal_acts where slug=${request.actSlug} and is_active for update`);
  if (!act) throw new Error("Ato legal ativo não encontrado.");
  if (act.id === 17) throw new Error("Código Penal tem operador próprio (recibo da Câmara).");
  const versions = await tx.execute<{ id: number; checksum: string; url: string }>(sql`select id::int id, checksum_sha256 checksum, source_url url
    from legal_versions where legal_act_id=${act.id} and status='current' for update`);
  if (versions.length !== 1) throw new Error("Exige exatamente uma versão vigente.");
  const old = versions[0];
  const [text] = await tx.execute<{ id: number; publicId: string; monitorId: number; url: string; checksum: string; content: string; articleCount: number; parser: string; status: string }>(sql`
    select id::int id, public_id as "publicId", monitor_snapshot_id::int as "monitorId", source_url url, checksum_sha256 checksum,
      normalized_content content, article_count as "articleCount", parser_version parser, status
    from legal_text_snapshots where legal_act_id=${act.id} and checksum_sha256=${request.textChecksum} for update`);
  if (!text || text.status !== "pending_review") throw new Error("Fotografia de texto pendente com esse checksum não encontrada.");
  if (text.checksum === old.checksum) throw new Error("Texto idêntico à versão vigente; nada a transicionar.");
  const [monitor] = await tx.execute<{ id: number; status: string }>(sql`select id::int id, status from legal_source_snapshots where id=${text.monitorId} and legal_act_id=${act.id} for update`);
  if (!monitor || !["pending_review", "approved"].includes(monitor.status)) throw new Error("Fotografia de monitoramento da captura inválida.");

  const fresh = parseConsolidatedLegalArticles(text.content);
  if (fresh.length !== text.articleCount || !fresh.length) throw new Error("Contagem de artigos da captura diverge do parser.");
  const oldArticles = await tx.execute<{ id: number; path: string; literal: string }>(sql`select id::int id, path, literal_text literal
    from legal_articles where legal_version_id=${old.id} order by article_order`);
  const freshByPath = new Map(fresh.map((a) => [a.path, a]));
  const unchanged = oldArticles.filter((a) => freshByPath.get(a.path)?.literalText === a.literal);
  const changed = oldArticles.filter((a) => freshByPath.has(a.path) && freshByPath.get(a.path)!.literalText !== a.literal);
  const removed = oldArticles.filter((a) => !freshByPath.has(a.path));
  const added = fresh.filter((a) => !oldArticles.some((o) => o.path === a.path)).map((a) => a.path);

  const removedRefs = await tx.execute<{ n: number }>(sql`select (
      (select count(*) from questions where legal_article_id in ${ids(removed.map((a) => a.id))}) +
      (select count(*) from contest_product_question_bindings where legal_article_id in ${ids(removed.map((a) => a.id))} and status in ('approved','pending_review')) +
      (select count(*) from opportunity_requirements where legal_article_id in ${ids(removed.map((a) => a.id))}) +
      (select count(*) from opportunity_requirement_articles where legal_article_id in ${ids(removed.map((a) => a.id))}))::int n`);
  if (removedRefs[0].n !== 0) throw new Error("Artigo removido com dependências; exige decisão editorial própria.");

  const changedIds = changed.map((a) => a.id);
  const changedQuestions = await tx.execute<{ id: number; status: string }>(sql`select id::int id, editorial_status status from questions
    where legal_article_id in ${ids(changedIds)} order by id for update`);
  const retire = [...new Set(request.retireQuestionIds)].sort((a, b) => a - b);
  if (retire.some((id) => !changedQuestions.some((q) => q.id === id))) throw new Error("Questão a retirar fora dos artigos alterados.");

  const products = await tx.execute<{ slug: string; opportunityId: number }>(sql`select slug, opportunity_id::int as "opportunityId"
    from contest_store_products where status='released' order by slug`);
  const countAll = async () => tx.execute<{ slug: string; count: number }>(sql`select p.slug, ${approvedProductQuestionCount(sql`p.slug`, sql`p.opportunity_id`)} as count
    from contest_store_products p where p.status='released' order by p.slug`);
  const before = await countAll();
  const changedValid = await tx.execute<{ slug: string; count: number }>(sql`select p.slug, (select count(*)::int from questions q
      where q.id in ${ids(changedQuestions.map((q) => q.id))} and ${approvedProductQuestionExists(sql`p.slug`, sql`q.id`, sql`p.opportunity_id`)}) as count
    from contest_store_products p where p.status='released' order by p.slug`);
  const [refs] = await tx.execute<{ bindings: number; questions: number; requirements: number }>(sql`select
    (select count(*)::int from contest_product_question_bindings where legal_article_id in ${ids(unchanged.map((a) => a.id))} and status in ('approved','pending_review')) bindings,
    (select count(*)::int from questions where legal_article_id in ${ids(unchanged.map((a) => a.id))}) questions,
    (select count(distinct r.id)::int from opportunity_requirements r where r.legal_article_id in ${ids(oldArticles.map((a) => a.id))}
      or exists (select 1 from opportunity_requirement_articles ra where ra.requirement_id=r.id and ra.legal_article_id in ${ids(oldArticles.map((a) => a.id))})) requirements`);

  const plan = { policy: LEGAL_VERSION_TRANSITION_POLICY, act: act.slug, oldVersion: old, textSnapshot: { id: text.id, publicId: text.publicId, checksum: text.checksum, url: text.url, articles: fresh.length },
    unchanged: unchanged.length, changed: changed.map((a) => a.path), added, removed: removed.map((a) => a.path), changedQuestions: changedQuestions.map((q) => q.id),
    retire, rebind: refs, approvalReference: request.approvalReference };
  const fingerprint = digest({ plan, before, changedValid, actorId: request.actorId });
  const expectedAfter = before.map((row, i) => ({ slug: row.slug, count: row.count - changedValid[i].count }));
  if (request.mode === "preview") return { mode: "preview" as const, fingerprint, plan, before, expectedAfter };
  if (request.expectedFingerprint !== fingerprint) throw new Error("Contexto mudou desde a prévia; nada gravado.");

  const now = new Date().toISOString();
  const notes = `${LEGAL_VERSION_TRANSITION_POLICY}; ${request.approvalReference}; texto ${text.checksum.slice(0, 12)} recapturado e idêntico; humanReview:false.`;
  if (monitor.status === "pending_review") {
    await tx.execute(sql`update legal_source_snapshots set status='superseded' where legal_act_id=${act.id} and status='approved' and id<>${monitor.id}`);
    await tx.execute(sql`update legal_source_snapshots set status='approved', reviewed_by_user_id=${request.actorId}, reviewed_at=${now}::timestamptz, review_notes=${notes} where id=${monitor.id}`);
  }
  await tx.execute(sql`update legal_text_snapshots set status='superseded', updated_at=${now}::timestamptz where legal_act_id=${act.id} and status='approved' and id<>${text.id}`);
  await tx.execute(sql`update legal_text_snapshots set status='approved', reviewed_by_user_id=${request.actorId}, reviewed_at=${now}::timestamptz, review_notes=${notes}, updated_at=${now}::timestamptz where id=${text.id}`);
  await tx.execute(sql`update legal_versions set status='superseded' where id=${old.id}`);
  const [version] = await tx.execute<{ id: number }>(sql`insert into legal_versions (legal_act_id, source_url, checksum_sha256, verified_at, status)
    values (${act.id}, ${text.url}, ${text.checksum}, ${now}::timestamptz, 'current') returning id::int id`);
  const newIdByPath = new Map<string, number>();
  for (let offset = 0; offset < fresh.length; offset += 200) {
    const rows = await tx.insert(schema.legalArticles).values(fresh.slice(offset, offset + 200).map((a, i) => ({
      legalVersionId: version.id, articleRef: a.articleRef, articleOrder: offset + i + 1, heading: a.heading, path: a.path,
      literalText: a.literalText, editorialStatus: "reviewed" as const, sourceRights: "official_text" as const,
    }))).returning({ id: schema.legalArticles.id, path: schema.legalArticles.path });
    for (const row of rows) newIdByPath.set(row.path, Number(row.id));
  }
  const pairs = [...unchanged, ...changed].map((a) => ({ oldId: a.id, newId: newIdByPath.get(a.path)!, unchanged: unchanged.includes(a) }));
  const mapping = sql`(values ${sql.join(pairs.map((p) => sql`(${p.oldId}::bigint, ${p.newId}::bigint, ${p.unchanged})`), sql`,`)}) as m(old_id, new_id, unchanged)`;
  // Requisitos: artigo novo como adicional, sem editar o requisito revisado.
  await tx.execute(sql`insert into opportunity_requirement_articles (requirement_id, legal_article_id, created_at)
    select distinct r.id, m.new_id, ${now}::timestamptz from ${mapping}
    join opportunity_requirements r on r.legal_article_id=m.old_id or exists (select 1 from opportunity_requirement_articles ra where ra.requirement_id=r.id and ra.legal_article_id=m.old_id)
    on conflict do nothing`);
  // Artigos sem mudança: religação no lugar.
  const rebound = await tx.execute<{ id: string }>(sql`update contest_product_question_bindings b set legal_article_id=m.new_id, legal_version_id=${version.id},
      legal_version_checksum=${text.checksum}, evidence=jsonb_set(b.evidence, '{legalSourceUrl}', to_jsonb(${text.url}::text)), updated_at=${now}::timestamptz
    from ${mapping} where m.unchanged and b.legal_article_id=m.old_id and b.status in ('approved','pending_review') returning b.id`);
  const movedQuestions = await tx.execute<{ id: number }>(sql`update questions q set legal_article_id=m.new_id, updated_at=q.updated_at
    from ${mapping} where m.unchanged and q.legal_article_id=m.old_id returning q.id::int id`);
  // Artigos alterados: suspende vínculo/certificado e manda a questão para a fila normal.
  const suspended = await tx.execute<{ id: string }>(sql`update contest_product_question_bindings b set status='suspended', updated_at=${now}::timestamptz,
      reviewed_by_user_id=coalesce(b.reviewed_by_user_id, ${request.actorId}), reviewed_at=coalesce(b.reviewed_at, ${now}::timestamptz),
      review_notes=${`${notes} Artigo alterado pela nova redação; questão devolvida à fila de revisão.`}
    from ${mapping} where not m.unchanged and b.legal_article_id=m.old_id and b.status in ('approved','pending_review') returning b.id`);
  if (suspended.length) await tx.execute(sql`update question_contract_certifications set status='suspended'
    where binding_id in (${sql.join(suspended.map((b) => sql`${b.id}`), sql`,`)}) and status='approved'`);
  // A fila normal (aprovador da fábrica) só pega rascunho sem autor registrado: a questão volta ao estado de
  // rascunho importado e é reavaliada contra o texto vigente; as retiradas ficam suspensas com a proveniência.
  const reopenToQueue = sql`q.id not in ${ids(retire)} and q.editorial_status in ('reviewed','draft')`;
  const reopened = await tx.execute<{ id: number; status: string }>(sql`update questions q set legal_article_id=m.new_id,
      editorial_status=case when q.id in ${ids(retire)} then 'suspended' when q.editorial_status='reviewed' then 'draft' else q.editorial_status end,
      created_by_user_id=case when ${reopenToQueue} then null else q.created_by_user_id end,
      reviewed_by_user_id=case when ${reopenToQueue} then null else q.reviewed_by_user_id end,
      clean_room_attested_at=case when ${reopenToQueue} then null else q.clean_room_attested_at end,
      submitted_at=case when ${reopenToQueue} then null else q.submitted_at end,
      review_notes=${`${notes} Artigo alterado; revisão contra o texto vigente.`}, updated_at=${now}::timestamptz
    from ${mapping} where not m.unchanged and q.legal_article_id=m.old_id returning q.id::int id, q.editorial_status status`);

  const after = await countAll();
  const mismatch = after.filter((row, i) => row.slug !== expectedAfter[i].slug || row.count !== expectedAfter[i].count);
  if (mismatch.length) throw new Error(`Contagem por produto diverge do esperado (${mismatch.map((m) => m.slug).join(", ")}); revertido.`);
  const [orphans] = await tx.execute<{ n: number }>(sql`select (
      (select count(*) from contest_product_question_bindings where legal_version_id=${old.id} and status in ('approved','pending_review')) +
      (select count(*) from questions q join legal_articles a on a.id=q.legal_article_id where a.legal_version_id=${old.id}))::int n`);
  if (orphans.n !== 0) throw new Error("Restaram vínculos ou questões na versão superada; revertido.");
  const summary = { ...plan, newVersionId: version.id, reboundBindings: rebound.length, movedQuestions: movedQuestions.length, suspendedBindings: suspended.length,
    reopenedQuestions: reopened.filter((q) => q.status === "draft").length, retiredQuestions: reopened.filter((q) => q.status === "suspended" && retire.includes(q.id)).length,
    before, after, products: products.length, humanReview: false };
  const [audit] = await tx.insert(schema.auditLogs).values({ actorUserId: request.actorId, action: "editorial.legal_version.transitioned",
    entityType: "legal_version", entityId: String(version.id), metadata: { ...summary, fingerprint, operationId: randomUUID() } }).returning({ id: schema.auditLogs.id });
  return { mode: "applied" as const, fingerprint, auditId: Number(audit.id), ...summary };
}
