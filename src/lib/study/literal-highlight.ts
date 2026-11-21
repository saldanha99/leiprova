/**
 * Grifo do texto literal do artigo no gabarito (sem IA, determinístico).
 *
 * - Divide o artigo em unidades (caput, parágrafos, incisos, alíneas) e escolhe as que mais
 *   coincidem com o enunciado e as alternativas.
 * - "match": palavras da lei que a versão correta do item repete (o item confirma a lei).
 * - "trap": palavras da lei que a versão errada trocou ou omitiu (o ponto da pegadinha).
 * Só palavras significativas entram (números, ou 4+ letras fora das palavras vazias), para o
 * grifo apontar prazo, competência, exceção e verbo, não artigos e preposições.
 */

export type LiteralSegment = { text: string; kind: "plain" | "match" | "trap" };

/** Trecho literal do artigo, grifado, que vai ao gabarito (usado no servidor e no cliente). */
export type LiteralFeedback = {
  articleRef: string;
  actTitle: string;
  segments: LiteralSegment[];
  hasTrap: boolean;
};

export type LiteralHighlightInput = {
  literalText: string;
  prompt: string;
  type: string;
  options: { key: string; text: string; isCorrect: boolean }[];
  /** Alternativa escolhida pelo aluno (opcional). */
  selectedKey?: string | null;
};

export type LiteralHighlight = {
  segments: LiteralSegment[];
  hasTrap: boolean;
  hasMatch: boolean;
};

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de da do das dos em na no nas nos por pela pelo pelas pelos para com sem sob " +
    "sobre entre ate até e ou que se ser sera será sao são esta está este esse essa isso aquele aquela " +
    "como mais menos muito pouco qual quais quando onde todo toda todos todas cada outro outra outros outras " +
    "lei artigo art caput item julgue alternativa assinale correta incorreta afirmar afirmação segundo conforme " +
    "termos nos texto dispositivo hipótese hipotese situação situacao seguinte seguintes acordo caso"
  ).split(/\s+/),
);

/** Negação, exceção e restrição: curtas, mas costumam ser o ponto da pegadinha. */
const DECISIVE = new Set(["nao", "nem", "nunca", "salvo", "exceto", "vedado", "vedada", "somente", "apenas", "sempre", "independentemente"]);

/** Acima disso a alternativa foi reescrita (não é uma troca pontual): sem grifo vermelho. */
export const MAX_TRAP_WORDS = 4;

const WORD = /[\p{L}\p{N}ºª°§]+/gu;

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ºª°]/g, "");
}

function significant(norm: string): boolean {
  if (!norm) return false;
  if (/^\d+$/.test(norm) || DECISIVE.has(norm)) return true;
  return norm.length >= 4 && !STOPWORDS.has(norm);
}

function wordSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(WORD)) {
    const n = normalizeWord(m[0]);
    if (significant(n)) out.add(n);
  }
  return out;
}

/** Unidades do artigo: quebras de linha e marcadores de parágrafo, inciso e alínea. */
function splitUnits(literal: string): { start: number; end: number }[] {
  const marks: number[] = [0];
  const re = /(\n+|(?<=[.;:])\s+(?=(§\s*\d|Parágrafo único|[IVXLC]+\s*[-–—]|[a-z]\)\s)))/g;
  for (const m of literal.matchAll(re)) marks.push((m.index ?? 0) + m[0].length);
  marks.push(literal.length);
  const units: { start: number; end: number }[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    if (marks[i + 1] > marks[i]) units.push({ start: marks[i], end: marks[i + 1] });
  }
  return units;
}

function isTrueFalse(type: string, options: LiteralHighlightInput["options"]): boolean {
  if (type === "true_false") return true;
  const keys = options.map((o) => normalizeWord(o.text)).sort().join("|");
  return options.length === 2 && keys === "certo|errado";
}

