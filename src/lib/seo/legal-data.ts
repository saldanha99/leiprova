import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { cleanStudentFacingText } from "@/lib/editorial/student-facing-text";

import { staleWhileRevalidate } from "@/lib/commerce/stale-while-revalidate";
import { catalogContestPath, contestTitle, getCatalogContest } from "@/lib/commerce/catalog";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import { getDb } from "@/lib/db/client";
import {
  contestStoreProducts,
  legalActs,
  legalArticles,
  legalVersions,
  opportunityRequirementArticles,
  opportunityRequirements,
  questionOptions,
  questions,
  quizBanks,
} from "@/lib/db/schema";
import type { ArticleGatePolicy } from "@/lib/seo/gates";
import {
  type LawRow,
  type LawSnapshot,
  type OptionRow,
  type QuestionRow,
  PUBLIC_QUESTIONS_PER_ARTICLE,
  buildLawSnapshot,
} from "@/lib/seo/legal-snapshot";
import { STATIC_LAW_ALIASES, canonicalLawSlug, lawSlugAliases } from "@/lib/seo/slugs";

/** Law/article data changes a few times a day; pages tolerate 10 minutes. */
const CACHE_TTL_MS = 10 * 60_000;

export function articleGatePolicy(): ArticleGatePolicy {
  return { requireDirectAnswer: process.env.SEO_DIRECT_ANSWER_REQUIRED?.trim() !== "0" };
}

export type LawSummary = LawRow &
  Readonly<{ slug: string; aliases: readonly string[]; productCount: number }>;

async function loadLawRows(): Promise<LawSummary[]> {
  const db = getDb();
  const rows = await db
    .selectDistinctOn([legalActs.id], {
      id: legalActs.id,
      slug: legalActs.slug,
      title: legalActs.title,
      shortTitle: legalActs.shortTitle,
      actType: legalActs.actType,
      actNumber: legalActs.actNumber,
      actYear: legalActs.actYear,
      officialUrl: legalActs.officialUrl,
      versionId: legalVersions.id,
      versionSourceUrl: legalVersions.sourceUrl,
      versionVerifiedAt: legalVersions.verifiedAt,
      versionChecksum: legalVersions.checksumSha256,
    })
    .from(legalActs)
    .innerJoin(legalVersions, eq(legalVersions.legalActId, legalActs.id))
    .where(and(eq(legalActs.isActive, true), eq(legalVersions.status, "current")))
    .orderBy(legalActs.id, desc(legalVersions.verifiedAt));

  // Products (contest store entries) whose reviewed programme requires the law.
  const counts = await db.execute<{ act_id: number; products: number }>(sql`
    select coalesce(v.legal_act_id, r.legal_act_id)::bigint as act_id,
           count(distinct p.slug)::int as products
    from ${opportunityRequirements} r
    join ${contestStoreProducts} p on p.opportunity_id = r.opportunity_id
    left join ${opportunityRequirementArticles} ra on ra.requirement_id = r.id
    left join ${legalArticles} a on a.id = ra.legal_article_id
    left join ${legalVersions} v on v.id = a.legal_version_id
    where r.editorial_status = 'reviewed'
    group by 1`);
  const productsByAct = new Map(counts.map((row) => [Number(row.act_id), Number(row.products)]));

  return rows
    .map((row) => ({
      ...row,
      slug: canonicalLawSlug(row),
      aliases: lawSlugAliases(row),
      productCount: productsByAct.get(row.id) ?? 0,
    }))
    .toSorted((a, b) => b.productCount - a.productCount || a.shortTitle.localeCompare(b.shortTitle, "pt-BR"));
}

const lawRowsCache = staleWhileRevalidate(loadLawRows, CACHE_TTL_MS);

export async function listLaws(): Promise<LawSummary[]> {
  return lawRowsCache();
}

export type LawLookup =
  | Readonly<{ kind: "found"; law: LawSummary }>
  | Readonly<{ kind: "redirect"; slug: string }>
  | Readonly<{ kind: "missing" }>;

export async function findLaw(requestedSlug: string): Promise<LawLookup> {
  const slug = STATIC_LAW_ALIASES[requestedSlug] ?? requestedSlug;
  const laws = await listLaws();
  const exact = laws.find((law) => law.slug === slug);
  if (exact) return slug === requestedSlug ? { kind: "found", law: exact } : { kind: "redirect", slug };
  const aliased = laws.find((law) => law.aliases.includes(requestedSlug));
  return aliased ? { kind: "redirect", slug: aliased.slug } : { kind: "missing" };
}

