import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import {
  claimPurchaseDelivery, enqueuePurchaseDelivery, finishPurchaseDelivery, runPurchaseDeliveryWorker,
} from "@/lib/commerce/purchase-delivery";
import { DELIVERY_LEASE_MS, DELIVERY_SAFE_RETRY_WINDOW_MS, purchaseDeliveryId, type PurchaseDeliveryInput } from "@/lib/commerce/purchase-delivery-core";
import { TransactionalEmailError } from "@/lib/transactional-email";

const testUrl = process.env.LEIPROVA_DELIVERY_TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "55479" || url.pathname !== "/leiprova_webhook_test" ||
      url.username !== "leiprova_test" || url.search || url.hash) throw new Error("Somente cluster sintético efêmero autorizado.");
}
const schemaName = `delivery_test_${randomUUID().replaceAll("-", "")}`;
const control = testUrl ? postgres(testUrl, { max: 1, prepare: false, onnotice: () => {} }) : null;
const client = testUrl ? postgres(testUrl, { max: 4, prepare: false, onnotice: () => {}, connection: { search_path: schemaName } }) : null;
const db = client ? drizzle(client, { schema }) : null;
// Avança o relógio sintético além dos defaults now() gravados durante o setup.
const clock = new Date(Date.now() + 60_000);
const config = { from: "Editalume <acesso@example.invalid>", origin: "https://leiprova.2b.app.br" };

