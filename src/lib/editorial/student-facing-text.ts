/**
 * Texto que o aluno lê (enunciado, alternativas, justificativas e comentário) não pode trazer
 * referência interna do motor: id de artigo, número de versão, "corpus", "pacote".
 * Em 21/11/2026 havia 128 comentários publicados com "artigo 5834, versão 65, do corpus…".
 */

/** "artigo 5834, versão 65" e variações, com o qualificador "do corpus …" opcional. */
const INTERNAL_ARTICLE_REF =
  /\bartigo\s+\d{3,}\s*,\s*vers[aã]o\s+\d+(?:\s*,?\s*do\s+corpus(?:\s+(?:oficial|fornecido|recebido|versionado))?)?/giu;
/** "versão 65 do corpus …" sem o artigo antes. */
const INTERNAL_VERSION_REF = /\bvers[aã]o\s+\d+\s*,?\s*do\s+corpus(?:\s+(?:oficial|fornecido|recebido|versionado))?/giu;
/** Parêntese com id logo depois do artigo certo: "art. 321 do CPP (artigo 1600 do pacote)". */
const INTERNAL_PACKET_REF = /\s*\(\s*artigo\s+\d{3,}\s+do\s+pacote\s*\)|\bartigo\s+\d{3,}\s+do\s+pacote\b/giu;
/** Qualificador solto: ", do corpus fornecido". */
const CORPUS_QUALIFIER = /\s*,?\s*do\s+corpus(?:\s+(?:oficial|fornecido|recebido|versionado))?/giu;

/** Padrões que o Autor e o Guardião nunca podem produzir em texto para o aluno. */
export const INTERNAL_REFERENCE_PATTERNS: readonly RegExp[] = [
  /\bartigo\s+\d{3,}\s*,\s*vers[aã]o\s+\d+/iu,
  /\bvers[aã]o\s+\d+\s*,?\s*do\s+corpus/iu,
  /\bdo\s+corpus\s+(?:oficial|fornecido|recebido|versionado)\b/iu,
  /\b(?:artigo|dispositivo)\s+(?:id|#)\s*\d+/iu,
  /\bartigo\s+\d{3,}\s+do\s+pacote\b/iu,
];

/** Primeiro trecho com referência interna, ou null. */
export function findInternalReference(text: string): string | null {
  for (const pattern of INTERNAL_REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

/**
 * Exibição: troca a referência interna pelo rótulo legível do artigo vinculado à questão
 * (ex.: "art. 5º da Constituição Federal"); sem rótulo, remove a referência. Não altera o banco.
 */
export function cleanStudentFacingText(
  text: string,
  article?: { articleRef?: string | null; actTitle?: string | null } | null,
): string {
  if (!text) return text;
  const full = articleLabel(article?.articleRef, article?.actTitle);
  const short = article?.articleRef?.trim().replace(/^Art\./u, "art.") || full;
  const act = article?.actTitle?.trim().toLowerCase();
  let out = text.replace(INTERNAL_ARTICLE_REF, (_match, offset: number, whole: string) => {
    // "Constituição Federal, artigo 6008, versão 65" → "Constituição Federal, art. 166".
    const before = whole.slice(Math.max(0, offset - 80), offset).toLowerCase().replace(/[\s,]+$/u, "");
    // O artigo já está escrito logo antes ("…, art. 5º, artigo 5834, versão 65"): só remove.
    if (short && before.endsWith(short.toLowerCase())) return "";
    return (act && before.endsWith(act) ? short : full) ?? "";
  });
  out = out.replace(INTERNAL_PACKET_REF, "").replace(INTERNAL_VERSION_REF, "").replace(CORPUS_QUALIFIER, "");
  return out
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*([.;])/g, "$1")
    .replace(/(Fonte|Fundamento)\s*:\s*,\s*/giu, "$1: ")
    .replace(/(Fonte|Fundamento)\s*:\s*\./giu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Rótulo legível: "art. 5º da Constituição Federal". */
export function articleLabel(articleRef?: string | null, actTitle?: string | null): string | null {
  const ref = articleRef?.trim().replace(/^Art\./u, "art.");
  if (!ref) return actTitle?.trim() || null;
  return actTitle?.trim() ? `${ref} da ${actTitle.trim()}` : ref;
}
