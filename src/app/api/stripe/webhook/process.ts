import "server-only";

import type Stripe from "stripe";
import { processContestStripeEvent } from "@/lib/commerce/webhook";
import { processContestSubscriptionEvent } from "@/lib/commerce/subscription-webhook";
import { processMasterStripeEvent } from "@/lib/stripe/master-subscription";

export async function processStripeEvent(event: Stripe.Event) {
  if (await processContestSubscriptionEvent(event)) return;
  if (await processContestStripeEvent(event)) return;
  await processMasterStripeEvent(event);
}
