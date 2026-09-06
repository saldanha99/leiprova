import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  contestOrders,
  contestPurchases,
  type ContestOrderLine,
} from "@/lib/db/schema";
import { getContestAccessOption } from "@/lib/commerce/catalog";
import { contestCartSchema } from "@/lib/commerce/order-policy";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import { contestCheckoutSessionResponse } from "@/lib/commerce/checkout-session-response";
import {
  getCheckoutAvailability,
  getPublicOrigin,
  getStripeClient,
  hasTrustedOrigin,
  isContestCheckoutEnabled,
  stripeKeyExpectsLivemode,
} from "@/lib/stripe";
import { getStudyEntitlement } from "@/lib/study/entitlement";
import { getOrCreateStripeCustomer } from "@/lib/commerce/customer";
import {
  CONTEST_SUBSCRIPTION_COMMERCE,
  contestRecurringPriceMatches,
} from "@/lib/commerce/subscription-policy";
import {
  expireContestCheckoutSnapshot, findRecoverableContestSession, markContestCreationStarted,
  originalContestCheckoutExpiry, persistContestCheckoutSession, validateContestCheckoutSession,
} from "@/lib/commerce/contest-checkout-recovery";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const error = (message: string, status: number) =>
    Response.json({ error: message }, { status });
  if (!hasTrustedOrigin(request)) return error("Origem não autorizada.", 403);
  if (!isContestCheckoutEnabled())
    return error("Contratações ainda não abertas.", 503);
  const input = contestCartSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success)
    return error(
      "Seleção inválida. Escolha até três concursos da mesma carreira, todos mensais ou todos anuais.",
      400,
    );
  const user = await getCurrentUser();
  if (!user) return error("Entre na sua conta para continuar.", 401);
  if ((await getStudyEntitlement(user.id)).hasFullAccess)
    return error(
      "Seu Master já inclui os concursos liberados. Não é necessário comprá-los novamente.",
      409,
    );
  const released = await listReleasedContestProducts();
  const expectedLive = stripeKeyExpectsLivemode(
    process.env.STRIPE_SECRET_KEY ?? "",
  );
  const lines: ContestOrderLine[] = [];
  for (const item of input.data.items) {
    const product = released.find(
      (candidate) => candidate.slug === item.productSlug,
    );
    const option = getContestAccessOption(item.accessKey)!;
    if (!product?.opportunityId)
      return error(
        "Um dos concursos ainda não está disponível para compra.",
        409,
      );
    const price =
      item.accessKey === "monthly"
        ? product.stripePriceMonthly
        : product.stripePriceAnnual;
    if (
      !price ||
      expectedLive === null ||
      (product.stripeMode === "live") !== expectedLive ||
      !getCheckoutAvailability(
        { stripePriceEnv: "UNUSED_CONTEST_PRICE" },
        price,
      ).available
    )
      return error("Configuração de pagamento indisponível.", 503);
    lines.push({
      productSlug: item.productSlug,
      accessKey: item.accessKey,
      months: option.months,
      amountCents: option.amountCents,
      stripePriceId: price,
      opportunityId: product.opportunityId,
    });
  }
  const db = getDb();
  const owned = await db
    .select({ slug: contestPurchases.productSlug })
    .from(contestPurchases)
    .where(
      and(
        eq(contestPurchases.userId, user.id),
        eq(contestPurchases.status, "active"),
        gt(contestPurchases.accessEndsAt, new Date()),
      ),
    );
  if (
    lines.some((line) => owned.some((item) => item.slug === line.productSlug))
  )
    return error(
      "Você já possui acesso vigente a um dos concursos selecionados.",
      409,
    );
  const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const order = await db.transaction(async (tx) => {
    // Duas abas não criam cobranças simultâneas para o mesmo concurso.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"contest-checkout:" + user.id},0))`,
    );
    const pendingOrders = await tx
      .select()
      .from(contestOrders)
      .where(
        and(
          eq(contestOrders.userId, user.id),
          or(
            inArray(contestOrders.status, ["created", "pending"]),
            inArray(contestOrders.subscriptionStatus, [
              "active",
              "past_due",
              "unpaid",
              "paused",
              "trialing",
              "incomplete",
            ]),
          ),
        ),
      );
    const overlapping = pendingOrders.find((item) =>
      item.lines.some((line) =>
        lines.some((selected) => selected.productSlug === line.productSlug),
      ),
    );
    if (overlapping) return overlapping;
    await tx
      .insert(contestOrders)
      .values({
        id: input.data.attemptId,
        userId: user.id,
        amountCents: total,
        lines,
        stripeMode: expectedLive ? "live" : "test",
        checkoutUiMode: "elements",
      })
      .onConflictDoNothing();
    const [created] = await tx
      .select()
      .from(contestOrders)
      .where(eq(contestOrders.id, input.data.attemptId))
      .limit(1);
    return created;
  });
  if (
    !order ||
    order.userId !== user.id ||
    order.amountCents !== total ||
    order.lines.length !== lines.length ||
    lines.some((line, index) =>
      Object.entries(line).some(
        ([key, value]) =>
          order.lines[index]?.[key as keyof ContestOrderLine] !== value,
      ),
    )
  )
    return error(
      "Há uma tentativa para outra seleção. Cancele o pagamento pendente em Meus concursos antes de alterar os itens.",
      409,
    );
  if (!["created", "pending"].includes(order.status))
    return error(
      "Já existe uma assinatura ou tentativa encerrada para este concurso. Gerencie-a em Meus concursos.",
      409,
    );
  try {
    const stripe = getStripeClient();
    if (order.stripeMode !== (expectedLive ? "live" : "test"))
      return error("O ambiente do pedido diverge do pagamento configurado.", 409);
    if (order.stripeSessionId || order.stripeCreationStartedAt) {
      const session = await findRecoverableContestSession(stripe.checkout.sessions, order, user.publicId);
      if (session) {
        if (session.status === "complete")
          return error("O pagamento já foi concluído. Aguarde a confirmação; não refaça a compra.", 409);
        const continuation = contestCheckoutSessionResponse(session, order.id);
        if (continuation) {
          if (!await persistContestCheckoutSession(db, order, session.id))
            return error("O estado do pedido mudou. Confira Meus concursos antes de continuar.", 409);
          return Response.json(continuation, { headers: { "Cache-Control": "no-store" } });
        }
        if (session.status === "expired")
          await expireContestCheckoutSnapshot(db, order, "stripe_expired");
        return error(
          "Esta sessão foi encerrada. Consulte seus acessos ou inicie outra tentativa.",
          409,
        );
      }
      if (Math.floor(Date.now() / 1000) >= originalContestCheckoutExpiry(order)) {
        if (!await expireContestCheckoutSnapshot(db, order, "original_expiry"))
          return error("O estado do pedido mudou. Confira Meus concursos antes de continuar.", 409);
        return error("A tentativa original expirou. Confira Meus concursos e monte outra seleção.", 409);
      }
    }
    if (Math.floor(Date.now() / 1000) >= originalContestCheckoutExpiry(order))
      return error("A tentativa original expirou. Cancele-a em Meus concursos antes de montar outra seleção.", 409);
    for (const line of lines) {
      const price = await stripe.prices.retrieve(line.stripePriceId);
      const product = released.find((item) => item.slug === line.productSlug)!;
      if (
        !contestRecurringPriceMatches(price, line, expectedLive!) ||
        price.product !== product.stripeProductId
      )
        return error(
          "O preço da Stripe diverge da oferta. Nenhuma cobrança foi iniciada.",
          409,
        );
    }
    const metadata = {
      app: "leiprova",
      commerce: CONTEST_SUBSCRIPTION_COMMERCE,
      order_id: order.id,
      user_public_id: user.publicId,
    };
    const customerId = order.stripeCustomerId ?? await getOrCreateStripeCustomer(stripe, user);
    // Este CAS compete com o cancelamento sem sessão. Quem perdeu não chama sessions.create.
    if (!await markContestCreationStarted(db, order, customerId))
      return error("O estado do pedido mudou. Atualize Meus concursos antes de continuar.", 409);
    const origin = getPublicOrigin(request);
    const urls = order.checkoutUiMode === "hosted" ? {
      success_url: `${origin}/app/compras?pedido=${order.id}`,
      cancel_url: `${origin}/checkout/concurso/${lines[0].productSlug}?acesso=${lines[0].accessKey}`,
    } : { return_url: `${origin}/app/compras?pedido=${order.id}&session_id={CHECKOUT_SESSION_ID}` };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        ui_mode: order.checkoutUiMode as "hosted" | "elements",
        customer: customerId,
        payment_method_types: ["card"],
        client_reference_id: user.publicId,
        locale: "pt-BR",
        metadata,
        subscription_data: { metadata },
        line_items: lines.map((line) => ({
          price: line.stripePriceId,
          quantity: 1,
        })),
        ...urls,
        expires_at: originalContestCheckoutExpiry(order),
      },
      { idempotencyKey: `contest-subscription:${order.id}` },
    );
    validateContestCheckoutSession({ ...order, stripeCustomerId: customerId }, user.publicId, session);
    if (!await persistContestCheckoutSession(db, { ...order, stripeCustomerId: customerId }, session.id))
      return error("O estado do pagamento mudou. Confira Meus concursos; não refaça a compra.", 409);
    const continuation = contestCheckoutSessionResponse(session, order.id);
    if (!continuation) return error("Não foi possível abrir o pagamento.", 502);
    return Response.json(continuation, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error(
      "Não foi possível iniciar o pagamento. Tente novamente sem alterar a seleção.",
      502,
    );
  }
}
