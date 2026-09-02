import { createHash } from "node:crypto";

export const NOTICE_QUESTION_GENERATOR_VERSION = "notice-source-grounded-v1";

type QuestionFormat = "multiple_choice" | "true_false";

export type NoticeQuestionGeneratorInput = Readonly<{
  bankSlug: string;
  format: QuestionFormat;
  requirementText: string;
  sourceLocator: string;
  topicName: string;
  actTitle: string;
  articleRef: string;
  literalText: string;
}>;

export type GeneratedNoticeQuestion = Readonly<{
  type: QuestionFormat;
  prompt: string;
  explanation: string;
  learningObjective: string;
  difficulty: number;
  mutationKind: string;
  options: readonly Readonly<{
    key: string;
    text: string;
    isCorrect: boolean;
    rationale: string;
    mutationKind: string | null;
  }>[];
}>;

function normalizeLiteralText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sourceExcerpt(value: string) {
  const normalized = normalizeLiteralText(value);
  if (normalized.length < 40) {
    throw new Error("O artigo oficial é curto demais para gerar uma questão segura.");
  }
  if (normalized.length > 900) {
    throw new Error(
      "O artigo oficial excede 900 caracteres. Vincule o requisito a um dispositivo mais específico antes de gerar.",
    );
  }
  return normalized;
}

const CONTROLLED_REPLACEMENTS = [
  [/\bpoderá\b/i, "deverá"],
  [/\bdeverá\b/i, "poderá"],
  [/\bsomente\b/i, "preferencialmente"],
  [/\bexclusivamente\b/i, "preferencialmente"],
  [/\bvedad[oa]s?\b/i, "permitido"],
  [/\bproibid[oa]s?\b/i, "permitido"],
  [/\bantes\b/i, "depois"],
  [/\bapós\b/i, "antes"],
  [/\bmaioria absoluta\b/i, "maioria simples"],
  [/\be\b/i, "ou"],
  [/\bou\b/i, "e"],
] as const;

function createControlledMutations(literalText: string) {
  const candidates: string[] = [];
  const add = (candidate: string) => {
    const normalized = normalizeLiteralText(candidate);
    if (
      normalized !== literalText &&
      normalized.length <= 1_200 &&
      !candidates.includes(normalized)
    ) {
      candidates.push(normalized);
    }
  };

  for (const [pattern, replacement] of CONTROLLED_REPLACEMENTS) {
    if (pattern.test(literalText)) add(literalText.replace(pattern, replacement));
  }

  const numberMatch = literalText.match(/\b\d{1,3}\b/);
  if (numberMatch) {
    const value = Number(numberMatch[0]);
    add(literalText.replace(numberMatch[0], String(value === 999 ? 998 : value + 1)));
  }

  const withoutFinalPunctuation = literalText.replace(/[.;:]$/, "");
  add(`${withoutFinalPunctuation}, em qualquer hipótese.`);
  add(`${withoutFinalPunctuation}, independentemente de previsão legal.`);
  add(`${withoutFinalPunctuation}, exclusivamente por decisão administrativa.`);
  add(`Em caráter absoluto, ${literalText.charAt(0).toLowerCase()}${literalText.slice(1)}`);

  if (candidates.length < 4) {
    throw new Error("O dispositivo não permite quatro mutações controladas distintas.");
  }
  return candidates.slice(0, 4);
}

function hashByte(value: string) {
  return createHash("sha256").update(value).digest()[0] ?? 0;
}

function clip(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;
}

function multipleChoicePrompt(input: NoticeQuestionGeneratorInput) {
  const context = `conteúdo programático “${input.requirementText}” (${input.sourceLocator})`;
  if (input.bankSlug === "fgv") {
    return `Durante a preparação para o concurso, uma candidata revisa o ${context}. Considerando exclusivamente a fonte oficial indicada, assinale a alternativa que reproduz corretamente a regra vigente.`;
  }
  if (input.bankSlug === "fcc") {
    return `A respeito do ${context}, assinale a alternativa cuja redação corresponde ao dispositivo oficial vigente.`;
  }
  return `Com base no ${context}, assinale a alternativa que reproduz corretamente a redação oficial vigente.`;
}

export function buildNoticeQuestionDraft(
  input: NoticeQuestionGeneratorInput,
): GeneratedNoticeQuestion {
  const literalText = sourceExcerpt(input.literalText);
  const mutations = createControlledMutations(literalText);
  const explanation = `A resposta decorre diretamente de ${input.actTitle}, ${input.articleRef}. O requisito foi associado ao local “${input.sourceLocator}” do edital e a redação usada na correção vem da fonte oficial vigente.`;
  const learningObjective = clip(
    `Reconhecer com precisão a regra de ${input.articleRef} exigida no tópico “${input.requirementText}”.`,
    500,
  );

  if (input.format === "true_false") {
    const useExactStatement = hashByte(`${input.requirementText}|${input.articleRef}`) % 2 === 0;
    const statement = useExactStatement ? literalText : mutations[0];
    return Object.freeze({
      type: "true_false",
      prompt: `Considerando o conteúdo programático “${input.requirementText}” do edital, julgue o item a seguir.\n\n${statement}`,
      explanation: useExactStatement
        ? `${explanation} O item mantém a redação oficial e, por isso, está certo.`
        : `${explanation} O item contém uma alteração controlada e, por isso, está errado.`,
      learningObjective,
      difficulty: 2,
      mutationKind: useExactStatement ? "official_text_exact" : "controlled_source_mutation",
      options: Object.freeze([
        Object.freeze({
          key: "C",
          text: "Certo",
          isCorrect: useExactStatement,
          rationale: useExactStatement ? "A assertiva conserva a redação oficial." : "A assertiva altera a fonte oficial.",
          mutationKind: null,
        }),
        Object.freeze({
          key: "E",
          text: "Errado",
          isCorrect: !useExactStatement,
          rationale: useExactStatement ? "A assertiva conserva a redação oficial." : "A assertiva altera a fonte oficial.",
          mutationKind: useExactStatement ? null : "controlled_source_mutation",
        }),
      ]),
    });
  }

  const correctIndex = hashByte(`${input.bankSlug}|${input.requirementText}|${input.articleRef}`) % 5;
  const alternatives = [...mutations];
  alternatives.splice(correctIndex, 0, literalText);

  return Object.freeze({
    type: "multiple_choice",
    prompt: multipleChoicePrompt(input),
    explanation,
    learningObjective,
    difficulty: 2,
    mutationKind: "literal_selection",
    options: Object.freeze(
      alternatives.map((text, index) =>
        Object.freeze({
          key: String.fromCharCode(65 + index),
          text,
          isCorrect: index === correctIndex,
          rationale:
            index === correctIndex
              ? "Corresponde à redação da fonte oficial vigente."
              : "Contém uma alteração controlada e não reproduz a redação oficial.",
          mutationKind: index === correctIndex ? null : "controlled_source_mutation",
        }),
      ),
    ),
  });
}

export function deterministicNoticeQuestionUuid(signature: string) {
  const bytes = createHash("sha256").update(signature).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
