import { describe, expect, it } from "vitest";

import { DEMO_QUESTIONS } from "@/lib/demo-content";
import {
  FREE_STUDY_QUESTION_IDS,
  canStudyQuestion,
} from "@/lib/study/access-policy";

describe("study access policy", () => {
  const publicDemoIds = [
    DEMO_QUESTIONS[0].slug,
    DEMO_QUESTIONS[3].slug,
    DEMO_QUESTIONS[6].slug,
    DEMO_QUESTIONS[8].slug,
    DEMO_QUESTIONS[10].slug,
  ];

  it("mantém a faixa gratuita igual às cinco questões da demonstração", () => {
    expect(FREE_STUDY_QUESTION_IDS).toEqual(publicDemoIds);
  });

  it("impede uma conta gratuita de responder por ID fora da demonstração", () => {
    expect(canStudyQuestion({ hasFullAccess: false }, publicDemoIds[0])).toBe(true);
    expect(canStudyQuestion({ hasFullAccess: false }, DEMO_QUESTIONS[1].slug)).toBe(false);
  });

  it("libera o acervo completo para uma assinatura válida", () => {
    expect(canStudyQuestion({ hasFullAccess: true }, DEMO_QUESTIONS[1].slug)).toBe(true);
  });
});
