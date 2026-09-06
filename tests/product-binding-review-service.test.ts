import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewProductQuestionBindings } from "../src/lib/commerce/product-binding-review-service";
import type { ProductBindingReviewDossier } from "../src/lib/commerce/product-binding-review-policy";

// Testes de controle/SQL com executor falso: nunca leem .env nem conectam a PostgreSQL.
const actorPublicId = "10000000-0000-4000-8000-000000000001";
const input = {
  schemaVersion: 1, productSlug: "qa-produto-a", opportunityPublicId: "10000000-0000-4000-8000-000000000002",
  examEditionPublicId: "10000000-0000-4000-8000-000000000003", bindingIds: ["a".repeat(64)],
  notes: "Revisão humana fictícia para teste isolado.", confirmations: { edition: true, program: true, adherence: true },
};
function fixture() {
  const statements: string[] = [];
  let role = "editor", valid = true, updatedCount = 1;
  const dossier: ProductBindingReviewDossier = { bindingId: input.bindingIds[0], questionId: 1, proposedByUserId: 2,
    productSlug: input.productSlug, opportunityPublicId: input.opportunityPublicId,
    bindingStatus: "pending_review", eligible: true, snapshot: { version: "QA-v1" } };
  const auditValues = vi.fn(async () => undefined);
  const transaction = {
    execute: vi.fn(async (query: SQL) => {
      const statement = new PgDialect().sqlToQuery(query).sql;
      statements.push(statement);
      if (statement.includes("select id::integer as id, role, email from users")) return [{ id: 1, role, email: "reviewer@example.invalid" }];
      if (statement.includes("as dossier")) return [{ dossier: structuredClone(dossier) }];
      if (/^\s*update public.contest_product_question_bindings/u.test(statement)) return Array.from({ length: updatedCount }, () => ({ id: input.bindingIds[0] }));
      if (statement.includes("from contest_product_question_bindings candidate order by candidate.id")) return [{ id: input.bindingIds[0], valid }];
      return [];
    }),
    insert: vi.fn(() => ({ values: auditValues })),
  };
  const transact = vi.fn(async (run: (tx: typeof transaction) => Promise<unknown>, config?: { isolationLevel: string; accessMode?: string }) => {
    void config;
    return run(transaction);
  });
  const db = { transaction: transact } as unknown as Parameters<typeof reviewProductQuestionBindings>[0];
  return { db, statements, transaction, transact, auditValues, dossier,
    setRole: (value: string) => { role = value; }, setValid: (value: boolean) => { valid = value; },
    setUpdatedCount: (value: number) => { updatedCount = value; } };
}
describe("revisão de vínculos — serviço transacional sem banco", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("preview é read only, não bloqueia/escreve e usa regra real de acesso via CTE", async () => {
    const f = fixture();
    const result = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "preview" });
    expect(result.mode).toBe("preview"); expect(result.approved).toBe(0);
    expect(f.transact.mock.calls[0][1]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
    expect(f.statements.some((s) => /for update|for share|^\s*(insert|update|delete) /u.test(s))).toBe(false);
    expect(f.transaction.insert).not.toHaveBeenCalled();
    const query = f.statements.find((s) => s.includes("as dossier"))!;
    expect(query).toContain("jsonb_populate_record");
    expect(query).toContain("binding.evidence->'questionContent'");
    expect(query).toContain("edition.public_id=");
    expect(query).toContain("coalesce((");
    expect(query).not.toContain("document_bytes");
  });
  it("apply bloqueia contexto, atualiza só revisão dos IDs exatos e audita após revalidação", async () => {
    const f = fixture();
    const preview = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "preview" });
    const result = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "apply", expectedFingerprint: preview.fingerprint });
    expect(result.approved).toBe(1); expect(result.productReleased).toBe(false); expect(result.checkoutEnabled).toBe(false);
    expect(f.transact.mock.calls[1][1]).toEqual({ isolationLevel: "serializable" });
    expect(f.statements.some((s) => s.includes("lock_editorial_approval_context"))).toBe(true);
    const writes = f.statements.filter((s) => /^\s*update /u.test(s));
    expect(writes).toHaveLength(1); expect(writes[0]).toContain("status='pending_review'");
    expect(writes[0]).not.toMatch(/clean_room|authorship|update questions|update contest_store_products/u);
    expect(f.auditValues).toHaveBeenCalledOnce();
    expect(f.statements.at(-1)).toContain("binding.status = 'approved'");
  });
  it.each(["role", "scope", "fingerprint", "context", "confirmation"])("bloqueia %s antes de qualquer UPDATE", async (failure) => {
    const f = fixture();
    const preview = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "preview" });
    if (failure === "role") f.setRole("student");
    if (failure === "scope") f.dossier.productSlug = "qa-outro-produto";
    if (failure === "context") f.dossier.eligible = false;
    const requestInput = failure === "confirmation" ? { ...input, confirmations: { ...input.confirmations, adherence: false } } : input;
    await expect(reviewProductQuestionBindings(f.db, { input: requestInput, actorPublicId, mode: "apply",
      expectedFingerprint: failure === "fingerprint" ? "b".repeat(64) : preview.fingerprint })).rejects.toThrow();
    expect(f.statements.some((s) => /^\s*update /u.test(s))).toBe(false); expect(f.auditValues).not.toHaveBeenCalled();
  });
  it.each(["count", "final-rule"])("falha %s rejeita a transação e não emite aprovação auditada", async (failure) => {
    const f = fixture();
    const preview = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "preview" });
    if (failure === "count") f.setUpdatedCount(0); else f.setValid(false);
    await expect(reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "apply", expectedFingerprint: preview.fingerprint })).rejects.toThrow();
    expect(f.auditValues).not.toHaveBeenCalled();
  });
  it("privilégio ausente falha fechado; não tenta URL privilegiada ou fallback", async () => {
    const f = fixture();
    f.transaction.execute.mockRejectedValueOnce(new Error("permission denied"));
    await expect(reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "apply", expectedFingerprint: "a".repeat(64) })).rejects.toThrow("permission denied");
    expect(f.transact).toHaveBeenCalledOnce(); expect(f.auditValues).not.toHaveBeenCalled();
  });
  it.each(["generic-editor", "owner-unconfirmed", "owner-confirmed"])("proposta própria: %s", async (scenario) => {
    const f = fixture(); f.dossier.proposedByUserId = 1;
    vi.stubEnv("EDITORIAL_OWNER_APPROVER_EMAIL", scenario === "generic-editor" ? "other@example.invalid" : "reviewer@example.invalid");
    const preview = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "preview" });
    const request = { input: { ...input, ownerOverride: scenario !== "owner-unconfirmed" }, actorPublicId, mode: "apply" as const, expectedFingerprint: preview.fingerprint };
    if (scenario === "owner-confirmed") {
      expect((await reviewProductQuestionBindings(f.db, request)).approved).toBe(1);
    } else {
      await expect(reviewProductQuestionBindings(f.db, request)).rejects.toThrow("Proposta própria");
      expect(f.statements.some((s) => /^\s*update /u.test(s))).toBe(false);
    }
  });
  it("edição ausente/incompatível produz preview bloqueado e não permite aplicar", async () => {
    const f = fixture(); f.dossier.eligible = false; f.dossier.snapshot.edition = null;
    const preview = await reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "preview" });
    expect(preview.mode === "preview" && preview.eligible).toBe(0);
    await expect(reviewProductQuestionBindings(f.db, { input, actorPublicId, mode: "apply", expectedFingerprint: preview.fingerprint })).rejects.toThrow("incompatível");
    expect(f.auditValues).not.toHaveBeenCalled();
  });
});
