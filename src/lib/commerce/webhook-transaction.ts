import "server-only";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/lib/db/client";
import { stripeEvents } from "@/lib/db/schema";

export type CommerceTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const lifetimes = new WeakMap<CommerceTransaction, { active: boolean }>();

function assertTransactionActive(transaction: CommerceTransaction) {
  if (lifetimes.get(transaction)?.active === false)
    throw new Error("Transação de comércio encerrada; aguarde a reentrega do evento.");
}

/** Handlers chamados fora da rota recebem sua própria unidade; dentro dela, nunca pedem outra conexão. */
export async function withCommerceTransaction<T>(
  transaction: CommerceTransaction | undefined,
  work: (tx: CommerceTransaction) => Promise<T>,
) {
  if (transaction) {
    assertTransactionActive(transaction);
    return work(transaction);
  }
  const lifetime = { active: true };
  try {
    return await getDb().transaction((tx) => {
      lifetimes.set(tx, lifetime);
      return work(tx);
    });
  } finally {
    // postgres-js pode encerrar begin antes de terminar um await externo do
    // callback. Esse executor não pode retomar consultas numa conexão já solta.
    lifetime.active = false;
  }
}

/** Apenas leituras externas: nunca enviar e-mail ou mutar Stripe dentro da tx. */
export async function readDuringCommerceTransaction<T>(
  transaction: CommerceTransaction,
  read: () => Promise<T>,
) {
  assertTransactionActive(transaction);
  const result = await read();
  assertTransactionActive(transaction);
  return result;
}

/** Claim, efeitos locais e conclusão compartilham a conexão e o mesmo destino de rollback. */
export async function withTrackedContestStripeEvent(
  event: Stripe.Event,
  work: (tx: CommerceTransaction) => Promise<void>,
) {
  return withCommerceTransaction(undefined, async (tx) => {
    await tx.execute(sql`set local lock_timeout = '8s'`);
    await tx.execute(sql`set local statement_timeout = '15s'`);
    // Reads Stripe têm timeout próprio de 8s e no máximo uma nova tentativa.
    // Isso não é lease: a segurança é o rollback de TODOS os efeitos na mesma tx.
    await tx.execute(sql`set local idle_in_transaction_session_timeout = '60s'`);
    const [stored] = await tx.select().from(stripeEvents)
      .where(eq(stripeEvents.eventId, event.id)).for("update");
    if (!stored || stored.eventType !== event.type || stored.livemode !== event.livemode)
      throw new Error("Registro do evento de concurso divergente.");
    if (stored.status === "processed") return { duplicate: true };
    if (!["received", "failed", "processing"].includes(stored.status))
      throw new Error("Estado do evento não recuperável.");
    await tx.update(stripeEvents).set({ status: "processing", errorMessage: null })
      .where(eq(stripeEvents.eventId, event.id));
    await work(tx);
    await tx.update(stripeEvents).set({ status: "processed", processedAt: new Date(), errorMessage: null })
      .where(eq(stripeEvents.eventId, event.id));
    return { duplicate: false };
  });
}
