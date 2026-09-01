import { z } from "zod";

export const OPPORTUNITY_PRIORITY_MODEL_VERSION = "priority-v1.0.0";

const authorizedCorpusSchema = z.enum(["licensed_questions", "mixed_authorized"]);

export const opportunityPriorityInputSchema = z
  .object({
    itemId: z.string().trim().min(1).max(180),
    lookbackYears: z.number().int().min(1).max(10),
    eligibleExams: z.number().int().min(1),
    examsWithOccurrence: z.number().int().min(0),
    recentEligibleExams: z.number().int().min(1),
    recentExamsWithOccurrence: z.number().int().min(0),
    distinctYearsWithOccurrence: z.number().int().min(0),
    editalAlignmentBps: z.number().int().min(0).max(10_000),
    legalChangeRelevanceBps: z.number().int().min(0).max(10_000),
    corpusBasis: authorizedCorpusSchema,
    corpusRightsReference: z.string().trim().min(3).max(2_000),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.examsWithOccurrence > input.eligibleExams) {
      context.addIssue({
        code: "custom",
        path: ["examsWithOccurrence"],
        message: "A ocorrência por prova não pode exceder a amostra elegível.",
      });
    }
    if (input.recentEligibleExams > input.eligibleExams) {
      context.addIssue({
        code: "custom",
        path: ["recentEligibleExams"],
        message: "A amostra recente não pode exceder a amostra total.",
      });
    }
    if (input.recentExamsWithOccurrence > input.recentEligibleExams) {
      context.addIssue({
        code: "custom",
        path: ["recentExamsWithOccurrence"],
        message: "A ocorrência recente não pode exceder a amostra recente.",
      });
    }
    if (input.recentExamsWithOccurrence > input.examsWithOccurrence) {
      context.addIssue({
        code: "custom",
        path: ["recentExamsWithOccurrence"],
        message: "A ocorrência recente não pode exceder a ocorrência histórica total.",
      });
    }
    if (input.distinctYearsWithOccurrence > input.lookbackYears) {
      context.addIssue({
        code: "custom",
        path: ["distinctYearsWithOccurrence"],
        message: "A persistência não pode exceder a janela histórica.",
      });
    }
    if (input.distinctYearsWithOccurrence > input.examsWithOccurrence) {
      context.addIssue({
        code: "custom",
        path: ["distinctYearsWithOccurrence"],
        message: "Os anos com ocorrência não podem exceder as provas com ocorrência.",
      });
    }
  });

export type OpportunityPriorityInput = z.infer<typeof opportunityPriorityInputSchema>;

export type OpportunityPriorityScore = Readonly<{
  itemId: string;
  methodologyVersion: typeof OPPORTUNITY_PRIORITY_MODEL_VERSION;
  historicalIncidenceBps: number;
  historicalIncidenceInterval95Bps: readonly [number, number];
  recentIncidenceBps: number;
  persistenceBps: number;
  editalAlignmentBps: number;
  legalChangeRelevanceBps: number;
  priorityScoreBps: number;
  evidenceConfidenceBps: number;
  isForecastProbability: false;
  sampleSize: number;
  corpusBasis: OpportunityPriorityInput["corpusBasis"];
  corpusRightsReference: string;
  limitations: readonly string[];
}>;

function clampBps(value: number) {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function rateBps(successes: number, trials: number) {
  return clampBps((successes / trials) * 10_000);
}

function wilsonInterval95Bps(successes: number, trials: number): readonly [number, number] {
  const z95 = 1.959963984540054;
  const proportion = successes / trials;
  const denominator = 1 + (z95 ** 2) / trials;
  const center = (proportion + (z95 ** 2) / (2 * trials)) / denominator;
  const margin =
    (z95 / denominator) *
    Math.sqrt((proportion * (1 - proportion)) / trials + (z95 ** 2) / (4 * trials ** 2));

  return Object.freeze([
    clampBps((center - margin) * 10_000),
    clampBps((center + margin) * 10_000),
  ]);
}

/**
 * Ranks study priorities from an authorized historical corpus. The score is a
 * transparent editorial ranking, not a probability that an item will appear in
 * a future exam.
 */
export function scoreOpportunityPriority(rawInput: OpportunityPriorityInput): OpportunityPriorityScore {
  const input = opportunityPriorityInputSchema.parse(rawInput);
  const historicalIncidenceBps = rateBps(input.examsWithOccurrence, input.eligibleExams);
  const recentIncidenceBps = rateBps(
    input.recentExamsWithOccurrence,
    input.recentEligibleExams,
  );
  const persistenceBps = rateBps(
    input.distinctYearsWithOccurrence,
    input.lookbackYears,
  );

  const priorityScoreBps = clampBps(
    historicalIncidenceBps * 0.35 +
      recentIncidenceBps * 0.2 +
      persistenceBps * 0.15 +
      input.editalAlignmentBps * 0.25 +
      input.legalChangeRelevanceBps * 0.05,
  );
  const sampleConfidence = input.eligibleExams / (input.eligibleExams + 10);
  const temporalCoverage = Math.min(1, input.lookbackYears / 10);
  const evidenceConfidenceBps = clampBps(
    10_000 * (sampleConfidence * 0.75 + temporalCoverage * 0.25),
  );

  return Object.freeze({
    itemId: input.itemId,
    methodologyVersion: OPPORTUNITY_PRIORITY_MODEL_VERSION,
    historicalIncidenceBps,
    historicalIncidenceInterval95Bps: wilsonInterval95Bps(
      input.examsWithOccurrence,
      input.eligibleExams,
    ),
    recentIncidenceBps,
    persistenceBps,
    editalAlignmentBps: input.editalAlignmentBps,
    legalChangeRelevanceBps: input.legalChangeRelevanceBps,
    priorityScoreBps,
    evidenceConfidenceBps,
    isForecastProbability: false,
    sampleSize: input.eligibleExams,
    corpusBasis: input.corpusBasis,
    corpusRightsReference: input.corpusRightsReference,
    limitations: Object.freeze([
      "Incidência histórica não garante cobrança futura.",
      "O ranking depende da comparabilidade, classificação e cobertura do corpus autorizado.",
      "Mudanças de edital, legislação ou responsável podem reduzir a utilidade do histórico.",
    ]),
  });
}

export function rankOpportunityPriorities(inputs: readonly OpportunityPriorityInput[]) {
  return Object.freeze(
    inputs
      .map(scoreOpportunityPriority)
      .toSorted(
        (left, right) =>
          right.priorityScoreBps - left.priorityScoreBps ||
          right.evidenceConfidenceBps - left.evidenceConfidenceBps ||
          left.itemId.localeCompare(right.itemId, "pt-BR"),
      ),
  );
}
