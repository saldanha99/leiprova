import { z } from "zod";

export const editorialQuestionTypeSchema = z.enum(["multiple_choice", "true_false"]);
export const authorshipMethodSchema = z.enum(["human", "ai_assisted"]);

const optionSchema = z.object({
  key: z.string().trim().min(1).max(2),
  text: z.string().trim().min(2, "Preencha o texto de todas as alternativas.").max(1200),
  isCorrect: z.boolean(),
  rationale: z.string().trim().max(1200).optional().default(""),
});

export const originalQuestionDraftSchema = z
  .object({
    styleBankId: z.coerce.number().int().positive(),
    legalArticleId: z.coerce.number().int().positive(),
    subjectId: z.coerce.number().int().positive(),
    topicId: z.coerce.number().int().positive(),
    type: editorialQuestionTypeSchema,
    learningObjective: z.string().trim().min(12).max(500),
    prompt: z.string().trim().min(30).max(4000),
    explanation: z.string().trim().min(30).max(5000),
    difficulty: z.coerce.number().int().min(1).max(5),
    authorshipMethod: authorshipMethodSchema,
    generatorModel: z.string().trim().max(120).optional().default(""),
    promptVersion: z.string().trim().max(120).optional().default(""),
    cleanRoomAttestation: z.literal(true, {
      error: "Confirme a declaração de autoria limpa antes de enviar.",
    }),
    options: z.array(optionSchema).min(2).max(5),
  })
  .superRefine((value, context) => {
    const expectedKeys = value.type === "true_false" ? ["C", "E"] : ["A", "B", "C", "D", "E"];
    const actualKeys = value.options.map((option) => option.key);

    if (actualKeys.join(",") !== expectedKeys.join(",")) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: `O formato ${value.type === "true_false" ? "certo ou errado" : "múltipla escolha"} exige as opções ${expectedKeys.join(", ")}.`,
      });
    }

    if (value.options.filter((option) => option.isCorrect).length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Marque exatamente uma resposta correta.",
      });
    }

    if (value.authorshipMethod === "ai_assisted" && (!value.generatorModel || !value.promptVersion)) {
      context.addIssue({
        code: "custom",
        path: ["generatorModel"],
        message: "Registre o modelo e a versão do prompt quando houver assistência de IA.",
      });
    }
  });

export type OriginalQuestionDraftInput = z.infer<typeof originalQuestionDraftSchema>;

export type ReviewTransitionInput = {
  status: string;
  creatorUserId: number | null;
  reviewerUserId: number;
  cleanRoomAttestedAt: Date | null;
};

export function validateIndependentReview(input: ReviewTransitionInput) {
  if (input.status !== "pending_review") {
    return { allowed: false, reason: "Somente itens pendentes podem ser revisados." } as const;
  }
  if (!input.creatorUserId || !input.cleanRoomAttestedAt) {
    return { allowed: false, reason: "O item não possui autoria limpa e responsável registrados." } as const;
  }
  if (input.creatorUserId === input.reviewerUserId) {
    return { allowed: false, reason: "A revisão precisa ser feita por outra pessoa." } as const;
  }
  return { allowed: true, reason: null } as const;
}
