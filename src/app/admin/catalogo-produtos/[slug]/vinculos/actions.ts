"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { CONTEST_CATALOG } from "@/lib/commerce/catalog";
import { reviewProductQuestionBindings } from "@/lib/commerce/product-binding-review-service";
import { ProductBindingReviewError } from "@/lib/commerce/product-binding-review-policy";
import { bindingAdminSelectionSchema, isTrustedBindingReviewOrigin, toBindingDossierView,
  type BindingReviewState } from "@/lib/commerce/product-binding-admin";

export async function reviewBindingAction(_state: BindingReviewState, form: FormData): Promise<BindingReviewState> {
  const actor = await requireSuperAdmin("/admin/catalogo-produtos");
  // Defesa adicional ao CSRF do Next: não confiar em Host/X-Forwarded-Host fornecido pelo cliente.
  const requestHeaders = await headers();
  if (actor.role !== "admin" || !isTrustedBindingReviewOrigin(requestHeaders.get("origin"),
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === "production")) {
    return { status: "error", message: "Origem ou permissão administrativa inválida. Reabra o painel no endereço configurado." };
  }
  const parsed = bindingAdminSelectionSchema.safeParse(Object.fromEntries(
    ["productSlug", "bindingId", "opportunityPublicId", "examEditionPublicId", "notes", "decision"].map((key) => [key, form.get(key)]),
  ));
  const mode = form.get("mode");
  if (!parsed.success || !["preview", "apply"].includes(String(mode)) ||
      !CONTEST_CATALOG.some((product) => product.slug === parsed.data.productSlug)) {
    return { status: "error", message: "Confira o produto, o vínculo, a edição e uma nota com pelo menos 20 caracteres." };
  }
  const selection = parsed.data;
  try {
    const result = await reviewProductQuestionBindings(getDb(), {
      actorPublicId: actor.publicId, mode: mode as "preview" | "apply",
      expectedFingerprint: typeof form.get("fingerprint") === "string" ? String(form.get("fingerprint")) : undefined,
      input: { schemaVersion: 1, productSlug: selection.productSlug, opportunityPublicId: selection.opportunityPublicId,
        examEditionPublicId: selection.examEditionPublicId, bindingIds: [selection.bindingId], notes: selection.notes,
        decision: selection.decision, ownerOverride: form.get("ownerOverride") === "on",
        confirmations: { edition: form.get("edition") === "on", program: form.get("program") === "on", adherence: form.get("adherence") === "on" } },
    });
    if (result.mode === "preview") return { status: "preview", message: "Confira o dossiê e a nota antes de registrar sua decisão.",
      preview: { selection, fingerprint: result.fingerprint, dossier: toBindingDossierView(result.dossiers[0]),
        reviewerAllowed: result.reviewerAllowed, requiresOwnerOverride: result.requiresOwnerOverride } };
    revalidatePath("/admin/catalogo-produtos");
    revalidatePath(`/admin/catalogo-produtos/${selection.productSlug}/vinculos`);
    return { status: "success", message: selection.decision === "approve"
      ? "Vínculo aprovado. Questão, produto, vendas e acesso total não foram aprovados por esta decisão."
      : "Vínculo rejeitado somente neste produto. A questão e os demais produtos foram preservados." };
  } catch (error) {
    return { status: "error", message: error instanceof ProductBindingReviewError ? error.message
      : "Decisão não registrada. Verifique dados e permissões restritas do banco; este painel não concede privilégios nem ignora bloqueios." };
  }
}
