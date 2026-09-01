import { z } from "zod";

import {
  getCareerBySlug,
  getSubjectsForCareer,
  quizBanks,
  quizCareerTracks,
  quizModes,
  quizSubjects,
} from "./catalog";

const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const quizSessionRequestSchema = z
  .object({
    path: z.enum(["career", "bank"]),
    careerSlug: slugSchema.optional(),
    specializationSlug: slugSchema.optional(),
    bankSlug: slugSchema.optional(),
    subjectSlug: slugSchema.optional(),
    topicSlug: slugSchema.optional(),
    mode: z.enum(["dry_law", "previous_exam", "original_style"]),
    count: z.number().int().min(1).max(50),
    experience: z.enum(["training", "exam"]).default("training"),
    timed: z.boolean().default(false),
    examScope: z.enum(["latest", "all"]).default("latest"),
    examEditionId: slugSchema.optional(),
  })
  .strict()
  .superRefine((selection, context) => {
    const career = selection.careerSlug ? getCareerBySlug(selection.careerSlug) : undefined;
    const bank = selection.bankSlug
      ? quizBanks.find((candidate) => candidate.slug === selection.bankSlug)
      : undefined;
    const subject = selection.subjectSlug
      ? quizSubjects.find((candidate) => candidate.slug === selection.subjectSlug)
      : undefined;
    const topic =
      subject && selection.topicSlug
        ? subject.topics.find((candidate) => candidate.slug === selection.topicSlug)
        : undefined;

    if (selection.path === "career" && !selection.careerSlug) {
      context.addIssue({ code: "custom", path: ["careerSlug"], message: "Selecione uma carreira." });
    }
    if (selection.path === "bank" && !selection.bankSlug) {
      context.addIssue({ code: "custom", path: ["bankSlug"], message: "Selecione uma banca." });
    }
    if (selection.path === "bank" && !selection.subjectSlug) {
      context.addIssue({ code: "custom", path: ["subjectSlug"], message: "Selecione uma matéria." });
    }
    if (selection.path === "bank" && (selection.careerSlug || selection.specializationSlug)) {
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: "O caminho por banca não aceita carreira ou especialização.",
      });
    }
    if (selection.path === "career" && selection.bankSlug) {
      context.addIssue({
        code: "custom",
        path: ["bankSlug"],
        message: "A banca deve ser derivada da edição oficial selecionada.",
      });
    }
    if (selection.path === "bank" && selection.examEditionId) {
      context.addIssue({
        code: "custom",
        path: ["examEditionId"],
        message: "O caminho por banca não aceita uma edição de carreira específica.",
      });
    }
    if (selection.careerSlug && !career) {
      context.addIssue({ code: "custom", path: ["careerSlug"], message: "Carreira inválida." });
    }
    if (selection.bankSlug && !bank) {
      context.addIssue({ code: "custom", path: ["bankSlug"], message: "Banca inválida." });
    }
    if (selection.subjectSlug && !subject) {
      context.addIssue({ code: "custom", path: ["subjectSlug"], message: "Matéria inválida." });
    }
    if (selection.topicSlug && !selection.subjectSlug) {
      context.addIssue({
        code: "custom",
        path: ["topicSlug"],
        message: "Selecione uma matéria antes do tópico.",
      });
    } else if (selection.topicSlug && !topic) {
      context.addIssue({ code: "custom", path: ["topicSlug"], message: "Tópico inválido para a matéria." });
    }
    if (
      career &&
      selection.subjectSlug &&
      !getSubjectsForCareer(career.slug).some((candidate) => candidate.slug === selection.subjectSlug)
    ) {
      context.addIssue({
        code: "custom",
        path: ["subjectSlug"],
        message: "Matéria indisponível para a carreira selecionada.",
      });
    }
    if (selection.specializationSlug) {
      if (!career) {
        context.addIssue({
          code: "custom",
          path: ["specializationSlug"],
          message: "Selecione a carreira antes da especialização.",
        });
      } else if (!career.specializations.some((item) => item.slug === selection.specializationSlug)) {
        context.addIssue({
          code: "custom",
          path: ["specializationSlug"],
          message: "Especialização inválida para a carreira.",
        });
      }
    } else if (selection.path === "career" && career?.specializations.length) {
      context.addIssue({
        code: "custom",
        path: ["specializationSlug"],
        message: "Selecione a especialização da carreira.",
      });
    }
    if (
      selection.path === "career" &&
      (selection.mode === "previous_exam" || selection.mode === "original_style") &&
      !selection.examEditionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["examEditionId"],
        message: "Selecione a edição oficial que determina a banca desta carreira.",
      });
    }
    if (
      selection.path === "career" &&
      !selection.subjectSlug &&
      (selection.mode !== "previous_exam" || selection.examScope === "all")
    ) {
      context.addIssue({
        code: "custom",
        path: ["subjectSlug"],
        message: "Selecione uma matéria para este tipo de sessão.",
      });
    }
    if (selection.examEditionId && selection.examScope !== "latest") {
      context.addIssue({
        code: "custom",
        path: ["examScope"],
        message: "Uma edição específica não pode ser combinada com todas as edições.",
      });
    }
  });

export type QuizSessionRequest = z.infer<typeof quizSessionRequestSchema>;

export type ResolvedCatalogSelection = {
  request: QuizSessionRequest;
  career: (typeof quizCareerTracks)[number] | null;
  specialization: { readonly slug: string; readonly name: string } | null;
  bank: (typeof quizBanks)[number] | null;
  subject: (typeof quizSubjects)[number] | null;
  topic: { readonly slug: string; readonly name: string } | null;
  mode: (typeof quizModes)[number];
};

export function resolveCatalogSelection(request: QuizSessionRequest): ResolvedCatalogSelection {
  const career = request.careerSlug ? (getCareerBySlug(request.careerSlug) ?? null) : null;
  const specialization = request.specializationSlug
    ? (career?.specializations.find((item) => item.slug === request.specializationSlug) ?? null)
    : null;
  const bank = request.bankSlug
    ? (quizBanks.find((candidate) => candidate.slug === request.bankSlug) ?? null)
    : null;
  const subject = request.subjectSlug
    ? (quizSubjects.find((candidate) => candidate.slug === request.subjectSlug) ?? null)
    : null;
  const topic = request.topicSlug
    ? (subject?.topics.find((candidate) => candidate.slug === request.topicSlug) ?? null)
    : null;
  const mode = quizModes.find((candidate) => candidate.slug === request.mode);
  if (!mode) throw new Error("Modo de quiz inválido após validação.");

  return { request, career, specialization, bank, subject, topic, mode };
}

export const quizAnswerRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    questionId: slugSchema,
    optionId: z.string().trim().min(1).max(16),
    durationMs: z.number().int().min(0).max(60 * 60 * 1_000).optional(),
  })
  .strict();

export const quizFinishRequestSchema = z.object({ sessionId: z.string().uuid() }).strict();

export type QuizQuestionSource = {
  kind: "official_law" | "licensed_exam" | "authorial";
  label: string;
  url: string | null;
  verifiedAt: string;
};

export type QuizSessionQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  difficulty: number;
  subject: { slug: string; name: string } | null;
  topic: { slug: string; name: string } | null;
  articleRef: string | null;
  legalAct: string | null;
  source: QuizQuestionSource;
};