describe.skipIf(!db)("outbox de entrega — PostgreSQL sintético exclusivo", () => {
  beforeAll(async () => {
    await control!.unsafe(`create schema "${schemaName}"`);
    await client!.unsafe(`
      create table users (id bigint primary key,email text not null,name text not null,password_hash text not null);
      create table contest_orders (id text primary key,user_id bigint,status text);
      create table contest_purchases (order_id text,product_slug text,user_id bigint,status text,access_starts_at timestamptz,access_ends_at timestamptz);
      create table plans (id bigint primary key,slug text);
      create table checkout_attempts (id text primary key,user_id bigint,plan_id bigint,status text,provider_session_id text);
      create table subscriptions (id bigint primary key,user_id bigint,plan_id bigint,provider text,status text,provider_checkout_session_id text,current_period_start timestamptz,access_ends_at timestamptz);
    `);
    // Só o DDL das tabelas novas é validado no schema aleatório. Não roda migrator/journal nem toca public.
    const ddl = (await readFile(new URL("../drizzle/0034_purchase_delivery_outbox.sql", import.meta.url), "utf8"))
      .replaceAll('"public".', `"${schemaName}".`);
    for (const statement of ddl.split("--> statement-breakpoint")) if (statement.trim()) await client!.unsafe(statement);
  });
  beforeEach(async () => {
    await client!.unsafe("truncate purchase_delivery_events,purchase_delivery_outbox,contest_purchases,contest_orders,subscriptions,checkout_attempts,plans,users cascade");
    await client!`insert into users (id,email,name,password_hash) values
      (1,'ana@example.invalid','Ana Silva','senha-preexistente'),(2,'bia@example.invalid','Bia','outra-senha')`;
  });
  afterAll(async () => {
    await client?.end();
    if (control) {
      if (!/^delivery_test_[a-f0-9]{32}$/.test(schemaName)) throw new Error("Schema de limpeza inválido.");
      await control.unsafe(`drop schema if exists "${schemaName}" cascade`);
      await control.end();
    }
  });

  async function purchase(scope: "master" | "contest" = "contest", range = "current"): Promise<PurchaseDeliveryInput> {
    const purchaseId = randomUUID();
    const start = new Date(clock.getTime() + (range === "future" ? 3600_000 : -3600_000));
    const end = new Date(clock.getTime() + (range === "expired" ? -1000 : 30 * 86400_000));
    const productSlug = scope === "contest" ? "concurso-ficticio" : "ritmo";
    if (scope === "contest") {
      await client!`insert into contest_orders values (${purchaseId},1,'paid')`;
      await client!`insert into contest_purchases values (${purchaseId},${productSlug},1,'active',${start.toISOString()}::timestamptz,${end.toISOString()}::timestamptz)`;
    } else {
      await client!`insert into plans values (1,'ritmo')`;
      await client!`insert into checkout_attempts values (${purchaseId},1,1,'completed','cs_ficticia')`;
      await client!`insert into subscriptions values (1,1,1,'stripe','active','cs_ficticia',${start.toISOString()}::timestamptz,${end.toISOString()}::timestamptz)`;
    }
    return { scope, purchaseId, productSlug, userId: 1 };
  }
  const enqueue = (input: PurchaseDeliveryInput) => db!.transaction((tx) => enqueuePurchaseDelivery(tx, input));
  const sender = () => vi.fn().mockResolvedValue({ messageId: "resend_ficticio", status: "queued" });
  const run = (send = sender(), now = clock) => runPurchaseDeliveryWorker({ limit: 1 }, {
    db: db!, config: () => config, send, now: () => now,
  });

  it("rollback da compra também remove outbox e histórico", async () => {
    const input = await purchase();
    await expect(db!.transaction(async (tx) => {
      await enqueuePurchaseDelivery(tx, input);
      throw new Error("rollback-ficticio");
    })).rejects.toThrow("rollback-ficticio");
    expect(await client!`select id from purchase_delivery_outbox`).toHaveLength(0);
    expect(await client!`select id from purchase_delivery_events`).toHaveLength(0);
  });

  it("duas transações concorrentes geram um único trabalho e evento enqueued", async () => {
    const input = await purchase();
    const results = await Promise.all([enqueue(input), enqueue(input)]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await client!`select id from purchase_delivery_outbox`).toHaveLength(1);
    expect(await client!`select id from purchase_delivery_events where event='enqueued'`).toHaveLength(1);
  });

  it("não permite trocar titular nem conceder Master a partir de compra avulsa", async () => {
    const input = await purchase();
    await expect(enqueue({ ...input, userId: 2 })).rejects.toThrow("entitlement_mismatch");
    await expect(enqueue({ ...input, scope: "master", productSlug: "ritmo" })).rejects.toThrow("entitlement_mismatch");
    await expect(enqueue({ ...input, productSlug: "outro-concurso" })).rejects.toThrow("entitlement_mismatch");
    expect(await client!`select id from purchase_delivery_outbox`).toHaveLength(0);
  });

  it.each(["contest", "master"] as const)("confirma %s, audita aceitação e preserva senhas", async (scope) => {
    await enqueue(await purchase(scope));
    const send = sender();
    expect(await run(send)).toMatchObject({ queued: 1, claimed: 1 });
    const [stored] = await client!`select status,provider_message_id,payload from purchase_delivery_outbox`;
    expect(stored.status).toBe("queued");
    expect(stored.provider_message_id).toBe("resend_ficticio");
    expect(stored.payload.scope).toBe(scope);
    expect(JSON.stringify(stored.payload)).not.toMatch(/password|rawToken|token=/);
    expect(send.mock.calls[0][0].text).toContain(scope === "master" ? "Seu Master" : "somente o concurso indicado");
    expect(await client!`select password_hash from users where id=1`).toEqual([{ password_hash: "senha-preexistente" }]);
    expect(await client!`select event from purchase_delivery_events order by created_at,id`).toHaveLength(4);
  });

  it.each(["expired", "future"])("evento pago com vigência %s enfileira sem bloquear webhook e é cancelado pelo worker", async (range) => {
    const input = await purchase("master", range);
    expect((await enqueue(input)).created).toBe(true);
    const send = sender();
    expect(await run(send)).toMatchObject({ cancelled: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("claims paralelos não reservam a mesma linha; fencing recusa resposta de lease vencida", async () => {
    await enqueue(await purchase());
    const claims = await Promise.all([claimPurchaseDelivery(db!, clock), claimPurchaseDelivery(db!, clock)]);
    const oldClaim = claims.find(Boolean)!;
    expect(claims.filter(Boolean)).toHaveLength(1);
    const later = new Date(clock.getTime() + DELIVERY_LEASE_MS + 1);
    const newClaim = await claimPurchaseDelivery(db!, later);
    expect(newClaim?.id).toBe(oldClaim.id);
    expect(newClaim?.leaseToken).not.toBe(oldClaim.leaseToken);
    expect(await finishPurchaseDelivery(db!, oldClaim, { status: "cancelled", code: "stale_worker" }, later)).toBe(false);
    expect(await finishPurchaseDelivery(db!, newClaim!, { status: "cancelled", code: "current_worker" }, later)).toBe(true);
  });

  it("retoma a mesma chave e conteúdo após resposta de rede perdida", async () => {
    await enqueue(await purchase());
    const send = vi.fn().mockRejectedValueOnce(new TransactionalEmailError("não logar resposta privada", "email_provider_unreachable"))
      .mockResolvedValueOnce({ messageId: "replay_ficticio", status: "queued" });
    expect(await run(send)).toMatchObject({ retry: 1 });
    expect(await run(send, new Date(clock.getTime() + 60_001))).toMatchObject({ queued: 1 });
    expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
  });

  it("não repete envio incerto além da janela idempotente", async () => {
    await enqueue(await purchase());
    const send = vi.fn().mockRejectedValue(new TransactionalEmailError("incerto", "email_provider_unreachable"));
    await run(send);
    expect(await run(send, new Date(clock.getTime() + DELIVERY_SAFE_RETRY_WINDOW_MS + 1))).toMatchObject({ claimed: 0 });
    expect(send).toHaveBeenCalledOnce();
    expect((await client!`select status from purchase_delivery_outbox`)[0].status).toBe("manual_review");
  });

  it("desistência/reembolso depois de enfileirar impede a confirmação de acesso", async () => {
    const input = await purchase();
    await enqueue(input);
    await client!`update contest_orders set status='refunded' where id=${input.purchaseId}`;
    expect((await enqueue(input)).created).toBe(false);
    const send = sender();
    expect(await run(send)).toMatchObject({ cancelled: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("rejeita snapshot contendo campos secretos e estado queued sem confirmação", async () => {
    const input = await purchase();
    await enqueue(input);
    const id = purchaseDeliveryId(input);
    await expect(client!`update purchase_delivery_outbox set status='queued' where id=${id}`).rejects.toThrow();
    await expect(client!`update purchase_delivery_outbox set payload=${client!.json({ rawToken: "segredo-ficticio" })},payload_digest=${"a".repeat(64)},first_dispatch_at=now() where id=${id}`).rejects.toThrow();
  });
});
