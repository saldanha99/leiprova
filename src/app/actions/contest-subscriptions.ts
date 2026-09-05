"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { contestOrders } from "@/lib/db/schema";
import { getStripeClient, getStripeWebhookConfiguration } from "@/lib/stripe";
import { validateContestSubscription } from "@/lib/commerce/subscription-policy";
import { reconcileContestSubscription } from "@/lib/commerce/subscription-webhook";

export async function cancelContestRenewalAction(
  previous: { message: string },
  form: FormData,
): Promise<{ message: string }> {
  void previous;
  const user = await requireUser("/app/compras");
  const id = z.uuid().safeParse(form.get("orderId"));
  if (!id.success) return { message: "Assinatura inválida." };
  const [order] = await getDb()
    .select()
    .from(contestOrders)
    .where(
      and(eq(contestOrders.id, id.data), eq(contestOrders.userId, user.id)),
    );
  if (!order?.stripeSubscriptionId)
    return { message: "Assinatura não encontrada." };
  // Cancelamento continua disponível mesmo com novas vendas fechadas.
  if (!getStripeWebhookConfiguration())
    return {
      message:
        "Gestão indisponível. Entre em contato com o atendimento para cancelar.",
    };
  try {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(
      order.stripeSubscriptionId,
    );
    validateContestSubscription(
      {
        orderId: order.id,
        userPublicId: user.publicId,
        customerId: order.stripeCustomerId,
        subscriptionId: order.stripeSubscriptionId,
        live: order.stripeMode === "live",
        lines: order.lines,
      },
      subscription,
    );
    if (
      !["canceled", "incomplete_expired"].includes(subscription.status) &&
      !subscription.cancel_at_period_end
    )
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
    await reconcileContestSubscription(subscription.id, order.id);
    revalidatePath("/app/compras");
    return {
      message:
        "Renovação cancelada. Você mantém o acesso até o fim do período já pago.",
    };
  } catch {
    return {
      message:
        "Não foi possível confirmar o cancelamento. Tente novamente ou fale com o atendimento.",
    };
  }
}
