import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { masterSubscriptionFixture } from "./fixtures/master-subscription";

const url = process.env.LEIPROVA_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "postgres:" || parsed.hostname !== "127.0.0.1" || parsed.port !== "55439" ||
    parsed.pathname !== "/leiprova_automation_test" || parsed.username !== "leiprova_test" || parsed.search) {
    throw new Error("Teste Master aceita somente banco sintético local e papel leiprova_test.");
  }
}
const qaApplicationName = `leiprova_master_test_${randomUUID()}`;
const client = url ? postgres(url, { max: 2, prepare: false, connection: { application_name: qaApplicationName } }) : null;
const db = client ? drizzle(client, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const mocks = vi.hoisted(() => ({
  subscription: vi.fn(), invoice: vi.fn(), payments: vi.fn(), intent: vi.fn(), session: vi.fn(), email: vi.fn(), webhook: vi.fn(), disputes: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({ getStripeWebhookConfiguration: () => ({ secretKey: "sk_test_synthetic_master", webhookSecret: "whsec_synthetic_master_only" }), stripeKeyExpectsLivemode: () => false, getStripeClient: () => ({
  subscriptions: { retrieve: mocks.subscription }, invoices: { retrieve: mocks.invoice },
  invoicePayments: { list: mocks.payments }, paymentIntents: { retrieve: mocks.intent }, checkout: { sessions: { retrieve: mocks.session } }, webhooks: { constructEvent: mocks.webhook }, disputes: { list: mocks.disputes },
}) }));
vi.mock("@/lib/transactional-email", () => ({ getTransactionalEmailConfig: () => null, sendTransactionalEmail: mocks.email }));
import { processMasterStripeEvent } from "@/lib/stripe/master-subscription";
import { POST } from "@/app/api/stripe/webhook/route";

describe.skipIf(!db)("Master real handler — PostgreSQL sintético e Stripe simulada", () => {
  let f: ReturnType<typeof masterSubscriptionFixture>;
  let userId: number;
  let planId: number;
  let session: Stripe.Checkout.Session;
  const eventIds: string[] = [];
  beforeEach(async () => {
    vi.resetAllMocks();
    f = masterSubscriptionFixture();
    const unique = randomUUID();
    f.identity.attemptId = `qa-master-${unique}`;
    f.identity.userPublicId = `qa-master-user-${unique}`;
    f.identity.customerId = `cus_qa_${unique}`;
    f.identity.plan = { ...f.identity.plan, slug: `qa-master-plan-${unique}`, stripePriceId: `price_qa_${unique}` };
    f.identity.subscriptionId = `sub_qa_${unique}`;
    await db!.transaction(async (tx) => {
      const [user] = await tx.insert(schema.users).values({ publicId: f.identity.userPublicId, email: `qa-master-${unique}@example.invalid`,
        name: "Fixture Master sem login", passwordHash: "not-a-login-password", stripeCustomerId: f.identity.customerId }).returning();
      const [plan] = await tx.insert(schema.plans).values({ ...f.identity.plan, name: "Master sintético", description: "Somente teste" }).returning();
      userId = user.id; planId = plan.id; f.identity.userId = userId;
      await tx.insert(schema.checkoutAttempts).values({ id: f.identity.attemptId, userId, planId, providerSessionId: `cs_qa_${unique}`, status: "session_created" });
    });
    const metadata = { app: "leiprova", plan_slug: f.identity.plan.slug, user_id: String(userId), user_public_id: f.identity.userPublicId, checkout_attempt_id: f.identity.attemptId };
    f.subscription.id = f.identity.subscriptionId!; f.subscription.customer = f.identity.customerId!; f.subscription.metadata = metadata;
    f.subscription.items.data[0].price.id = f.identity.plan.stripePriceId!;
    f.invoice.customer = f.identity.customerId!; f.invoice.parent!.subscription_details!.subscription = f.subscription.id;
    f.invoice.parent!.subscription_details!.metadata = metadata;
    f.invoice.lines.data[0].pricing!.price_details!.price = f.identity.plan.stripePriceId!;
    f.intent.customer = f.identity.customerId!; (f.intent.latest_charge as Stripe.Charge).customer = f.identity.customerId!;
    session = { id: `cs_qa_${unique}`, object: "checkout.session", mode: "subscription", status: "complete", payment_status: "paid", livemode: false,
      subscription: f.subscription.id, customer: f.identity.customerId!, client_reference_id: f.identity.userPublicId, metadata } as unknown as Stripe.Checkout.Session;
    mocks.subscription.mockImplementation(async () => structuredClone(f.subscription));
    mocks.invoice.mockImplementation(async () => structuredClone(f.invoice));
    mocks.payments.mockImplementation(async () => structuredClone(f.payments));
    mocks.intent.mockImplementation(async () => structuredClone(f.intent));
    mocks.session.mockImplementation(async () => structuredClone(session));
    mocks.email.mockResolvedValue({ status: "sent" });
    mocks.disputes.mockImplementation(async () => ({ data: [{ id: "dp_qa", object: "dispute", charge: (f.intent.latest_charge as Stripe.Charge).id, payment_intent: f.intent.id, amount: f.amount, currency: "brl", livemode: false, status: "needs_response" }], has_more: false }));
    mocks.webhook.mockImplementation((body: string, signature: string, secret: string) => new Stripe("sk_test_synthetic_master").webhooks.constructEvent(body, signature, secret));
  });
  afterEach(async () => {
    if (eventIds.length) await db!.delete(schema.stripeEvents).where(inArray(schema.stripeEvents.eventId, eventIds.splice(0)));
    if (userId) await db!.delete(schema.users).where(eq(schema.users.id, userId));
    if (planId) await db!.delete(schema.plans).where(eq(schema.plans.id, planId));
  });
  afterAll(async () => { await client?.end({ timeout: 1 }); });
  function event(type: Stripe.Event.Type = "invoice.paid", object: unknown = f.invoice) {
    return { id: `evt_qa_${randomUUID()}`, object: "event", type, livemode: false, created: 1, data: { object } } as Stripe.Event;
  }
  async function stored() { return (await db!.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)))[0]; }
  async function deliveries() { return db!.select().from(schema.purchaseDeliveryOutbox).where(eq(schema.purchaseDeliveryOutbox.userId, userId)); }
  async function tracked(e = event(), status = "received") {
    eventIds.push(e.id);
    await db!.insert(schema.stripeEvents).values({ eventId: e.id, eventType: e.type, livemode: e.livemode, status, payload: {} });
    return e;
  }
  async function reverse(type: "charge.refunded" | "charge.dispute.created" = "charge.refunded") {
    const object = type === "charge.refunded" ? f.intent.latest_charge : { object: "dispute", id: "dp_qa", payment_intent: f.intent.id, charge: (f.intent.latest_charge as Stripe.Charge).id };
    return processMasterStripeEvent(event(type, object));
  }
  function request(e: Stripe.Event, valid = true) {
    const payload = JSON.stringify(e);
    const signature = new Stripe("sk_test_synthetic_master").webhooks.generateTestHeaderString({ payload, secret: valid ? "whsec_synthetic_master_only" : "whsec_invalid" });
    return new NextRequest("https://qa.example.invalid/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body: payload });
  }
  it("libera apenas após prova financeira e com início/fim exatos", async () => {
    expect(await processMasterStripeEvent(event())).toBe(true);
    const row = await stored();
    expect(row).toMatchObject({ status: "active", userId, planId, providerSubscriptionId: f.subscription.id });
    expect(row.currentPeriodStart!.getTime()).toBe(f.start * 1000);
    expect(row.accessEndsAt!.getTime()).toBe(f.end * 1000);
    expect(await deliveries()).toHaveLength(1);
    expect((await deliveries())[0]).toMatchObject({ scope: "master", purchaseId: f.identity.attemptId, status: "pending" });
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("plano anual persiste valor e vigência anual pagos", async () => {
    const end = f.start + 365 * 86400; const amount = 89700;
    await db!.update(schema.plans).set({ billingType: "year", amountCents: amount }).where(eq(schema.plans.id, planId));
    const item = f.subscription.items.data[0]; item.current_period_end = end; item.price.unit_amount = amount; item.price.recurring!.interval = "year";
    f.invoice.lines.data[0].period.end = end; f.invoice.lines.data[0].amount = f.invoice.lines.data[0].subtotal = amount;
    f.invoice.total = f.invoice.subtotal = f.invoice.amount_due = f.invoice.amount_paid = amount;
    f.payments.data[0].amount_paid = f.intent.amount_received = (f.intent.latest_charge as Stripe.Charge).amount = amount;
    await processMasterStripeEvent(event());
    expect((await stored()).accessEndsAt).toEqual(new Date(end * 1000));
  });
  it("checkout completed não concede acesso sem fatura paga", async () => {
    f.invoice.status = "open";
    await processMasterStripeEvent(event("checkout.session.completed", session));
    expect((await stored()).status).toBe("incomplete");
    expect(mocks.email).not.toHaveBeenCalled();
    expect(await deliveries()).toHaveLength(0);
  });
  it.each(["trialing", "past_due", "canceled", "unpaid", "paused", "incomplete_expired"] as const)("não ativa status Stripe %s", async (status) => {
    f.subscription.status = status;
    await processMasterStripeEvent(event());
    expect((await stored()).status).not.toBe("active");
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it("evento invoice.paid antigo não reativa assinatura cancelada", async () => {
    await processMasterStripeEvent(event());
    f.subscription.status = "canceled";
    await processMasterStripeEvent(event());
    expect((await stored()).status).toBe("canceled");
  });
  it("cancelamento agendado preserva somente o fim efetivamente pago", async () => {
    f.subscription.cancel_at_period_end = true;
    await processMasterStripeEvent(event("customer.subscription.updated", f.subscription));
    expect(await stored()).toMatchObject({ status: "active", cancelAtPeriodEnd: true, accessEndsAt: new Date(f.end * 1000) });
  });
  it.each([1, 29700])("reembolso de %s revoga e replay não reativa", async (amount) => {
    await processMasterStripeEvent(event());
    (f.intent.latest_charge as Stripe.Charge).amount_refunded = amount;
    await reverse();
    expect((await stored()).status).toBe("unpaid");
    await processMasterStripeEvent(event());
    expect((await stored()).status).toBe("unpaid");
  });
  it("disputa antes de invoice.paid nunca entrega o Master", async () => {
    (f.intent.latest_charge as Stripe.Charge).disputed = true;
    await reverse("charge.dispute.created");
    expect((await stored()).status).toBe("unpaid");
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it.each(["won", "lost", "under_review", "warning_closed", "prevented"])("disputa encerrada/atual %s controla apenas ciclo pago vigente", async (status) => {
    (f.intent.latest_charge as Stripe.Charge).disputed = true;
    await reverse("charge.dispute.created");
    expect((await stored()).status).toBe("unpaid");
    const disputes = await mocks.disputes(); disputes.data[0].status = status; mocks.disputes.mockResolvedValue(disputes);
    await processMasterStripeEvent(event("charge.dispute.closed", disputes.data[0]));
    const expected = ["won", "warning_closed", "prevented"].includes(status) ? "active" : "unpaid";
    expect((await stored()).status).toBe(expected);
    await processMasterStripeEvent(event());
    expect((await stored()).status).toBe(expected);
  });
  it("uma disputa ganha não encobre outra ainda aberta no mesmo pagamento", async () => {
    (f.intent.latest_charge as Stripe.Charge).disputed = true;
    const disputes = await mocks.disputes(); disputes.data.push({ ...disputes.data[0], id: "dp_second", status: "won" });
    mocks.disputes.mockResolvedValue(disputes);
    await processMasterStripeEvent(event("charge.dispute.closed", disputes.data[1]));
    expect((await stored()).status).toBe("unpaid");
  });
  it("disputa ganha não restaura pagamento já reembolsado", async () => {
    (f.intent.latest_charge as Stripe.Charge).disputed = true; (f.intent.latest_charge as Stripe.Charge).amount_refunded = f.amount;
    const disputes = await mocks.disputes(); disputes.data[0].status = "won"; mocks.disputes.mockResolvedValue(disputes);
    await processMasterStripeEvent(event("charge.dispute.closed", disputes.data[0]));
    expect((await stored()).status).toBe("unpaid");
  });
  it.each(["missing", "foreign", "pagination", "api_failure"])("disputas divergentes: %s não restauram acesso", async (kind) => {
    (f.intent.latest_charge as Stripe.Charge).disputed = true;
    await reverse("charge.dispute.created");
    const disputes = await mocks.disputes();
    if (kind === "missing") disputes.data = [];
    if (kind === "foreign") disputes.data[0].payment_intent = "pi_other";
    if (kind === "pagination") disputes.has_more = true;
    mocks.disputes.mockResolvedValue(disputes);
    if (kind === "api_failure") mocks.disputes.mockRejectedValue(new Error("Disputa indisponível"));
    await expect(processMasterStripeEvent(event())).rejects.toThrow();
    expect((await stored()).status).toBe("unpaid");
  });
  it("nota de crédito posterior não impede revogar estorno real", async () => {
    f.invoice.post_payment_credit_notes_amount = 100;
    (f.intent.latest_charge as Stripe.Charge).amount_refunded = 100;
    await reverse();
    expect((await stored()).status).toBe("unpaid");
  });
  it("devolução de ciclo antigo não remove a renovação atual", async () => {
    const oldInvoice = structuredClone(f.invoice); oldInvoice.id = "in_old";
    mocks.invoice.mockImplementation(async (id: string) => structuredClone(id === "in_old" ? oldInvoice : f.invoice));
    mocks.payments.mockImplementation(async (params: { payment?: unknown }) => params.payment ? { ...f.payments, data: [{ ...f.payments.data[0], invoice: "in_old", payment: { type: "payment_intent", payment_intent: "pi_old" } }] } : structuredClone(f.payments));
    await processMasterStripeEvent(event("charge.refunded", { object: "charge", id: "ch_old", payment_intent: "pi_old", amount_refunded: 1 }));
    expect(await stored()).toMatchObject({ status: "active", accessEndsAt: new Date(f.end * 1000) });
  });
  it("evento antigo usa período da última fatura, não o snapshot", async () => {
    const old = structuredClone(f.invoice); old.id = "in_old";
    await processMasterStripeEvent(event("invoice.paid", old));
    expect((await stored()).accessEndsAt!.getTime()).toBe(f.end * 1000);
  });
  it.each(["subscription", "invoice", "payments", "intent", "session"] as const)("falha API %s faz rollback completo", async (api) => {
    mocks[api].mockRejectedValue(new Error("Falha sintética"));
    await expect(processMasterStripeEvent(event())).rejects.toThrow();
    expect(await stored()).toBeUndefined();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it.each(["customer", "publicId", "attempt", "price", "period", "mode"])("divergência de %s não concede direitos", async (kind) => {
    if (kind === "customer") f.subscription.customer = "cus_other";
    if (kind === "publicId") f.subscription.metadata.user_public_id = "other";
    if (kind === "attempt") f.subscription.metadata.checkout_attempt_id = "missing";
    if (kind === "price") f.subscription.items.data[0].price.id = "price_other";
    if (kind === "period") f.subscription.items.data[0].current_period_end = NaN;
    if (kind === "mode") f.subscription.livemode = true;
    await expect(processMasterStripeEvent(event())).rejects.toThrow();
    expect(await stored()).toBeUndefined();
  });
  it("não associa Customer ausente usando metadados", async () => {
    await db!.update(schema.users).set({ stripeCustomerId: null }).where(eq(schema.users.id, userId));
    await expect(processMasterStripeEvent(event())).rejects.toThrow();
    expect(await stored()).toBeUndefined();
  });
  it("não troca titularidade de assinatura persistida para outro usuário", async () => {
    const [other] = await db!.insert(schema.users).values({ publicId: randomUUID(), email: `master-other-${randomUUID()}@example.invalid`, name: "Outro sintético", passwordHash: "not-a-login-password" }).returning();
    try {
      await db!.insert(schema.subscriptions).values({ userId: other.id, planId, provider: "stripe", providerSubscriptionId: f.subscription.id,
        status: "canceled", currentPeriodStart: new Date(f.start * 1000), currentPeriodEnd: new Date(f.end * 1000), accessEndsAt: new Date(f.end * 1000) });
      await expect(processMasterStripeEvent(event())).rejects.toThrow(/Vínculo local/);
      expect(await stored()).toBeUndefined();
      const [row] = await db!.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, other.id));
      expect(row).toMatchObject({ userId: other.id, status: "canceled", providerSubscriptionId: f.subscription.id });
    } finally { await db!.delete(schema.users).where(eq(schema.users.id, other.id)); }
  });
  it("não entrega uma sessão Stripe diferente usando a mesma tentativa", async () => {
    session.subscription = "sub_other";
    await expect(processMasterStripeEvent(event())).rejects.toThrow(/Identidade do checkout/);
    expect(await stored()).toBeUndefined();
  });
  it("arquivar oferta não revoga assinatura histórica ainda paga", async () => {
    await db!.update(schema.plans).set({ isActive: false }).where(eq(schema.plans.id, planId));
    f.subscription.items.data[0].price.active = false;
    await processMasterStripeEvent(event());
    expect((await stored()).status).toBe("active");
  });
  it("tentativa sem sessão persistida solicita retry, sem liberar", async () => {
    await db!.update(schema.checkoutAttempts).set({ providerSessionId: null }).where(eq(schema.checkoutAttempts.id, f.identity.attemptId));
    await expect(processMasterStripeEvent(event())).rejects.toThrow(/persistido/);
    expect(await stored()).toBeUndefined();
  });
  it("checkout expired atrasado não rebaixa compra atual confirmada", async () => {
    await processMasterStripeEvent(event());
    await processMasterStripeEvent(event("checkout.session.expired", { ...session, status: "expired", subscription: null }));
    expect((await stored()).status).toBe("active");
  });
  it("eventos concorrentes compartilham lock e não duplicam assinatura nem aviso", async () => {
    await Promise.all(Array.from({ length: 5 }, () => processMasterStripeEvent(event())));
    const rows = await db!.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("active");
    expect(await deliveries()).toHaveLength(1);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("recupera processing antigo e conclui evento/direito atomicamente", async () => {
    const e = await tracked(event(), "processing");
    await processMasterStripeEvent(e, { trackEvent: true });
    expect((await stored()).status).toBe("active");
    const [record] = await db!.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.eventId, e.id));
    expect(record.status).toBe("processed");
  });
  it("falha depois do claim reverte; reentrega conclui sem claim preso", async () => {
    const e = await tracked();
    mocks.intent.mockRejectedValueOnce(new Error("Queda simulada durante leitura"));
    await expect(processMasterStripeEvent(e, { trackEvent: true })).rejects.toThrow();
    expect(await stored()).toBeUndefined();
    expect(await deliveries()).toHaveLength(0);
    expect((await db!.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.eventId, e.id)))[0].status).toBe("received");
    await processMasterStripeEvent(e, { trackEvent: true });
    expect((await stored()).status).toBe("active");
  });
  it("mesmo evento concorrente é concluído uma vez; duplicata não consulta Subscription", async () => {
    const e = await tracked();
    await Promise.all([processMasterStripeEvent(e, { trackEvent: true }), processMasterStripeEvent(e, { trackEvent: true })]);
    expect(mocks.subscription).toHaveBeenCalledTimes(1);
    expect(await deliveries()).toHaveLength(1);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("ignora dados de outro projeto/conta sem chamada externa", async () => {
    const foreign = structuredClone(f.subscription); foreign.metadata.app = "other";
    expect(await processMasterStripeEvent(event("customer.subscription.updated", foreign))).toBe(false);
    expect(await processMasterStripeEvent({ ...event(), account: "acct_other" })).toBe(false);
    expect(mocks.subscription).not.toHaveBeenCalled();
  });
  it("rota verifica assinatura real e conclui Master antes do claim legado", async () => {
    const e = event(); eventIds.push(e.id);
    expect((await POST(request(e, false))).status).toBe(400);
    expect(await stored()).toBeUndefined();
    expect((await POST(request(e))).status).toBe(200);
    expect((await stored()).status).toBe("active");
    expect((await db!.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.eventId, e.id)))[0].status).toBe("processed");
  });
  it("rota retorna 500 na falha e reentrega assinada recupera processing antigo", async () => {
    const e = await tracked(event(), "processing");
    mocks.intent.mockRejectedValueOnce(new Error("Falha externa sintética"));
    expect((await POST(request(e))).status).toBe(500);
    expect(await stored()).toBeUndefined();
    expect((await POST(request(e))).status).toBe(200);
    expect((await stored()).status).toBe("active");
  });
  it("modo incompatível é recusado antes de criar evento ou acesso", async () => {
    const e = { ...event(), livemode: true }; eventIds.push(e.id);
    expect((await POST(request(e))).status).toBe(400);
    expect(await stored()).toBeUndefined();
    expect(mocks.subscription).not.toHaveBeenCalled();
  });
  it("perda real da conexão transacional impede executor antigo de gravar; retry recupera", async () => {
    const e = await tracked();
    mocks.intent.mockImplementationOnce(async () => {
      // Apenas conexões marcadas por esta execução do teste; nunca sessões de outro agente/projeto.
      const owners = await client!`select a.pid from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.datname=current_database() and a.application_name=${qaApplicationName} and l.locktype='advisory' and l.granted and a.pid<>pg_backend_pid()`;
      expect(owners).toHaveLength(1);
      await client!`select pg_terminate_backend(${Number(owners[0].pid)})`;
      return structuredClone(f.intent);
    });
    await expect(processMasterStripeEvent(e, { trackEvent: true })).rejects.toThrow();
    expect(await stored()).toBeUndefined();
    await processMasterStripeEvent(e, { trackEvent: true });
    expect((await stored()).status).toBe("active");
  });
});
