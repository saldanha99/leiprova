import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";

export const ELIGIBLE_QUIZ_EXAM_STATUSES = ["held", "published"] as const;

export type EligibleQuizExamStatus = (typeof ELIGIBLE_QUIZ_EXAM_STATUSES)[number] | "scheduled";

export type QuizExamEditionCatalogItem = Readonly<{
  publicId: string;
  title: string;
  examDate: string;
  examYear: number;
  durationMinutes: number | null;
  status: EligibleQuizExamStatus;
  organizer: string | null;
  jurisdiction: string | null;
  officialUrl: string;
  career: Readonly<{
    slug: string;
    name: string;
    shortName: string;
  }>;
  specialization: Readonly<{
    slug: string;
    name: string;
  }> | null;
  bank: Readonly<{
    slug: string;
    name: string;
    fullName: string;
  }>;
}>;

export type QuizExamEditionOption = Readonly<{
  scheduled?: true;
  publicId: string;
  title: string;
  examDate: string;
  examYear: number;
  organizer: string | null;
  jurisdiction: string | null;
  careerSlug: string;
  specializationSlug: string | null;
  bank: Readonly<{
    slug: string;
    name: string;
  }>;
}>;

export type QuizExamEditionCatalogRow = {
  scheduledProgramReviewed?: boolean;
  sourceCheckedAt?: Date | null;
  publicId: string;
  title: string;
  examDate: string | Date;
  durationMinutes: number | null;
  status: string;
  organizer: string | null;
  jurisdiction: string | null;
  officialUrl: string | null;
  careerId: number;
  careerSlug: string;
  careerName: string;
  careerShortName: string;
  careerIsActive: boolean;
  specializationId: number | null;
  specializationCareerTrackId: number | null;
  specializationSlug: string | null;
  specializationName: string | null;
  specializationIsActive: boolean | null;
  bankSlug: string;
  bankName: string;
  bankFullName: string;
  bankIsActive: boolean;
};

const eligibleStatuses = new Set<string>(ELIGIBLE_QUIZ_EXAM_STATUSES);

export type QuizExamEditionSelectionCandidate = Readonly<{
  scheduledProgramReviewed?: boolean;
  sourceCheckedAt?: Date | null;
  publicId: string;
  careerTrackId: number;
  specializationId: number | null;
  bankId: number;
  bankSlug: string;
  bankIsActive: boolean;
  status: string;
  officialUrl: string | null;
  examDate: string | Date;
}>;

export function isQuizExamEditionAvailableForSelection(
  edition: QuizExamEditionSelectionCandidate,
  selection: Readonly<{
    careerTrackId: number | null;
    specializationId: number | null;
    bankId: number | null;
  }>,
  todayIso: string,
  requestedPublicId?: string,
  allowScheduled = false,
) {
  const normalizedToday = toIsoDate(todayIso);
  const examDate = toIsoDate(edition.examDate);

  return Boolean(
    normalizedToday &&
      examDate &&
      ((examDate <= normalizedToday && eligibleStatuses.has(edition.status)) ||
        (allowScheduled && edition.status === "scheduled" &&
          edition.scheduledProgramReviewed === true && Boolean(edition.sourceCheckedAt))) &&
      edition.officialUrl?.trim() &&
      isOfficialExamUrl(edition.bankSlug, edition.officialUrl) &&
      edition.bankIsActive &&
      (!requestedPublicId || edition.publicId === requestedPublicId) &&
      (selection.careerTrackId === null ||
        (edition.careerTrackId === selection.careerTrackId &&
          edition.specializationId === selection.specializationId)) &&
      (selection.bankId === null || edition.bankId === selection.bankId),
  );
}

/**
 * Defense-in-depth for catalog rows. The database query applies the same filters,
 * while this boundary guarantees that only serializable, eligible entries reach UI code.
 */
export function buildQuizExamEditionCatalog(
  rows: readonly QuizExamEditionCatalogRow[],
  todayIso: string,
  includeScheduled = false,
): QuizExamEditionCatalogItem[] {
  const normalizedToday = toIsoDate(todayIso);
  if (!normalizedToday) throw new Error("A data de referência do catálogo é inválida.");

  return rows
    .flatMap((row): QuizExamEditionCatalogItem[] => {
      const examDate = toIsoDate(row.examDate);
      const officialUrl = row.officialUrl?.trim();

      if (
        !examDate ||
        !((examDate <= normalizedToday && eligibleStatuses.has(row.status)) ||
          (includeScheduled && row.status === "scheduled" &&
            row.scheduledProgramReviewed === true && Boolean(row.sourceCheckedAt))) ||
        !officialUrl ||
        !isOfficialExamUrl(row.bankSlug, officialUrl) ||
        !row.careerIsActive ||
        !row.bankIsActive
      ) {
        return [];
      }

      let specialization: QuizExamEditionCatalogItem["specialization"] = null;
      if (row.specializationId !== null) {
        if (
          !row.specializationIsActive ||
          row.specializationCareerTrackId !== row.careerId ||
          !row.specializationSlug ||
          !row.specializationName
        ) {
          return [];
        }

        specialization = {
          slug: row.specializationSlug,
          name: row.specializationName,
        };
      }

      return [
        {
          publicId: row.publicId,
          title: row.title,
          examDate,
          examYear: Number(examDate.slice(0, 4)),
          durationMinutes: row.durationMinutes,
          status: row.status as EligibleQuizExamStatus,
          organizer: row.organizer,
          jurisdiction: row.jurisdiction,
          officialUrl,
          career: {
            slug: row.careerSlug,
            name: row.careerName,
            shortName: row.careerShortName,
          },
          specialization,
          bank: {
            slug: row.bankSlug,
            name: row.bankName,
            fullName: row.bankFullName,
          },
        },
      ];
    })
    .sort((left, right) => {
      const byDate = right.examDate.localeCompare(left.examDate);
      return byDate || left.publicId.localeCompare(right.publicId);
    });
}

export function saoPauloDateIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toQuizExamEditionOptions(
  editions: readonly QuizExamEditionCatalogItem[],
): QuizExamEditionOption[] {
  return editions.map((edition) => ({
    ...(edition.status === "scheduled" ? { scheduled: true as const } : {}),
    publicId: edition.publicId,
    title: edition.title,
    examDate: edition.examDate,
    examYear: edition.examYear,
    organizer: edition.organizer,
    jurisdiction: edition.jurisdiction,
    careerSlug: edition.career.slug,
    specializationSlug: edition.specialization?.slug ?? null,
    bank: {
      slug: edition.bank.slug,
      name: edition.bank.name,
    },
  }));
}

function toIsoDate(value: string | Date) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const match = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value.trim());
  if (!match) return null;

  const normalized = match[1];
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}
