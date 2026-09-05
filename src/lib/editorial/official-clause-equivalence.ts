import { createHash } from "node:crypto";
import { z } from "zod";

export const CF88_PLANALTO_URL = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
export const normalizeOfficialText = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();
export const officialTextHash = (text: string) => createHash("sha256").update(normalizeOfficialText(text)).digest("hex");

export const clauseEquivalenceSchema = z.object({
  strategy: z.literal("cf88-art5-inciso-v1"),
  parentArticleRef: z.literal("Art. 5º"),
  inciso: z.string().regex(/^[IVXLCDM]{1,12}$/u),
  targetSourceUrl: z.string().regex(/^https:\/\/legis\.senado\.leg\.br\/norma\/579494\/publicacao\/\d+$/u),
  parentTextSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

/** Extrai o inciso inteiro, com todas as alíneas; não aceita citação parcial. */
export function extractOfficialClause(article: string, inciso: string) {
  if (!/^[IVXLCDM]{1,12}$/u.test(inciso)) throw new Error("Inciso inválido.");
  const starts = [...article.matchAll(new RegExp(`^${inciso} - `, "gmu"))];
  if (starts.length !== 1) throw new Error("Inciso ausente ou ambíguo no artigo integral.");
  const rest = article.slice(starts[0].index);
  const markerLength = starts[0][0].length;
  const end = rest.slice(markerLength).search(/^(?:[IVXLCDM]+ - |§\s|Parágrafo único)/mu);
  return (end < 0 ? rest : rest.slice(0, markerLength + end)).trim();
}

/** Três diferenças tipográficas observadas nas duas fontes oficiais. Não remove
 * pontuação/maiúsculas indiscriminadamente nem normaliza outras palavras. */
function canonicalClause(text: string, inciso: string) {
  const normalized = normalizeOfficialText(text);
  if (inciso === "XXXI") return normalized.replace('"de cujus"', "de cujus");
  if (inciso === "XXXIV") return normalized.replace("Poderes Públicos", "poderes públicos");
  if (inciso === "XLIII") return normalized.replace("tortura ,", "tortura,");
  return normalized;
}

export function verifyOfficialClause(input: {
  equivalence: z.infer<typeof clauseEquivalenceSchema>;
  source: { articleRef: string; text: string };
  bundle: { officialUrl: string; articleContext: string };
  article: { articleRef: string; literalText: string; sourceUrl: string; officialUrl: string };
}) {
  const { equivalence: e, source, bundle, article } = input;
  const firstClause = article.literalText.indexOf("\nI - ");
  if (bundle.officialUrl !== CF88_PLANALTO_URL || article.officialUrl !== CF88_PLANALTO_URL ||
      article.sourceUrl !== e.targetSourceUrl || article.articleRef !== e.parentArticleRef ||
      source.articleRef !== `${e.parentArticleRef}, ${e.inciso}` ||
      officialTextHash(article.literalText) !== e.parentTextSha256 || firstClause < 0 ||
      normalizeOfficialText(article.literalText.slice(0, firstClause)) !== normalizeOfficialText(bundle.articleContext)) {
    throw new Error("O vínculo do inciso, caput ou versão integral não corresponde às fontes declaradas.");
  }
  const targetText = extractOfficialClause(article.literalText, e.inciso);
  if (canonicalClause(source.text, e.inciso) !== canonicalClause(targetText, e.inciso)) {
    throw new Error("O texto completo do inciso difere entre as fontes oficiais.");
  }
  return {
    ...e, packageSourceUrl: bundle.officialUrl, packageArticleRef: source.articleRef,
    packageClauseSha256: officialTextHash(source.text), targetClauseSha256: officialTextHash(targetText),
    typographicVariant: normalizeOfficialText(source.text) !== normalizeOfficialText(targetText),
    targetClauseText: targetText,
  };
}
