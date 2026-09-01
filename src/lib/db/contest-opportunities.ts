import "server-only";

import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import {
  contestCategories,
  contestOpportunities,
  opportunityOrganizerAssignments,
  quizBanks,
  quizCareerTracks,
} from "@/lib/db/schema";
import {
  NOTICE_REFRESH_MAX_DAYS,
  PRE_NOTICE_REFRESH_MAX_DAYS,
  PUBLIC_STUDY_LIFECYCLE_STATUSES,
  saoPauloCalendarDate,
  shiftIsoCalendarDate,
} from "@/lib/opportunities/catalog-policy";

const primaryAssignments = alias(
  opportunityOrganizerAssignments,
  "primary_assignments",
);
const examinationProviderAssignments = alias(
  opportunityOrganizerAssignments,
  "examination_provider_assignments",
);
const primaryBanks = alias(quizBanks, "primary_banks");
const examinationProviderBanks = alias(quizBanks, "examination_provider_banks");

const publicOpportunitySelection = {
  publicId: contestOpportunities.publicId,
  slug: contestOpportunities.slug,
  title: contestOpportunities.title,
  summary: contestOpportunities.summary,
  institutionAcronym: contestOpportunities.institutionAcronym,
  institutionName: contestOpportunities.institutionName,
  roleName: contestOpportunities.roleName,
  cycleYear: contestOpportunities.cycleYear,
  jurisdictionCode: contestOpportunities.jurisdictionCode,
  lifecycleStatus: contestOpportunities.lifecycleStatus,
  statusAsOf: contestOpportunities.statusAsOf,
  officialUrl: contestOpportunities.officialUrl,
  registrationStartsAt: contestOpportunities.registrationStartsAt,
  registrationEndsAt: contestOpportunities.registrationEndsAt,
  examDate: contestOpportunities.examDate,
  sourceCheckedAt: contestOpportunities.sourceCheckedAt,
  publishedAt: contestOpportunities.publishedAt,
  updatedAt: contestOpportunities.updatedAt,
  categorySlug: contestCategories.slug,
  categoryName: contestCategories.name,
  careerSlug: quizCareerTracks.slug,
  careerName: quizCareerTracks.name,
  responsibleName: primaryAssignments.organizerName,
  responsibleType: primaryAssignments.responsibleType,
  examinationProviderName: examinationProviderAssignments.organizerName,
  bankSlug: sql<string | null>`coalesce(${examinationProviderBanks.slug}, ${primaryBanks.slug})`,
  bankName: sql<string | null>`coalesce(${examinationProviderBanks.name}, ${primaryBanks.name})`,
} as const;

const currentPrimaryResponsibleJoin = and(
  eq(primaryAssignments.role, "primary_responsible"),
  eq(primaryAssignments.status, "reviewed"),
  isNull(primaryAssignments.validUntil),
);

const currentExaminationProviderJoin = and(
  eq(examinationProviderAssignments.role, "examination_provider"),
  eq(examinationProviderAssignments.status, "reviewed"),
  isNull(examinationProviderAssignments.validUntil),
);

export type PublicContestOpportunity = Awaited<
  ReturnType<typeof listReviewedContestOpportunities>
>[number];

function currentOpportunityFreshnessCondition(referenceDate: Date) {
  const todayIso = saoPauloCalendarDate(referenceDate);
  const preNoticeCutoff = shiftIsoCalendarDate(
    todayIso,
    -PRE_NOTICE_REFRESH_MAX_DAYS,
  );
  const noticeCutoff = shiftIsoCalendarDate(
    todayIso,
    -NOTICE_REFRESH_MAX_DAYS,
  );

  return or(
    and(
      inArray(contestOpportunities.lifecycleStatus, [
        "authorized",
        "commission_formed",
        "organizer_selected",
        "pre_notice",
      ]),
      gte(contestOpportunities.statusAsOf, preNoticeCutoff),
    ),
    and(
      eq(contestOpportunities.lifecycleStatus, "notice_published"),
      gte(contestOpportunities.statusAsOf, noticeCutoff),
      or(isNull(contestOpportunities.examDate), gte(contestOpportunities.examDate, todayIso)),
    ),
    and(
      eq(contestOpportunities.lifecycleStatus, "registration_open"),
      gte(contestOpportunities.registrationEndsAt, todayIso),
      or(isNull(contestOpportunities.examDate), gte(contestOpportunities.examDate, todayIso)),
    ),
    and(
      inArray(contestOpportunities.lifecycleStatus, [
        "registration_closed",
        "exam_scheduled",
      ]),
      gte(contestOpportunities.examDate, todayIso),
    ),
  );
}

