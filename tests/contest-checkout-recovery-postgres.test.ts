import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { CONTEST_CATALOG } from "@/lib/commerce/catalog";
import { cancelRecoverableContestOrder, markContestCreationStarted, originalContestCheckoutExpiry } from "@/lib/commerce/contest-checkout-recovery";

const url = process.env.LEIPROVA_CHECKOUT_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (target.protocol !== "postgres:" || target.hostname !== "127.0.0.1" || target.port !== "55479" ||
      target.pathname !== "/leiprova_webhook_test" || target.username !== "leiprova_test" || target.password || target.search || target.hash)
    throw new Error("Somente cluster local descartável de checkout.");
}
const namespace = `checkout_test_${randomUUID().replaceAll("-", "")}`;
const client = url ? postgres(url, { max: 4, prepare: false, connection: { search_path: namespace }, onnotice: () => {} }) : null;
const control = url ? postgres(url, { max: 1, prepare: false, onnotice: () => {} }) : null;
const db = client ? drizzle(client, { schema }) : null;
const mocked = vi.hoisted(() => ({ user: vi.fn(), released: vi.fn(), create: vi.fn(), retrieve: vi.fn(), list: vi.fn(), expire: vi.fn(), customer: vi.fn(), prices: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocked.user, requireUser: mocked.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/commerce/customer", () => ({ getOrCreateStripeCustomer: mocked.customer }));
vi.mock("@/lib/commerce/store", () => ({ listReleasedContestProducts: mocked.released }));
vi.mock("@/lib/study/entitlement", () => ({ getStudyEntitlement: async () => ({ hasFullAccess: false }) }));
vi.mock("@/lib/stripe", () => ({ hasTrustedOrigin: () => true, isContestCheckoutEnabled: () => true,
  stripeKeyExpectsLivemode: () => false, getCheckoutAvailability: () => ({ available: true }), getPublicOrigin: () => "https://qa.example.invalid",
  getStripeClient: () => ({ prices: { retrieve: mocked.prices }, checkout: { sessions: { create: mocked.create, retrieve: mocked.retrieve, list: mocked.list, expire: mocked.expire } } }),
}));
import { POST } from "@/app/api/stripe/contest-checkout/route";
import { cancelContestOrderAction } from "@/app/actions/contest-orders";

const slug = CONTEST_CATALOG[0].slug;
const user = { id: 1, publicId: "synthetic-checkout-user", email: "checkout@example.invalid", name: "Teste", stripeCustomerId: "cus_qa" };
const lines: schema.ContestOrderLine[] = [{ productSlug: slug, accessKey: "monthly", months: 1, amountCents: 6700, stripePriceId: "price_qa", opportunityId: 1 }];
const sessions = () => ({ list: mocked.list, retrieve: mocked.retrieve, expire: mocked.expire }) as unknown as Pick<Stripe["checkout"]["sessions"], "list" | "retrieve" | "expire">;
function sessionFor(order: typeof schema.contestOrders.$inferSelect, overrides: Partial<Stripe.Checkout.Session> = {}) {
  return { id: order.stripeSessionId ?? `cs_${order.id}`, mode: "subscription", ui_mode: order.checkoutUiMode,
    metadata: { app: "leiprova", commerce: "contest_subscription_v2", order_id: order.id, user_public_id: user.publicId },
    customer: "cus_qa", client_reference_id: user.publicId, livemode: false, status: "open",
    expires_at: originalContestCheckoutExpiry(order), client_secret: "synthetic_client_secret", url: "https://checkout.stripe.com/c/pay/synthetic",
    ...overrides } as Stripe.Checkout.Session;
}
function request(id: string) { return new NextRequest("https://qa.example.invalid/api/stripe/contest-checkout", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ attemptId: id, items: [{ productSlug: slug, accessKey: "monthly" }] }) }); }
async function fixture(values: Partial<typeof schema.contestOrders.$inferInsert> = {}) {
  const [order] = await db!.insert(schema.contestOrders).values({ id: randomUUID(), userId: 1, amountCents: 6700, lines, stripeMode: "test", checkoutUiMode: "elements", ...values }).returning();
  return order;
}
async function state(id: string) { const [order] = await db!.select().from(schema.contestOrders).where(eq(schema.contestOrders.id, id)); return order; }
function form(id: string) { const data = new FormData(); data.set("orderId", id); return data; }

