import type { QuizExamEditionOption } from "@/lib/quiz/exam-edition-catalog";

import { isQuizConfigReady, type QuizConfig } from "./types";

export type QuizPresetSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const defaultQuizConfig: QuizConfig = {
  path: "career",
  count: 10,
  experience: "training",
  timed: false,
  examScope: "latest",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function quizConfigFromSearchParams(
  params: QuizPresetSearchParams,
  examEditions: readonly QuizExamEditionOption[],
): QuizConfig {
  const countValue = Number(first(params.quantidade));
  const count = ([5, 10, 20] as const).find((item) => item === countValue) ?? 10;
  const yearValue = Number(first(params.ano));
  const config: QuizConfig = {
    path: first(params.caminho) === "banca" ? "bank" : "career",
    careerSlug: first(params.carreira),
    specializationSlug: first(params.especializacao),
    examYear: Number.isInteger(yearValue) && yearValue > 2000 ? yearValue : undefined,
    examEditionId: first(params.edicao),
    bankSlug: first(params.banca),
    subjectSlug: first(params.materia),
    topicSlug: first(params.topico),
    mode: first(params.modo),
    count,
    experience: first(params.experiencia) === "prova" ? "exam" : "training",
    timed: first(params.cronometrado) === "1",
    examScope: first(params.escopo) === "todas" ? "all" : "latest",
  };

  return isQuizConfigReady(config, examEditions) ? config : defaultQuizConfig;
}

export function quizPresetHref(config: QuizConfig) {
  const params = new URLSearchParams();
  params.set("caminho", config.path === "bank" ? "banca" : "carreira");
  if (config.careerSlug) params.set("carreira", config.careerSlug);
  if (config.specializationSlug) params.set("especializacao", config.specializationSlug);
  if (config.examYear) params.set("ano", String(config.examYear));
  if (config.examEditionId) params.set("edicao", config.examEditionId);
  if (config.bankSlug) params.set("banca", config.bankSlug);
  if (config.subjectSlug) params.set("materia", config.subjectSlug);
  if (config.topicSlug) params.set("topico", config.topicSlug);
  if (config.mode) params.set("modo", config.mode);
  params.set("quantidade", String(config.count));
  params.set("experiencia", config.experience === "exam" ? "prova" : "treino");
  params.set("cronometrado", config.timed ? "1" : "0");
  params.set("escopo", config.examScope === "all" ? "todas" : "ultima");
  return `/app/quiz?${params.toString()}`;
}
