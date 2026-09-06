import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BindingDecisionPreview } from "../src/components/admin/product-binding-review-panel";
import type { BindingReviewState } from "../src/lib/commerce/product-binding-admin";

function state(decision: "approve" | "reject", eligible: boolean): BindingReviewState {
  return { status: "preview", message: "Conferir", preview: {
    selection: { productSlug: "qa-product", bindingId: "a".repeat(64), opportunityPublicId: "10000000-0000-4000-8000-000000000001",
      examEditionPublicId: "10000000-0000-4000-8000-000000000002", notes: "Nota explícita sobre a aderência apenas desta proposta.", decision },
    fingerprint: "f".repeat(64), reviewerAllowed: true, requiresOwnerOverride: false,
    dossier: { bindingId: "a".repeat(64), status: "pending_review", eligible, prompt: "Questão autoral de teste", explanation: "Explicação própria",
      options: [{ key: "A", text: "Alternativa", correct: true, rationale: "Fundamento" }], links: [],
      fields: [{ label: "Cargo", value: "Cargo exclusivo" }], blockers: eligible ? [] : ["Requisito ainda sem revisão"] },
  } };
}
const render = (value: BindingReviewState) => renderToStaticMarkup(createElement(BindingDecisionPreview, { state: value, pending: false, action: () => undefined }));
describe("UI da decisão de vínculo", () => {
  it("exibe contexto, nota, fingerprint, gabarito e checks obrigatórios desmarcados", () => {
    const html = render(state("approve", true));
    expect(html).toContain("Cargo exclusivo"); expect(html).toContain("Gabarito registrado");
    expect(html).toContain("f".repeat(64)); expect(html).toContain("Nota explícita");
    expect((html.match(/type="checkbox"/gu) ?? [])).toHaveLength(3);
    expect(html).not.toContain("checked="); expect(html).not.toContain("disabled=");
    expect(html).toContain("não abre checkout");
  });
  it("aprovação inelegível fica desabilitada, com bloqueio legível", () => {
    const html = render(state("approve", false));
    expect(html).toContain("Requisito ainda sem revisão"); expect(html).toContain("disabled=");
  });
  it("rejeição explicitamente não altera validade global", () => {
    const html = render(state("reject", false));
    expect(html).toContain("rejeitar vínculo"); expect(html).toContain("não invalida a questão globalmente");
    expect(html).not.toContain("disabled=");
  });
  it("ator sem permissão não recebe botão acionável; exceção proprietária não vem marcada", () => {
    const value = state("reject", true); value.preview!.reviewerAllowed = false; value.preview!.requiresOwnerOverride = true;
    const html = render(value); expect(html).toContain("disabled="); expect(html).toContain("exceção proprietária"); expect(html).not.toContain("checked=");
  });
  it("escapa HTML do texto editorial", () => {
    const value = state("approve", true); value.preview!.dossier.prompt = "<script>unsafe()</script>";
    expect(render(value)).toContain("&lt;script&gt;"); expect(render(value)).not.toContain("<script>unsafe()");
  });
});
