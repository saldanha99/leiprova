/**
 * Indexing gates (spec 3.2 and 3.3). Pure: the page, the sitemap, llms-full and
 * the page-state job all call these, so a URL is never `index` in one place and
 * `noindex` in another.
 */

export type GateStatus = "index" | "noindex" | "not_found";

export type GateReason =
  | "no_current_version"
  | "article_not_reviewed"
  | "missing_direct_answer"
  | "few_questions"
  | "few_trap_patterns"
  | "few_own_words"
  | "similar_to_sibling"
  | "no_inbound_links"
  | "few_indexable_articles";

export type GateDecision = Readonly<{ status: GateStatus; reasons: readonly GateReason[] }>;

export const ARTICLE_GATE = Object.freeze({
  minQuestions: 3,
  minDirectAnswerWords: 40,
  minTrapPatterns: 2,
  minOwnWords: 250,
  maxSimilarity: 0.5,
  minInboundLinks: 1,
});

export const LAW_GATE = Object.freeze({ minIndexableArticles: 10 });

export type ArticleGateInput = Readonly<{
  hasCurrentVersion: boolean;
  articleReviewed: boolean;
  /** Words of the authored, reviewed direct answer; null when none exists. */
  directAnswerWords: number | null;
  /** Reviewed questions linked to the article that have a comment. */
  reviewedQuestions: number;
  trapPatterns: number;
  /** Own words: statements, comments and rationales of the public questions. */
  ownWords: number;
  /** Highest Jaccard similarity against the other articles of the same law. */
  maxSimilarity: number;
  /** Contextual inbound links outside the law table of contents. */
  inboundLinks: number;
}>;

export type ArticleGatePolicy = Readonly<{
  /**
   * Spec 3.2 makes the authored direct answer mandatory. The database has no
   * such text yet (see docs/seo/ondas.md), so the owner may relax only this item
   * with SEO_DIRECT_ANSWER_REQUIRED=0. Every other item stays mandatory.
   */
  requireDirectAnswer: boolean;
}>;

export const STRICT_ARTICLE_POLICY: ArticleGatePolicy = Object.freeze({ requireDirectAnswer: true });

export function evaluateArticleGate(
  input: ArticleGateInput,
  policy: ArticleGatePolicy = STRICT_ARTICLE_POLICY,
): GateDecision {
  if (!input.hasCurrentVersion) return { status: "not_found", reasons: ["no_current_version"] };
  if (!input.articleReviewed) return { status: "not_found", reasons: ["article_not_reviewed"] };

  const reasons: GateReason[] = [];
  if (
    policy.requireDirectAnswer &&
    (input.directAnswerWords === null || input.directAnswerWords < ARTICLE_GATE.minDirectAnswerWords)
  ) {
    reasons.push("missing_direct_answer");
  }
  if (input.reviewedQuestions < ARTICLE_GATE.minQuestions) reasons.push("few_questions");
  if (input.trapPatterns < ARTICLE_GATE.minTrapPatterns) reasons.push("few_trap_patterns");
  if (input.ownWords < ARTICLE_GATE.minOwnWords) reasons.push("few_own_words");
  if (input.maxSimilarity >= ARTICLE_GATE.maxSimilarity) reasons.push("similar_to_sibling");
  if (input.inboundLinks < ARTICLE_GATE.minInboundLinks) reasons.push("no_inbound_links");

  return { status: reasons.length === 0 ? "index" : "noindex", reasons };
}

export type LawGateInput = Readonly<{ hasCurrentVersion: boolean; indexableArticles: number }>;

export function evaluateLawGate(input: LawGateInput): GateDecision {
  if (!input.hasCurrentVersion) return { status: "not_found", reasons: ["no_current_version"] };
  return input.indexableArticles >= LAW_GATE.minIndexableArticles
    ? { status: "index", reasons: [] }
    : { status: "noindex", reasons: ["few_indexable_articles"] };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function normalizedWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Set of 5-word shingles (spec 3.2). */
export function shingles(text: string, size = 5): Set<string> {
  const words = normalizedWords(text);
  const result = new Set<string>();
  for (let index = 0; index + size <= words.length; index += 1) {
    result.add(words.slice(index, index + size).join(" "));
  }
  return result;
}

export function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let shared = 0;
  for (const value of small) if (large.has(value)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Highest similarity of each item against all the others (same law). */
export function maxSimilarities(texts: readonly string[]): number[] {
  const sets = texts.map((text) => shingles(text));
  const result = sets.map(() => 0);
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      const value = jaccard(sets[i], sets[j]);
      if (value > result[i]) result[i] = value;
      if (value > result[j]) result[j] = value;
    }
  }
  return result;
}