async function loadQuestions(versionId: number) {
  const db = getDb();
  const ranked = db.$with("ranked").as(
    db
      .select({
        id: questions.id,
        articleId: sql<number>`${questions.legalArticleId}`.as("article_id"),
        total: sql<number>`count(*) over (partition by ${questions.legalArticleId})::int`.as("total"),
        position: sql<number>`row_number() over (
          partition by ${questions.legalArticleId}
          order by length(${questions.explanation}) desc, ${questions.id})::int`.as("position"),
      })
      .from(questions)
      .innerJoin(legalArticles, eq(legalArticles.id, questions.legalArticleId))
      .where(
        and(
          eq(legalArticles.legalVersionId, versionId),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(questions.editorialStatus, "reviewed"),
          sql`length(btrim(${questions.explanation})) > 0`,
        ),
      ),
  );
  const rankedRows = await db.with(ranked).select().from(ranked);
  const questionCounts = new Map<number, number>();
  const publicIds: number[] = [];
  for (const row of rankedRows) {
    questionCounts.set(Number(row.articleId), Number(row.total));
    if (Number(row.position) <= PUBLIC_QUESTIONS_PER_ARTICLE * 2) publicIds.push(Number(row.id));
  }
  if (publicIds.length === 0) return { questionCounts, questions: [] as QuestionRow[] };

  // Only original questions are public: licensed items stay inside the product
  // until a licence explicitly covers public web display.
  const rows = await db
    .select({
      id: questions.id,
      publicId: questions.publicId,
      articleId: questions.legalArticleId,
      type: questions.type,
      prompt: questions.prompt,
      explanation: questions.explanation,
      sourceRights: questions.sourceRights,
      styleBankName: quizBanks.name,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .leftJoin(quizBanks, eq(quizBanks.id, questions.styleBankId))
    .where(
      and(
        inArray(questions.id, publicIds),
        eq(questions.sourceRights, "original_authorial"),
        inArray(questions.type, ["multiple_choice", "true_false"]),
      ),
    )
    .orderBy(asc(questions.legalArticleId), desc(sql`length(${questions.explanation})`), asc(questions.id));
  const options = await db
    .select({
      questionId: questionOptions.questionId,
      key: questionOptions.optionKey,
      text: questionOptions.text,
      isCorrect: questionOptions.isCorrect,
      rationale: questionOptions.rationale,
    })
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, rows.map((row) => row.id)))
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder));
  const optionsByQuestion = new Map<number, OptionRow[]>();
  for (const option of options) {
    const list = optionsByQuestion.get(option.questionId) ?? [];
    list.push({
      key: option.key,
      text: option.text,
      isCorrect: option.isCorrect,
      rationale: option.rationale === null ? null : cleanStudentFacingText(option.rationale),
    });
    optionsByQuestion.set(option.questionId, list);
  }

  const result: QuestionRow[] = rows.flatMap((row) =>
    row.articleId === null || (row.type !== "multiple_choice" && row.type !== "true_false")
      ? []
      : [
          {
            id: row.id,
            publicId: row.publicId,
            articleId: row.articleId,
            type: row.type,
            prompt: row.prompt,
            // Sem referência interna do motor ("artigo 6008, versão 65"); o banco não muda.
            explanation: cleanStudentFacingText(row.explanation),
            sourceRights: "original_authorial" as const,
            styleBankName: row.styleBankName,
            licensedBankName: null,
            licensedExamYear: null,
            updatedAt: row.updatedAt,
            options: optionsByQuestion.get(row.id) ?? [],
          },
        ],
  );
  return { questionCounts, questions: result };
}

/** Uncached build; scripts pass an explicit policy (e.g. wave selection). */
export async function loadSnapshot(law: LawSummary, policy: ArticleGatePolicy = articleGatePolicy()): Promise<LawSnapshot> {
  const articles = await getDb()
    .select({
      id: legalArticles.id,
      articleRef: legalArticles.articleRef,
      articleOrder: legalArticles.articleOrder,
      heading: legalArticles.heading,
      path: legalArticles.path,
      literalText: legalArticles.literalText,
      editorialStatus: legalArticles.editorialStatus,
      updatedAt: legalArticles.updatedAt,
    })
    .from(legalArticles)
    .where(eq(legalArticles.legalVersionId, law.versionId))
    .orderBy(asc(legalArticles.articleOrder));
  const { questionCounts, questions: questionRows } = await loadQuestions(law.versionId);
  return buildLawSnapshot({
    law,
    articles,
    questionCounts,
    questions: questionRows,
    // No authored, reviewed direct-answer text exists in the database yet.
    directAnswers: new Map(),
    policy,
  });
}

