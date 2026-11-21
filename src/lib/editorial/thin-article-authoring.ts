import { sql } from "drizzle-orm";
import { workPayloadSchema, type AgentWorkPayload, type WorkArticle } from "./agent-work-contract";
import { enqueueAgentWork, REQUIREMENT_CONTEXT_HASH_SQL, type AgentDatabase } from "./agent-work-queue";
import { currentQuestionContractExists } from "./question-contract-query";
import { THIN_ARTICLE_JOB_KEY_SQL_PATTERN, THIN_ARTICLE_POLICY, THIN_ARTICLE_TARGET_REVIEWED, thinArticleJobKey } from "./thin-article-job";

/**
 * Autoria por artigo "fino" (1 ou 2 questões revisadas com comentário; a página pública
 * do artigo exige 3). Decisão do proprietário em 21/11/2026: 1 tarefa por artigo, pedindo
 * 2–3 inéditas, com a MESMA linha de sempre: reserva com contrato vigente, validação do
 * contrato, originalidade, importação como rascunho e aprovação pela linha de liberação.
 *
 * A tarefa é a autoria do requisito (`author:<requisito>`) restrita a um artigo:
 * chave `author-thin:<requisito>:<artigo>`, payload igual ao da autoria do requisito, só
 * com `articles` = o artigo fino e instruções próprias. Nada do caminho de revisão muda.
 * Chave, teto e alvo ficam em ./thin-article-job (sem dependências: a fila os importa).
 */

/** Slug público da lei, igual a src/lib/seo/slugs.ts (branch feat/seo-organico): a lista da
 * onda 0 usa a URL `/lei/<lei>/<artigo>`. Só serve para casar a lista com o artigo. */
const POPULAR_LAW_SLUGS: Readonly<Record<string, string>> = {
  "constituicao-1988": "constituicao-federal",
  "decreto-lei-2848-1940": "codigo-penal",
  "decreto-lei-3689-1941": "codigo-de-processo-penal",
  "decreto-lei-5452-1943": "clt",
  "lei-10406-2002": "codigo-civil",
  "lei-13105-2015": "codigo-de-processo-civil",
  "lei-5172-1966": "codigo-tributario-nacional",
  "lei-8078-1990": "codigo-de-defesa-do-consumidor",
  "lei-4737-1965": "codigo-eleitoral",
};
export function thinArticlePublicPath(act: { slug: string; actType: string; actNumber: string | null; actYear: number | null }, articlePath: string) {
  let law = act.slug;
  const type = act.actType.trim().toLowerCase();
  const digits = (act.actNumber ?? "").replace(/\D/gu, "");
  const numeric = !act.actYear ? null : type === "constituicao" ? `constituicao-${act.actYear}`
    : digits && /^[a-z-]+$/u.test(type) ? `${type}-${digits}-${act.actYear}` : null;
  if (numeric) law = POPULAR_LAW_SLUGS[numeric] ?? numeric;
  return `/lei/${law}/${articlePath}`;
}

