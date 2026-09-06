import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { subscriptionFixture } from "./fixtures/contest-subscription";
import type { CommerceTransaction } from "@/lib/commerce/webhook-transaction";

// Instância descartável exclusiva: nunca usar DATABASE_URL/.env nem dados editoriais.
const url = process.env.LEIPROVA_WEBHOOK_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    target.protocol !== "postgres:" || target.hostname !== "127.0.0.1" ||
    target.port !== "55479" || target.pathname !== "/leiprova_webhook_test" ||
    target.username !== "leiprova_test" || target.password || target.search || target.hash
  ) throw new Error("Somente PostgreSQL local descartável para webhooks.");
}
const namespace = `webhook_${randomUUID().replaceAll("-", "")}`;
const applicationName = `contest-webhook-${randomUUID()}`;
const client = url ? postgres(url, {
  max: 2, prepare: false,
  connection: { search_path: namespace, application_name: applicationName },
  onnotice: () => undefined,
}) : null;
const control = url ? postgres(url, { max: 1, prepare: false, onnotice: () => undefined }) : null;
const db = client ? drizzle(client, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const stripe = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn() }, invoices: { retrieve: vi.fn() },
  invoicePayments: { list: vi.fn() }, paymentIntents: { retrieve: vi.fn() },
}));
const delivery = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => stripe }));
vi.mock("@/lib/commerce/purchase-delivery", () => ({ enqueuePurchaseDelivery: delivery.enqueue }));
import { withTrackedContestStripeEvent } from "@/lib/commerce/webhook-transaction";
import { processStripeEvent } from "@/app/api/stripe/webhook/process";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe.skipIf(!db)("recuperação transacional real dos webhooks de concurso", () => {
  beforeAll(async () => {
    await control!.unsafe(`create schema ${namespace}`);
    // Estrutura mínima sintética dos campos/constraints usados pelos handlers reais.
    await client!.unsafe(`
      create table users (id bigint primary key, public_id text not null unique);
      create table contest_orders (
        id text primary key, user_id bigint not null references users(id),
        status text not null default 'created', currency text not null default 'brl',
        amount_cents integer not null, lines jsonb not null,
        stripe_session_id text unique, stripe_payment_intent_id text unique,
        checkout_ui_mode text not null default 'hosted', stripe_creation_started_at timestamptz,
        stripe_subscription_id text unique, stripe_customer_id text,
        subscription_status text, cancel_at_period_end boolean not null default false,
        paid_through timestamptz, stripe_mode text not null,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      );
      create table contest_purchases (
        order_id text not null references contest_orders(id), product_slug text not null,
        opportunity_id bigint not null, user_id bigint not null references users(id),
        status text not null default 'active', access_starts_at timestamptz not null,
        access_ends_at timestamptz not null,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        primary key(order_id, product_slug), check(access_ends_at > access_starts_at)
      );
      create table contest_billing_invoices (
        invoice_id text primary key, order_id text not null references contest_orders(id),
        payment_intent_id text not null unique, period_start timestamptz not null,
        period_end timestamptz not null, status text not null default 'paid',
        created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      );
      create table stripe_events (
        event_id text primary key, event_type text not null, api_version text,
        livemode boolean not null, status text not null default 'received', payload jsonb not null,
        received_at timestamptz not null default now(), processed_at timestamptz, error_message text,
        check(status in ('received','processing','processed','failed'))
      );
      create table delivery_effects (
        order_id text not null, product_slug text not null, user_id bigint not null,
        primary key(order_id, product_slug)
      );
      insert into users(id, public_id) values (1, 'synthetic-user'), (2, 'other-synthetic-user');
    `);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    delivery.enqueue.mockImplementation(async (tx: CommerceTransaction, input: {
      userId: number; scope: string; purchaseId: string; productSlug: string;
    }) => {
      await tx.execute(sql`insert into delivery_effects(order_id,product_slug,user_id)
        values (${input.purchaseId},${input.productSlug},${input.userId}) on conflict do nothing`);
      return { id: "synthetic-delivery", created: true };
    });
  });
  afterAll(async () => {
    await client?.end({ timeout: 2 });
    // O nome é gerado por UUID nesta execução; somente o schema sintético é removido.
    await control?.unsafe(`drop schema if exists ${namespace} cascade`);
    await control?.end();
  });

  async function fixture(status = "received") {
    const f = subscriptionFixture({ orderId: randomUUID(), publicId: "synthetic-user" });
    await db!.insert(schema.contestOrders).values({
      id: f.id, userId: 1, amountCents: 6700, stripeMode: "test",
      stripeCustomerId: "cus_qa", lines: f.lines,
    });
    await register(f.event, status);
    stripe.subscriptions.retrieve.mockResolvedValue(f.subscription);
    stripe.invoices.retrieve.mockResolvedValue(f.invoice);
    stripe.invoicePayments.list.mockResolvedValue(f.payments);
    stripe.paymentIntents.retrieve.mockResolvedValue(f.intent);
    return f;
  }
  async function register(event: Stripe.Event, status = "received") {
    await db!.insert(schema.stripeEvents).values({
      eventId: event.id, eventType: event.type, livemode: event.livemode,
      status, payload: event as unknown as Record<string, unknown>,
    });
  }
  const process = (event: Stripe.Event) => withTrackedContestStripeEvent(event, tx => processStripeEvent(event, tx));
  async function state(f: ReturnType<typeof subscriptionFixture>) {
    const [order] = await db!.select().from(schema.contestOrders).where(eq(schema.contestOrders.id, f.id));
    const [event] = await db!.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.eventId, f.event.id));
    const purchases = await db!.select().from(schema.contestPurchases).where(eq(schema.contestPurchases.orderId, f.id));
    const invoices = await db!.select().from(schema.contestBillingInvoices).where(eq(schema.contestBillingInvoices.orderId, f.id));
    const effects = await client!`select * from delivery_effects where order_id=${f.id}`;
    return { order, event, purchases, invoices, effects };
  }

  it.each(["received", "failed", "processing"])("recupera %s e confirma direitos/evento/outbox no mesmo commit", async status => {
    const f = await fixture(status);
    expect(await process(f.event)).toEqual({ duplicate: false });
    const result = await state(f);
    expect(result.event.status).toBe("processed");
    expect(result.order.status).toBe("paid");
    expect(result.purchases).toHaveLength(1);
    expect(result.invoices).toHaveLength(1);
    expect(result.effects).toHaveLength(1);
    expect(result.purchases[0].userId).toBe(1);
    expect(result.purchases[0].productSlug).toBe(f.lines[0].productSlug);
    expect(result.purchases[0].accessEndsAt.getTime()).toBe(f.end * 1000);
    expect(await process(f.event)).toEqual({ duplicate: true });
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledTimes(1);
  });

  it("rollback depois de gravar direitos e outbox permite retry sem sobras parciais", async () => {
    const f = await fixture("processing");
    await expect(withTrackedContestStripeEvent(f.event, async tx => {
      await processStripeEvent(f.event, tx);
      throw new Error("queda sintética antes do commit");
    })).rejects.toThrow("queda sintética");
    const failed = await state(f);
    expect(failed.event.status).toBe("processing");
    expect(failed.order.status).toBe("created");
    expect(failed.order.stripeSubscriptionId).toBeNull();
    expect(failed.purchases).toHaveLength(0);
    expect(failed.invoices).toHaveLength(0);
    expect(failed.effects).toHaveLength(0);
    await process(f.event);
    expect((await state(f)).event.status).toBe("processed");
  });

  it("falha da outbox desfaz também fatura, pedido e acesso", async () => {
    const f = await fixture();
    delivery.enqueue.mockRejectedValueOnce(new Error("outbox indisponível"));
    await expect(process(f.event)).rejects.toThrow("outbox indisponível");
    const failed = await state(f);
    expect(failed.event.status).toBe("received");
    expect(failed.order.status).toBe("created");
    expect(failed.purchases).toHaveLength(0);
    expect(failed.invoices).toHaveLength(0);
    await process(f.event);
    expect((await state(f)).effects).toHaveLength(1);
  });

  it("12 entregas do mesmo evento com pool de 2 concluem sem conexão aninhada", async () => {
    const f = await fixture();
    const results = await Promise.all(Array.from({ length: 12 }, () => process(f.event)));
    expect(results.filter(result => !result.duplicate)).toHaveLength(1);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledTimes(1);
    const result = await state(f);
    expect(result.purchases).toHaveLength(1);
    expect(result.effects).toHaveLength(1);
  });

  it("12 eventos diferentes do mesmo pedido serializam sem duplicar ou estender direitos", async () => {
    const f = await fixture();
    const events = Array.from({ length: 12 }, () => ({ ...f.event, id: `evt_${randomUUID()}` }));
    for (const event of events) await register(event);
    await Promise.all(events.map(process));
    const result = await state(f);
    expect(result.purchases).toHaveLength(1);
    expect(result.invoices).toHaveLength(1);
    expect(result.effects).toHaveLength(1);
    expect(result.purchases[0].accessEndsAt.getTime()).toBe(f.end * 1000);
  });

  it("perda real de backend faz rollback; executor antigo não altera o retry vencedor", async () => {
    const f = await fixture("processing");
    const entered = deferred<void>();
    const resumeOld = deferred<void>();
    let oldPid = 0;
    stripe.paymentIntents.retrieve.mockImplementationOnce(async () => {
      entered.resolve();
      await resumeOld.promise;
      return f.intent;
    });
    const oldResult = withTrackedContestStripeEvent(f.event, async tx => {
      const rows = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      oldPid = rows[0].pid;
      await processStripeEvent(f.event, tx);
    }).then(() => "unexpected-success", () => "rolled-back");
    await entered.promise;
    try {
      const terminated = await control!`
        select pg_terminate_backend(pid) as terminated from pg_stat_activity
        where pid=${oldPid} and application_name=${applicationName}
          and datname='leiprova_webhook_test' and usename='leiprova_test'
          and state='idle in transaction'`;
      expect(terminated).toHaveLength(1);
      expect(terminated[0].terminated).toBe(true);
      await process(f.event);
      expect((await state(f)).event.status).toBe("processed");
    } finally {
      resumeOld.resolve();
    }
    expect(await oldResult).toBe("rolled-back");
    const result = await state(f);
    expect(result.event.status).toBe("processed");
    expect(result.order.status).toBe("paid");
    expect(result.purchases).toHaveLength(1);
    expect(result.effects).toHaveLength(1);
  });

  it.each([["esm", true], ["cjs", true], ["esm", false], ["cjs", false]] as const)(
    "driver %s cercado: callback antigo não afeta nova tx; consulta tardia=%s", async (format, lateQuery) => {
    const driver = format === "esm" ? postgres : createRequire(import.meta.url)("postgres") as typeof postgres;
    const name = `driver-patch-${randomUUID()}`;
    const isolated = driver(url!, { max: 1, prepare: false, connection: {
      search_path: namespace, application_name: name,
    }, onnotice: () => undefined });
    const entered = deferred<number>();
    const resumeOld = deferred<void>();
    const oldCallbackDone = deferred<string>();
    const winnerEntered = deferred<void>();
    const releaseWinner = deferred<void>();
    const oldId = randomUUID();
    const winnerId = randomUUID();
    const old = isolated.begin(async tx => {
      const [connection] = await tx`select pg_backend_pid() as pid`;
      await tx`insert into delivery_effects values (${oldId},'old-before',1)`;
      entered.resolve(Number(connection.pid));
      await resumeOld.promise;
      if (!lateQuery) {
        oldCallbackDone.resolve("returned");
        return;
      }
      try {
        await tx`insert into delivery_effects values (${oldId},'old-after',1)`;
        oldCallbackDone.resolve("unexpected-query");
      } catch (error) {
        oldCallbackDone.resolve("query-rejected");
        throw error;
      }
    }).then(() => "unexpected-success", () => "rolled-back");
    try {
      const pid = await entered.promise;
      const rows = await control!`select pg_terminate_backend(pid) as terminated from pg_stat_activity
        where pid=${pid} and application_name=${name} and datname='leiprova_webhook_test'
          and usename='leiprova_test' and state='idle in transaction'`;
      expect(rows[0]?.terminated).toBe(true);
      expect(await old).toBe("rolled-back");
      const winner = isolated.begin(async tx => {
        await tx`insert into delivery_effects values (${winnerId},'winner',1)`;
        winnerEntered.resolve();
        await releaseWinner.promise;
        await tx`insert into delivery_effects values (${winnerId},'winner-second',1)`;
        if (!lateQuery) throw new Error("rollback deliberado da nova transação");
      }).then(() => "committed", () => "rolled-back");
      await winnerEntered.promise;
      resumeOld.resolve();
      expect(await oldCallbackDone.promise).toBe(lateQuery ? "query-rejected" : "returned");
      // Permite ao catch interno do begin antigo terminar antes do commit novo.
      await new Promise<void>(resolve => setImmediate(resolve));
      releaseWinner.resolve();
      expect(await winner).toBe(lateQuery ? "committed" : "rolled-back");
      expect(await isolated`select * from delivery_effects where order_id=${oldId}`).toHaveLength(0);
      expect(await isolated`select * from delivery_effects where order_id=${winnerId}`).toHaveLength(lateQuery ? 2 : 0);
    } finally {
      resumeOld.resolve();
      releaseWinner.resolve();
      await isolated.end({ timeout: 2 });
    }
  });

  it("recusa colisão de ID com tipo/modo diferentes antes dos efeitos", async () => {
    const f = await fixture();
    await expect(process({ ...f.event, livemode: true })).rejects.toThrow("divergente");
    await expect(process({ ...f.event, type: "invoice.payment_failed" } as Stripe.Event)).rejects.toThrow("divergente");
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect((await state(f)).purchases).toHaveLength(0);
  });

  it("legado one-time usa a mesma transação para checkout e entrega", async () => {
    const f = await fixture();
    const event = {
      ...f.event, id: `evt_${randomUUID()}`, type: "checkout.session.completed",
      data: { object: {
        id: `cs_${f.id}`, metadata: { ...f.metadata, commerce: "contest_v1" },
        client_reference_id: "synthetic-user", mode: "payment", payment_status: "paid",
        amount_total: 6700, currency: "brl", livemode: false, payment_intent: f.intent.id,
      } },
    } as unknown as Stripe.Event;
    await register(event);
    await expect(withTrackedContestStripeEvent(event, async tx => {
      await processStripeEvent(event, tx);
      throw new Error("queda após acesso avulso");
    })).rejects.toThrow("queda após acesso avulso");
    expect((await state(f)).order.status).toBe("created");
    expect((await state(f)).purchases).toHaveLength(0);
    expect((await state(f)).effects).toHaveLength(0);
    await process(event);
    expect((await state(f)).purchases).toHaveLength(1);
    expect((await state(f)).effects).toHaveLength(1);
  });
});
