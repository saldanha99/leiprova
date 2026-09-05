"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { contestOrders } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe";

export async function cancelContestOrderAction(
  previous: { message: string },
  form: FormData,
): Promise<{ message: string }> {
  void previous;
  const user = await requireUser("/app/compras");
  const parsed = z.uuid().safeParse(form.get("orderId"));
  if (!parsed.success) return { message: "Pedido inválido." };
  const [order] = await getDb()
    .select()
    .from(contestOrders)
    .where(
      and(eq(contestOrders.id, parsed.data), eq(contestOrders.userId, user.id)),
    )
    .limit(1);
  if (
    !order ||
    !order.stripeSessionId ||
    !["created", "pending"].includes(order.status)
  )
    return { message: "Este pedido não tem pagamento pendente cancelável." };
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(
      order.stripeSessionId,
    );
    if (
      session.metadata?.order_id !== order.id ||
      session.client_reference_id !== user.publicId
    )
      return { message: "Identidade do pedido divergente." };
    if (session.status === "complete")
      return {
        message:
          "O pagamento já foi concluído. Aguarde a confirmação; não refaça a compra.",
      };
    if (session.status === "open")
      await stripe.checkout.sessions.expire(session.id);
    await getDb()
      .update(contestOrders)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          eq(contestOrders.id, order.id),
          eq(contestOrders.userId, user.id),
          inArray(contestOrders.status, ["created", "pending"]),
        ),
      );
    revalidatePath("/app/compras");
    return {
      message: "Pagamento pendente cancelado. Você pode montar outra seleção.",
    };
  } catch {
    return {
      message:
        "Não foi possível cancelar agora. Confira o estado do pagamento antes de tentar outra compra.",
    };
  }
}
