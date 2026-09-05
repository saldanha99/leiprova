import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

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
const client = url ? postgres(url, { max: 1, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const stripe = vi.hoisted(() => ({
  paymentIntents: {
    retrieve: vi.fn(async () => ({
      latest_charge: { amount_refunded: 0, disputed: false },
    })),
  },
}));
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => stripe }));
import { processContestStripeEvent } from "@/lib/commerce/webhook";
import { getStudyEntitlement } from "@/lib/study/entitlement";

describe.skipIf(!db)("compra avulsa: transação e isolamento PostgreSQL", () => {
  let user: typeof schema.users.$inferSelect;
  let other: typeof schema.users.$inferSelect;
  let opportunityId: number;
  let questionId: string;
  const slug = `qa-store-${randomUUID()}`;
  const orders: string[] = [];
  beforeAll(async () => {
    [user, other] = await db!
      .insert(schema.users)
      .values(
        [0, 1].map((index) => ({
          publicId: randomUUID(),
          email: `commerce-${randomUUID()}@example.invalid`,
          name: `Comprador fictício ${index}`,
          passwordHash: "not-a-login-password",
        })),
      )
      .returning();
    const rows =
      await client!`select o.id,q.public_id from contest_opportunities o join question_opportunities qo on qo.opportunity_id=o.id join questions q on q.id=qo.question_id where o.slug like 'teste-%' and q.editorial_status='reviewed' limit 1`;
    if (!rows.length)
      throw new Error("Fixture editorial revisada de QA ausente.");
    opportunityId = Number(rows[0].id);
    questionId = rows[0].public_id;
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
  async function fixture() {
    const id = randomUUID();
    orders.push(id);
    await db!
      .insert(schema.contestOrders)
      .values({
        id,
        userId: user.id,
        amountCents: 6700,
        stripeMode: "test",
        lines: [
          {
            productSlug: slug,
            accessKey: "6m",
            months: 6,
            amountCents: 6700,
            stripePriceId: "price_qa",
            opportunityId,
          },
        ],
      });
    return {
      id,
      event: {
        id: `evt_${id}`,
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        data: {
          object: {
            id: `cs_test_${id}`,
            metadata: {
              app: "leiprova",
              commerce: "contest_v1",
              order_id: id,
              user_public_id: user.publicId,
            },
            client_reference_id: user.publicId,
            mode: "payment",
            payment_status: "paid",
            amount_total: 6700,
            currency: "brl",
            livemode: false,
            payment_intent: `pi_${id}`,
          },
        },
      } as unknown as Stripe.Event,
    };
  }
  it("não libera pagamento pendente", async () => {
    const f = await fixture();
    (f.event.data.object as Stripe.Checkout.Session).payment_status = "unpaid";
    await processContestStripeEvent(f.event);
    expect(
      await db!
        .select()
        .from(schema.contestPurchases)
        .where(eq(schema.contestPurchases.orderId, f.id)),
    ).toHaveLength(0);
  });
  it("rejeita valor alterado e não muda o pedido", async () => {
    const f = await fixture();
    (f.event.data.object as Stripe.Checkout.Session).amount_total = 1;
    await expect(processContestStripeEvent(f.event)).rejects.toThrow("Valor");
    const [order] = await db!
      .select()
      .from(schema.contestOrders)
      .where(eq(schema.contestOrders.id, f.id));
    expect(order.status).toBe("created");
  });
  it("rejeita a identidade de outro usuário", async () => {
    const f = await fixture();
    (f.event.data.object as Stripe.Checkout.Session).client_reference_id =
      other.publicId;
    await expect(processContestStripeEvent(f.event)).rejects.toThrow(
      "Identidade",
    );
  });
  it("confirma uma vez, não renova em replay, e não dá Master nem acesso a outro usuário", async () => {
    const f = await fixture();
    await processContestStripeEvent(f.event);
    const [before] = await db!
      .select()
      .from(schema.contestPurchases)
      .where(eq(schema.contestPurchases.orderId, f.id));
    await processContestStripeEvent({
      ...f.event,
      created: f.event.created + 86400,
    });
    const after = await db!
      .select()
      .from(schema.contestPurchases)
      .where(eq(schema.contestPurchases.orderId, f.id));
    expect(after).toHaveLength(1);
    expect(after[0].accessEndsAt).toEqual(before.accessEndsAt);
    expect(await getStudyEntitlement(user.id)).toMatchObject({
      hasFullAccess: false,
      questionPublicIds: expect.arrayContaining([questionId]),
    });
    expect(await getStudyEntitlement(other.id)).toEqual({
      hasFullAccess: false,
      questionPublicIds: [],
    });
    await db!
      .update(schema.contestPurchases)
      .set({ status: "revoked" })
      .where(eq(schema.contestPurchases.orderId, f.id));
  });
  it("reembolso revoga e evento antigo não restaura", async () => {
    const f = await fixture();
    await processContestStripeEvent(f.event);
    await processContestStripeEvent({
      type: "charge.refunded",
      data: { object: { payment_intent: `pi_${f.id}` } },
    } as unknown as Stripe.Event);
    await processContestStripeEvent(f.event);
    const [purchase] = await db!
      .select()
      .from(schema.contestPurchases)
      .where(eq(schema.contestPurchases.orderId, f.id));
    expect(purchase.status).toBe("revoked");
  });
  it("reembolso anterior à confirmação também impede entrega", async () => {
    const f = await fixture();
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({
      latest_charge: { amount_refunded: 1, disputed: false },
    });
    await processContestStripeEvent(f.event);
    expect(
      await db!
        .select()
        .from(schema.contestPurchases)
        .where(eq(schema.contestPurchases.orderId, f.id)),
    ).toHaveLength(0);
    const [order] = await db!
      .select()
      .from(schema.contestOrders)
      .where(eq(schema.contestOrders.id, f.id));
    expect(order.status).toBe("refunded");
  });
  it("vence no servidor e não permite acesso futuro", async () => {
    const f = await fixture();
    await processContestStripeEvent(f.event);
    await db!
      .update(schema.contestPurchases)
      .set({
        accessStartsAt: new Date("2026-01-01"),
        accessEndsAt: new Date("2026-02-01"),
      })
      .where(eq(schema.contestPurchases.orderId, f.id));
    const entitlement = await getStudyEntitlement(
      user.id,
      new Date("2027-03-01"),
    );
    expect(entitlement.hasFullAccess).toBe(false);
    expect(entitlement.questionPublicIds).not.toContain(questionId);
    await db!
      .update(schema.contestPurchases)
      .set({ status: "revoked" })
      .where(
        and(
          eq(schema.contestPurchases.orderId, f.id),
          eq(schema.contestPurchases.userId, user.id),
        ),
      );
  });
});
