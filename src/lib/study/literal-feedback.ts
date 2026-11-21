import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { legalActs, legalArticles, legalVersions, questionOptions, questions } from "@/lib/db/schema";
import { highlightLiteral, type LiteralFeedback } from "@/lib/study/literal-highlight";

export type { LiteralFeedback } from "@/lib/study/literal-highlight";

/**
 * Uma consulta para as questões e outra para as alternativas (≤ 20 questões por sessão).
 * `selectedKeyById`: alternativa escolhida por questão (o vermelho só aparece para ela).
 */
export async function loadLiteralFeedback(
  questionIds: number[],
  selectedKeyById: Map<number, string | null> = new Map(),
): Promise<Map<number, LiteralFeedback>> {
  const out = new Map<number, LiteralFeedback>();
  const ids = [...new Set(questionIds)].filter((id) => Number.isSafeInteger(id));
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({
      id: questions.id,
      prompt: questions.prompt,
      type: questions.type,
      literalText: legalArticles.literalText,
      articleRef: legalArticles.articleRef,
      actTitle: legalActs.shortTitle,
    })
    .from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(
      and(
        inArray(questions.id, ids),
        eq(legalArticles.editorialStatus, "reviewed"),
        eq(legalArticles.sourceRights, "official_text"),
        eq(legalVersions.status, "current"),
        eq(legalActs.isActive, true),
      ),
    );
  if (!rows.length) return out;
  const options = await db
    .select({
      questionId: questionOptions.questionId,
      key: questionOptions.optionKey,
      text: questionOptions.text,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, rows.map((row) => row.id)))
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder));

  for (const row of rows) {
    if (!row.literalText?.trim()) continue;
    const highlight = highlightLiteral({
      literalText: row.literalText,
      prompt: row.prompt,
      type: row.type,
      options: options.filter((option) => option.questionId === row.id),
      selectedKey: selectedKeyById.get(row.id) ?? null,
    });
    out.set(row.id, {
      articleRef: row.articleRef,
      actTitle: row.actTitle,
      segments: highlight.segments,
      excerpt: highlight.excerpt,
      hasTrap: highlight.hasTrap,
    });
  }
  return out;
}
