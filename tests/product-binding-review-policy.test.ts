import { describe, expect, it } from "vitest";
import {
  assertProductBindingReviewDecision, assertProductBindingReviewScope, productBindingReviewFingerprint,
  productBindingReviewSchema, type ProductBindingReviewDossier,
} from "../src/lib/commerce/product-binding-review-policy";

const actor = { publicId: "10000000-0000-4000-8000-000000000001", role: "editor" };
const base = {
  schemaVersion: 1 as const, productSlug: "qa-produto-a",
  opportunityPublicId: "10000000-0000-4000-8000-000000000002",
  examEditionPublicId: "10000000-0000-4000-8000-000000000003",
  bindingIds: ["a".repeat(64)], notes: "Revisão humana fictícia exclusiva de teste.",
  confirmations: { edition: true, program: true, adherence: true },
};
const dossier: ProductBindingReviewDossier = {
  bindingId: base.bindingIds[0], questionId: 1, proposedByUserId: 2, productSlug: base.productSlug,
  opportunityPublicId: base.opportunityPublicId, bindingStatus: "pending_review", eligible: true,
  snapshot: { question: { prompt: "Questão fictícia", options: ["A", "B"] }, requirement: "Requisito fictício" },
};
const input = () => productBindingReviewSchema.parse(structuredClone(base));
const fingerprint = () => productBindingReviewFingerprint(input(), actor, [dossier]);

describe("revisão de vínculos — contrato estrito e escopo", () => {
  it("aceita lote exato, notas e três confirmações sem campos de autoria", () => {
    expect(input().bindingIds).toHaveLength(1);
    expect(() => assertProductBindingReviewDecision(input(), actor.role, [dossier], fingerprint(), fingerprint())).not.toThrow();
  });
  it.each(["status", "reviewedByUserId", "reviewedAt", "cleanRoomAttestedAt", "publicationAllowed", "force"])("rejeita campo forjado %s", (field) => {
    expect(() => productBindingReviewSchema.parse({ ...base, [field]: true })).toThrow();
  });
  it.each([[], [base.bindingIds[0], base.bindingIds[0]], ["UUID-não-é-hash"], Array.from({ length: 251 }, (_, i) => i.toString(16).padStart(64, "0"))].map((bindingIds) => ({ bindingIds })))("rejeita seleção inválida de IDs", ({ bindingIds }) => {
    expect(() => productBindingReviewSchema.parse({ ...base, bindingIds })).toThrow();
  });
  it("exige nota substantiva e edição explícita", () => {
    expect(() => productBindingReviewSchema.parse({ ...base, notes: "   curta   " })).toThrow();
    expect(() => productBindingReviewSchema.parse({ ...base, examEditionPublicId: undefined })).toThrow();
  });
  it.each(["edition", "program", "adherence"] as const)("bloqueia confirmação ausente de %s", (key) => {
    const request = input(); request.confirmations[key] = false;
    expect(() => assertProductBindingReviewDecision(request, actor.role, [dossier], fingerprint(), fingerprint())).toThrow("Confirme");
  });
  it.each(["student", "", "owner", "superadmin"])("não inventa papel autorizado %s", (role) => {
    expect(() => assertProductBindingReviewDecision(input(), role, [dossier], fingerprint(), fingerprint())).toThrow("Papel");
  });
  it.each([
    [], [{ ...dossier, bindingId: "b".repeat(64) }], [{ ...dossier, productSlug: "qa-outro-produto" }],
    [{ ...dossier, opportunityPublicId: "10000000-0000-4000-8000-000000000004" }],
  ].map((rows) => ({ rows })))("rejeita linhas ausentes ou outro produto/concurso", ({ rows }) => {
    expect(() => assertProductBindingReviewScope(input(), rows)).toThrow("escopo");
  });
  it("não conta duas versões da mesma questão", () => {
    const request = input(); request.bindingIds.push("b".repeat(64));
    expect(() => assertProductBindingReviewScope(request, [dossier, { ...dossier, bindingId: request.bindingIds[1] }])).toThrow("versões históricas");
  });
  it.each(["approved", "rejected", "suspended"])("não reaprova nem rebaixa vínculo %s", (bindingStatus) => {
    expect(() => assertProductBindingReviewDecision(input(), actor.role, [{ ...dossier, bindingStatus }], fingerprint(), fingerprint())).toThrow("incompatível");
  });
  it("não promove contexto inelegível e rejeita SHA ausente ou diferente", () => {
    expect(() => assertProductBindingReviewDecision(input(), actor.role, [{ ...dossier, eligible: false }], fingerprint(), fingerprint())).toThrow("incompatível");
    for (const sha of [undefined, "wrong", "b".repeat(64)]) {
      expect(() => assertProductBindingReviewDecision(input(), actor.role, [dossier], sha, fingerprint())).toThrow("preview");
    }
  });
  it("SHA fixa operador, nota, edição, seleção e conteúdo, mas permite marcar checks após preview", () => {
    const original = fingerprint();
    const checks = input(); checks.confirmations.edition = false;
    expect(productBindingReviewFingerprint(checks, actor, [dossier])).toBe(original);
    for (const changed of [{ ...input(), notes: `${base.notes} Outra decisão.` }, { ...input(), examEditionPublicId: "10000000-0000-4000-8000-000000000004" }]) {
      expect(productBindingReviewFingerprint(changed, actor, [dossier])).not.toBe(original);
    }
    expect(productBindingReviewFingerprint(input(), { ...actor, publicId: base.opportunityPublicId }, [dossier])).not.toBe(original);
    expect(productBindingReviewFingerprint(input(), actor, [{ ...dossier, snapshot: { question: "alterada" } }])).not.toBe(original);
    expect(productBindingReviewFingerprint(input(), actor, [{ ...dossier, snapshot: { requirement: "Requisito fictício", question: { options: ["A", "B"], prompt: "Questão fictícia" } } }])).toBe(original);
  });
});
