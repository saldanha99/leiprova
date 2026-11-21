/**
 * Referências explícitas a partes do artigo no enunciado e nas alternativas ("art. 5º, LXIX e
 * LXXI", "inciso II, alínea b", "§§ 1º e 3º", "parágrafo único", "caput"), para o gabarito
 * sempre mostrar a parte citada, mesmo distante das outras.
 *
 * Numeral romano solto só conta dentro de uma cadeia iniciada por artigo, inciso ou parágrafo:
 * "apenas I e III estão corretas" fala de afirmativas, não de incisos.
 */

export type LegalReference =
  | { kind: "caput" }
  | { kind: "paragraph"; value: string }
  | { kind: "inciso"; value: string; paragraph: string | null }
  | { kind: "alinea"; value: string; paragraph: string | null; inciso: string | null };

type Chain = {
  article: string | null;
  paragraph: string | null;
  inciso: string | null;
  refs: LegalReference[];
};

// Fronteira por letra Unicode: com `\b`, o "C" de "Código" contaria como numeral.
// Inciso acrescido por emenda: "V-A".
const ROMAN = String.raw`(?<![\p{L}\p{N}])[IVXLC]+(?:\s*-\s*[A-Z])?(?![\p{L}\p{N}])`;
const ROMAN_LIST = String.raw`${ROMAN}(?:\s*(?:,|\be\b|\bou\b)\s*${ROMAN})*`;
const ORDINAL = String.raw`\d+\s*[º°o]?(?:\s*-\s*[A-Z](?![\p{L}]))?`;
// Na continuação de uma lista de alíneas, "a" e "o" são artigos da frase ("alínea b e a lei").
const FIRST_LETTER = String.raw`["“']?[a-z]["”']?(?![\p{L}\p{N}])`;
const NEXT_LETTER = String.raw`["“']?[b-np-z]["”']?(?![\p{L}\p{N}])`;

const TOKEN = new RegExp(
  [
    String.raw`(?<article>\b[Aa]rt(?:igo)?s?\.?\s*(?<articleNumber>\d+(?:\.\d+)*)\s*[º°o]?(?:\s*-\s*(?<articleSuffix>[A-Z])(?![\p{L}]))?)`,
    String.raw`(?<caput>\bcaput\b)`,
    String.raw`(?<paragraphSingle>\b[Pp]ar[áa]grafo\s+[úu]nico\b)`,
    String.raw`(?<paragraphs>(?:§§?|\b[Pp]ar[áa]grafos?\b)\s*${ORDINAL}(?:\s*(?:,|\be\b|\bou\b)\s*${ORDINAL})*)`,
    String.raw`(?<incisos>\b[Ii]nc(?:isos?\b|\.)\s*${ROMAN_LIST})`,
    String.raw`(?<alineas>(?:\b[Aa]l[íi]neas?|\b[Ll]etras?)\s+${FIRST_LETTER}(?:\s*(?:,|\be\b|\bou\b)\s*${NEXT_LETTER})*)`,
    String.raw`(?<bareRomans>${ROMAN_LIST})`,
  ].join("|"),
  "gu",
);

/** Só vírgulas, espaços e preposições entre duas referências: continuam a mesma cadeia. */
function isConnector(gap: string) {
  return !gap.replace(/\b(?:e|ou|do|da|de|dos|das|no|na|nos|nas|ao|c\/c)\b/giu, "").replace(/[\s,;()]/gu, "");
}

