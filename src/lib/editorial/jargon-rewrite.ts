import { cleanStudentFacingText, findInternalReference } from "./student-facing-text";

/**
 * Correção determinística (sem IA) do jargão do motor nas questões já publicadas
 * (decisão de 21/11/2026). Só substituições que preservam a gramática; nada é apagado no meio
 * da frase. Se, depois das regras, o texto ainda tiver jargão, ele fica intacto (não resolvido).
 * "habeas corpus" e "pacote anticrime" nunca são tocados.
 */
export type JargonRule = { id: string; description: string; pattern: RegExp; replace: string | ((match: string, ...groups: string[]) => string) };

const keepCase = (source: string, target: string) =>
  source[0] && source[0] === source[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target;

export const JARGON_RULES: readonly JargonRule[] = [
  {
    id: "url-do-pacote",
    description: '", URL oficial indicada no pacote", "(versionId N)", "articleId N" e "art. 702, versão 66" → removidos',
    pattern: /\s+como\s+(?:articleId|versionId)\s*\d+|\s*,?\s*URL\s+oficial\s+indicada\s+no\s+pacote|\s*\(\s*(?:versionId|articleId)\s*\d+\s*\)|\s*,?\s*(?:versionId|articleId)\s*\d+|(?<=\barts?\.?\s*\d+[ºo°]?(?:-[A-Z])?(?:,\s*[^,.;]{1,25})?),\s*vers[aã]o\s+\d+\b|(?<=\btexto\s+legal),\s*vers[aã]o\s+\d+\b/giu,
    replace: "",
  },
  {
    id: "texto",
    description: '"texto recebido/fornecido/versionado (no pacote)/do pacote" → "texto legal"',
    pattern: /\b(texto)s?\s+(?:(?:recebid[oa]s?|fornecid[oa]s?|versionad[oa]s?|integral|literal|constante)\s+(?:n|d)o\s+pacote|recebid[oa]s?|fornecid[oa]s?|versionad[oa]s?|do\s+pacote)\b/giu,
    replace: (match) => keepCase(match, /^textos/iu.test(match) ? "textos legais" : "texto legal"),
  },
  {
    id: "texto-legal-participio",
    description: '"texto legal recebido/fornecido" (sobra de "texto do pacote recebido") → "texto legal"',
    pattern: /\b(texto\s+legal)\s+(?:recebid[oa]s?|fornecid[oa]s?|versionad[oa]s?)\b/giu,
    replace: (_match, keep: string) => keep,
  },
  {
    id: "redacao",
    description: '"redação do pacote/recebida/fornecida/versionada" → "redação vigente"',
    pattern: /\b(reda[çc][aã]o)\s+(?:do\s+pacote|(?:recebida|fornecida|versionada)(?:\s+no\s+pacote)?)\b/giu,
    replace: (match) => keepCase(match, "redação vigente"),
  },
  {
    id: "dispositivo",
    description: '"dispositivo do pacote/recebido/fornecido" → "dispositivo legal"',
    pattern: /\b(dispositivo)s?\s+(?:do\s+pacote|recebid[oa]s?|fornecid[oa]s?|versionad[oa]s?)\b/giu,
    replace: (match) => keepCase(match, /s\s/u.test(match) ? "dispositivos legais" : "dispositivo legal"),
  },
  {
    id: "trecho",
    description: '"trecho recebido/fornecido/do pacote" → "trecho legal"',
    pattern: /\b(trecho)s?\s+(?:do\s+pacote|recebid[oa]s?|fornecid[oa]s?)\b/giu,
    replace: (match) => keepCase(match, "trecho legal"),
  },
  {
    id: "art-participio",
    description: '"art. 7º fornecido/recebido (no pacote)" → "art. 7º"',
    pattern: /\b(arts?\.?\s*\d+[ºo°]?(?:-[A-Z])?)\s+(?:fornecid[oa]s?|recebid[oa]s?|versionad[oa]s?)(?:\s+no\s+pacote)?\b/gu,
    replace: (_match, ref: string) => ref,
  },
  {
    id: "artigos-participio",
    description: '"artigo(s) fornecido(s)/recebido(s) (no pacote)" → "artigo(s)"',
    pattern: /\b(artigos?)\s+(?:fornecid[oa]s?|recebid[oa]s?|versionad[oa]s?)(?:\s+no\s+pacote)?\b/giu,
    replace: (_match, noun: string) => noun,
  },
  {
    id: "lei-participio",
    description: '"lei/norma recebida/fornecida" (não "recebida pela", que é recepção) → "lei/norma"',
    pattern: /\b(leis?|normas?)\s+(?:fornecidas?|recebidas?)\b(?!\s+pel[oa])/giu,
    replace: (_match, noun: string) => noun,
  },
  {
    id: "no-pacote-apos-participio",
    description: '"(previsto/transcrito/citado…) no pacote" → sem "no pacote" (nunca depois de "não": aí é conteúdo)',
    pattern: /(?<!n[aã]o\s)\b(previst[oa]s?|transcrit[oa]s?|citad[oa]s?|inclu[ií]d[oa]s?|constante?s?|contid[oa]s?|indicad[oa]s?)\s+no\s+pacote\b/giu,
    replace: (_match, word: string) => word,
  },
  {
    id: "versao-do-pacote",
    description: '"na versão do pacote" / "tal como consta (fornecido) do/no pacote" → "na redação vigente"',
    pattern: /\b(?:na\s+vers[aã]o\s+do\s+pacote|tal\s+como\s+(?:consta|fornecid[oa]|transcrit[oa])\s+(?:n|d)o\s+pacote)\b/giu,
    replace: "na redação vigente",
  },
  {
    id: "ref-do-pacote",
    description: '"art. 11 do pacote" / "art. 310, §2º, do pacote" / "caput, do pacote" / "da CF no pacote" → sem "do pacote"',
    pattern: /(\b(?:arts?\.?\s*\d+(?:\.\d{3})*[ºo°]?(?:-[A-Z])?|caput|§+\s*\d+[ºo°]?|par[aá]grafo\s+[úu]nico|[IVXLC]+|al[ií]nea\s+[a-z]|da\s+CF|do\s+C[ÓO]DIGO\s+\S+|da\s+Constitui[çc][aã]o(?:\s+Federal)?)),?\s+(?:n|d)o\s+pacote\b/gu,
    replace: (_match, ref: string) => ref,
  },
  {
    id: "redacao-constante",
    description: '"com a redação da Lei X constante do pacote" → sem "constante do pacote"',
    pattern: /\s+constante\s+do\s+pacote\b/giu,
    replace: "",
  },
  {
    id: "corpus",
    description: '"(, ) do/no corpus (oficial/recebido/fornecido/versionado)" → removido (nunca "habeas corpus")',
    // Só o qualificador com vírgula (", do corpus recebido"); "no corpus" no meio da frase é conteúdo.
    pattern: /\s*,\s*\b(?:d|n)o\s+corpus(?:\s+(?:oficial|recebido|fornecido|versionado))?\b/giu,
    replace: "",
  },
];

export type JargonRewrite = { text: string; rules: string[]; resolved: boolean };

/** Aplica as regras; se sobrar jargão, devolve o original com resolved=false. */
export function rewriteJargon(original: string, article?: { articleRef?: string | null; actTitle?: string | null } | null): JargonRewrite {
  if (!original || !findInternalReference(original)) return { text: original, rules: [], resolved: true };
  const rules: string[] = [];
  let text = original;
  const ids = cleanStudentFacingText(text, article);
  if (ids !== text) {
    rules.push("ids");
    text = ids;
  }
  for (const rule of JARGON_RULES) {
    const next = text.replace(rule.pattern, rule.replace as never);
    if (next !== text) {
      rules.push(rule.id);
      text = next;
    }
  }
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").replace(/,\s*,/g, ",").replace(/,\s*([.;])/g, "$1").trim();
  if (findInternalReference(text)) return { text: original, rules, resolved: false };
  return { text, rules, resolved: true };
}
