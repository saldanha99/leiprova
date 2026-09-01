import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  examEditions,
  quizBanks,
  quizCareerSpecializations,
  quizCareerTracks,
} from "@/lib/db/schema";
import {
  buildQuizExamEditionCatalog,
  ELIGIBLE_QUIZ_EXAM_STATUSES,
  saoPauloDateIso,
  type QuizExamEditionCatalogItem,
} from "@/lib/quiz/exam-edition-catalog";

export async function listEligibleQuizExamEditions(
  referenceDate = new Date(),
): Promise<QuizExamEditionCatalogItem[]> {
  const todayIso = saoPauloDateIso(referenceDate);
  const rows = await getDb()
    .select({
      publicId: examEditions.publicId,
      title: examEditions.title,
      examDate: examEditions.examDate,
      durationMinutes: examEditions.durationMinutes,
      status: examEditions.status,
      organizer: examEditions.organizer,
      jurisdiction: examEditions.jurisdiction,
      officialUrl: examEditions.officialUrl,
      careerId: quizCareerTracks.id,
      careerSlug: quizCareerTracks.slug,
      careerName: quizCareerTracks.name,
      careerShortName: quizCareerTracks.shortName,
      careerIsActive: quizCareerTracks.isActive,
      specializationId: examEditions.specializationId,
      specializationCareerTrackId: quizCareerSpecializations.careerTrackId,
      specializationSlug: quizCareerSpecializations.slug,
      specializationName: quizCareerSpecializations.name,
      specializationIsActive: quizCareerSpecializations.isActive,
      bankSlug: quizBanks.slug,
      bankName: quizBanks.name,
      bankFullName: quizBanks.fullName,
      bankIsActive: quizBanks.isActive,
    })
    .from(examEditions)
    .innerJoin(quizCareerTracks, eq(examEditions.careerTrackId, quizCareerTracks.id))
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .leftJoin(
      quizCareerSpecializations,
      and(
        eq(examEditions.specializationId, quizCareerSpecializations.id),
        eq(examEditions.careerTrackId, quizCareerSpecializations.careerTrackId),
      ),
    )
    .where(
      and(
        eq(quizCareerTracks.isActive, true),
        eq(quizBanks.isActive, true),
        inArray(examEditions.status, [...ELIGIBLE_QUIZ_EXAM_STATUSES]),
        lte(examEditions.examDate, todayIso),
        isNotNull(examEditions.officialUrl),
        sql<boolean>`char_length(btrim(${examEditions.officialUrl})) > 0`,
        or(
          isNull(examEditions.specializationId),
          eq(quizCareerSpecializations.isActive, true),
        ),
      ),
    )
    .orderBy(desc(examEditions.examDate), asc(examEditions.publicId));

  return buildQuizExamEditionCatalog(rows, todayIso);
}

export type { QuizExamEditionCatalogItem } from "@/lib/quiz/exam-edition-catalog";
