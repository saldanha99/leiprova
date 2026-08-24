import type Stripe from "stripe";

export type LocalSubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "unpaid"
  | "expired";

/*
 * Mapeamento puro entre o que a Stripe envia e o modelo local.
 *
 * Vive fora de `process.ts` de propósito: aquele módulo é `server-only` e fala
 * com o banco, o que tornava estas funções impossíveis de testar. São elas que
 * decidem quem recebe acesso pago, então precisam de cobertura direta.
 */
export function isLeiProvaMetadata(metadata: Stripe.Metadata | null | undefined): metadata is Stripe.Metadata {
  return metadata?.app === "leiprova";
}

export function objectId(value: { id: string } | string | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function unixDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

export function parsePositiveInteger(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function subscriptionPeriod(subscription: Stripe.Subscription) {
  const starts = subscription.items.data.map((item) => item.current_period_start).filter(Number.isFinite);
  const ends = subscription.items.data.map((item) => item.current_period_end).filter(Number.isFinite);

  return {
    start: starts.length ? unixDate(Math.min(...starts)) : null,
    end: ends.length ? unixDate(Math.max(...ends)) : null,
  };
}

export function normalizeSubscriptionStatus(status: Stripe.Subscription.Status): LocalSubscriptionStatus {
  switch (status) {
    case "incomplete":
      return "incomplete";
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete_expired":
      return "expired";
    default:
      return "incomplete";
  }
}
