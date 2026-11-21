import { WAVE_0_ARTICLE_PATHS } from "@/lib/seo/waves/onda-0";

/**
 * Index waves (spec 5). The wave only decides what goes into the sitemap (and
 * IndexNow); every gate-passing page still renders with `index, follow`.
 * - `off` (default, unset): no law/article URL in the sitemap.
 * - `0`: the committed list `docs/seo/onda-0-300.txt` and the laws it covers.
 * - `all`: every gate-passing law and article page.
 */
export type SeoWave = "off" | "0" | "all";

export function seoWave(value: string | undefined = process.env.SEO_WAVE): SeoWave {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "0" || normalized === "all") return normalized;
  return "off";
}

const wave0Articles = new Set<string>(WAVE_0_ARTICLE_PATHS);
const wave0Laws = new Set(WAVE_0_ARTICLE_PATHS.map((path) => path.split("/").slice(0, 3).join("/")));

export function articleInWave(path: string, wave: SeoWave): boolean {
  if (wave === "all") return true;
  return wave === "0" && wave0Articles.has(path);
}

export function lawInWave(path: string, wave: SeoWave): boolean {
  if (wave === "all") return true;
  return wave === "0" && wave0Laws.has(path);
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
