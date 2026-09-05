import { and, eq, gt, inArray, sql } from "drizzle-orm";
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
import {
  getCheckoutAvailability,
  getPublicOrigin,
  getStripeClient,
  hasTrustedOrigin,
  isContestCheckoutEnabled,
  stripeKeyExpectsLivemode,
} from "@/lib/stripe";
import { getStudyEntitlement } from "@/lib/study/entitlement";

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
      "Seleção inválida. Escolha até três concursos da mesma carreira, um período por concurso.",
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
      item.accessKey === "6m" ? product.stripePrice6m : product.stripePrice12m;
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
          inArray(contestOrders.status, ["created", "pending"]),
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
      "Esta tentativa já foi encerrada. Consulte seus acessos.",
      409,
    );
  try {
    const stripe = getStripeClient();
    if (order.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId,
      );
      if (session.status === "open" && session.url)
        return Response.json({ url: session.url });
      if (session.status === "expired")
        await db
          .update(contestOrders)
          .set({ status: "expired", updatedAt: new Date() })
          .where(
            and(
              eq(contestOrders.id, order.id),
              inArray(contestOrders.status, ["created", "pending"]),
            ),
          );
      return error(
        "Esta sessão foi encerrada. Consulte seus acessos ou inicie outra tentativa.",
        409,
      );
    }
    for (const line of lines) {
      const price = await stripe.prices.retrieve(line.stripePriceId);
      const product = released.find((item) => item.slug === line.productSlug)!;
      if (
        !price.active ||
        price.recurring ||
        price.unit_amount !== line.amountCents ||
        price.currency !== "brl" ||
        price.livemode !== expectedLive ||
        price.product !== product.stripeProductId
      )
        return error(
          "O preço da Stripe diverge da oferta. Nenhuma cobrança foi iniciada.",
          409,
        );
    }
    const metadata = {
      app: "leiprova",
      commerce: "contest_v1",
      order_id: order.id,
      user_public_id: user.publicId,
    };
    const origin = getPublicOrigin(request);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "hosted",
        customer_email: user.email,
        client_reference_id: user.publicId,
        locale: "pt-BR",
        metadata,
        payment_intent_data: { metadata },
        line_items: lines.map((line) => ({
          price: line.stripePriceId,
          quantity: 1,
        })),
        success_url: `${origin}/app/compras?pedido=${order.id}`,
        cancel_url: `${origin}/checkout/concurso/${lines[0].productSlug}?acesso=${lines[0].accessKey}`,
        expires_at: Math.floor(order.createdAt.getTime() / 1000) + 3600,
      },
      { idempotencyKey: `contest-order:${order.id}` },
    );
    await db
      .update(contestOrders)
      .set({
        stripeSessionId: session.id,
        status: "pending",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contestOrders.id, order.id),
          eq(contestOrders.status, "created"),
        ),
      );
    if (!session.url) return error("Não foi possível abrir o pagamento.", 502);
    return Response.json({ url: session.url });
  } catch {
    return error(
      "Não foi possível iniciar o pagamento. Tente novamente sem alterar a seleção.",
      502,
    );
  }
}
