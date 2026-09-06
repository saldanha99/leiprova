import { describe, expect, it } from "vitest";
import { isTrustedBindingReviewOrigin, toBindingDossierView } from "../src/lib/commerce/product-binding-admin";
import type { ProductBindingReviewDossier } from "../src/lib/commerce/product-binding-review-policy";

export const adminDossier: ProductBindingReviewDossier = {
  bindingId: "a".repeat(64), questionId: 1, proposedByUserId: 2, productSlug: "qa-produto-a",
  opportunityPublicId: "10000000-0000-4000-8000-000000000001", bindingStatus: "pending_review", eligible: false,
  snapshot: { question: { prompt: "Questão autoral de teste", explanation: "Explicação", source_rights: "original_authorial", editorial_status: "draft", private_email: "secret@example.invalid" },
    product: { opportunity_id: null }, opportunity: { id: 1, title: "Concurso QA", role_name: "Cargo QA" }, edition: null,
    source: { status: "pending_review", source_url: "javascript:alert(1)" },
    options: [{ option_key: "A", text: "Alternativa QA", is_correct: true, rationale: "Razão QA" }],
    users: { password: "never-serialize" } },
};
describe("admin de vínculos — proteção e DTO", () => {
  it.each([null, "null", "https://evil.invalid", "https://admin.invalid.evil.invalid", "https://admin.invalid/path", "https://u:p@admin.invalid"])("recusa origem %s", (origin) => {
    expect(isTrustedBindingReviewOrigin(origin, "https://admin.invalid", true)).toBe(false);
  });
  it("exige configuração e HTTPS em produção, permite origem local exata no desenvolvimento", () => {
    expect(isTrustedBindingReviewOrigin("https://admin.invalid", "https://admin.invalid", true)).toBe(true);
    expect(isTrustedBindingReviewOrigin("http://localhost:3000", "http://localhost:3000", true)).toBe(false);
    expect(isTrustedBindingReviewOrigin("http://localhost:3000", "http://localhost:3000", false)).toBe(true);
    expect(isTrustedBindingReviewOrigin("https://admin.invalid", undefined, true)).toBe(false);
  });
  it("mostra bloqueios concretos sem entregar snapshot ou identidade pessoal", () => {
    const view = toBindingDossierView(adminDossier);
    expect(view.blockers.join(" ")).toContain("Edição oficial");
    expect(view.blockers.join(" ")).toContain("revisão jurídica");
    expect(view.links).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/secret@example|never-serialize|proposedByUserId|snapshot/u);
  });
  it("oculta enunciado e alternativas não autorais", () => {
    const changed = structuredClone(adminDossier);
    changed.snapshot.question = { prompt: "Questão terceirizada", source_rights: "licensed" };
    const view = toBindingDossierView(changed);
    expect(view.options).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("Questão terceirizada");
    expect(view.prompt).toBe("Conteúdo não autoral oculto");
  });
});
