import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: {
    id: number;
    publicId: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
  },
) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create(
    {
      email: user.email,
      name: user.name,
      metadata: {
        app: "leiprova",
        user_id: String(user.id),
        user_public_id: user.publicId,
      },
    },
    { idempotencyKey: `customer:${user.publicId}` },
  );
  const db = getDb();
  const [claimed] = await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(and(eq(users.id, user.id), isNull(users.stripeCustomerId)))
    .returning({ id: users.stripeCustomerId });
  if (claimed?.id) return claimed.id;
  const [fresh] = await db
    .select({ id: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id));
  if (!fresh?.id) throw new Error("Cliente de pagamento não persistido.");
  return fresh.id;
}
