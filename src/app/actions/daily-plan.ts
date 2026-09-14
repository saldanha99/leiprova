"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getDailyStudyPlan } from "@/lib/db/daily-plan";
import { getDb } from "@/lib/db/client";
import { userDailyStudyProgress } from "@/lib/db/schema";
import { getStudyEntitlement } from "@/lib/study/entitlement";

const stepSchema = z.enum(["reading", "review"]);

export async function completeDailyStudyStepAction(formData: FormData) {
  const step = stepSchema.safeParse(formData.get("step"));
  if (!step.success) return;
  const user = await requireUser("/app/plano-diario");
  const entitlement = await getStudyEntitlement(user.id);
  const plan = await getDailyStudyPlan(user.id, entitlement);
  if (!plan) return;

  const now = new Date();
  const readingCompletedAt = step.data === "reading"
    ? now
    : plan.steps.reading.completedAt;
  const reviewCompletedAt = step.data === "review"
    ? now
    : plan.steps.review.completedAt;
  await getDb()
    .insert(userDailyStudyProgress)
    .values({
      userId: user.id,
      studyDate: plan.dateIso,
      legalActId: plan.target.id,
      articleStartOrder: plan.target.articleStartOrder,
      articleEndOrder: plan.target.articleEndOrder,
      readingCompletedAt,
      reviewCompletedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userDailyStudyProgress.userId, userDailyStudyProgress.studyDate],
      set: {
        legalActId: plan.target.id,
        articleStartOrder: plan.target.articleStartOrder,
        articleEndOrder: plan.target.articleEndOrder,
        readingCompletedAt,
        reviewCompletedAt,
        updatedAt: now,
      },
    });
  revalidatePath("/app/plano-diario");
  revalidatePath("/app");
}