describe.skipIf(!db)("recuperação e cancelamento de checkout em PostgreSQL isolado", () => {
  let legacyBackfill: { checkout_ui_mode: string; started: boolean };
  beforeAll(async () => {
    await control!.unsafe(`create schema ${namespace}`);
    await client!.unsafe(`
      create table users(id bigint primary key);
      insert into users values(1),(2);
      create table contest_orders (
        id text primary key,user_id bigint not null references users(id),status text not null default 'created',currency text not null default 'brl',
        amount_cents integer not null,lines jsonb not null,stripe_session_id text unique,stripe_payment_intent_id text unique,
        stripe_subscription_id text unique,stripe_customer_id text,subscription_status text,cancel_at_period_end boolean not null default false,
        paid_through timestamptz,stripe_mode text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
      );
      create table contest_purchases (product_slug text,user_id bigint,status text,access_ends_at timestamptz);
      insert into contest_orders(id,user_id,amount_cents,lines,stripe_mode) values('legacy-before-migration',1,6700,'[]','test');
    `);
    // Executa somente a DDL0035 no schema sintético; nunca o migrador ou uma conexão da aplicação.
    await client!.unsafe(readFileSync("drizzle/0035_contest_checkout_recovery.sql", "utf8"));
    [legacyBackfill] = await client!<{ checkout_ui_mode: string; started: boolean }[]>`select checkout_ui_mode,stripe_creation_started_at = created_at as started from contest_orders where id='legacy-before-migration'`;
  });
  beforeEach(async () => {
    await client!`truncate contest_orders,contest_purchases`;
    vi.clearAllMocks();
    mocked.user.mockResolvedValue(user);
    mocked.customer.mockResolvedValue("cus_qa");
    mocked.released.mockResolvedValue([{ slug, opportunityId: 1, stripeMode: "test", stripeProductId: "prod_qa", stripePriceMonthly: "price_qa" }]);
    mocked.prices.mockResolvedValue({ id: "price_qa", active: true, product: "prod_qa", currency: "brl", livemode: false, unit_amount: 6700,
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } });
    mocked.list.mockResolvedValue({ data: [], has_more: false });
    mocked.retrieve.mockImplementation(async (id: string) => {
      const pages = await Promise.all(mocked.list.mock.results.filter((result) => result.type === "return").map((result) => result.value));
      const found = pages.flatMap((page: { data: Stripe.Checkout.Session[] }) => page.data).find((item) => item.id === id);
      return found ?? sessionFor((await db!.select().from(schema.contestOrders))[0], { id });
    });
    mocked.create.mockImplementation(async (params: Stripe.Checkout.SessionCreateParams) => sessionFor(await state(params.metadata!.order_id as string)));
    mocked.expire.mockImplementation(async (id: string) => {
      const order = (await db!.select().from(schema.contestOrders))[0];
      return sessionFor(order, { id, status: "expired" });
    });
  });
  afterAll(async () => {
    await client?.end({ timeout: 2 });
    if (!/^checkout_test_[a-f0-9]{32}$/.test(namespace)) throw new Error("invalid_test_schema");
    await control?.unsafe(`drop schema if exists ${namespace} cascade`);
    await control?.end();
  });

  it("trata todo legado pendente como criação desconhecida, não como nunca iniciada", () => {
    expect(legacyBackfill).toEqual({ checkout_ui_mode: "hosted", started: true });
  });
  it("persiste elements/início antes da Stripe e conserva chave/expiração na criação", async () => {
    const id = randomUUID();
    mocked.create.mockImplementation(async () => { const order = await state(id); expect(order.stripeCreationStartedAt).toBeInstanceOf(Date); return sessionFor(order); });
    const response = await POST(request(id));
    expect(response.status).toBe(200);
    const order = await state(id);
    expect(order.status).toBe("pending");
    expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ ui_mode: "elements", expires_at: originalContestCheckoutExpiry(order),
      return_url: `https://qa.example.invalid/app/compras?pedido=${id}&session_id={CHECKOUT_SESSION_ID}` }), { idempotencyKey: `contest-subscription:${id}` });
  });
  it("CAS entre início e cancelamento só permite um vencedor", async () => {
    for (let index = 0; index < 12; index += 1) {
      const order = await fixture();
      const [started, cancelled] = await Promise.all([markContestCreationStarted(db!, order, "cus_qa"), cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)]);
      expect(Number(started) + Number(cancelled === "cancelled")).toBe(1);
      const fresh = await state(order.id);
      expect(fresh.status === "expired" ? fresh.stripeCreationStartedAt === null : fresh.stripeCreationStartedAt !== null).toBe(true);
    }
    expect(mocked.list).not.toHaveBeenCalled(); expect(mocked.expire).not.toHaveBeenCalled();
  });
  it("cancelamento vence enquanto API busca customer e impede sessions.create", async () => {
    let release!: (id: string) => void, entered!: () => void;
    const ready = new Promise<void>((done) => { entered = done; });
    mocked.customer.mockImplementation(() => { entered(); return new Promise<string>((done) => { release = done; }); });
    const id = randomUUID(); const pending = POST(request(id)); await ready;
    expect((await cancelContestOrderAction({ message: "" }, form(id))).message).toContain("cancelado");
    release("cus_qa"); expect((await pending).status).toBe(409);
    expect(mocked.create).not.toHaveBeenCalled(); expect((await state(id)).status).toBe("expired");
  });
  it("recupera resposta perdida pela metadata sem criar outra sessão", async () => {
    const id = randomUUID(); let created!: Stripe.Checkout.Session;
    mocked.create.mockImplementation(async () => { created = sessionFor(await state(id)); throw new Error("resposta perdida"); });
    expect((await POST(request(id))).status).toBe(502);
    mocked.list.mockResolvedValue({ data: [created], has_more: false });
    expect((await POST(request(id))).status).toBe(200);
    expect((await state(id)).stripeSessionId).toBe(created.id);
    expect(mocked.create).toHaveBeenCalledTimes(1);
  });
  it("repete hosted legado com parâmetros idempotentes originais quando busca não encontrou sessão", async () => {
    const order = await fixture({ checkoutUiMode: "hosted", stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    expect((await POST(request(order.id))).status).toBe(200);
    expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ ui_mode: "hosted", expires_at: originalContestCheckoutExpiry(order),
      success_url: `https://qa.example.invalid/app/compras?pedido=${order.id}`, cancel_url: `https://qa.example.invalid/checkout/concurso/${slug}?acesso=monthly` }),
      { idempotencyKey: `contest-subscription:${order.id}` });
    expect(mocked.create.mock.calls[0][0]).not.toHaveProperty("return_url");
  });
  it("antes de uma hora não declara cancelada a criação desconhecida sem sessão encontrada", async () => {
    const order = await fixture({ stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    expect(await cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).toBe("wait");
    expect((await state(order.id)).status).toBe("created"); expect(mocked.expire).not.toHaveBeenCalled();
  });
  it("só libera ausência confirmada após expiração original, nunca estende expires_at", async () => {
    const order = await fixture({ createdAt: new Date(Date.now() - 3_700_000), stripeCreationStartedAt: new Date(Date.now() - 3_700_000), stripeCustomerId: "cus_qa" });
    expect(await cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).toBe("cancelled");
    expect((await state(order.id)).status).toBe("expired"); expect(mocked.create).not.toHaveBeenCalled();
  });
  it("sessão concluída descoberta impede cancelamento e nova compra", async () => {
    const order = await fixture({ stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    mocked.list.mockResolvedValue({ data: [sessionFor(order, { status: "complete" })], has_more: false });
    expect(await cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).toBe("completed");
    expect((await POST(request(order.id))).status).toBe(409);
    expect((await state(order.id)).status).toBe("created"); expect(mocked.expire).not.toHaveBeenCalled(); expect(mocked.create).not.toHaveBeenCalled();
  });
  it("expira sessão open encontrada e preserva pagamento que concorreu ao CAS", async () => {
    const order = await fixture({ stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    mocked.list.mockResolvedValue({ data: [sessionFor(order)], has_more: false });
    mocked.expire.mockImplementation(async () => { await db!.update(schema.contestOrders).set({ status: "paid" }).where(eq(schema.contestOrders.id, order.id)); return sessionFor(order, { status: "expired" }); });
    expect(await cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).toBe("conflict");
    expect((await state(order.id)).status).toBe("paid");
  });
  it("cancela sessão open confirmada e não cancela se expire falhar", async () => {
    const order = await fixture({ stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    mocked.list.mockResolvedValue({ data: [sessionFor(order)], has_more: false });
    mocked.expire.mockRejectedValueOnce(new Error("sintético"));
    await expect(cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).rejects.toThrow();
    expect((await state(order.id)).status).toBe("created");
    mocked.expire.mockResolvedValue(sessionFor(order, { status: "expired" }));
    expect(await cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).toBe("cancelled");
    expect((await state(order.id)).status).toBe("expired");
  });
  it("não cancela resultado ambíguo, incompleto ou falha Stripe", async () => {
    const order = await fixture({ stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    mocked.list.mockResolvedValue({ data: [sessionFor(order), sessionFor(order, { id: "cs_second" })], has_more: false });
    expect((await cancelContestOrderAction({ message: "" }, form(order.id))).message).toContain("Não foi possível");
    mocked.list.mockImplementation(async () => ({ data: [{ id: `cs_unrelated_${randomUUID()}`, metadata: {} }], has_more: true }));
    expect((await cancelContestOrderAction({ message: "" }, form(order.id))).message).toContain("Não foi possível");
    mocked.list.mockRejectedValue(new Error("falha sintética privada"));
    expect((await cancelContestOrderAction({ message: "" }, form(order.id))).message).not.toContain("privada");
    expect((await state(order.id)).status).toBe("created"); expect(mocked.expire).not.toHaveBeenCalled();
  });
  it("não cancela identidade alheia nem assume ausência sem customer conhecido", async () => {
    const order = await fixture({ stripeCreationStartedAt: new Date(), stripeCustomerId: "cus_qa" });
    mocked.list.mockResolvedValue({ data: [sessionFor(order, { client_reference_id: "outro" })], has_more: false });
    await expect(cancelRecoverableContestOrder(db!, sessions(), order, user.publicId)).rejects.toThrow("identity");
    await expect(cancelRecoverableContestOrder(db!, sessions(), { ...order, stripeCustomerId: null }, user.publicId)).rejects.toThrow("customer_missing");
    expect(mocked.expire).not.toHaveBeenCalled(); expect((await state(order.id)).status).toBe("created");
  });
});
