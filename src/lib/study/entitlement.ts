import "server-only";

import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import type { StudyEntitlement } from "@/lib/study/access-policy";

export async function getStudyEntitlement(
  userId: number,
  now = new Date(),
): Promise<StudyEntitlement> {
  const [validSubscription] = await getDb()
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["active", "trialing"]),
        or(isNull(subscriptions.accessEndsAt), gt(subscriptions.accessEndsAt, now)),
      ),
    )
    .limit(1);

  return { hasFullAccess: Boolean(validSubscription) };
}
