import "server-only";

import { and, eq, gt, inArray, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  subscriptions,
  contestPurchases,
  questions,
} from "@/lib/db/schema";
import type { StudyEntitlement } from "@/lib/study/access-policy";
import { approvedProductQuestionExists } from "@/lib/commerce/product-binding-query";

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
        // Stripe nunca ganha Master por trial, período futuro ou término desconhecido.
        // Acesso manual/sintético documentado conserva seu provedor e exige fim finito.
        or(
          and(
            eq(subscriptions.provider, "stripe"),
            eq(subscriptions.status, "active"),
            sql`isfinite(${subscriptions.currentPeriodStart}) and isfinite(${subscriptions.currentPeriodEnd})`,
            lte(subscriptions.currentPeriodStart, now),
            gt(subscriptions.currentPeriodEnd, now),
          ),
          and(
            inArray(subscriptions.provider, ["synthetic_test", "manual"]),
            inArray(subscriptions.status, ["active", "trialing"]),
            sql`(${subscriptions.currentPeriodStart} is null or ${subscriptions.currentPeriodStart} <= ${now.toISOString()}::timestamptz)`,
          ),
        ),
        gt(subscriptions.accessEndsAt, now),
        sql`isfinite(${subscriptions.accessEndsAt})`,
      ),
    )
    .limit(1);

  if (validSubscription) return { hasFullAccess: true };
  const scoped = await getDb()
    .selectDistinct({ publicId: questions.publicId })
    .from(contestPurchases)
    .innerJoin(questions, approvedProductQuestionExists(contestPurchases.productSlug, questions.id, contestPurchases.opportunityId))
    .where(
      and(
        eq(contestPurchases.userId, userId),
        eq(contestPurchases.status, "active"),
        lte(contestPurchases.accessStartsAt, now),
        gt(contestPurchases.accessEndsAt, now),
        sql`isfinite(${contestPurchases.accessStartsAt}) and isfinite(${contestPurchases.accessEndsAt})`,
        eq(questions.editorialStatus, "reviewed"),
      ),
    );
  return {
    hasFullAccess: false,
    questionPublicIds: scoped.map((row) => row.publicId),
  };
}
