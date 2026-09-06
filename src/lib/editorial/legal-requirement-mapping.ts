/**
 * Sugestões conservadoras por citação explícita, sem inferência temática.
 * O chamador fornece o catálogo e as URLs oficiais previamente identificadas.
 * A validação local não autentica documentos, comprova vigência ou revisão humana.
 * A unicidade vale apenas para o catálogo recebido, nunca para toda a legislação.
 */
export type MappingSource = Readonly<{
  url: string;
  checksumSha256: string;
  verifiedOn: string;
}>;

export type MappingRequirement = Readonly<{
  id: number;
  requirementText: string;
  sourceLocator: string;
  source: MappingSource;
}>;

export type MappingArticle = Readonly<{
  legalActId: number;
  legalVersionId: number;
  legalArticleId: number;
  actType: string;
  actNumber: string;
  actYear: number;
  actTitle: string;
  jurisdiction: string;
  articleRef: string;
  literalText: string;
  source: MappingSource;
  uncertainties: readonly string[];
}>;

export type MappingInput = Readonly<{
  requirement: MappingRequirement;
  articles: readonly MappingArticle[];
  officialSourceUrls: readonly string[];
}>;

export type MappingCandidateReference = Readonly<{
  legalActId: number;
  legalVersionId: number;
  legalArticleId: number;
  actType: string;
  actNumber: string;
  actYear: number;
  actTitle: string;
  jurisdiction: string;
  articleRef: string;
}>;

export type MappingEvidence = Readonly<{
  requirementQuote: string;
  sourceLocator: string;
  requirementSource: MappingSource;
  legalQuote: string;
  legalSource: MappingSource;
  candidate: MappingCandidateReference;
  confidence: Readonly<{
    level: "exact_citation";
    justification: string;
  }>;
}>;

type MappingResultBase = Readonly<{
  requirementId: number;
  humanReviewRequired: true;
}>;

export type LegalRequirementMappingResult = MappingResultBase & (
  | Readonly<{
      kind: "suggestion";
      evidence: MappingEvidence;
      limitations: readonly string[];
    }>
  | Readonly<{
      kind: "pending";
      reason: "ambiguous_reference" | "insufficient_evidence";
      explanation: string;
      candidates: readonly MappingCandidateReference[];
    }>
);

const ACT = String.raw`(lei complementar|lei|decreto-lei|decreto|emenda constitucional)`;
const NUMBER = String.raw`([1-9]\d*(?:\.\d{3})*)`;
const YEAR = String.raw`(\d{4})`;
const ARTICLE = String.raw`([1-9]\d*(?:\s*[º°o])?(?:\s*-\s*[a-z])?)`;
const ACT_CITATION = String.raw`${ACT}\s+(?:n(?:[º°o]|\.)?\s*)?${NUMBER}\s*\/\s*${YEAR}`;
const ARTICLE_CITATION = String.raw`(?:art\.?|artigo)\s+${ARTICLE}`;

function normalize(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/gu, " ");
}

function normalizeNumber(value: string): string {
  return value.replaceAll(".", "");
}

function normalizeArticle(value: string): string | null {
  const match = new RegExp(`^(?:(?:art\\.?|artigo)\\s+)?${ARTICLE}$`, "iu").exec(normalize(value));
  return match ? match[1].replace(/[º°o\s]/gu, "").toUpperCase() : null;
}

type Citation = Readonly<{
  actType: string;
  actNumber: string;
  actYear: number;
  article: string;
}>;

function parseCitation(text: string): Citation | null {
  // A âncora integral impede descartar silenciosamente listas, exceções ou tópicos adicionais.
  const normalized = normalize(text);
  const forward = new RegExp(`^${ACT_CITATION}\\s*[,;:]?\\s+${ARTICLE_CITATION}\\.?$`, "iu").exec(normalized);
  if (forward) {
    const article = normalizeArticle(forward[4]);
    return article ? { actType: forward[1], actNumber: normalizeNumber(forward[2]), actYear: Number(forward[3]), article } : null;
  }
  const reverse = new RegExp(`^${ARTICLE_CITATION}\\s+(?:da|do)\\s+${ACT_CITATION}\\.?$`, "iu").exec(normalized);
  if (!reverse) return null;
  const article = normalizeArticle(reverse[1]);
  return article ? { actType: reverse[2], actNumber: normalizeNumber(reverse[3]), actYear: Number(reverse[4]), article } : null;
}