/** Lista da onda 0: uma URL por linha; comentários (#) e linhas vazias ignorados. */
export function parseWave0List(text: string) {
  return text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

export type ThinArticleRow = {
  articleId: number; reviewed: number; articlePath: string;
  actSlug: string; actType: string; actNumber: string | null; actYear: number | null;
  linked: boolean; live: boolean; requirements: number; forSaleRequirements: number;
  requirementId: number | null; authorKey: string | null; candidateForSale: boolean | null; candidateCovered: boolean | null;
  existingKey: string | null; existingStatus: string | null;
};
export type ThinArticleGroup = "wave0" | "forSale" | "others";
export type ThinArticlePlanItem = ThinArticleRow & { group: ThinArticleGroup; rank: number; publicPath: string; jobKey: string };

/**
 * Uma linha por artigo fino, com o melhor requisito alcançável: autoria `author:<id>` com
 * contrato vigente, mapa-pai preparado e o mesmo hash de contexto (as conferências da
 * preparação da autoria). O artigo chega ao requisito pela cobertura do edital
 * (opportunity_requirement_articles) ou por já estar nos artigos da autoria do requisito
 * (vindos do mapa do Guardião). Preferência: produto à venda, cobertura, menor id. Só leitura.
 * `existing`: uma tarefa por artigo, de qualquer requisito; só a substituída (contexto
 * mudou) libera outra.
 */
export function thinArticleCandidatesQuery() {
  return sql`with thin as materialized (
      select thin_question.legal_article_id id, count(*)::int reviewed
      from questions thin_question
      where thin_question.editorial_status = 'reviewed' and thin_question.legal_article_id is not null
        and coalesce(length(thin_question.explanation), 0) > 0
      group by thin_question.legal_article_id
      having count(*) between 1 and ${THIN_ARTICLE_TARGET_REVIEWED - 1}
    ), for_sale as materialized (
      select distinct sale.opportunity_id from contest_store_products sale
      where sale.status = 'released' and sale.opportunity_id is not null
    ), demand as materialized (
      select link.legal_article_id id, count(*)::int requirements,
        count(*) filter (where demand_requirement.opportunity_id in (select opportunity_id from for_sale))::int for_sale_requirements
      from opportunity_requirement_articles link
      join opportunity_requirements demand_requirement on demand_requirement.id = link.requirement_id
      where link.legal_article_id in (select id from thin) and demand_requirement.editorial_status <> 'suspended'
      group by link.legal_article_id
    ), article_requirement as materialized (
      select coverage.legal_article_id article_id, coverage.requirement_id, true covered
      from opportunity_requirement_articles coverage where coverage.legal_article_id in (select id from thin)
      union all
      select (payload_article->>'id')::bigint, split_part(author_link.job_key, ':', 2)::bigint, false
      from editorial_agent_work author_link
      cross join lateral jsonb_array_elements(author_link.payload->'articles') payload_article
      where author_link.kind = 'authoring' and author_link.job_key ~ '^author:[0-9]{1,18}$'
        and payload_article->>'id' ~ '^[0-9]{1,18}$' and (payload_article->>'id')::bigint in (select id from thin)
    ), article_link as materialized (
      select article_id, requirement_id, bool_or(covered) covered from article_requirement group by article_id, requirement_id
    ), candidate as materialized (
      select link.article_id, r.id requirement_id, author.job_key author_key, link.covered,
        (r.opportunity_id in (select opportunity_id from for_sale)) for_sale,
        row_number() over (partition by link.article_id
          order by (r.opportunity_id in (select opportunity_id from for_sale)) desc, link.covered desc, r.id) position
      from article_link link
      join opportunity_requirements r on r.id = link.requirement_id
      join contest_opportunities o on o.id = r.opportunity_id
      join opportunity_source_documents d on d.id = r.source_document_id
      join opportunity_document_snapshots s on s.id = r.source_snapshot_id
      join editorial_agent_work author on author.job_key = 'author:' || r.id::text and author.kind = 'authoring'
      join editorial_agent_work parent on parent.job_key = author.payload->>'parentKey'
        and parent.input_hash = author.payload->>'parentHash' and parent.status = 'prepared'
      where r.subject_id is not null and r.editorial_status in ('draft', 'pending_review', 'reviewed')
        and o.editorial_status = 'reviewed' and d.status = 'approved' and s.status = 'approved'
        and author.payload->>'requirementId' = r.id::text and author.payload->>'opportunityId' = r.opportunity_id::text
        and author.payload->>'bank' is not null and author.payload->>'role' is not null
        and author.payload->'context'->>'sourceContextHash' = ${REQUIREMENT_CONTEXT_HASH_SQL}
        and ${currentQuestionContractExists(sql`author.payload->>'questionContractId'`, sql`r.opportunity_id`)}
    ), existing as materialized (
      select distinct on (split_part(previous.job_key, ':', 3)::bigint)
        split_part(previous.job_key, ':', 3)::bigint article_id, previous.job_key, previous.status
      from editorial_agent_work previous
      where previous.kind = 'authoring' and previous.job_key ~ ${THIN_ARTICLE_JOB_KEY_SQL_PATTERN} and previous.status <> 'superseded'
      order by split_part(previous.job_key, ':', 3)::bigint, previous.updated_at desc, previous.job_key
    )
    select thin.id::int as "articleId", thin.reviewed, article.path as "articlePath",
      act.slug as "actSlug", act.act_type as "actType", act.act_number as "actNumber", act.act_year as "actYear",
      exists (select 1 from article_link any_link where any_link.article_id = thin.id) linked,
      (article.editorial_status = 'reviewed' and article.source_rights = 'official_text' and version.status = 'current'
        and act.is_active and (version.valid_from is null or version.valid_from <= current_date)
        and (version.valid_until is null or version.valid_until >= current_date)
        and length(article.literal_text) between 20 and 80000) live,
      coalesce(demand.requirements, 0) requirements, coalesce(demand.for_sale_requirements, 0) as "forSaleRequirements",
      candidate.requirement_id::int as "requirementId", candidate.author_key as "authorKey", candidate.for_sale as "candidateForSale",
      candidate.covered as "candidateCovered",
      existing.job_key as "existingKey", existing.status as "existingStatus"
    from thin
    join legal_articles article on article.id = thin.id
    join legal_versions version on version.id = article.legal_version_id
    join legal_acts act on act.id = version.legal_act_id
    left join demand on demand.id = thin.id
    left join candidate on candidate.article_id = thin.id and candidate.position = 1
    left join existing on existing.article_id = thin.id
    order by thin.id`;
}

const lawOfPath = (path: string) => path.split("/").slice(0, 3).join("/");

/** Plano puro: grupos e ordem e o que fica de fora. Ordem: onda 0 (na ordem da lista);
 * depois os que mais aparecem em requisitos de produtos à venda; nos empates, leis da
 * onda 0 primeiro. Artigo com tarefa viva/concluída não volta para a fila. */
export function planThinArticleJobs(rows: readonly ThinArticleRow[], wave0Paths: readonly string[]) {
  const waveOrder = new Map(wave0Paths.map((path, index) => [path, index]));
  const waveLaws = new Set(wave0Paths.map(lawOfPath));
  const skipped = { alreadyQueued: 0, alreadyQueuedByStatus: {} as Record<string, number> };
  const unreachable = { notLinked: 0, noCurrentContract: 0, articleNotLive: 0 };
  type Ranked = { item: ThinArticleRow & { group: ThinArticleGroup; publicPath: string }; waveIndex: number; waveLaw: boolean };
  const reachable: Ranked[] = [];
  for (const row of rows) {
    if (row.reviewed >= THIN_ARTICLE_TARGET_REVIEWED || row.reviewed < 1) continue;
    if (row.existingKey) {
      skipped.alreadyQueued++;
      const status = row.existingStatus ?? "unknown";
      skipped.alreadyQueuedByStatus[status] = (skipped.alreadyQueuedByStatus[status] ?? 0) + 1;
      continue;
    }
    if (!row.live) { unreachable.articleNotLive++; continue; }
    if (!row.linked) { unreachable.notLinked++; continue; }
    if (!row.requirementId || !row.authorKey) { unreachable.noCurrentContract++; continue; }
    const publicPath = thinArticlePublicPath({ slug: row.actSlug, actType: row.actType, actNumber: row.actNumber, actYear: row.actYear }, row.articlePath);
    const waveIndex = waveOrder.get(publicPath) ?? -1;
    const group: ThinArticleGroup = waveIndex >= 0 ? "wave0" : row.forSaleRequirements > 0 ? "forSale" : "others";
    reachable.push({ item: { ...row, group, publicPath }, waveIndex, waveLaw: waveLaws.has(lawOfPath(publicPath)) });
  }
  const groupOrder: Record<ThinArticleGroup, number> = { wave0: 0, forSale: 1, others: 2 };
  reachable.sort((a, b) => groupOrder[a.item.group] - groupOrder[b.item.group] || a.waveIndex - b.waveIndex ||
    b.item.forSaleRequirements - a.item.forSaleRequirements || b.item.requirements - a.item.requirements ||
    Number(b.waveLaw) - Number(a.waveLaw) || Number(b.item.candidateForSale) - Number(a.item.candidateForSale) ||
    a.item.articleId - b.item.articleId);
  const jobs: ThinArticlePlanItem[] = reachable.map(({ item }, index) => ({
    ...item, rank: index + 1, jobKey: thinArticleJobKey(item.requirementId!, item.articleId),
  }));
  const groups = { wave0: 0, forSale: 0, others: 0 };
  for (const job of jobs) groups[job.group]++;
  const detail = {
    inWave0Laws: reachable.filter((ranked) => ranked.waveLaw).length,
    viaCoverage: jobs.filter((job) => job.candidateCovered).length,
    viaAuthorPayloadOnly: jobs.filter((job) => !job.candidateCovered).length,
    requirementOfProductForSale: jobs.filter((job) => job.candidateForSale).length,
  };
  const unreachableTotal = unreachable.notLinked + unreachable.noCurrentContract + unreachable.articleNotLive;
  return { thinArticles: rows.filter((row) => row.reviewed >= 1 && row.reviewed < THIN_ARTICLE_TARGET_REVIEWED).length,
    groups, detail, unreachable: { total: unreachableTotal, ...unreachable }, skipped, jobs };
}

export const THIN_ARTICLE_INSTRUCTIONS = "Crie DUAS ou TRÊS questões originais (no máximo três) de literalidade/aplicação da lei, todas sobre o único artigo deste pacote, por banca E cargo deste pacote, com resposta única e justificativa de cada alternativa. O artigo já tem questões revisadas: context.thinArticle.existingPrompts lista os enunciados atuais; não repita, não parafraseie nem cubra o mesmo recorte; explore outros incisos, parágrafos, prazos, exceções ou competências do próprio texto. Use exatamente questionContract.format e questionContract.optionKeys; nunca inferir formato pelo nome da banca. C/E usa internamente A=Certo e B=Errado, preservando os códigos oficiais C/E no contrato. Fundamento somente no artigo versionado fornecido. Não consultar simulados/provas. Perfil interno, não material oficial da banca. Se o texto não sustentar duas questões novas e distintas, entregue só as que tiverem fundamento ou blocked com o motivo; nunca invente fundamento para atingir quantidade. São propostas para revisão editorial: publicationAllowed false. Não altere banco ou conteúdo público.";

/** Payload da autoria do requisito, restrito ao artigo fino. Mesmo formato e mesmas
 * referências (contrato, mapa-pai, hash de contexto): a conclusão revalida tudo igual. */
export function buildThinArticlePayload(author: AgentWorkPayload, article: WorkArticle,
  meta: { reviewed: number; rank: number; group: ThinArticleGroup; existingPrompts: readonly string[] }): AgentWorkPayload {
  const base = workPayloadSchema.parse(author);
  if (!base.questionContractId || !base.questionContract || !base.requirementId || !base.opportunityId || !base.parentKey || !base.parentHash) {
    throw new Error("Autoria do requisito sem contrato ou mapa-pai: artigo fino não enfileirado.");
  }
  const proposals = Array.isArray(base.context.mappingProposals) ? base.context.mappingProposals : [];
  return workPayloadSchema.parse({
    ...base,
    title: `${base.title} — ${article.act}, ${article.articleRef} (artigo com ${meta.reviewed} questão(ões))`.slice(0, 8_000),
    instructions: THIN_ARTICLE_INSTRUCTIONS,
    articles: [article],
    context: {
      ...base.context,
      mappingProposals: proposals.filter((item) => item && typeof item === "object" && (item as { articleId?: unknown }).articleId === article.id),
      thinArticle: {
        policy: THIN_ARTICLE_POLICY, articleId: article.id, reviewedQuestions: meta.reviewed,
        requestedQuestions: "2-3", targetReviewed: THIN_ARTICLE_TARGET_REVIEWED, group: meta.group, rank: meta.rank,
        existingPrompts: meta.existingPrompts.slice(0, 12).map((prompt) => prompt.slice(0, 600)),
      },
      humanReviewRequired: true,
    },
  });
}

/**
 * Enfileira (ou só simula, `dryRun`) as tarefas de artigo fino. Idempotente: artigo com
 * 3+ questões revisadas sai da consulta; artigo com tarefa não substituída é pulado.
 */
export async function enqueueThinArticleAuthoring(db: AgentDatabase,
  options: { dryRun: boolean; wave0Paths: readonly string[]; limit?: number }) {
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '120s'`);
    if (options.dryRun) await tx.execute(sql`set transaction read only`);
    return tx.execute<ThinArticleRow>(thinArticleCandidatesQuery());
  });
  const plan = planThinArticleJobs([...rows], options.wave0Paths);
  const selected = options.limit === undefined ? plan.jobs : plan.jobs.slice(0, options.limit);
  const summary = { thinArticles: plan.thinArticles, groups: plan.groups, detail: plan.detail, expectedJobs: plan.jobs.length,
    unreachable: plan.unreachable, skipped: plan.skipped, firstJobKeys: plan.jobs.slice(0, 20).map((job) => `${job.jobKey} (${job.group} ${job.publicPath})`) };
  if (options.dryRun) return { mode: "dry-run" as const, ...summary, enqueued: 0, unchanged: 0, failed: [] as string[] };
  let enqueued = 0, unchanged = 0;
  const failed: string[] = [];
  // Em ordem: created_at crescente vira a ordem de reserva entre as tarefas de artigo fino.
  for (const job of selected) {
    try {
      const [author] = await db.execute<{ payload: AgentWorkPayload }>(sql`select payload from editorial_agent_work
        where job_key = ${job.authorKey} and kind = 'authoring'`);
      const [article] = await db.execute<WorkArticle>(sql`select a.id::int id, l.short_title act, a.article_ref as "articleRef",
        v.id::int as "versionId", v.checksum_sha256 checksum, a.literal_text text, v.source_url url
        from legal_articles a join legal_versions v on v.id = a.legal_version_id join legal_acts l on l.id = v.legal_act_id
        where a.id = ${job.articleId}`);
      const prompts = await db.execute<{ prompt: string }>(sql`select prompt from questions
        where legal_article_id = ${job.articleId} and editorial_status in ('reviewed', 'draft', 'pending_review')
        order by (editorial_status = 'reviewed') desc, id limit 12`);
      if (!author || !article) { failed.push(job.jobKey); continue; }
      const payload = buildThinArticlePayload(author.payload, article,
        { reviewed: job.reviewed, rank: job.rank, group: job.group, existingPrompts: prompts.map((row) => row.prompt) });
      if (await enqueueAgentWork(db, job.jobKey, "authoring", payload)) enqueued++;
      else unchanged++;
    } catch {
      failed.push(job.jobKey);
    }
  }
  return { mode: "apply" as const, ...summary, enqueued, unchanged, failed };
}
