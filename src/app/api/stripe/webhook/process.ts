import "server-only";

import type Stripe from "stripe";
import { processContestStripeEvent } from "@/lib/commerce/webhook";
import { processContestSubscriptionEvent } from "@/lib/commerce/subscription-webhook";
import type { CommerceTransaction } from "@/lib/commerce/webhook-transaction";

export async function processStripeEvent(event: Stripe.Event, tx: CommerceTransaction) {
  if (await processContestSubscriptionEvent(event, tx)) return;
  await processContestStripeEvent(event, tx);
}
