import { createHash } from "node:crypto";
import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{64}$/u);
export const productBindingReviewSchema = z.object({
  schemaVersion: z.literal(1),
  productSlug: z.string().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  opportunityPublicId: z.uuid(),
  examEditionPublicId: z.uuid(),
  bindingIds: z.array(sha).min(1).max(250),
  notes: z.string().trim().min(20).max(2_000),
  decision: z.enum(["approve", "reject"]).default("approve"),
  confirmations: z.object({ edition: z.boolean(), program: z.boolean(), adherence: z.boolean() }).strict(),
  ownerOverride: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (new Set(value.bindingIds).size !== value.bindingIds.length) {
    context.addIssue({ code: "custom", path: ["bindingIds"], message: "Selecione IDs de vínculo distintos." });
  }
});
export type ProductBindingReviewInput = z.infer<typeof productBindingReviewSchema>;
export const productBindingReviewDossierSchema = z.object({
  bindingId: sha,
  questionId: z.number().int().positive().safe(),
  proposedByUserId: z.number().int().positive().safe(),
  productSlug: z.string(),
  opportunityPublicId: z.uuid(),
  bindingStatus: z.string(),
  eligible: z.boolean(),
  snapshot: z.record(z.string(), z.unknown()),
}).strict();
export type ProductBindingReviewDossier = z.infer<typeof productBindingReviewDossierSchema>;
export class ProductBindingReviewError extends Error {}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

/** A confirmação não altera o dossiê: o humano marca os três checks depois do preview. */
export function productBindingReviewFingerprint(input: ProductBindingReviewInput, actor: { publicId: string; role: string }, dossiers: readonly ProductBindingReviewDossier[]) {
  return createHash("sha256").update(JSON.stringify(canonical({
    purpose: "product-binding-human-review-v1", productSlug: input.productSlug,
    opportunityPublicId: input.opportunityPublicId, examEditionPublicId: input.examEditionPublicId,
    bindingIds: [...input.bindingIds].sort(),
    notes: input.notes, decision: input.decision, actor, dossiers: [...dossiers].sort((a, b) => a.bindingId.localeCompare(b.bindingId)),
  }))).digest("hex");
}

export function assertProductBindingReviewScope(input: ProductBindingReviewInput, dossiers: readonly ProductBindingReviewDossier[]) {
  if (dossiers.length !== input.bindingIds.length || new Set(dossiers.map((d) => d.bindingId)).size !== dossiers.length ||
      dossiers.some((d) => !input.bindingIds.includes(d.bindingId) || d.productSlug !== input.productSlug || d.opportunityPublicId !== input.opportunityPublicId)) {
    throw new ProductBindingReviewError("IDs ausentes ou escopo misturado: selecione um único produto e uma única oportunidade/edição.");
  }
  if (new Set(dossiers.map((d) => d.questionId)).size !== dossiers.length) {
    throw new ProductBindingReviewError("Selecione apenas uma proposta atual por questão; versões históricas não contam como questões distintas.");
  }
}

export function assertProductBindingReviewDecision(input: ProductBindingReviewInput, actorRole: string, dossiers: readonly ProductBindingReviewDossier[], expectedFingerprint: string | undefined, fingerprint: string) {
  if (!["admin", "editor"].includes(actorRole)) throw new ProductBindingReviewError("Papel editorial não autorizado.");
  assertProductBindingReviewScope(input, dossiers);
  if (!input.confirmations.edition || !input.confirmations.program || !input.confirmations.adherence) {
    throw new ProductBindingReviewError("Confirme pessoalmente edição, programa e aderência das questões do dossiê.");
  }
  if (!sha.safeParse(expectedFingerprint).success || expectedFingerprint !== fingerprint) {
    throw new ProductBindingReviewError("Dossiê, operador ou nota mudou; faça novo preview e confira sua impressão digital.");
  }
  if (dossiers.some((d) => d.bindingStatus !== "pending_review" || (input.decision === "approve" && !d.eligible))) {
    throw new ProductBindingReviewError("Há vínculo decidido, desatualizado ou contexto editorial incompatível. Nenhuma aprovação implícita é permitida.");
  }
}
