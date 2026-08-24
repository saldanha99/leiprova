const LEGAL_ACT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeStudyTopic(value: string | null | undefined) {
  const topic = value?.trim();
  return topic && topic.length <= 120 ? topic : undefined;
}

export function normalizeLegalActSlug(value: string | null | undefined) {
  const slug = value?.trim();
  return slug && slug.length <= 120 && LEGAL_ACT_SLUG.test(slug) ? slug : undefined;
}

export function normalizeArticleOrder(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100_000 ? parsed : undefined;
}

export function normalizeArticleRange(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
) {
  const start = normalizeArticleOrder(startValue);
  const end = normalizeArticleOrder(endValue);
  if (start === undefined || end === undefined || start <= end) return { start, end };
  return { start: end, end: start };
}

export function normalizeNotebookPublicId(value: string | null | undefined) {
  const publicId = value?.trim();
  return publicId && UUID.test(publicId) ? publicId : undefined;
}
