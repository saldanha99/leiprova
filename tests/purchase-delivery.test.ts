import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { CommerceTransaction } from "@/lib/commerce/webhook-transaction";
import { TransactionalEmailError } from "@/lib/transactional-email";
import {
  buildPurchaseConfirmationV1, DELIVERY_SAFE_RETRY_WINDOW_MS, deliveryFailureState,
  deliveryPayloadDigest, deliverySnapshotSchema, purchaseDeliveryId, validateDeliveryOrigin,
} from "@/lib/commerce/purchase-delivery-core";
import {
  claimPurchaseDelivery, enqueuePurchaseDelivery, finishPurchaseDelivery, runPurchaseDeliveryWorker,
  type ClaimedPurchaseDelivery, type PurchaseDeliveryDependencies,
} from "@/lib/commerce/purchase-delivery";

const input = { userId: 7, scope: "contest" as const, purchaseId: "order_123", productSlug: "curso-um" };
const id = purchaseDeliveryId(input);
const fixedNow = new Date("2026-09-07T12:00:00Z");
const config = { from: "Editalume <acesso@example.invalid>", origin: "https://leiprova.2b.app.br" };
const snapshot = { version: 1 as const, to: "aluna@example.invalid", name: "Ana Silva", productLabel: "Curso um", scope: "contest" as const, ...config };
const job = (): ClaimedPurchaseDelivery => ({ ...input, id, attempts: 1, leaseToken: "lease_one", payload: null, payloadDigest: null, firstDispatchAt: null });
const dialect = new PgDialect();
function fakeDb(responses: unknown[][]) {
  const execute = vi.fn(async (query: SQL) => { void query; return responses.shift() ?? []; });
  return { db: { execute } as unknown as PurchaseDeliveryDependencies["db"], execute };
}
function queryText(query: SQL) { return dialect.sqlToQuery(query).sql; }
function workerDependencies(responses: unknown[][], send = vi.fn().mockResolvedValue({ messageId: "message_1", status: "queued" })) {
  const { db, execute } = fakeDb(responses);
  return { execute, send, dependencies: { db, send, config: () => config, now: () => fixedNow } };
}

describe("contrato durável de confirmação de compra", () => {
  it("deduplica por compra/produto, distingue avulso e Master e rejeita payload extra", () => {
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(purchaseDeliveryId({ ...input })).toBe(id);
    expect(purchaseDeliveryId({ ...input, scope: "master" })).not.toBe(id);
    expect(purchaseDeliveryId({ ...input, productSlug: "curso-dois" })).not.toBe(id);
    expect(purchaseDeliveryId({ ...input, purchaseId: "outra" })).not.toBe(id);
    expect(() => purchaseDeliveryId({ ...input, password: "nao-aceitar" } as typeof input)).toThrow();
    expect(deliverySnapshotSchema.safeParse({ ...snapshot, rawToken: "segredo" }).success).toBe(false);
  });

  it("mantém a senha atual e aponta ao fluxo seguro de recuperação, sem token por compra", () => {
    const email = buildPurchaseConfirmationV1(snapshot);
    expect(email.text).toContain("somente o concurso indicado");
    expect(email.text).toContain("Sua senha atual continua igual");
    expect(email.html).toContain("/recuperar-acesso");
    expect(email.html).toContain("/entrar");
    expect(email.html).not.toContain("token=");
    expect(email.html).not.toContain("/ativar-acesso");
  });

  it("descreve Master sem apresentar acesso irrestrito permanente", () => {
    const email = buildPurchaseConfirmationV1({ ...snapshot, scope: "master", productLabel: "Master Anual" });
    expect(email.text).toContain("concursos liberados na plataforma durante a vigência paga");
    expect(email.html).toContain("/app/assinatura");
    expect(email.html).not.toContain("/app/compras");
  });

  it("escapa HTML e mantém fingerprint estável incluindo remetente", () => {
    const message = buildPurchaseConfirmationV1({ ...snapshot, name: "<script>", productLabel: "A & B" });
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("A &amp; B");
    expect(deliveryPayloadDigest(snapshot)).toBe(deliveryPayloadDigest({ ...snapshot }));
    expect(deliveryPayloadDigest({ ...snapshot, from: "outro@example.invalid" })).not.toBe(deliveryPayloadDigest(snapshot));
  });

  it.each(["https://example.invalid/path", "https://user:pass@example.invalid", "http://example.invalid", "javascript:alert(1)"])("rejeita origem insegura %s", (origin) => {
    expect(() => validateDeliveryOrigin(origin)).toThrow();
  });

  it("limita repetição por tentativas e por janela de idempotência incerta", () => {
    expect(deliveryFailureState(1, null, fixedNow)).toBe("retry");
    expect(deliveryFailureState(6, null, fixedNow)).toBe("manual_review");
    expect(deliveryFailureState(1, new Date(fixedNow.getTime() - DELIVERY_SAFE_RETRY_WINDOW_MS), fixedNow)).toBe("manual_review");
    expect(deliveryFailureState(1, null, fixedNow, true)).toBe("manual_review");
  });
});

