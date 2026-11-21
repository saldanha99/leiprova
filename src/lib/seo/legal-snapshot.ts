import { createHash } from "node:crypto";

import {
  type ArticleGatePolicy,
  type GateDecision,
  countWords,
  evaluateArticleGate,
  evaluateLawGate,
  maxSimilarities,
} from "@/lib/seo/gates";
import {
  type LawIdentity,
  articlePagePath,
  canonicalLawSlug,
  lawPagePath,
  lawShortLabel,
  lawSlugAliases,
} from "@/lib/seo/slugs";

/**
 * Pure assembly of a law and its article pages from database rows: public
 * questions (D4), "cai assim" items, own text, similarity, gates, links and
 * content hash. The data layer (`legal-data.ts`) only fetches rows.
 */

export const PUBLIC_QUESTIONS_PER_ARTICLE = 5;
export const MAX_TRAP_ITEMS = 4;
export const TOP_ARTICLES_PER_LAW = 10;
const RELATED_PER_ARTICLE = 4;

export type LawRow = LawIdentity &
  Readonly<{
    id: number;
    title: string;
    shortTitle: string;
    officialUrl: string;
    versionId: number;
    versionSourceUrl: string;
    versionVerifiedAt: Date;
    versionChecksum: string;
  }>;

export type ArticleRow = Readonly<{
  id: number;
  articleRef: string;
  articleOrder: number;
  heading: string | null;
  path: string;
  literalText: string;
  editorialStatus: string;
  updatedAt: Date;
}>;

export type OptionRow = Readonly<{
  key: string;
  text: string;
  isCorrect: boolean;
  rationale: string | null;
}>;

export type QuestionRow = Readonly<{
  id: number;
  publicId: string;
  articleId: number;
  type: "multiple_choice" | "true_false";
  prompt: string;
  explanation: string;
  sourceRights: "original_authorial" | "licensed";
  styleBankName: string | null;
  licensedBankName: string | null;
  licensedExamYear: number | null;
  updatedAt: Date;
  options: readonly OptionRow[];
}>;

export type QuestionOrigin = Readonly<{ kind: "original" | "licensed"; label: string }>;

/** Honest origin label (spec 2.4 item 7): never "questão da {banca}" for an original. */
export function questionOriginLabel(
  question: Pick<QuestionRow, "sourceRights" | "styleBankName" | "licensedBankName" | "licensedExamYear">,
): QuestionOrigin {
  if (question.sourceRights === "licensed") {
    const details = [question.licensedBankName, question.licensedExamYear].filter(Boolean).join(", ");
    return {
      kind: "licensed",
      label: details ? `Questão de prova anterior licenciada (${details})` : "Questão de prova anterior licenciada",
    };
  }
  return {
    kind: "original",
    label: question.styleBankName ? `Inédita no estilo ${question.styleBankName}` : "Inédita do Edital Lei Seca",
  };
}

export type PublicQuestion = QuestionRow &
  Readonly<{ anchorId: string; origin: QuestionOrigin; correct: OptionRow | null }>;

export type TrapItem = Readonly<{ statement: string; why: string; questionAnchorId: string }>;

/** "Cai assim na prova": wrong statements taken from our reviewed questions. */
export function trapItems(questions: readonly PublicQuestion[]): TrapItem[] {
  const items: TrapItem[] = [];
  for (const question of questions) {
    if (items.length >= MAX_TRAP_ITEMS) break;
    if (question.type === "true_false") {
      const correct = question.correct?.text.trim().toLowerCase();
      if (correct === "errado") {
        items.push({ statement: question.prompt, why: question.explanation, questionAnchorId: question.anchorId });
      }
      continue;
    }
    const wrong = question.options.find((option) => !option.isCorrect && option.rationale?.trim());
    if (wrong?.rationale) {
      items.push({ statement: wrong.text, why: wrong.rationale, questionAnchorId: question.anchorId });
    }
  }
  return items;
}

/** Own text of an article page (T0 definition): statements, comments, rationales. */
export function ownText(questions: readonly QuestionRow[]): string {
  return questions
    .map((question) =>
      [question.prompt, question.explanation, ...question.options.map((option) => option.rationale ?? "")].join(" "),
    )
    .join(" ");
}