const VALID_ROMAN = /^(?:C|XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/u;

function romans(text: string) {
  return [...text.matchAll(new RegExp(ROMAN, "gu"))]
    .map((m) => m[0].replace(/\s/gu, ""))
    .filter((r) => VALID_ROMAN.test(r.split("-")[0]));
}

export function normalizeOrdinal(text: string) {
  return text.replace(/[\sº°]/gu, "").replace(/^(\d+)o/u, "$1").toUpperCase();
}

function ordinals(text: string) {
  return [...text.matchAll(new RegExp(ORDINAL, "gu"))].map((m) => normalizeOrdinal(m[0]));
}

function letters(text: string) {
  return text
    .replace(/^(?:[Aa]l[íi]neas?|[Ll]etras?)/u, "")
    .trim()
    .split(/\s*,\s*|\s+(?:e|ou)\s+/u)
    .map((item) => item.replace(/["“”']/gu, ""))
    .filter((item) => /^[a-z]$/u.test(item));
}

/**
 * Referências do texto. `articleNumber` é o número do artigo exibido; cadeia que cita outro
 * artigo ("art. 7º, II" num gabarito do art. 5º) é descartada.
 */
export function parseLegalReferences(text: string, articleNumber: string | null): LegalReference[] {
  const out: LegalReference[] = [];
  let chain: Chain | null = null;
  let lastEnd = 0;

  const close = () => {
    if (!chain) return;
    const current = chain;
    if (current.article === null || articleNumber === null || current.article === articleNumber) {
      // "alíneas a e c do inciso II": a alínea sem inciso fica sob o primeiro inciso citado depois dela.
      current.refs.forEach((ref, index) => {
        if (ref.kind !== "alinea" || ref.inciso) return;
        const later = current.refs.slice(index + 1).find((item) => item.kind === "inciso");
        if (later?.kind === "inciso") ref.inciso = later.value;
      });
      out.push(...current.refs);
    }
    chain = null;
  };

  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    const groups = match.groups ?? {};
    if (chain && !isConnector(text.slice(lastEnd, at))) close();
    lastEnd = at + match[0].length;

    if (groups.article) {
      const number = normalizeOrdinal(`${groups.articleNumber.replaceAll(".", "")}${groups.articleSuffix ? `-${groups.articleSuffix}` : ""}`);
      // "inciso II do art. 5º": o artigo citado depois completa a cadeia; outro artigo abre uma nova.
      if (chain && chain.article === null) chain.article = number;
      else {
        close();
        chain = { article: number, paragraph: null, inciso: null, refs: [] };
      }
      continue;
    }

    if (groups.bareRomans && !chain) continue;
    const active: Chain = chain ?? { article: null, paragraph: null, inciso: null, refs: [] };
    chain = active;

    if (groups.caput) {
      active.refs.push({ kind: "caput" });
      active.paragraph = null;
      active.inciso = null;
    } else if (groups.paragraphSingle) {
      active.refs.push({ kind: "paragraph", value: "UNICO" });
      active.paragraph = "UNICO";
      active.inciso = null;
    } else if (groups.paragraphs) {
      for (const value of ordinals(groups.paragraphs)) {
        active.refs.push({ kind: "paragraph", value });
        active.paragraph = value;
      }
      active.inciso = null;
    } else if (groups.incisos || groups.bareRomans) {
      for (const value of romans(groups.incisos ?? groups.bareRomans)) {
        active.refs.push({ kind: "inciso", value, paragraph: active.paragraph });
        active.inciso = value;
      }
    } else if (groups.alineas) {
      for (const value of letters(groups.alineas)) {
        active.refs.push({ kind: "alinea", value, paragraph: active.paragraph, inciso: active.inciso });
      }
    }
  }
  close();
  return out;
}

type UnitLabel = {
  kind: "caput" | "paragraph" | "inciso" | "alinea" | "other";
  value: string | null;
  paragraph: string | null;
  inciso: string | null;
};

/** Rótulo de cada unidade pelo começo dela, com o parágrafo e o inciso em que está. */
export function labelUnits(texts: string[]): UnitLabel[] {
  let paragraph: string | null = null;
  let inciso: string | null = null;
  return texts.map((raw, index) => {
    const text = raw.trimStart();
    const paragraphMatch = /^§\s*(\d+\s*[º°o]?(?:\s*-\s*[A-Z](?![\p{L}]))?)/u.exec(text);
    if (/^Par[áa]grafo\s+[úu]nico/iu.test(text) || paragraphMatch) {
      paragraph = paragraphMatch ? normalizeOrdinal(paragraphMatch[1]) : "UNICO";
      inciso = null;
      return { kind: "paragraph", value: paragraph, paragraph, inciso: null };
    }
    const incisoMatch = /^([IVXLC]+)(?:\s*-\s*([A-Z])(?![\p{L}]))?\s*[-–—]/u.exec(text);
    if (incisoMatch && VALID_ROMAN.test(incisoMatch[1])) {
      inciso = incisoMatch[2] ? `${incisoMatch[1]}-${incisoMatch[2]}` : incisoMatch[1];
      return { kind: "inciso", value: inciso, paragraph, inciso };
    }
    const alineaMatch = /^([a-z])\)/u.exec(text);
    if (alineaMatch) return { kind: "alinea", value: alineaMatch[1], paragraph, inciso };
    if (index === 0 && /^Art\.?\s*\d/iu.test(text)) return { kind: "caput", value: null, paragraph: null, inciso: null };
    return { kind: "other", value: null, paragraph, inciso };
  });
}

/** Número do artigo no começo do texto literal ("Art. 5º" → "5"), ou null. */
export function literalArticleNumber(literal: string) {
  const match = /^\s*Art\.?\s*(\d+(?:\.\d+)*)\s*[º°o]?(?:\s*-\s*([A-Z])(?![\p{L}]))?/iu.exec(literal);
  if (!match) return null;
  return normalizeOrdinal(`${match[1].replaceAll(".", "")}${match[2] ? `-${match[2]}` : ""}`);
}

/**
 * Índices das unidades citadas. Sem parágrafo na referência, vale o inciso do caput (o primeiro
 * com esse numeral); sem inciso, a primeira alínea com essa letra.
 */
export function referencedUnitIndexes(refs: LegalReference[], labels: UnitLabel[]): Set<number> {
  const found = new Set<number>();
  for (const ref of refs) {
    let index = -1;
    if (ref.kind === "caput") index = labels.findIndex((label) => label.kind === "caput");
    else if (ref.kind === "paragraph") index = labels.findIndex((label) => label.kind === "paragraph" && label.value === ref.value);
    else if (ref.kind === "inciso") {
      index = labels.findIndex((label) => label.kind === "inciso" && label.value === ref.value && label.paragraph === ref.paragraph);
      if (index < 0 && ref.paragraph === null) index = labels.findIndex((label) => label.kind === "inciso" && label.value === ref.value);
    } else {
      index = labels.findIndex(
        (label) =>
          label.kind === "alinea" &&
          label.value === ref.value &&
          (ref.inciso === null || label.inciso === ref.inciso) &&
          (ref.paragraph === null || label.paragraph === ref.paragraph),
      );
    }
    if (index >= 0) found.add(index);
  }
  return found;
}