const snapshotCaches = new Map<number, () => Promise<LawSnapshot>>();

export async function getLawSnapshot(law: LawSummary): Promise<LawSnapshot> {
  const key = law.versionId;
  let loader = snapshotCaches.get(key);
  if (!loader) {
    loader = staleWhileRevalidate(() => loadSnapshot(law), CACHE_TTL_MS);
    snapshotCaches.set(key, loader);
  }
  return loader();
}

export async function listLawSnapshots(): Promise<LawSnapshot[]> {
  const laws = await listLaws();
  const snapshots: LawSnapshot[] = [];
  // Sequential on purpose: keeps the pool and the shared database calm.
  for (const law of laws) snapshots.push(await getLawSnapshot(law));
  return snapshots;
}

export type ContestLink = Readonly<{ path: string; title: string }>;

/**
 * Released contest product pages whose reviewed programme requires each article
 * (`opportunity_requirements.legal_article_id` or the extra articles table).
 */
export async function loadArticleContestLinks(versionId: number): Promise<Map<number, ContestLink[]>> {
  const db = getDb();
  const [direct, extra, products] = await Promise.all([
    db
      .select({ articleId: opportunityRequirements.legalArticleId, opportunityId: opportunityRequirements.opportunityId })
      .from(opportunityRequirements)
      .innerJoin(legalArticles, eq(legalArticles.id, opportunityRequirements.legalArticleId))
      .where(
        and(
          eq(opportunityRequirements.editorialStatus, "reviewed"),
          isNotNull(opportunityRequirements.legalArticleId),
          eq(legalArticles.legalVersionId, versionId),
        ),
      ),
    db
      .select({ articleId: opportunityRequirementArticles.legalArticleId, opportunityId: opportunityRequirements.opportunityId })
      .from(opportunityRequirementArticles)
      .innerJoin(opportunityRequirements, eq(opportunityRequirements.id, opportunityRequirementArticles.requirementId))
      .innerJoin(legalArticles, eq(legalArticles.id, opportunityRequirementArticles.legalArticleId))
      .where(and(eq(opportunityRequirements.editorialStatus, "reviewed"), eq(legalArticles.legalVersionId, versionId))),
    releasedContestLinks(),
  ]);
  const result = new Map<number, ContestLink[]>();
  for (const row of [...direct, ...extra]) {
    if (row.articleId === null) continue;
    const links = products.get(row.opportunityId) ?? [];
    const list = result.get(row.articleId) ?? [];
    for (const link of links) if (!list.some((item) => item.path === link.path)) list.push(link);
    result.set(row.articleId, list);
  }
  return result;
}

/** Released product pages that require a law, ordered by title. */
export async function loadLawContestLinks(actId: number): Promise<ContestLink[]> {
  const db = getDb();
  const [rows, products] = await Promise.all([
    db
      .selectDistinct({ opportunityId: opportunityRequirements.opportunityId })
      .from(opportunityRequirements)
      .leftJoin(opportunityRequirementArticles, eq(opportunityRequirementArticles.requirementId, opportunityRequirements.id))
      .leftJoin(legalArticles, eq(legalArticles.id, opportunityRequirementArticles.legalArticleId))
      .leftJoin(legalVersions, eq(legalVersions.id, legalArticles.legalVersionId))
      .where(
        and(
          eq(opportunityRequirements.editorialStatus, "reviewed"),
          or(eq(opportunityRequirements.legalActId, actId), eq(legalVersions.legalActId, actId)),
        ),
      ),
    releasedContestLinks(),
  ]);
  const links = new Map<string, ContestLink>();
  for (const row of rows) for (const link of products.get(row.opportunityId) ?? []) links.set(link.path, link);
  return [...links.values()].toSorted((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

async function releasedContestLinks(): Promise<Map<number, ContestLink[]>> {
  const products = await listReleasedContestProducts();
  const result = new Map<number, ContestLink[]>();
  for (const product of products) {
    const contest = getCatalogContest(product.slug);
    if (!contest || product.opportunityId === null) continue;
    const list = result.get(product.opportunityId) ?? [];
    list.push({ path: catalogContestPath(contest), title: contestTitle(contest) });
    result.set(product.opportunityId, list);
  }
  return result;
}
