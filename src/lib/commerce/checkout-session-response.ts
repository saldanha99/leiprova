import type Stripe from "stripe";

export type ContestCheckoutSessionResponse =
  | { clientSecret: string; orderId: string; url?: never }
  | { url: string; clientSecret?: never; orderId?: never };

// Mantém a retomada de sessões hospedadas antigas sem criar outra cobrança.
export function contestCheckoutSessionResponse(
  session: Pick<Stripe.Checkout.Session, "status" | "ui_mode" | "url" | "client_secret">,
  orderId: string,
): ContestCheckoutSessionResponse | null {
  if (session.status !== "open") return null;
  if (session.ui_mode === "elements" && session.client_secret) {
    return { clientSecret: session.client_secret, orderId };
  }
  if (session.ui_mode === "hosted" && session.url) {
    try {
      const target = new URL(session.url);
      if (target.protocol === "https:" && target.hostname === "checkout.stripe.com") {
        return { url: target.href };
      }
    } catch { /* Uma URL inválida nunca chega ao cliente. */ }
  }
  return null;
}
