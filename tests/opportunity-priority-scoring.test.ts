import { describe, expect, it } from "vitest";

import {
  opportunityPriorityInputSchema,
  rankOpportunityPriorities,
  scoreOpportunityPriority,
} from "@/lib/opportunities/priority-scoring";

const baseInput = {
  itemId: "codigo-penal-art-121",
  lookbackYears: 10,
  eligibleExams: 20,
  examsWithOccurrence: 8,
  recentEligibleExams: 6,
  recentExamsWithOccurrence: 3,
  distinctYearsWithOccurrence: 6,
  editalAlignmentBps: 10_000,
  legalChangeRelevanceBps: 7_000,
  corpusBasis: "licensed_questions" as const,
  corpusRightsReference: "licenca-interna-2026-001",
};

describe("ranking estatístico de prioridades", () => {
  it("calcula incidência, intervalo e ranking sem chamar o resultado de probabilidade", () => {
    const score = scoreOpportunityPriority(baseInput);

    expect(score.historicalIncidenceBps).toBe(4_000);
    expect(score.recentIncidenceBps).toBe(5_000);
    expect(score.persistenceBps).toBe(6_000);
    expect(score.historicalIncidenceInterval95Bps[0]).toBeLessThan(4_000);
    expect(score.historicalIncidenceInterval95Bps[1]).toBeGreaterThan(4_000);
    expect(score.priorityScoreBps).toBe(6_150);
    expect(score.isForecastProbability).toBe(false);
    expect(score.limitations).toHaveLength(3);
  });

  it("prioriza evidência mais aderente e recente de modo determinístico", () => {
    const ranked = rankOpportunityPriorities([
      { ...baseInput, itemId: "baixo", recentExamsWithOccurrence: 0, editalAlignmentBps: 2_000 },
      { ...baseInput, itemId: "alto" },
    ]);

    expect(ranked.map((item) => item.itemId)).toEqual(["alto", "baixo"]);
  });

  it("rejeita corpus sem base autorizada e contagens incoerentes", () => {
    expect(() =>
      opportunityPriorityInputSchema.parse({ ...baseInput, corpusBasis: "public_web" }),
    ).toThrow();
    expect(() =>
      scoreOpportunityPriority({ ...baseInput, examsWithOccurrence: 21 }),
    ).toThrow(/não pode exceder/i);
    expect(() =>
      scoreOpportunityPriority({ ...baseInput, lookbackYears: 11 }),
    ).toThrow();
    expect(() =>
      scoreOpportunityPriority({
        ...baseInput,
        examsWithOccurrence: 2,
        recentExamsWithOccurrence: 3,
      }),
    ).toThrow(/recente/i);
    expect(() =>
      scoreOpportunityPriority({
        ...baseInput,
        examsWithOccurrence: 2,
        distinctYearsWithOccurrence: 3,
      }),
    ).toThrow(/anos com ocorrência/i);
  });
});