function isOpportunityCatalogNotMigrated(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && (current as { code?: unknown }).code === "42P01") return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

export async function listReviewedContestOpportunities(filters?: {
  categorySlug?: string;
  jurisdictionCode?: string;
}, referenceDate = new Date()) {
  const conditions = [
    eq(contestOpportunities.editorialStatus, "reviewed"),
    inArray(contestOpportunities.lifecycleStatus, PUBLIC_STUDY_LIFECYCLE_STATUSES),
    currentOpportunityFreshnessCondition(referenceDate),
  ];
  if (filters?.categorySlug) conditions.push(eq(contestCategories.slug, filters.categorySlug));
  if (filters?.jurisdictionCode) {
    conditions.push(eq(contestOpportunities.jurisdictionCode, filters.jurisdictionCode));
  }

  try {
    return await getDb()
      .select(publicOpportunitySelection)
      .from(contestOpportunities)
      .innerJoin(contestCategories, eq(contestOpportunities.categoryId, contestCategories.id))
      .innerJoin(quizCareerTracks, eq(contestOpportunities.careerTrackId, quizCareerTracks.id))
      .leftJoin(
        primaryAssignments,
        and(
          eq(primaryAssignments.opportunityId, contestOpportunities.id),
          currentPrimaryResponsibleJoin,
        ),
      )
      .leftJoin(
        examinationProviderAssignments,
        and(
          eq(examinationProviderAssignments.opportunityId, contestOpportunities.id),
          currentExaminationProviderJoin,
        ),
      )
      .leftJoin(primaryBanks, eq(primaryAssignments.quizBankId, primaryBanks.id))
      .leftJoin(
        examinationProviderBanks,
        eq(examinationProviderAssignments.quizBankId, examinationProviderBanks.id),
      )
      .where(and(...conditions))
      .orderBy(desc(contestOpportunities.isFeatured), desc(contestOpportunities.statusAsOf));
  } catch (error) {
    if (isOpportunityCatalogNotMigrated(error)) return [];
    throw error;
  }
}

export async function getReviewedContestOpportunity(input: {
  categorySlug: string;
  jurisdictionCode: string;
  opportunitySlug: string;
}, referenceDate = new Date()) {
  try {
    const [opportunity] = await getDb()
      .select(publicOpportunitySelection)
      .from(contestOpportunities)
      .innerJoin(contestCategories, eq(contestOpportunities.categoryId, contestCategories.id))
      .innerJoin(quizCareerTracks, eq(contestOpportunities.careerTrackId, quizCareerTracks.id))
      .leftJoin(
        primaryAssignments,
        and(
          eq(primaryAssignments.opportunityId, contestOpportunities.id),
          currentPrimaryResponsibleJoin,
        ),
      )
      .leftJoin(
        examinationProviderAssignments,
        and(
          eq(examinationProviderAssignments.opportunityId, contestOpportunities.id),
          currentExaminationProviderJoin,
        ),
      )
      .leftJoin(primaryBanks, eq(primaryAssignments.quizBankId, primaryBanks.id))
      .leftJoin(
        examinationProviderBanks,
        eq(examinationProviderAssignments.quizBankId, examinationProviderBanks.id),
      )
      .where(
        and(
          eq(contestOpportunities.editorialStatus, "reviewed"),
          inArray(
            contestOpportunities.lifecycleStatus,
            PUBLIC_STUDY_LIFECYCLE_STATUSES,
          ),
          currentOpportunityFreshnessCondition(referenceDate),
          eq(contestOpportunities.slug, input.opportunitySlug),
          eq(contestCategories.slug, input.categorySlug),
          eq(contestOpportunities.jurisdictionCode, input.jurisdictionCode),
        ),
      )
      .limit(1);

    return opportunity ?? null;
  } catch (error) {
    if (isOpportunityCatalogNotMigrated(error)) return null;
    throw error;
  }
}