export function contentHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** "CAPÍTULO I · DOS DEVERES" → "Dos deveres" (last structural label, sentence case). */
export function headingLabel(heading: string | null): string | null {
  const last = heading?.split("·").pop()?.trim();
  if (!last) return null;
  const lower = last.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

/** "Art. 5º" → "Art. 5º"; trims a trailing period. */
function articleLabel(row: ArticleRow): string {
  return row.articleRef.replace(/\.$/, "").trim();
}

export type ArticleLink = Readonly<{ path: string; label: string; heading: string | null }>;

export type ArticlePage = Readonly<{
  id: number;
  path: string;
  label: string;
  heading: string | null;
  articleOrder: number;
  literalText: string;
  reviewedQuestionCount: number;
  publicQuestions: readonly PublicQuestion[];
  traps: readonly TrapItem[];
  ownWords: number;
  maxSimilarity: number;
  inboundLinks: number;
  directAnswer: string | null;
  gate: GateDecision;
  previous: ArticleLink | null;
  next: ArticleLink | null;
  related: readonly ArticleLink[];
  contentHash: string;
  contentDate: Date;
}>;

export type LawSnapshot = Readonly<{
  law: LawRow;
  slug: string;
  aliases: readonly string[];
  path: string;
  label: string;
  articles: readonly ArticlePage[];
  /** Reviewed articles only, by order (table of contents). */
  bySegment: ReadonlyMap<string, ArticlePage>;
  topArticles: readonly ArticlePage[];
  reviewedQuestionCount: number;
  gate: GateDecision;
  contentHash: string;
  contentDate: Date;
}>;

export type SnapshotInput = Readonly<{
  law: LawRow;
  articles: readonly ArticleRow[];
  /** Reviewed questions with a comment, per article id. */
  questionCounts: ReadonlyMap<number, number>;
  /** Already ordered by preference; at most PUBLIC_QUESTIONS_PER_ARTICLE are used. */
  questions: readonly QuestionRow[];
  /** Authored, reviewed direct answers per article id (none exist yet). */
  directAnswers: ReadonlyMap<number, string>;
  policy: ArticleGatePolicy;
}>;

const linkOf = (page: { path: string; label: string; heading: string | null }): ArticleLink => ({
  path: page.path,
  label: page.label,
  heading: page.heading,
});

export function buildLawSnapshot(input: SnapshotInput): LawSnapshot {
  const slug = canonicalLawSlug(input.law);
  const label = lawShortLabel(input.law);
  const reviewed = input.articles
    .filter((article) => article.editorialStatus === "reviewed")
    .toSorted((a, b) => a.articleOrder - b.articleOrder);

  const questionsByArticle = new Map<number, PublicQuestion[]>();
  for (const question of input.questions) {
    const list = questionsByArticle.get(question.articleId) ?? [];
    if (list.length >= PUBLIC_QUESTIONS_PER_ARTICLE) continue;
    list.push({
      ...question,
      anchorId: `questao-${question.publicId}`,
      origin: questionOriginLabel(question),
      correct: question.options.find((option) => option.isCorrect) ?? null,
    });
    questionsByArticle.set(question.articleId, list);
  }

  const base = reviewed.map((article) => {
    const publicQuestions = questionsByArticle.get(article.id) ?? [];
    const text = ownText(publicQuestions);
    return {
      article,
      path: articlePagePath(slug, article.path),
      label: articleLabel(article),
      heading: headingLabel(article.heading),
      publicQuestions,
      text,
      count: input.questionCounts.get(article.id) ?? 0,
    };
  });

  // Similarity only among pages that could be indexed (enough questions).
  const candidates = base.filter((item) => item.count >= 3 && item.text);
  const similarities = new Map<number, number>();
  maxSimilarities(candidates.map((item) => item.text)).forEach((value, index) => {
    similarities.set(candidates[index].article.id, value);
  });

  const top = base
    .filter((item) => item.count > 0)
    .toSorted((a, b) => b.count - a.count || a.article.articleOrder - b.article.articleOrder)
    .slice(0, TOP_ARTICLES_PER_LAW);
  const topIds = new Set(top.map((item) => item.article.id));

  const related = new Map<number, typeof candidates>();
  for (const item of candidates) {
    const sameHeading = candidates.filter(
      (other) => other !== item && item.article.heading && other.article.heading === item.article.heading,
    );
    const pool = sameHeading.length
      ? sameHeading
      : candidates
          .filter((other) => other !== item)
          .toSorted(
            (a, b) =>
              Math.abs(a.article.articleOrder - item.article.articleOrder) -
              Math.abs(b.article.articleOrder - item.article.articleOrder),
          );
    related.set(
      item.article.id,
      pool.toSorted((a, b) => b.count - a.count || a.article.articleOrder - b.article.articleOrder).slice(0, RELATED_PER_ARTICLE),
    );
  }
  const relatedInbound = new Map<number, number>();
  for (const list of related.values()) {
    for (const item of list) relatedInbound.set(item.article.id, (relatedInbound.get(item.article.id) ?? 0) + 1);
  }

  const articles: ArticlePage[] = base.map((item, index) => {
    const previous = base[index - 1];
    const next = base[index + 1];
    // Contextual inbound links outside the table of contents: neighbours'
    // previous/next, the law "most asked" block and "same topic" blocks.
    const inboundLinks =
      (previous ? 1 : 0) + (next ? 1 : 0) + (topIds.has(item.article.id) ? 1 : 0) + (relatedInbound.get(item.article.id) ?? 0);
    const directAnswer = input.directAnswers.get(item.article.id) ?? null;
    const traps = trapItems(item.publicQuestions);
    const ownWords = countWords(item.text);
    const maxSimilarity = similarities.get(item.article.id) ?? 0;
    const gate = evaluateArticleGate(
      {
        hasCurrentVersion: true,
        articleReviewed: true,
        directAnswerWords: directAnswer ? countWords(directAnswer) : null,
        // Public, commented questions shown on the page (D4: 3 to 5).
        reviewedQuestions: item.publicQuestions.length,
        trapPatterns: traps.length,
        ownWords,
        maxSimilarity,
        inboundLinks,
      },
      input.policy,
    );
    const dates = [item.article.updatedAt, ...item.publicQuestions.map((question) => question.updatedAt)];
    return {
      id: item.article.id,
      path: item.path,
      label: item.label,
      heading: item.heading,
      articleOrder: item.article.articleOrder,
      literalText: item.article.literalText,
      reviewedQuestionCount: item.count,
      publicQuestions: item.publicQuestions,
      traps,
      ownWords,
      maxSimilarity,
      inboundLinks,
      directAnswer,
      gate,
      previous: previous ? linkOf(previous) : null,
      next: next ? linkOf(next) : null,
      related: (related.get(item.article.id) ?? []).map(linkOf),
      contentHash: contentHash([
        item.article.literalText,
        directAnswer ?? "",
        item.text,
        ...item.publicQuestions.map((question) => question.publicId).toSorted(),
      ]),
      contentDate: new Date(Math.max(...dates.map((date) => date.getTime()))),
    };
  });

  const bySegment = new Map(articles.map((article) => [article.path.split("/").pop() ?? "", article]));
  const indexable = articles.filter((article) => article.gate.status === "index");
  const topArticles = top.map((item) => bySegment.get(item.path.split("/").pop() ?? "")).filter(
    (article): article is ArticlePage => Boolean(article),
  );
  // Source re-verification never moves this date (spec 3.4); only content does.
  const contentDates = (indexable.length ? indexable : articles).map((article) => article.contentDate);

  return {
    law: input.law,
    slug,
    aliases: lawSlugAliases(input.law),
    path: lawPagePath(slug),
    label,
    articles,
    bySegment,
    topArticles,
    reviewedQuestionCount: base.reduce((sum, item) => sum + item.count, 0),
    gate: evaluateLawGate({ hasCurrentVersion: true, indexableArticles: indexable.length }),
    contentHash: contentHash([
      input.law.versionChecksum,
      ...indexable.map((article) => `${article.path}:${article.contentHash}`),
      ...topArticles.map((article) => article.path),
    ]),
    contentDate: new Date(Math.max(0, ...contentDates.map((date) => date.getTime()))),
  };
}
