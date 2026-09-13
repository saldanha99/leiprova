export const OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS = 30;
export const OFFICIAL_EXAM_SOURCE_MAX_AGE_MS =
  OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1_000;

export function isOfficialExamSourceFresh(
  checkedAtValue: Date | string | null | undefined,
  referenceDateValue: Date | string,
) {
  if (!checkedAtValue) return false;
  const checkedAt =
    checkedAtValue instanceof Date
      ? checkedAtValue
      : new Date(checkedAtValue);
  const referenceDate =
    referenceDateValue instanceof Date
      ? referenceDateValue
      : new Date(referenceDateValue);
  if (
    Number.isNaN(checkedAt.getTime()) ||
    Number.isNaN(referenceDate.getTime())
  ) {
    return false;
  }
  const age = referenceDate.getTime() - checkedAt.getTime();
  return age >= 0 && age <= OFFICIAL_EXAM_SOURCE_MAX_AGE_MS;
}
