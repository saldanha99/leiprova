import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { PLANS } from "@/lib/plans";

const url = process.env.LEIPROVA_WEBHOOK_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (target.protocol !== "postgres:" || target.hostname !== "127.0.0.1" || target.port !== "55479" ||
    target.pathname !== "/leiprova_webhook_test" || target.username !== "leiprova_test" || target.password || target.search || target.hash)
    throw new Error("Somente PostgreSQL descartável local para checkout.");
}
const namespace = `master_checkout_${randomUUID().replaceAll("-", "")}`;
const client = url ? postgres(url, { max: 2, prepare: false, connection: { search_path: namespace }, onnotice: () => undefined }) : null;
const control = url ? postgres(url, { max: 1, prepare: false, onnotice: () => undefined }) : null;
const db = client ? drizzle(client, { schema }) : null;
const mocks = vi.hoisted(() => ({ user: vi.fn(), create: vi.fn(), retrieve: vi.fn(), price: vi.fn(), customer: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/stripe", () => ({
  getCheckoutAvailability: (plan: { stripePriceEnv: string }) => ({ available: true,
    priceId: plan.stripePriceEnv === "STRIPE_PRICE_RITMO" ? "price_ritmo" : "price_foco" }),
  getPublicOrigin: () => "https://example.invalid", hasTrustedOrigin: () => true,
  stripeKeyExpectsLivemode: () => false,
  stripeMetadata: (input: { userId: number; userPublicId: string; planSlug: string; attemptId: string }) => ({
    app: "leiprova", user_id: String(input.userId), user_public_id: input.userPublicId,
    plan_slug: input.planSlug, checkout_attempt_id: input.attemptId,
  }),
  getStripeClient: () => ({ checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } },
    prices: { retrieve: mocks.price }, customers: { create: mocks.customer } }),
}));
import { POST } from "@/app/api/stripe/checkout/route";