function hasMultipleReferences(text: string): boolean {
  const normalized = normalize(text);
  const mentions = normalized.match(/\b(?:art\.?|artigo)\s+\d/gu) ?? [];
  return mentions.length > 1 || /\b(?:arts\.?|artigos)\s+\d/gu.test(normalized)
    || /\b(?:art\.?|artigo)\s+\d+(?:[º°o])?\s*(?:,|\/|–|—|-|a\b|até\b|e\b|ou\b)\s*\d/gu.test(normalized);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function hasSourceEvidence(source: MappingSource, allowedUrls: readonly string[]): boolean {
  // A lista é injetada: não confundir URL bem formada com autenticação da fonte.
  if (!allowedUrls.includes(source.url) || !/^[a-f0-9]{64}$/u.test(source.checksumSha256)
    || !isCalendarDate(source.verifiedOn)) return false;
  try {
    const url = new URL(source.url);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function reference(article: MappingArticle): MappingCandidateReference {
  return {
    legalActId: article.legalActId,
    legalVersionId: article.legalVersionId,
    legalArticleId: article.legalArticleId,
    actType: article.actType,
    actNumber: article.actNumber,
    actYear: article.actYear,
    actTitle: article.actTitle,
    jurisdiction: article.jurisdiction,
    articleRef: article.articleRef,
  };
}

/** Não devolve campos de aprovação, vínculo persistido ou autoria de revisão. */
export function suggestLegalRequirementMapping(input: MappingInput): LegalRequirementMappingResult {
  const { requirement, articles, officialSourceUrls } = input;
  const pending = (
    reason: "ambiguous_reference" | "insufficient_evidence",
    explanation: string,
    candidates: readonly MappingArticle[] = [],
  ): LegalRequirementMappingResult => ({
    kind: "pending",
    requirementId: requirement.id,
    humanReviewRequired: true,
    reason,
    explanation,
    candidates: candidates.map(reference).sort((left, right) => {
      const a = JSON.stringify(left);
      const b = JSON.stringify(right);
      return a < b ? -1 : a > b ? 1 : 0;
    }),
  });

  if (hasMultipleReferences(requirement.requirementText)) {
    return pending("ambiguous_reference", "O requisito menciona uma lista ou intervalo de artigos; é necessário delimitar cada referência.");
  }
  const citation = parseCitation(requirement.requirementText);
  if (!citation) {
    return pending("insufficient_evidence", "Exige-se uma citação integral com tipo, número, ano da norma e um único artigo. Temas, siglas, incisos, exceções e redações não reconhecidas exigem análise explícita.");
  }
  const candidates = articles.filter((article) => normalize(article.actType) === citation.actType
    && normalizeNumber(article.actNumber) === citation.actNumber
    && article.actYear === citation.actYear
    && normalizeArticle(article.articleRef) === citation.article);

  // Não eliminar candidatos fracos antes da contagem: isso esconderia ambiguidade.
  if (candidates.length > 1) {
    return pending("ambiguous_reference", "Há mais de um registro plausível no catálogo fornecido, incluindo possíveis versões ou jurisdições distintas. Nenhum foi escolhido.", candidates);
  }
  const candidate = candidates[0];
  if (!candidate) {
    return pending("insufficient_evidence", "A referência explícita não tem artigo correspondente no catálogo fornecido; isso não prova inexistência na legislação.");
  }
  if (![requirement.id, candidate.legalActId, candidate.legalVersionId, candidate.legalArticleId].every((id) => Number.isSafeInteger(id) && id > 0)
    || !requirement.sourceLocator.trim() || !candidate.actTitle.trim() || !candidate.jurisdiction.trim()
    || !candidate.literalText.trim()
    || !hasSourceEvidence(requirement.source, officialSourceUrls)
    || !hasSourceEvidence(candidate.source, officialSourceUrls)
    || candidate.uncertainties.length > 0) {
    return pending("insufficient_evidence", "Faltam identificadores, localização, texto, fonte autorizada, checksum ou data válida, ou existem incertezas declaradas sobre a versão.", candidates);
  }
  return {
    kind: "suggestion",
    requirementId: requirement.id,
    humanReviewRequired: true,
    evidence: {
      requirementQuote: requirement.requirementText,
      sourceLocator: requirement.sourceLocator,
      requirementSource: { ...requirement.source },
      legalQuote: candidate.literalText,
      legalSource: { ...candidate.source },
      candidate: reference(candidate),
      confidence: {
        level: "exact_citation",
        justification: "Tipo, número, ano da norma e artigo coincidem exatamente após normalização gráfica; há um único registro no catálogo fornecido e trilha documental declarada para ambas as fontes. O grau mede correspondência de citação, não validade jurídica.",
      },
    },
    limitations: [
      "Unicidade limitada ao catálogo fornecido pelo chamador; não há cobertura universal.",
      "URLs, hashes, textos e datas são evidências fornecidas, sem consulta ou autenticação pelo módulo.",
      "Vigência na data aplicável, integralidade do edital e revisão humana permanecem pendentes.",
    ],
  };
}
