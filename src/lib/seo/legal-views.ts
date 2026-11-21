import { absoluteUrl } from "@/lib/seo";
import type { FaqInput, JsonLdGraph, QuizQuestionInput } from "@/lib/seo/graph";
import {
  breadcrumbNode,
  collectionPageNode,
  faqPageNode,
  graph,
  itemListNode,
  legislationId,
  legislationNode,
  quizNode,
  webPageNode,
} from "@/lib/seo/graph";
import type { ArticlePage, LawSnapshot, PublicQuestion } from "@/lib/seo/legal-snapshot";
import { brDate, inlineArticle, joinList, lawDateFromTitle, legislationTypeLabel, ofLaw, theLaw } from "@/lib/seo/legal-format";
import { caputExcerpt } from "@/lib/seo/literal-text";

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

/**
 * View models of templates A (article) and B (law): titles, descriptions, FAQ
 * and JSON-LD built only from database facts. Pure.
 */

export type ContestRef = Readonly<{ path: string; title: string }>;

export function articleCrumbs(snapshot: LawSnapshot, article: ArticlePage) {
  return [
    { name: "Início", path: "/" },
    { name: "Leis", path: "/leis" },
    { name: snapshot.label, path: snapshot.path },
    { name: article.label, path: article.path },
  ];
}

export function articleHeadline(snapshot: LawSnapshot, article: ArticlePage): string {
  const base = `${article.label} ${ofLaw(snapshot.label)}`;
  return article.heading ? `${base} — ${article.heading}` : base;
}

export function articleTitle(snapshot: LawSnapshot, article: ArticlePage): string {
  const base = `${article.label} ${ofLaw(snapshot.label)}`;
  return article.heading ? `${base}: ${article.heading}` : base;
}

function styleNames(questions: readonly PublicQuestion[]): string[] {
  return [...new Set(questions.flatMap((question) => (question.styleBankName ? [question.styleBankName] : [])))];
}

export function articleDescription(snapshot: LawSnapshot, article: ArticlePage): string {
  if (article.directAnswer) return article.directAnswer;
  const styles = styleNames(article.publicQuestions);
  const count = article.publicQuestions.length;
  const questions = count
    ? ` e ${count} ${count === 1 ? "questão resolvida" : "questões resolvidas"}${styles.length ? `, inéditas no estilo ${joinList(styles)}` : ""}`
    : "";
  return `Texto oficial do ${inlineArticle(article.label)} ${ofLaw(snapshot.label)}${article.heading ? ` (${article.heading.toLocaleLowerCase("pt-BR")})` : ""}${questions}.`;
}

export function articleFaq(
  snapshot: LawSnapshot,
  article: ArticlePage,
  contests: readonly ContestRef[],
  asOf: Date,
): FaqInput[] {
  const name = `${inlineArticle(article.label)} ${ofLaw(snapshot.label)}`;
  const items: FaqInput[] = [
    { question: `O que diz o ${name}?`, answer: `Pelo texto oficial: “${caputExcerpt(article.literalText)}”` },
  ];
  if (contests.length) {
    const names = contests.slice(0, 5).map((contest) => contest.title);
    const more = contests.length > 5 ? ` e mais ${contests.length - 5}` : "";
    items.push({
      question: `Quais concursos cobram o ${name}?`,
      answer: `No programa revisado das preparações acompanhadas pelo Edital Lei Seca, o artigo aparece em ${joinList(names)}${more}.`,
    });
  }
  if (article.reviewedQuestionCount > 0) {
    const shown = article.publicQuestions.length;
    items.push({
      question: `Quantas questões sobre o ${name} há no Edital Lei Seca?`,
      answer: `Em ${brDate(asOf)}, a base tinha ${article.reviewedQuestionCount} questões revisadas ligadas a este artigo. Esta página mostra ${shown} resolvidas e comentadas; as demais ficam no treino.`,
    });
  }
  return items;
}

function quizQuestions(questions: readonly PublicQuestion[]): QuizQuestionInput[] {
  return questions.flatMap((question) =>
    question.correct
      ? [
          {
            anchorId: question.anchorId,
            text: question.prompt,
            kind: question.type,
            correctAnswer: question.correct.text,
            comment: question.explanation,
            wrongAnswers: question.options.filter((option) => !option.isCorrect).map((option) => option.text),
          },
        ]
      : [],
  );
}

