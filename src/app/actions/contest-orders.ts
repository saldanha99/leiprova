"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { contestOrders } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe";
import { cancelRecoverableContestOrder } from "@/lib/commerce/contest-checkout-recovery";

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
    !["created", "pending"].includes(order.status)
  )
    return { message: "Este pedido não tem pagamento pendente cancelável." };
  try {
    const result = await cancelRecoverableContestOrder(getDb(), () => getStripeClient().checkout.sessions, order, user.publicId);
    if (result === "completed")
      return {
        message:
          "O pagamento já foi concluído. Aguarde a confirmação; não refaça a compra.",
      };
    if (result === "wait") return { message: "A criação do pagamento ainda está em recuperação. Retome a mesma seleção ou aguarde até uma hora da tentativa inicial; ainda não foi cancelada." };
    if (result === "conflict") return { message: "O estado do pedido mudou. Atualize Meus concursos antes de tentar outra compra." };
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
