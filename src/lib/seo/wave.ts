import { WAVE_0_ARTICLE_PATHS } from "@/lib/seo/waves/onda-0";

/**
 * Index waves (spec 5). The wave only decides what goes into the sitemap (and
 * IndexNow); every gate-passing page still renders with `index, follow`.
 * - `off` (default, unset): no law/article URL in the sitemap.
 * - `0`: the committed list `docs/seo/onda-0-300.txt` and the laws it covers.
 * - `paced`: wave 0 plus N gate-passing articles released per day (see `pacedRelease`).
 * - `all`: every gate-passing law and article page.
 */
export type SeoWave = "off" | "0" | "paced" | "all";

export function seoWave(value: string | undefined = process.env.SEO_WAVE): SeoWave {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "0" || normalized === "paced" || normalized === "all") return normalized;
  return "off";
}

const wave0Articles = new Set<string>(WAVE_0_ARTICLE_PATHS);
const wave0Laws = new Set(WAVE_0_ARTICLE_PATHS.map((path) => path.split("/").slice(0, 3).join("/")));

/** Static membership; `paced` only knows wave 0 here (use `resolveWaveScope`). */
export function articleInWave(path: string, wave: SeoWave): boolean {
  if (wave === "all") return true;
  return (wave === "0" || wave === "paced") && wave0Articles.has(path);
}

export function lawInWave(path: string, wave: SeoWave): boolean {
  if (wave === "all") return true;
  return (wave === "0" || wave === "paced") && wave0Laws.has(path);
}

// ---------------------------------------------------------------------------
// Paced wave (spec 5: "~50–100 pages per day, ordered by number of questions").
// Stateless: the released count is derived from the calendar and the env only.

export const DAILY_MIN = 50;
export const DAILY_MAX = 100;
/** A law enters the sitemap/llms.txt once it has this many released indexable articles. */
export const LAW_MIN_RELEASED_ARTICLES = 10;
/** Spec 5: the 70% target is read at 4–6 weeks; the < 50% brake only after 6 weeks. */
export const BRAKE_READ_FROM_DAY = 28;
export const BRAKE_STOP_FROM_DAY = 42;
export const INDEXED_TARGET_PCT = 70;
export const INDEXED_STOP_PCT = 50;

export type WavePace = Readonly<{
  /** First release day (America/Sao_Paulo calendar), YYYY-MM-DD; null = nothing paced. */
  start: string | null;
  /** Articles per day, clamped to 50–100. */
  daily: number;
  /** Latest GSC reading of the article segments: date (YYYY-MM-DD) and % "Indexada". */
  gscDate: string | null;
  gscIndexedPct: number | null;
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!ISO_DATE.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed ? null : trimmed;
}

export function clampDaily(value: string | undefined): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return DAILY_MIN;
  return Math.min(DAILY_MAX, Math.max(DAILY_MIN, parsed));
}

export function wavePace(env: Readonly<Record<string, string | undefined>> = process.env): WavePace {
  const pct = Number.parseFloat(env.SEO_WAVE_GSC_INDEXED_PCT?.trim() ?? "");
  const gscDate = parseDate(env.SEO_WAVE_GSC_DATE);
  const validPct = Number.isFinite(pct) && pct >= 0 && pct <= 100;
  return {
    start: parseDate(env.SEO_WAVE_START),
    daily: clampDaily(env.SEO_WAVE_DAILY),
    gscDate: gscDate && validPct ? gscDate : null,
    gscIndexedPct: gscDate && validPct ? pct : null,
  };
}

