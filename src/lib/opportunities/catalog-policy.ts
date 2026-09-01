export const PUBLIC_STUDY_LIFECYCLE_STATUSES = [
  "authorized",
  "commission_formed",
  "organizer_selected",
  "pre_notice",
  "notice_published",
  "registration_open",
  "registration_closed",
  "exam_scheduled",
] as const;

export type PublicStudyLifecycleStatus =
  (typeof PUBLIC_STUDY_LIFECYCLE_STATUSES)[number];

export const PRE_NOTICE_REFRESH_MAX_DAYS = 180;
export const NOTICE_REFRESH_MAX_DAYS = 90;

type OpportunityFreshnessInput = Readonly<{
  lifecycleStatus: string;
  statusAsOf: string;
  registrationEndsAt: string | null;
  examDate: string | null;
}>;

/**
 * The commercial catalog follows opportunities that can still guide a future
 * exam. Editions whose exam has already happened remain in the database for
 * audit/history, but are not exposed as active study plans.
 */
export function isPublicStudyLifecycleStatus(
  lifecycleStatus: string,
): lifecycleStatus is PublicStudyLifecycleStatus {
  return (PUBLIC_STUDY_LIFECYCLE_STATUSES as readonly string[]).includes(
    lifecycleStatus,
  );
}

export function shiftIsoCalendarDate(isoDate: string, days: number) {
  const parsed = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data ISO inválida.");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function saoPauloCalendarDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isOpportunityFreshForPublicCatalog(
  opportunity: OpportunityFreshnessInput,
  todayIso: string,
) {
  if (!isPublicStudyLifecycleStatus(opportunity.lifecycleStatus)) return false;

  if (
    ["authorized", "commission_formed", "organizer_selected", "pre_notice"].includes(
      opportunity.lifecycleStatus,
    )
  ) {
    return (
      opportunity.statusAsOf >=
      shiftIsoCalendarDate(todayIso, -PRE_NOTICE_REFRESH_MAX_DAYS)
    );
  }

  if (opportunity.lifecycleStatus === "notice_published") {
    return (
      opportunity.statusAsOf >=
        shiftIsoCalendarDate(todayIso, -NOTICE_REFRESH_MAX_DAYS) &&
      (!opportunity.examDate || opportunity.examDate >= todayIso)
    );
  }

  if (opportunity.lifecycleStatus === "registration_open") {
    return Boolean(
      opportunity.registrationEndsAt &&
        opportunity.registrationEndsAt >= todayIso &&
        (!opportunity.examDate || opportunity.examDate >= todayIso),
    );
  }

  return Boolean(opportunity.examDate && opportunity.examDate >= todayIso);
}