describe("enqueue e fencing", () => {
  it("enfileira e audita na transação fornecida sem exigir vigência atual para evento histórico", async () => {
    const { db, execute } = fakeDb([[], [{ eligible: true }], [{ id }]]);
    expect(await enqueuePurchaseDelivery(db as CommerceTransaction, input)).toEqual({ id, created: true });
    expect(execute).toHaveBeenCalledTimes(3);
    const eligibility = queryText(execute.mock.calls[1][0]);
    expect(eligibility).toContain("contest_purchases");
    expect(eligibility).not.toContain("access_ends_at");
    expect(queryText(execute.mock.calls[2][0])).toContain("purchase_delivery_events");
  });

  it("reentrega já enfileirada não exige acesso ainda vigente nem recria o trabalho", async () => {
    const { db, execute } = fakeDb([[{ matches: true }]]);
    expect(await enqueuePurchaseDelivery(db as CommerceTransaction, input)).toEqual({ id, created: false });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("bloqueia outro titular e compra não confirmada", async () => {
    const wrongUser = fakeDb([[{ matches: false }]]);
    await expect(enqueuePurchaseDelivery(wrongUser.db as CommerceTransaction, input)).rejects.toThrow("identity_conflict");
    const unpaid = fakeDb([[], [{ eligible: false }]]);
    await expect(enqueuePurchaseDelivery(unpaid.db as CommerceTransaction, input)).rejects.toThrow("entitlement_mismatch");
    expect(unpaid.execute).toHaveBeenCalledTimes(2);
  });

  it("claim usa SKIP LOCKED e encerramento exige lease e tentativa atuais", async () => {
    const claim = fakeDb([[], [job()]]);
    expect(await claimPurchaseDelivery(claim.db, fixedNow)).toEqual(job());
    expect(queryText(claim.execute.mock.calls[1][0])).toContain("for update skip locked");
    const finish = fakeDb([[]]);
    expect(await finishPurchaseDelivery(finish.db, job(), { status: "retry", code: "temporary_failure" }, fixedNow)).toBe(false);
    const sqlText = queryText(finish.execute.mock.calls[0][0]);
    expect(sqlText).toContain("lease_token =");
    expect(sqlText).toContain("lease_expires_at >");
    expect(sqlText).toContain("attempts =");
  });
});

describe("worker pós-commit", () => {
  it("não conecta nem reserva quando o canal está desativado", async () => {
    const { dependencies, execute, send } = workerDependencies([]);
    const result = await runPurchaseDeliveryWorker({ limit: 1 }, { ...dependencies, config: () => null });
    expect(result.disabled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("persiste preparação antes de enviar, usa chave estável e registra queued, não delivered", async () => {
    const { dependencies, execute, send } = workerDependencies([[], [job()], [{ ...snapshot, email: snapshot.to, eligible: true }], [{ id }], [{ id }]]);
    expect(await runPurchaseDeliveryWorker({ limit: 1 }, dependencies)).toMatchObject({ queued: 1, claimed: 1 });
    expect(send.mock.calls[0][0]).toMatchObject({ to: snapshot.to, idempotencyKey: `purchase-delivery/v1/${id}` });
    expect(queryText(execute.mock.calls[3][0])).toContain("payload_digest");
    expect(execute.mock.invocationCallOrder[3]).toBeLessThan(send.mock.invocationCallOrder[0]);
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(execute.mock.invocationCallOrder[4]);
  });

  it("reutiliza exatamente o payload e a chave após falha incerta", async () => {
    const retryJob = { ...job(), attempts: 2, payload: snapshot, payloadDigest: deliveryPayloadDigest(snapshot), firstDispatchAt: fixedNow };
    const { dependencies, send } = workerDependencies([[], [retryJob], [{ email: snapshot.to, name: "Nome atualizado", eligible: true }], [{ id }], [{ id }]]);
    await runPurchaseDeliveryWorker({ limit: 1 }, dependencies);
    const expected = buildPurchaseConfirmationV1(snapshot);
    expect(send.mock.calls[0][0]).toMatchObject({ subject: expected.subject, html: expected.html, text: expected.text, idempotencyKey: `purchase-delivery/v1/${id}` });
  });

  it("reembolso/expiração impede mensagem de acesso disponível", async () => {
    const { dependencies, send } = workerDependencies([[], [job()], [{ email: snapshot.to, name: "Ana", eligible: false }], [{ id }]]);
    expect(await runPurchaseDeliveryWorker({ limit: 1 }, dependencies)).toMatchObject({ cancelled: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("troca de e-mail/fingerprint exige revisão, não retentativa com corpo diferente", async () => {
    const { dependencies, send } = workerDependencies([[], [{ ...job(), payload: snapshot, payloadDigest: deliveryPayloadDigest(snapshot) }],
      [{ email: "outro@example.invalid", name: "Ana", eligible: true }], [{ id }]]);
    expect(await runPurchaseDeliveryWorker({ limit: 1 }, dependencies)).toMatchObject({ manual_review: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("falha do provedor é auditada por código sem persistir erro bruto", async () => {
    const sender = vi.fn().mockRejectedValue(new TransactionalEmailError("segredo e email em resposta privada", "email_provider_unreachable"));
    const { dependencies, execute } = workerDependencies([[], [job()], [{ email: snapshot.to, name: "Ana", eligible: true }], [{ id }], [{ id }]], sender);
    expect(await runPurchaseDeliveryWorker({ limit: 1 }, dependencies)).toMatchObject({ retry: 1 });
    const completion = dialect.sqlToQuery(execute.mock.calls[4][0]);
    expect(completion.params).toContain("email_provider_unreachable");
    expect(JSON.stringify(completion.params)).not.toContain("resposta privada");
  });
});

describe("estrutura da migration", () => {
  it("inclui fila, histórico, índices e constraints sem tocar credenciais ou direitos", () => {
    const migration = readFileSync(new URL("../drizzle/0034_purchase_delivery_outbox.sql", import.meta.url), "utf8");
    expect(migration).toContain('CREATE TABLE "purchase_delivery_outbox"');
    expect(migration).toContain('CREATE TABLE "purchase_delivery_events"');
    expect(migration).toContain("purchase_delivery_payload_check");
    expect(migration).toContain("purchase_delivery_identity_uidx");
    expect(migration).not.toMatch(/ALTER TABLE "users"|password_hash|raw_token|GRANT ALL|UPDATE subscriptions/i);
  });
});
