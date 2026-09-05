import "server-only";

import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  subscriptions,
  contestPurchases,
  questionOpportunities,
  questions,
} from "@/lib/db/schema";
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
        or(
          isNull(subscriptions.accessEndsAt),
          gt(subscriptions.accessEndsAt, now),
        ),
      ),
    )
    .limit(1);

  if (validSubscription) return { hasFullAccess: true };
  const scoped = await getDb()
    .selectDistinct({ publicId: questions.publicId })
    .from(contestPurchases)
    .innerJoin(
      questionOpportunities,
      eq(contestPurchases.opportunityId, questionOpportunities.opportunityId),
    )
    .innerJoin(questions, eq(questionOpportunities.questionId, questions.id))
    .where(
      and(
        eq(contestPurchases.userId, userId),
        eq(contestPurchases.status, "active"),
        lte(contestPurchases.accessStartsAt, now),
        gt(contestPurchases.accessEndsAt, now),
        eq(questions.editorialStatus, "reviewed"),
      ),
    );
  return {
    hasFullAccess: false,
    questionPublicIds: scoped.map((row) => row.publicId),
  };
}
