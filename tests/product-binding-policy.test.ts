import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bindingFingerprint, containsVerbatimQuote, productBindingPackageSchema, requireProductBindingTarget } from "../src/lib/commerce/product-binding-policy";

const proposal = { productSlug: "enam-exame-nacional-da-magistratura-2026-2", opportunityPublicId: randomUUID(), requirementId: 7,
  questionPublicId: "qa-question", requirementQuote: "Garantias processuais constitucionais",
  legalQuote: "a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito",
  scopeNotes: "Proposta de aderência ao requisito; exige revisão humana específica, sem aprovação implícita." };
describe("curadoria por produto: contrato estrito", () => {
  it("aceita proposta sem inventar revisão ou publicação", () => {
    expect(productBindingPackageSchema.parse({ schemaVersion: 1, items: [proposal] }).items).toHaveLength(1);
  });
  it.each(["status", "reviewedByUserId", "reviewedAt", "publicationAllowed"])("recusa campo de aprovação %s", (field) => {
    expect(() => productBindingPackageSchema.parse({ schemaVersion: 1, items: [{ ...proposal, [field]: "approved" }] })).toThrow();
  });
  it("recusa duplicatas, identificador inventado e citações insuficientes", () => {
    expect(() => productBindingPackageSchema.parse({ schemaVersion: 1, items: [proposal, proposal] })).toThrow();
    expect(() => productBindingPackageSchema.parse({ schemaVersion: 1, items: [{ ...proposal, opportunityPublicId: "enam" }] })).toThrow();
    expect(() => productBindingPackageSchema.parse({ schemaVersion: 1, items: [{ ...proposal, legalQuote: "direito" }] })).toThrow();
  });
  it("normaliza somente Unicode e espaços, não inventa equivalência jurídica", () => {
    expect(containsVerbatimQuote("a lei não\n excluirá", "a lei não excluirá")).toBe(true);
    expect(containsVerbatimQuote("a lei não excluirá", "a lei excluirá")).toBe(false);
    expect(containsVerbatimQuote("a lei não excluirá", "A LEI NÃO EXCLUIRÁ")).toBe(false);
  });
  it("a impressão muda quando produto, evidência ou operador muda", () => {
    expect(bindingFingerprint(proposal)).toBe(bindingFingerprint({ ...proposal }));
    expect(bindingFingerprint(proposal)).not.toBe(bindingFingerprint({ ...proposal, productSlug: "pc-ba-outro-cargo" }));
  });
});
describe("destinos isolados do importador de propostas", () => {
  it("não aceita DATABASE_URL implícita nem outros projetos", () => {
    expect(() => requireProductBindingTarget(undefined)).toThrow();
    for (const url of ["postgres://u@127.0.0.1:5432/leiprova", "postgres://u@remote:55441/leiprova_binding_test", "postgres://u@127.0.0.1:55441/outro", "postgres://u@127.0.0.1:55441/leiprova_binding_test?options=x"]) {
      expect(() => requireProductBindingTarget(url)).toThrow();
    }
  });
  it("permite apenas sandbox nomeado ou pooler restrito com confirmação explícita", () => {
    expect(requireProductBindingTarget("postgres://qa@127.0.0.1:55441/leiprova_binding_test").production).toBe(false);
    const live = "postgresql://leiprova_app@leiprova-pooler:5432/leiprova";
    expect(() => requireProductBindingTarget(live, "https://leiprova.2b.app.br", "production")).toThrow();
    expect(requireProductBindingTarget(live, "https://leiprova.2b.app.br", "production", "import_pending_bindings").production).toBe(true);
    expect(() => requireProductBindingTarget(live.replace("leiprova_app@", "postgres@"), "https://leiprova.2b.app.br", "production", "import_pending_bindings")).toThrow();
  });
});
