import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { NextRequest } from "next/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/lib/db/schema";
import {
  CONTEST_CATALOG,
  CONTEST_ACCESS_OPTIONS,
} from "@/lib/commerce/catalog";
import { subscriptionFixture } from "./fixtures/contest-subscription";

const url = process.env.LEIPROVA_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55439" ||
    target.pathname !== "/leiprova_automation_test"
  )
    throw new Error("Somente QA sintético.");
}
const client = url ? postgres(url, { max: 1, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const mocked = vi.hoisted(() => ({
  user: vi.fn(),
  released: vi.fn(),
  enabled: vi.fn(),
  trusted: vi.fn(),
  create: vi.fn(),
  prices: vi.fn(),
  customer: vi.fn(),
  retrieve: vi.fn(),
  subscription: vi.fn(),
  updateSubscription: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocked.user,
  requireUser: mocked.user,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/commerce/subscription-webhook", () => ({
  reconcileContestSubscription: mocked.reconcile,
}));
vi.mock("@/lib/commerce/store", () => ({
  listReleasedContestProducts: mocked.released,
}));
vi.mock("@/lib/commerce/customer", () => ({
  getOrCreateStripeCustomer: mocked.customer,
}));
vi.mock("@/lib/study/entitlement", () => ({
  getStudyEntitlement: async () => ({
    hasFullAccess: false,
    questionPublicIds: [],
  }),
}));
vi.mock("@/lib/stripe", () => ({
  getCheckoutAvailability: () => ({ available: true }),
  getPublicOrigin: () => "https://qa.example.invalid",
  hasTrustedOrigin: mocked.trusted,
  isContestCheckoutEnabled: mocked.enabled,
  stripeKeyExpectsLivemode: () => false,
  getStripeWebhookConfiguration: () => ({ secretKey: "qa-not-a-secret" }),
  getStripeClient: () => ({
    subscriptions: {
      retrieve: mocked.subscription,
      update: mocked.updateSubscription,
    },
    prices: { retrieve: mocked.prices },
    checkout: {
      sessions: { create: mocked.create, retrieve: mocked.retrieve },
    },
  }),
}));
import { POST } from "@/app/api/stripe/contest-checkout/route";
import { cancelContestRenewalAction } from "@/app/actions/contest-subscriptions";

describe.skipIf(!db)(
  "checkout por concurso cria assinatura com preços recorrentes",
  () => {
    let user: typeof schema.users.$inferSelect;
    const ids: string[] = [];
    const slug = CONTEST_CATALOG[0].slug;
    beforeAll(async () => {
      [user] = await db!
        .insert(schema.users)
        .values({
          publicId: randomUUID(),
          email: `recurring-api-${randomUUID()}@example.invalid`,
          name: "Cliente API fictício",
          passwordHash: "not-a-password",
        })
        .returning();
    });
    afterAll(async () => {
      if (db) {
        for (const id of ids)
          await db
            .delete(schema.contestOrders)
            .where(eq(schema.contestOrders.id, id));
        if (user)
          await db.delete(schema.users).where(eq(schema.users.id, user.id));
      }
      await client?.end();
    });
    beforeEach(async () => {
      if (db)
        for (const id of ids)
          await db
            .delete(schema.contestOrders)
            .where(eq(schema.contestOrders.id, id));
      vi.clearAllMocks();
      mocked.user.mockResolvedValue(user);
      mocked.enabled.mockReturnValue(true);
      mocked.trusted.mockReturnValue(true);
      mocked.customer.mockResolvedValue("cus_qa");
      mocked.released.mockResolvedValue([
        {
          slug,
          opportunityId: 1,
          stripeMode: "test",
          stripeProductId: "prod_qa",
          stripePriceMonthly: "price_monthly",
          stripePriceAnnual: "price_annual",
        },
      ]);
      mocked.prices.mockImplementation(async (id: string) => {
        const option = CONTEST_ACCESS_OPTIONS.find(
          (option) => `price_${option.key}` === id,
        )!;
        return {
          id,
          active: true,
          product: "prod_qa",
          currency: "brl",
          livemode: false,
          unit_amount: option.amountCents,
          recurring: {
            interval: option.interval,
            interval_count: 1,
            usage_type: "licensed",
          },
        };
      });
      mocked.create.mockImplementation(async (params: Stripe.Checkout.SessionCreateParams) => ({
        id: `cs_${randomUUID()}`,
        metadata: params.metadata,
        customer: params.customer,
        client_reference_id: params.client_reference_id,
        mode: params.mode,
        livemode: false,
        url: "https://checkout.stripe.com/c/pay/qa",
        client_secret: "cs_synthetic_secret",
        ui_mode: "elements",
        status: "open",
      }));
    });
    function request(accessKey: string, attemptId = randomUUID()) {
      ids.push(attemptId);
      return new NextRequest(
        "https://qa.example.invalid/api/stripe/contest-checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            items: [{ productSlug: slug, accessKey }],
          }),
        },
      );
    }
    it.each(["monthly", "annual"])(
      "usa subscription, preço correto e metadata para %s",
      async (key) => {
        const response = await POST(request(key));
        expect(response.status).toBe(200);
        expect(mocked.create).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: "subscription",
            ui_mode: "elements",
            return_url: expect.stringMatching(/^https:\/\/qa\.example\.invalid\/app\/compras\?pedido=.+&session_id=\{CHECKOUT_SESSION_ID\}$/),
            customer: "cus_qa",
            line_items: [{ price: `price_${key}`, quantity: 1 }],
            subscription_data: {
              metadata: expect.objectContaining({
                app: "leiprova",
                commerce: "contest_subscription_v2",
              }),
            },
          }),
          expect.anything(),
        );
        expect(mocked.create.mock.calls[0][0]).not.toHaveProperty(
          "payment_intent_data",
        );
        expect(mocked.create.mock.calls[0][0]).not.toHaveProperty("success_url");
        expect(mocked.create.mock.calls[0][0]).not.toHaveProperty("cancel_url");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(await response.json()).toMatchObject({ clientSecret: "cs_synthetic_secret", orderId: expect.any(String) });
      },
    );
    it("rejeita seis meses e mantém as flags de venda", async () => {
      expect((await POST(request("6m"))).status).toBe(400);
      mocked.enabled.mockReturnValue(false);
      expect((await POST(request("monthly"))).status).toBe(503);
      expect(mocked.create).not.toHaveBeenCalled();
    });
    it("rejeita usuário ausente e origem não confiável", async () => {
      mocked.user.mockResolvedValue(null);
      expect((await POST(request("monthly"))).status).toBe(401);
      mocked.trusted.mockReturnValue(false);
      expect((await POST(request("monthly"))).status).toBe(403);
      expect(mocked.create).not.toHaveBeenCalled();
    });
    it("rejeita preço de pagamento único sem abrir Stripe", async () => {
      mocked.prices.mockResolvedValue({
        id: "price_monthly",
        active: true,
        unit_amount: 6700,
        currency: "brl",
        product: "prod_qa",
        livemode: false,
        recurring: null,
      });
      expect((await POST(request("monthly"))).status).toBe(409);
      expect(mocked.create).not.toHaveBeenCalled();
    });
    it("reutiliza a mesma sessão numa repetição", async () => {
      const id = randomUUID();
      await POST(request("annual", id));
      mocked.retrieve.mockResolvedValue(await mocked.create.mock.results[0].value);
      const response = await POST(request("annual", id));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ clientSecret: "cs_synthetic_secret", orderId: id });
      expect(mocked.create).toHaveBeenCalledTimes(1);
    });
    it("retoma checkout hospedado legado sem criar outra sessão", async () => {
      const id = randomUUID();
      await POST(request("annual", id));
      await db!.update(schema.contestOrders).set({ checkoutUiMode: "hosted" }).where(eq(schema.contestOrders.id, id));
      mocked.retrieve.mockResolvedValue({
        ...await mocked.create.mock.results[0].value,
        ui_mode: "hosted",
        url: "https://checkout.stripe.com/c/pay/qa",
      });
      expect((await POST(request("annual", id))).status).toBe(200);
      expect(mocked.create).toHaveBeenCalledTimes(1);
    });
    it("não inicia segunda assinatura enquanto a primeira está inadimplente", async () => {
      const id = randomUUID();
      await POST(request("monthly", id));
      await db!
        .update(schema.contestOrders)
        .set({
          status: "paid",
          stripeSubscriptionId: `sub_${id}`,
          subscriptionStatus: "past_due",
        })
        .where(eq(schema.contestOrders.id, id));
      expect((await POST(request("monthly"))).status).toBe(409);
      expect(mocked.create).toHaveBeenCalledTimes(1);
    });
    it("cancela somente a renovação do dono, mesmo com novas vendas fechadas", async () => {
      const id = randomUUID();
      await POST(request("annual", id));
      await db!
        .update(schema.contestOrders)
        .set({
          stripeSubscriptionId: `sub_${id}`,
          subscriptionStatus: "active",
        })
        .where(eq(schema.contestOrders.id, id));
      const f = subscriptionFixture({
        orderId: id,
        publicId: user.publicId,
        annual: true,
      });
      f.subscription.items.data[0].price.id = "price_annual";
      mocked.subscription.mockResolvedValue(f.subscription);
      mocked.enabled.mockReturnValue(false);
      const form = new FormData();
      form.set("orderId", id);
      expect(
        (await cancelContestRenewalAction({ message: "" }, form)).message,
      ).toContain("Renovação cancelada");
      expect(mocked.updateSubscription).toHaveBeenCalledWith(`sub_${id}`, {
        cancel_at_period_end: true,
      });
      expect(mocked.reconcile).toHaveBeenCalledWith(`sub_${id}`, id);
      mocked.updateSubscription.mockClear();
      mocked.user.mockResolvedValue({ ...user, id: -999 });
      expect(
        (await cancelContestRenewalAction({ message: "" }, form)).message,
      ).toContain("não encontrada");
      expect(mocked.updateSubscription).not.toHaveBeenCalled();
    });
  },
);
