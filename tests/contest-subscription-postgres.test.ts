import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { subscriptionFixture } from "./fixtures/contest-subscription";

const url = process.env.LEIPROVA_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55439" ||
    target.pathname !== "/leiprova_automation_test"
  )
    throw new Error("Somente QA local sintético.");
}
const client = url ? postgres(url, { max: 4, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const stripe = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn() },
  invoices: { retrieve: vi.fn() },
  invoicePayments: { list: vi.fn() },
  paymentIntents: { retrieve: vi.fn() },
}));
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => stripe }));
import { processContestSubscriptionEvent } from "@/lib/commerce/subscription-webhook";
import { getStudyEntitlement } from "@/lib/study/entitlement";

describe.skipIf(!db)(
  "ciclos recorrentes: isolamento e reconciliação PostgreSQL",
  () => {
    let user: typeof schema.users.$inferSelect;
    let other: typeof schema.users.$inferSelect;
    let opportunityId: number;
    const slug = `qa-recurring-${randomUUID()}`;
    const orders: string[] = [];
    beforeAll(async () => {
      [user, other] = await db!
        .insert(schema.users)
        .values(
          [0, 1].map((index) => ({
            publicId: randomUUID(),
            email: `recurring-${randomUUID()}@example.invalid`,
            name: `Assinante fictício ${index}`,
            passwordHash: "not-a-password",
          })),
        )
        .returning();
      const rows =
        await client!`select o.id from contest_opportunities o join question_opportunities qo on qo.opportunity_id=o.id join questions q on q.id=qo.question_id where o.slug like 'teste-%' and q.editorial_status='reviewed' limit 1`;
      if (!rows.length) throw new Error("Fixture editorial de QA ausente.");
      opportunityId = Number(rows[0].id);
      await db!
        .insert(schema.contestStoreProducts)
        .values({ slug, opportunityId });
    });
    afterAll(async () => {
      if (db) {
        for (const id of orders)
          await db
            .delete(schema.contestOrders)
            .where(eq(schema.contestOrders.id, id));
        await db
          .delete(schema.contestStoreProducts)
          .where(eq(schema.contestStoreProducts.slug, slug));
        for (const person of [user, other])
          if (person)
            await db.delete(schema.users).where(eq(schema.users.id, person.id));
      }
      await client?.end();
    });
    function configureStripeFixture(f: ReturnType<typeof subscriptionFixture>) {
      stripe.subscriptions.retrieve.mockResolvedValue(f.subscription);
      stripe.invoices.retrieve.mockResolvedValue(f.invoice);
      stripe.invoicePayments.list.mockResolvedValue(f.payments);
      stripe.paymentIntents.retrieve.mockResolvedValue(f.intent);
    }
    async function fixture(annual = false) {
      const id = randomUUID();
      orders.push(id);
      const f = subscriptionFixture({
        orderId: id,
        publicId: user.publicId,
        slug,
        opportunityId,
        annual,
      });
      await db!
        .insert(schema.contestOrders)
        .values({
          id,
          userId: user.id,
          amountCents: annual ? 34700 : 6700,
          stripeMode: "test",
          stripeCustomerId: "cus_qa",
          lines: f.lines,
        });
      configureStripeFixture(f);
      return f;
    }
    async function purchases(id: string) {
      return db!
        .select()
        .from(schema.contestPurchases)
        .where(eq(schema.contestPurchases.orderId, id));
    }
    it("não concede acesso antes do primeiro pagamento", async () => {
      const f = await fixture();
      f.subscription.status = "incomplete";
      f.invoice.status = "open";
      await processContestSubscriptionEvent(f.event);
      expect(await purchases(f.id)).toHaveLength(0);
    });
    it.each([false, true])(
      "concede apenas o período pago; anual=%s; sem Master",
      async (annual) => {
        const f = await fixture(annual);
        await processContestSubscriptionEvent(f.event);
        const [purchase] = await purchases(f.id);
        expect(purchase.accessEndsAt.getTime()).toBe(f.end * 1000);
        expect(purchase.accessStartsAt.getTime()).toBe(f.start * 1000);
        expect((await getStudyEntitlement(user.id)).hasFullAccess).toBe(false);
        expect(await getStudyEntitlement(other.id)).toEqual({
          hasFullAccess: false,
          questionPublicIds: [],
        });
      },
    );
    it("duas entregas concorrentes não duplicam nem estendem o ciclo", async () => {
      const f = await fixture();
      await Promise.all([
        processContestSubscriptionEvent(f.event),
        processContestSubscriptionEvent({ ...f.event, created: f.end + 86400 }),
      ]);
      const rows = await purchases(f.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].accessEndsAt.getTime()).toBe(f.end * 1000);
      expect(
        await db!
          .select()
          .from(schema.contestBillingInvoices)
          .where(eq(schema.contestBillingInvoices.orderId, f.id)),
      ).toHaveLength(1);
    });
    it("renova pela nova fatura e ignora a data de um evento antigo", async () => {
      const f = await fixture();
      await processContestSubscriptionEvent(f.event);
      const next = subscriptionFixture({
        orderId: f.id,
        publicId: user.publicId,
        slug,
        opportunityId,
        start: f.end,
      });
      configureStripeFixture(next);
      await processContestSubscriptionEvent(next.event);
      await processContestSubscriptionEvent(f.event);
      expect((await purchases(f.id))[0].accessEndsAt.getTime()).toBe(
        next.end * 1000,
      );
    });
    it("falha na renovação não amplia o acesso já pago", async () => {
      const f = await fixture();
      await processContestSubscriptionEvent(f.event);
      const next = subscriptionFixture({
        orderId: f.id,
        publicId: user.publicId,
        slug,
        opportunityId,
        start: f.end,
      });
      next.subscription.status = "past_due";
      next.invoice.status = "open";
      configureStripeFixture(next);
      await processContestSubscriptionEvent({
        ...next.event,
        type: "invoice.payment_failed",
      } as Stripe.Event);
      expect((await purchases(f.id))[0].accessEndsAt.getTime()).toBe(
        f.end * 1000,
      );
    });
    it("cancelamento ao final preserva período pago; cancelamento efetivo revoga", async () => {
      const f = await fixture();
      await processContestSubscriptionEvent(f.event);
      f.subscription.cancel_at_period_end = true;
      await processContestSubscriptionEvent(f.event);
      expect((await purchases(f.id))[0].status).toBe("active");
      f.subscription.status = "canceled";
      await processContestSubscriptionEvent(f.event);
      expect((await purchases(f.id))[0].status).toBe("revoked");
      await processContestSubscriptionEvent(f.event);
      expect((await purchases(f.id))[0].status).toBe("revoked");
    });
    it("reembolso antigo não revoga ciclo posterior pago; reembolso atual revoga", async () => {
      const f = await fixture();
      await processContestSubscriptionEvent(f.event);
      const next = subscriptionFixture({
        orderId: f.id,
        publicId: user.publicId,
        slug,
        opportunityId,
        start: f.end,
      });
      configureStripeFixture(next);
      await processContestSubscriptionEvent(next.event);
      const refund = (intentId: string) =>
        ({
          type: "charge.refunded",
          livemode: false,
          data: { object: { payment_intent: intentId } },
        }) as Stripe.Event;
      await processContestSubscriptionEvent(refund(f.intent.id));
      expect((await purchases(f.id))[0].status).toBe("active");
      await processContestSubscriptionEvent(refund(next.intent.id));
      expect((await purchases(f.id))[0].status).toBe("revoked");
      await processContestSubscriptionEvent(next.event);
      expect((await purchases(f.id))[0].status).toBe("revoked");
    });
    it("reembolso antes do evento da fatura não libera acesso", async () => {
      const f = await fixture();
      (f.intent.latest_charge as Stripe.Charge).amount_refunded = 1;
      await processContestSubscriptionEvent(f.event);
      expect(await purchases(f.id)).toHaveLength(0);
    });
    it("rejeita cliente ou preço de outro produto", async () => {
      const f = await fixture();
      f.subscription.customer = "cus_outro";
      await expect(processContestSubscriptionEvent(f.event)).rejects.toThrow(
        "Identidade",
      );
      expect(await purchases(f.id)).toHaveLength(0);
      f.subscription.customer = "cus_qa";
      f.subscription.items.data[0].price.id = "price_master";
      await expect(processContestSubscriptionEvent(f.event)).rejects.toThrow(
        "Preço",
      );
    });
    it("evento de outra integração não é processado como concurso", async () => {
      const f = subscriptionFixture();
      f.invoice.parent!.subscription_details!.metadata = { app: "outro" };
      expect(await processContestSubscriptionEvent(f.event)).toBe(false);
    });
  },
);