export function highlightLiteral(input: LiteralHighlightInput): LiteralHighlight {
  const literal = input.literalText ?? "";
  if (!literal.trim()) return { segments: [], hasTrap: false, hasMatch: false };

  const tf = isTrueFalse(input.type, input.options);
  const correct = input.options.find((o) => o.isCorrect);
  const promptWords = wordSet(`${input.prompt} ${input.options.map((o) => o.text).join(" ")}`);
  // O que a versão correta do item diz (verde) e onde está a troca (vermelho).
  let matchWords: Set<string>;
  let trapWords: Set<string> = new Set();
  let tfWrongPrompt: Set<string> | null = null;
  if (tf) {
    const answerIsTrue = correct ? normalizeWord(correct.text) === "certo" : true;
    matchWords = wordSet(input.prompt);
    if (!answerIsTrue) tfWrongPrompt = matchWords;
  } else {
    const correctWords = wordSet(correct?.text ?? "");
    matchWords = new Set([...wordSet(input.prompt), ...correctWords]);
    const selected = input.options.find((o) => o.key === input.selectedKey && !o.isCorrect);
    if (selected) {
      const wrong = wordSet(selected.text);
      trapWords = new Set([...correctWords].filter((w) => !wrong.has(w)));
      if (trapWords.size > MAX_TRAP_WORDS) trapWords = new Set();
    }
  }
  const units = splitUnits(literal);

  // Unidades em foco: as de maior coincidência com o que a questão fala.
  const scores = units.map((u) => {
    const words = wordSet(literal.slice(u.start, u.end));
    let hits = 0;
    for (const w of words) if (promptWords.has(w)) hits++;
    return hits;
  });
  const best = Math.max(0, ...scores);
  const focus = new Set(scores.map((s, i) => (best >= 2 && s >= Math.max(2, best * 0.6) ? i : -1)).filter((i) => i >= 0));

  const segments: LiteralSegment[] = [];
  let hasTrap = false;
  let hasMatch = false;
  const push = (text: string, kind: LiteralSegment["kind"]) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += text;
    else segments.push({ text, kind });
  };

  units.forEach((unit, index) => {
    const text = literal.slice(unit.start, unit.end);
    if (!focus.has(index)) return push(text, "plain");
    const words = [...text.matchAll(WORD)].map((m) => ({ at: m.index ?? 0, raw: m[0], norm: normalizeWord(m[0]) }));
    // Certo/Errado com gabarito "Errado": a troca fica entre a 1ª e a última palavra que o
    // enunciado repete; ali, a palavra da lei que o enunciado não traz é o ponto da pegadinha.
    let first = -1;
    let last = -1;
    if (tfWrongPrompt) {
      words.forEach((w, i) => {
        if (significant(w.norm) && tfWrongPrompt!.has(w.norm)) {
          if (first < 0) first = i;
          last = i;
        }
      });
    }
    let cursor = 0;
    words.forEach((w, i) => {
      push(text.slice(cursor, w.at), "plain");
      let kind: LiteralSegment["kind"] = "plain";
      if (significant(w.norm)) {
        if (trapWords.has(w.norm)) kind = "trap";
        else if (tfWrongPrompt && first >= 0 && i > first && i < last && !tfWrongPrompt.has(w.norm)) kind = "trap";
        else if (matchWords.has(w.norm)) kind = "match";
      }
      if (kind === "trap") hasTrap = true;
      if (kind === "match") hasMatch = true;
      push(w.raw, kind);
      cursor = w.at + w.raw.length;
    });
    push(text.slice(cursor), "plain");
  });

  // Troca pontual: poucas palavras. Muitas = item reescrito; o vermelho viraria ruído.
  const trapDistinct = new Set(segments.filter((seg) => seg.kind === "trap").flatMap((seg) => [...seg.text.matchAll(WORD)].map((m) => normalizeWord(m[0]))));
  if (trapDistinct.size > MAX_TRAP_WORDS) {
    for (const seg of segments) if (seg.kind === "trap") seg.kind = "plain";
    hasTrap = false;
  }

  // Sem foco confiável: devolve o texto sem grifo (melhor nada do que grifo errado).
  if (!focus.size) return { segments: [{ text: literal, kind: "plain" }], hasTrap: false, hasMatch: false };
  return { segments, hasTrap, hasMatch };
}