/** Calendar date in São Paulo (the release day turns at local midnight). */
export function saoPauloDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function shiftDate(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** 1 on the start day, 0 before it. */
function releaseDay(start: string, day: string): number {
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  return diff < 0 ? 0 : diff + 1;
}

export type BrakeState = "none" | "slow" | "stop";
export type PacedRelease = Readonly<{ count: number; day: number; brake: BrakeState }>;

/**
 * How many paced articles are released on `today`, out of `total` candidates.
 * Without a usable GSC reading: day × daily. A reading taken on release day r
 * (only from day 28) applies from the next day on:
 * - indexed < 50% and r ≥ 42 → stop growing: frozen at r × daily;
 * - indexed < 70% → slow down to 50/day after r;
 * - otherwise the configured pace continues.
 */
export function pacedRelease(pace: WavePace, today: string, total: number): PacedRelease {
  if (!pace.start) return { count: 0, day: 0, brake: "none" };
  const day = releaseDay(pace.start, today);
  const readDay = pace.gscDate ? releaseDay(pace.start, pace.gscDate) : 0;
  let brake: BrakeState = "none";
  if (pace.gscIndexedPct !== null && readDay >= BRAKE_READ_FROM_DAY && readDay <= day) {
    if (pace.gscIndexedPct < INDEXED_STOP_PCT && readDay >= BRAKE_STOP_FROM_DAY) brake = "stop";
    else if (pace.gscIndexedPct < INDEXED_TARGET_PCT) brake = "slow";
  }
  const raw =
    brake === "none" ? day * pace.daily
    : brake === "stop" ? readDay * pace.daily
    : readDay * pace.daily + (day - readDay) * DAILY_MIN;
  return { count: Math.min(total, raw), day, brake };
}

export type ScopeArticle = Readonly<{ path: string; indexable: boolean; questions: number; order: number }>;
export type ScopeLaw = Readonly<{ path: string; articles: readonly ScopeArticle[] }>;

/**
 * Paced candidates: gate-passing articles outside wave 0, most reviewed
 * questions with comment first; ties by article order, then path.
 */
export function pacedOrder(laws: readonly ScopeLaw[]): string[] {
  return laws
    .flatMap((law) => law.articles.filter((article) => article.indexable && !wave0Articles.has(article.path)))
    .toSorted((a, b) => b.questions - a.questions || a.order - b.order || a.path.localeCompare(b.path))
    .map((article) => article.path);
}

export type WaveScope = Readonly<{
  hasArticle: (path: string) => boolean;
  hasLaw: (path: string) => boolean;
  /** Paced only: today's release (null for the other waves). */
  release: PacedRelease | null;
}>;

/** Membership of the active wave on `today` (São Paulo date). */
export function resolveWaveScope(laws: readonly ScopeLaw[], wave: SeoWave, pace: WavePace, today: string): WaveScope {
  if (wave !== "paced") {
    return { hasArticle: (path) => articleInWave(path, wave), hasLaw: (path) => lawInWave(path, wave), release: null };
  }
  const order = pacedOrder(laws);
  const release = pacedRelease(pace, today, order.length);
  const articles = new Set<string>([...WAVE_0_ARTICLE_PATHS, ...order.slice(0, release.count)]);
  const lawPaths = new Set<string>(wave0Laws);
  for (const law of laws) {
    const released = law.articles.filter((article) => article.indexable && articles.has(article.path)).length;
    if (released >= LAW_MIN_RELEASED_ARTICLES) lawPaths.add(law.path);
  }
  return { hasArticle: (path) => articles.has(path), hasLaw: (path) => lawPaths.has(path), release };
}

/** Snapshot → scope input (kept here so callers share one mapping). */
export function scopeLaws(
  snapshots: readonly Readonly<{ path: string; articles: readonly Readonly<{ path: string; gate: { status: string }; reviewedQuestionCount: number; articleOrder: number }>[] }>[],
): ScopeLaw[] {
  return snapshots.map((snapshot) => ({
    path: snapshot.path,
    articles: snapshot.articles.map((article) => ({
      path: article.path,
      indexable: article.gate.status === "index",
      questions: article.reviewedQuestionCount,
      order: article.articleOrder,
    })),
  }));
}

export type WaveCandidate = Readonly<{ path: string; questions: number; order: number }>;
export type WaveLaw = Readonly<{ path: string; productCount: number; candidates: readonly WaveCandidate[] }>;

/**
 * Wave selection (docs/seo/ondas.md): the `lawCount` laws required by the most
 * contest products; inside each law, articles by reviewed questions; filled
 * round-robin across those laws (law rank order) until `size` articles.
 */
export function selectWave(laws: readonly WaveLaw[], size: number, lawCount: number): string[] {
  const ranked = laws
    .filter((law) => law.candidates.length > 0)
    .toSorted((a, b) => b.productCount - a.productCount || a.path.localeCompare(b.path))
    .slice(0, lawCount)
    .map((law) =>
      law.candidates.toSorted((a, b) => b.questions - a.questions || a.order - b.order).map((item) => item.path),
    );
  const selected: string[] = [];
  for (let round = 0; selected.length < size; round += 1) {
    let added = false;
    for (const list of ranked) {
      if (selected.length >= size) break;
      if (round < list.length) {
        selected.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}
