import type { QuizBankSlug } from "@/lib/quiz/catalog";

export type EditorialQuestionFormat = "multiple_choice" | "true_false";

export type StyleProfileSeed = {
  readonly bankSlug: QuizBankSlug;
  readonly format: EditorialQuestionFormat;
  readonly commandStyle: string;
  readonly reasoningDemand: string;
  readonly authoringGuidelines: readonly string[];
  readonly distractorGuidance: readonly string[];
  readonly prohibitedPatterns: readonly string[];
  readonly disclaimer: string;
};

const COMMON_PROHIBITIONS = [
  "Não consultar, colar, resumir nem parafrasear uma questão de prova durante a autoria.",
  "Não conservar personagens, números, sequência argumentativa ou alternativas de uma questão de terceiros.",
  "Não atribuir a questão à banca: a classificação descreve somente um perfil editorial interno.",
] as const;

const DISCLAIMER =
  "Perfil editorial interno e abstrato, criado para orientar questões inéditas. Não contém nem deriva do texto de questões de terceiros e não representa material oficial da banca.";

export const STYLE_PROFILE_SEEDS = [
  {
    bankSlug: "vunesp",
    format: "multiple_choice",
    commandStyle: "Enunciado direto, contexto enxuto e uma tarefa central claramente delimitada.",
    reasoningDemand: "Aplicação objetiva da regra legal a uma situação curta, com leitura precisa do dispositivo.",
    authoringGuidelines: [
      "Apresente apenas os fatos necessários para aplicar a regra legal escolhida.",
      "Use linguagem acessível sem eliminar a precisão jurídica.",
      "Faça a resposta depender de um ponto verificável no artigo de origem.",
    ],
    distractorGuidance: [
      "Troca controlada de requisito, sujeito ou consequência jurídica.",
      "Generalização indevida de uma exceção prevista no texto legal.",
      "Confusão entre institutos próximos, sem criar ambiguidade interpretativa.",
    ],
    prohibitedPatterns: COMMON_PROHIBITIONS,
    disclaimer: DISCLAIMER,
  },
  {
    bankSlug: "fgv",
    format: "multiple_choice",
    commandStyle: "Situação-problema contextualizada, comando analítico e alternativas juridicamente próximas.",
    reasoningDemand: "Identificação da consequência legal correta a partir de fatos relevantes e limites normativos.",
    authoringGuidelines: [
      "Construa um caso inteiramente novo a partir do dispositivo oficial selecionado.",
      "Inclua somente fatos que alterem ou testem a aplicação da regra.",
      "Exija uma decisão jurídica clara, sem depender de informação externa à fonte declarada.",
    ],
    distractorGuidance: [
      "Consequência correta aplicada ao sujeito ou momento processual errado.",
      "Exceção plausível que não incide nos fatos inéditos apresentados.",
      "Conclusão parcialmente correta com fundamento legal incompatível.",
    ],
    prohibitedPatterns: COMMON_PROHIBITIONS,
    disclaimer: DISCLAIMER,
  },
  {
    bankSlug: "fcc",
    format: "multiple_choice",
    commandStyle: "Comando estruturado, vocabulário técnico moderado e foco em distinções legais precisas.",
    reasoningDemand: "Reconhecimento de requisitos, competências, prazos ou efeitos previstos literalmente na norma.",
    authoringGuidelines: [
      "Escolha uma única distinção normativa relevante como núcleo da questão.",
      "Mantenha paralelismo sintático entre todas as alternativas.",
      "Evite pistas gramaticais e faça a justificativa citar o trecho legal determinante.",
    ],
    distractorGuidance: [
      "Inversão de competência, prazo, condição ou efeito jurídico.",
      "Combinação de duas proposições verdadeiras em relação normativa incorreta.",
      "Uso de termo absoluto quando a norma prevê condição ou ressalva.",
    ],
    prohibitedPatterns: COMMON_PROHIBITIONS,
    disclaimer: DISCLAIMER,
  },
  {
    bankSlug: "cebraspe",
    format: "true_false",
    commandStyle: "Item autônomo de certo ou errado, redigido como uma única assertiva verificável.",
    reasoningDemand: "Julgamento integral da assertiva com atenção a qualificadores, exceções e alcance da regra legal.",
    authoringGuidelines: [
      "Formule uma única proposição, sem depender de outro item ou de contexto oculto.",
      "Faça a correção decorrer integralmente da fonte oficial selecionada.",
      "Quando o item for errado, altere um único elemento juridicamente relevante.",
    ],
    distractorGuidance: [
      "Troca pontual de sujeito, prazo, condição, competência ou exceção.",
      "Supressão de qualificador indispensável previsto na norma.",
      "Ampliação ou restrição indevida do alcance do dispositivo.",
    ],
    prohibitedPatterns: COMMON_PROHIBITIONS,
    disclaimer: DISCLAIMER,
  },
] as const satisfies readonly StyleProfileSeed[];

export function getStyleProfileSeed(bankSlug: QuizBankSlug) {
  return STYLE_PROFILE_SEEDS.find((profile) => profile.bankSlug === bankSlug);
}
