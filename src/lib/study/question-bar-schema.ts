import { z } from "zod";

import {
  QUESTION_REPORT_NOTES_MAX,
  QUESTION_REPORT_REASONS,
  type QuestionReportReason,
} from "@/lib/study/question-bar-contract";

const reasonValues = QUESTION_REPORT_REASONS.map((reason) => reason.value) as [
  QuestionReportReason,
  ...QuestionReportReason[],
];

const questionIdSchema = z.string().trim().min(1).max(160);

export const questionBarRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("history"), questionId: questionIdSchema }).strict(),
  z.object({ action: z.literal("stats"), questionId: questionIdSchema }).strict(),
  z.object({ action: z.literal("review"), questionId: questionIdSchema }).strict(),
  z
    .object({
      action: z.literal("report"),
      questionId: questionIdSchema,
      reason: z.enum(reasonValues),
      notes: z
        .string()
        .trim()
        .max(QUESTION_REPORT_NOTES_MAX, `Use no máximo ${QUESTION_REPORT_NOTES_MAX} caracteres.`)
        .optional()
        .transform((value) => (value ? value : undefined)),
    })
    .strict()
    .refine((value) => value.reason !== "other" || Boolean(value.notes && value.notes.length >= 10), {
      message: "Descreva o problema em pelo menos 10 caracteres.",
      path: ["notes"],
    }),
]);

export type QuestionBarRequest = z.infer<typeof questionBarRequestSchema>;