describe.skipIf(!db)("Master: duas abas e retry com reserva durável PostgreSQL", () => {
  let userId = 0;
  let publicId = "";
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const creations = new Map<string, { params: string; session: Stripe.Checkout.Session }>();
  beforeAll(async () => {
    await control!.unsafe(`create schema ${namespace}`);
    await client!.unsafe(`
      create table users (id bigint primary key, public_id text not null, stripe_customer_id text, updated_at timestamptz default now());
      create table plans (id bigint primary key, slug text unique not null, stripe_price_id text, is_active boolean not null default true,
        amount_cents integer not null, currency text not null default 'brl', billing_type text not null);
      create table subscriptions (id bigint generated always as identity primary key, user_id bigint references users(id), status text not null);
      create table checkout_attempts (
        id text primary key, user_id bigint not null references users(id), plan_id bigint not null references plans(id),
        provider_session_id text unique, status text not null default 'created', expires_at timestamptz,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        check(status in ('created','session_created','completed','expired','failed'))
      );
      insert into plans values (1,'ritmo','price_ritmo',true,29700,'brl','month'),(2,'foco','price_foco',true,89700,'brl','year');
    `);
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessions.clear(); creations.clear();
    userId += 1;
    publicId = `synthetic-user-${randomUUID()}`;
    await client!`insert into users(id,public_id,stripe_customer_id) values (${userId},${publicId},${`cus_${userId}`})`;
    mocks.user.mockResolvedValue({ id: userId, publicId, stripeCustomerId: `cus_${userId}`,
      email: `${publicId}@example.invalid`, name: "Cliente sintético", role: "student", avatarUrl: null });
    mocks.price.mockImplementation(async id => price(id));
    mocks.create.mockImplementation(create);
    mocks.retrieve.mockImplementation(async id => {
      const session = sessions.get(id);
      if (!session) throw new Error("Sessão sintética ausente");
      return structuredClone(session);
    });
  });
  afterAll(async () => {
    await client?.end({ timeout: 2 });
    await control?.unsafe(`drop schema if exists ${namespace} cascade`);
    await control?.end({ timeout: 2 });
  });

  function price(id: string) {
    const plan = PLANS.find(item => `price_${item.slug}` === id)!;
    return { id, active: true, type: "recurring", billing_scheme: "per_unit", livemode: false,
      unit_amount: plan.priceCents, currency: "brl", recurring: { interval: plan.billingMonths === 12 ? "year" : "month",
        interval_count: 1, usage_type: "licensed" } } as Stripe.Price;
  }
  async function create(params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) {
    const key = options.idempotencyKey!;
    const previous = creations.get(key);
    if (previous) {
      if (previous.params !== JSON.stringify(params)) throw new Error("Parâmetros idempotentes divergentes");
      return structuredClone(previous.session);
    }
    const itemPrice = price(params.line_items![0].price!);
    const session = { id: `cs_${randomUUID()}`, mode: "subscription", ui_mode: "elements", status: "open",
      client_secret: `secret_synthetic_${key}`, customer: params.customer, client_reference_id: params.client_reference_id,
      livemode: false, currency: "brl", amount_subtotal: itemPrice.unit_amount, expires_at: params.expires_at,
      metadata: params.metadata, line_items: { data: [{ quantity: 1, price: itemPrice }], has_more: false },
    } as unknown as Stripe.Checkout.Session;
    creations.set(key, { params: JSON.stringify(params), session });
    sessions.set(session.id, session);
    await new Promise<void>(resolve => setImmediate(resolve));
    return structuredClone(session);
  }
  function request(planSlug = "ritmo", attemptId = randomUUID()) {
    return new NextRequest("https://example.invalid/api/stripe/checkout", {
      method: "POST", body: JSON.stringify({ planSlug, attemptId }), headers: { "Content-Type": "application/json" },
    });
  }
  const attempts = () => db!.select().from(schema.checkoutAttempts).where(eq(schema.checkoutAttempts.userId, userId));

  it("duas abas do mesmo plano usam uma tentativa/sessão/chave e expiração persistida", async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(await responses[0].json()).toEqual(await responses[1].json());
    const rows = await attempts();
    expect(rows).toHaveLength(1);
    expect(creations.size).toBe(1);
    expect(rows[0].providerSessionId).toBe([...sessions.keys()][0]);
    const entry = creations.get(`checkout:${rows[0].id}`)!;
    expect(JSON.parse(entry.params).expires_at).toBe(Math.floor(rows[0].expiresAt!.getTime() / 1000));
    expect(rows[0].expiresAt!.getTime() - rows[0].createdAt.getTime()).toBe(3600_000);
  });
  it("12 abas com pool2 também reutilizam uma única tentativa", async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => POST(request())));
    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(await attempts()).toHaveLength(1);
    expect(creations.size).toBe(1);
  });
  it("dois planos simultâneos: somente um pode iniciar cobrança", async () => {
    const responses = await Promise.all([POST(request("ritmo")), POST(request("foco"))]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await attempts()).toHaveLength(1);
    expect(creations.size).toBe(1);
  });
  it("falha antes da criação preserva reserva e permite retry com novo ID da aba", async () => {
    mocks.price.mockRejectedValueOnce(new Error("Stripe indisponível"));
    expect((await POST(request())).status).toBe(502);
    const [before] = await attempts();
    expect(before.providerSessionId).toBeNull();
    expect((await POST(request())).status).toBe(200);
    expect((await attempts())[0].id).toBe(before.id);
    expect(creations.size).toBe(1);
  });
  it("resposta perdida da Stripe retoma com chave e parâmetros exatamente iguais", async () => {
    mocks.create.mockImplementationOnce(async (params, options) => {
      await create(params, options);
      throw new Error("Resposta perdida após aceitar criação");
    });
    expect((await POST(request())).status).toBe(502);
    const [before] = await attempts();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    try { expect((await POST(request())).status).toBe(200); }
    finally { clock.mockRestore(); }
    const [after] = await attempts();
    expect(after.id).toBe(before.id);
    expect(after.expiresAt).toEqual(before.expiresAt);
    expect(creations.size).toBe(1);
  });
  it("falha ao salvar sessão não cria nova cobrança no retry", async () => {
    await client!.unsafe(`create function fail_session_save() returns trigger language plpgsql as $$
      begin raise exception 'falha sintética de persistência'; end $$;
      create trigger fail_session_save before update of provider_session_id on checkout_attempts
        for each row execute function fail_session_save();`);
    try { expect((await POST(request())).status).toBe(502); }
    finally { await client!.unsafe("drop trigger fail_session_save on checkout_attempts; drop function fail_session_save();"); }
    expect((await attempts())[0].providerSessionId).toBeNull();
    expect((await POST(request())).status).toBe(200);
    expect(creations.size).toBe(1);
  });
  it("tentativa legada sem sessão/expiração exige conciliação sem mutação Stripe", async () => {
    const id = randomUUID();
    await db!.insert(schema.checkoutAttempts).values({ id, userId, planId: 1 });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect((await attempts())[0]).toMatchObject({ id, status: "created", providerSessionId: null, expiresAt: null });
  });
  it("múltiplas tentativas antigas não são conciliadas por suposição", async () => {
    await db!.insert(schema.checkoutAttempts).values([0, 1].map(() => ({ id: randomUUID(), userId, planId: 1 })));
    expect((await POST(request())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(await attempts()).toHaveLength(2);
  });
  it.each(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"])(
    "assinatura %s bloqueia nova cobrança", async status => {
      await client!`insert into subscriptions(user_id,status) values (${userId},${status})`;
      expect((await POST(request())).status).toBe(409);
      expect(await attempts()).toHaveLength(0);
      expect(mocks.create).not.toHaveBeenCalled();
    });
  it("sessão conhecida expirada permite nova seleção somente após confirmação da Stripe", async () => {
    expect((await POST(request())).status).toBe(200);
    const session = [...sessions.values()][0]; session.status = "expired";
    expect((await POST(request())).status).toBe(409);
    expect((await attempts())[0].status).toBe("expired");
    expect((await POST(request("foco"))).status).toBe(200);
    expect(creations.size).toBe(2);
  });
  it("não entrega segredo de sessão de outro cliente", async () => {
    expect((await POST(request())).status).toBe(200);
    [...sessions.values()][0].customer = "cus_outro";
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty("clientSecret");
    expect(creations.size).toBe(1);
  });
  it("não retoma preço ou modo divergente nem cria substituto", async () => {
    expect((await POST(request())).status).toBe(200);
    [...sessions.values()][0].livemode = true;
    expect((await POST(request())).status).toBe(502);
    expect(creations.size).toBe(1);
  });
  it("não recria tentativa antiga sem sessão usando novo prazo", async () => {
    const createdAt = new Date(Date.now() - 40 * 60_000);
    await db!.insert(schema.checkoutAttempts).values({ id: randomUUID(), userId, planId: 1, createdAt,
      expiresAt: new Date(createdAt.getTime() + 3600_000) });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect((await attempts())[0].status).toBe("created");
  });
  it("preço divergente no banco é bloqueado antes de reservar tentativa ou cobrar", async () => {
    await client!`update plans set amount_cents=1 where slug='ritmo'`;
    try {
      expect((await POST(request())).status).toBe(503);
      expect(await attempts()).toHaveLength(0);
      expect(mocks.create).not.toHaveBeenCalled();
    } finally { await client!`update plans set amount_cents=29700 where slug='ritmo'`; }
  });
});
