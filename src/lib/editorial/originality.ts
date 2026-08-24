export const ORIGINALITY_REJECTION_THRESHOLD_BPS = 8_500;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shingles(value: string, size = 3) {
  const tokens = normalize(value).split(/\s+/).filter(Boolean);
  if (tokens.length <= size) return new Set(tokens);
  return new Set(tokens.slice(0, tokens.length - size + 1).map((_, index) => tokens.slice(index, index + size).join(" ")));
}

export function textualSimilarityBps(left: string, right: string) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 10_000;

  const leftSet = shingles(left);
  const rightSet = shingles(right);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? Math.round((intersection / union) * 10_000) : 0;
}

export function findMostSimilarQuestion(
  candidate: string,
  corpus: readonly { publicId: string; prompt: string }[],
) {
  return corpus.reduce(
    (best, item) => {
      const scoreBps = textualSimilarityBps(candidate, item.prompt);
      return scoreBps > best.scoreBps ? { scoreBps, referencePublicId: item.publicId } : best;
    },
    { scoreBps: 0, referencePublicId: null as string | null },
  );
}
