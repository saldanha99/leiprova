import { BRAND_NAME } from "@/lib/brand";
import { ORGANIZATION_ID, WEBSITE_ID, absoluteUrl, siteIdentityGraph } from "@/lib/seo";

/**
 * schema.org JSON-LD generators (spec 4.3). Every node uses English schema.org
 * types only; pages reference the site Organization and WebSite by `@id`
 * (rendered once by the root layout).
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonLdNode = { "@type": string; "@id"?: string; [key: string]: JsonValue | undefined };
export type JsonLdGraph = { "@context": "https://schema.org"; "@graph": JsonLdNode[] };

export const ALLOWED_SCHEMA_TYPES = new Set([
  "Organization",
  "WebSite",
  "WebPage",
  "CollectionPage",
  "BreadcrumbList",
  "ListItem",
  "ItemList",
  "Legislation",
  "Quiz",
  "Question",
  "Answer",
  "FAQPage",
  "ImageObject",
  "Comment",
  "Thing",
]);

const ref = (id: string) => ({ "@id": id });

export function organizationNode(): JsonLdNode {
  return { ...siteIdentityGraph["@graph"][0] };
}

export function websiteNode(): JsonLdNode {
  return { ...siteIdentityGraph["@graph"][1] };
}

export type Crumb = Readonly<{ name: string; path: string }>;

export function breadcrumbNode(path: string, crumbs: readonly Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export type WebPageInput = Readonly<{
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "CollectionPage";
  dateModified?: Date | null;
  mainEntityId?: string;
  /** D3: the editorial team (the Organization), never an invented person. */
  withEditorialAuthor?: boolean;
}>;

export function webPageNode(input: WebPageInput): JsonLdNode {
  const url = absoluteUrl(input.path);
  return {
    "@type": input.type ?? "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: "pt-BR",
    isPartOf: ref(WEBSITE_ID),
    publisher: ref(ORGANIZATION_ID),
    breadcrumb: ref(`${url}#breadcrumb`),
    ...(input.withEditorialAuthor ? { author: ref(ORGANIZATION_ID) } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified.toISOString() } : {}),
    ...(input.mainEntityId ? { mainEntity: ref(input.mainEntityId) } : {}),
  };
}

export type LegislationInput = Readonly<{
  path: string;
  name: string;
  identifier: string;
  /** ISO date (yyyy-mm-dd) of the act, when known. */
  date?: string | null;
  legislationType?: string;
  officialUrl?: string | null;
  inForce?: boolean;
  /** `@id` of the law this node is part of (for articles). */
  partOfId?: string;
  dateModified?: Date | null;
}>;

export function legislationId(path: string): string {
  return `${absoluteUrl(path)}#legislation`;
}

export function legislationNode(input: LegislationInput): JsonLdNode {
  return {
    "@type": "Legislation",
    "@id": legislationId(input.path),
    url: absoluteUrl(input.path),
    name: input.name,
    legislationIdentifier: input.identifier,
    legislationJurisdiction: "BR",
    inLanguage: "pt-BR",
    ...(input.legislationType ? { legislationType: input.legislationType } : {}),
    ...(input.date ? { legislationDate: input.date } : {}),
    ...(input.inForce ? { legislationLegalForce: "https://schema.org/InForce" } : {}),
    ...(input.officialUrl ? { sameAs: input.officialUrl } : {}),
    ...(input.partOfId ? { isPartOf: ref(input.partOfId) } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified.toISOString() } : {}),
  };
}

export type QuizQuestionInput = Readonly<{
  anchorId: string;
  text: string;
  kind: "multiple_choice" | "true_false";
  correctAnswer: string;
  comment: string;
  wrongAnswers: readonly string[];
}>;

export function quizNode(input: Readonly<{
  path: string;
  name: string;
  aboutId: string;
  questions: readonly QuizQuestionInput[];
}>): JsonLdNode {
  const url = absoluteUrl(input.path);
  return {
    "@type": "Quiz",
    "@id": `${url}#quiz`,
    name: input.name,
    inLanguage: "pt-BR",
    educationalLevel: "Concursos públicos",
    about: ref(input.aboutId),
    author: ref(ORGANIZATION_ID),
    hasPart: input.questions.map((question) => ({
      "@type": "Question",
      "@id": `${url}#${question.anchorId}`,
      eduQuestionType: question.kind === "true_false" ? "TrueFalse" : "MultipleChoice",
      text: question.text,
      acceptedAnswer: { "@type": "Answer", text: question.correctAnswer, answerExplanation: { "@type": "Comment", text: question.comment } },
      suggestedAnswer: question.wrongAnswers.map((answer) => ({ "@type": "Answer", text: answer })),
    })),
  };
}

export type FaqInput = Readonly<{ question: string; answer: string }>;

export function faqPageNode(path: string, items: readonly FaqInput[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export type ListEntry = Readonly<{ name: string; path: string }>;

export function itemListNode(path: string, name: string, entries: readonly ListEntry[]): JsonLdNode {
  return {
    "@type": "ItemList",
    "@id": `${absoluteUrl(path)}#itemlist`,
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      url: absoluteUrl(entry.path),
    })),
  };
}

export function collectionPageNode(input: Omit<WebPageInput, "type">): JsonLdNode {
  return webPageNode({ ...input, type: "CollectionPage" });
}

export function graph(nodes: readonly JsonLdNode[]): JsonLdGraph {
  return { "@context": "https://schema.org", "@graph": [...nodes] };
}

/** Every `@type` found anywhere in a JSON-LD value (for tests and audits). */
export function collectTypes(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "@type" && typeof item === "string") found.add(item);
      else collectTypes(item, found);
    }
  }
  return found;
}

export const EDITORIAL_AUTHOR_NAME = `Equipe editorial ${BRAND_NAME}`;