export function articleJsonLd(
  snapshot: LawSnapshot,
  article: ArticlePage,
  input: Readonly<{ description: string; faq: readonly FaqInput[]; modifiedAt: Date }>,
): JsonLdGraph {
  const legislation = legislationNode({
    path: article.path,
    name: articleHeadline(snapshot, article),
    identifier: `${snapshot.label}, ${inlineArticle(article.label)}`,
    legislationType: legislationTypeLabel(snapshot.law.actType),
    officialUrl: snapshot.law.officialUrl,
    inForce: true,
    partOfId: legislationId(snapshot.path),
  });
  const questions = quizQuestions(article.publicQuestions);
  return graph([
    webPageNode({
      path: article.path,
      name: articleHeadline(snapshot, article),
      description: input.description,
      dateModified: input.modifiedAt,
      mainEntityId: legislationId(article.path),
      withEditorialAuthor: true,
    }),
    breadcrumbNode(article.path, articleCrumbs(snapshot, article)),
    legislation,
    ...(questions.length
      ? [quizNode({ path: article.path, name: `Questões sobre o ${inlineArticle(article.label)} ${ofLaw(snapshot.label)}`, aboutId: legislationId(article.path), questions })]
      : []),
    ...(input.faq.length ? [faqPageNode(article.path, input.faq)] : []),
  ]);
}

export function lawCrumbs(snapshot: LawSnapshot) {
  return [
    { name: "Início", path: "/" },
    { name: "Leis", path: "/leis" },
    { name: snapshot.label, path: snapshot.path },
  ];
}

export function lawHeadline(snapshot: LawSnapshot): string {
  return snapshot.label === snapshot.law.shortTitle ? snapshot.label : `${snapshot.label} — ${snapshot.law.shortTitle}`;
}

export function lawSummary(snapshot: LawSnapshot, contests: readonly ContestRef[]): string {
  const withQuestions = snapshot.articles.filter((article) => article.reviewedQuestionCount > 0).length;
  const facts = [
    `${snapshot.law.title}: vigente na versão verificada em ${brDate(snapshot.law.versionVerifiedAt)}, com ${snapshot.articles.length} artigos no texto oficial.`,
    snapshot.reviewedQuestionCount
      ? `Na base do Edital Lei Seca, ${snapshot.reviewedQuestionCount} questões revisadas tratam de ${withQuestions} desses artigos.`
      : "",
    contests.length ? `A norma aparece no programa de ${contests.length} ${contests.length === 1 ? "preparação acompanhada" : "preparações acompanhadas"}.` : "",
  ];
  return facts.filter(Boolean).join(" ");
}

export function lawDescription(snapshot: LawSnapshot): string {
  return `${lawHeadline(snapshot)}: texto oficial organizado por artigo, os artigos com mais questões e questões resolvidas para concursos.`;
}

export function lawFaq(snapshot: LawSnapshot, contests: readonly ContestRef[], asOf: Date): FaqInput[] {
  const items: FaqInput[] = [
    {
      question: `O que é ${theLaw(snapshot.label)}?`,
      answer: `${capitalize(theLaw(snapshot.label))} corresponde à norma “${snapshot.law.title}”. O texto usado aqui foi conferido em ${brDate(snapshot.law.versionVerifiedAt)} na fonte oficial.`,
    },
  ];
  const top = snapshot.topArticles.slice(0, 3);
  if (top.length) {
    items.push({
      question: `Quais artigos ${ofLaw(snapshot.label)} têm mais questões?`,
      answer: `Na base do Edital Lei Seca, em ${brDate(asOf)}: ${joinList(top.map((article) => `${inlineArticle(article.label)} (${article.reviewedQuestionCount} questões)`))}. A contagem é do nosso banco, não de todas as provas do país.`,
    });
  }
  if (contests.length) {
    const names = contests.slice(0, 5).map((contest) => contest.title);
    items.push({
      question: `Quais concursos cobram ${theLaw(snapshot.label)}?`,
      answer: `Entre as preparações acompanhadas: ${joinList(names)}${contests.length > 5 ? ` e mais ${contests.length - 5}` : ""}.`,
    });
  }
  return items;
}

export function lawJsonLd(
  snapshot: LawSnapshot,
  input: Readonly<{ description: string; faq: readonly FaqInput[]; modifiedAt: Date }>,
): JsonLdGraph {
  return graph([
    webPageNode({
      path: snapshot.path,
      name: lawHeadline(snapshot),
      description: input.description,
      dateModified: input.modifiedAt,
      mainEntityId: legislationId(snapshot.path),
    }),
    breadcrumbNode(snapshot.path, lawCrumbs(snapshot)),
    legislationNode({
      path: snapshot.path,
      name: snapshot.law.title,
      identifier: snapshot.label,
      date: lawDateFromTitle(snapshot.law.title),
      legislationType: legislationTypeLabel(snapshot.law.actType),
      officialUrl: snapshot.law.officialUrl,
      inForce: true,
    }),
    ...(input.faq.length ? [faqPageNode(snapshot.path, input.faq)] : []),
  ]);
}

export function lawsHubJsonLd(laws: readonly Readonly<{ label: string; path: string }>[], description: string): JsonLdGraph {
  return graph([
    collectionPageNode({ path: "/leis", name: "Leis para concursos", description, mainEntityId: `${absoluteUrl("/leis")}#itemlist` }),
    breadcrumbNode("/leis", [
      { name: "Início", path: "/" },
      { name: "Leis", path: "/leis" },
    ]),
    itemListNode("/leis", "Leis com texto oficial e questões por artigo", laws.map((law) => ({ name: law.label, path: law.path }))),
  ]);
}
