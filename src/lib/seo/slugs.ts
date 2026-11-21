/**
 * Public URL slugs for laws and articles (spec 2.3). Pure: used by the proxy
 * (301s), the pages and the sitemap, so every place agrees on one canonical URL.
 */

export type LawIdentity = Readonly<{
  slug: string;
  actType: string;
  actNumber: string | null;
  actYear: number | null;
}>;

/** Codes and the Constitution get the popular slug, keyed by the numeric form. */
const POPULAR_LAW_SLUGS: Readonly<Record<string, string>> = {
  "constituicao-1988": "constituicao-federal",
  "decreto-lei-2848-1940": "codigo-penal",
  "decreto-lei-3689-1941": "codigo-de-processo-penal",
  "decreto-lei-5452-1943": "clt",
  "lei-10406-2002": "codigo-civil",
  "lei-13105-2015": "codigo-de-processo-civil",
  "lei-5172-1966": "codigo-tributario-nacional",
  "lei-8078-1990": "codigo-de-defesa-do-consumidor",
  "lei-4737-1965": "codigo-eleitoral",
};

/** Extra spellings people type for the popular slugs; all 301 to the canonical. */
const EXTRA_ALIASES: Readonly<Record<string, string>> = {
  cf: "constituicao-federal",
  "cf-1988": "constituicao-federal",
  cf88: "constituicao-federal",
  "constituicao-federal-1988": "constituicao-federal",
  "codigo-processo-penal": "codigo-de-processo-penal",
  "codigo-processo-civil": "codigo-de-processo-civil",
  "codigo-defesa-consumidor": "codigo-de-defesa-do-consumidor",
};

/**
 * Aliases resolvable without the database (proxy answers them with 301).
 * Database slugs of other laws are resolved by the page itself.
 */
export const STATIC_LAW_ALIASES: Readonly<Record<string, string>> = {
  ...POPULAR_LAW_SLUGS,
  ...EXTRA_ALIASES,
};

/** `{tipo}-{numero}-{ano}` with digits only; null when the act has no number/year. */
export function numericLawSlug(law: LawIdentity): string | null {
  if (!law.actYear) return null;
  const type = law.actType.trim().toLowerCase();
  if (type === "constituicao") return `constituicao-${law.actYear}`;
  const digits = (law.actNumber ?? "").replace(/\D/g, "");
  if (!digits || !/^[a-z-]+$/.test(type)) return null;
  return `${type}-${digits}-${law.actYear}`;
}

export function canonicalLawSlug(law: LawIdentity): string {
  const numeric = numericLawSlug(law);
  if (numeric) return POPULAR_LAW_SLUGS[numeric] ?? numeric;
  return law.slug;
}

/** Every known slug of a law except the canonical one. */
export function lawSlugAliases(law: LawIdentity): string[] {
  const canonical = canonicalLawSlug(law);
  const aliases = new Set<string>([law.slug]);
  const numeric = numericLawSlug(law);
  if (numeric) aliases.add(numeric);
  for (const [alias, target] of Object.entries(EXTRA_ALIASES)) {
    if (target === canonical) aliases.add(alias);
  }
  aliases.delete(canonical);
  return [...aliases];
}

/** Human label: "Lei 8.112/1990", "LC 101/2000", or the code name. */
export function lawShortLabel(law: LawIdentity & { shortTitle: string }): string {
  const numeric = numericLawSlug(law);
  if (numeric && POPULAR_LAW_SLUGS[numeric]) return law.shortTitle;
  const number = law.actNumber?.trim();
  if (!number || !law.actYear) return law.shortTitle;
  const prefix: Readonly<Record<string, string>> = {
    lei: "Lei",
    "lei-complementar": "LC",
    "decreto-lei": "Decreto-Lei",
    decreto: "Decreto",
  };
  return `${prefix[law.actType] ?? "Lei"} ${number}/${law.actYear}`;
}

const ARTICLE_PATTERN =
  /^(adct[-._\s]*)?art(?:igo)?[-._\s]*(\d+)(?:o|º|°|ª)?((?:[-._\s]*[a-z](?![a-z]))*)$/;

/**
 * Normalizes an article URL segment: `Art-5`, `artigo-5`, `art.5`, `art-5o`,
 * `art-5º` → `art-5`; `art-1a` → `art-1-a`; `adct-art-10` stays. Null when it is
 * not an article reference at all.
 */
export function normalizeArticleSegment(raw: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const match = ARTICLE_PATTERN.exec(value.trim().toLowerCase());
  if (!match) return null;
  const [, adct, digits, suffix] = match;
  const number = String(Number.parseInt(digits, 10));
  const letters = (suffix.match(/[a-z]/g) ?? []).map((letter) => `-${letter}`).join("");
  return `${adct ? "adct-" : ""}art-${number}${letters}`;
}

/** Article page path. `articlePath` is the DB `legal_articles.path` (already `art-n`). */
export function articlePagePath(lawSlug: string, articlePath: string): string {
  return `/lei/${lawSlug}/${normalizeArticleSegment(articlePath) ?? articlePath}`;
}

export function lawPagePath(lawSlug: string): string {
  return `/lei/${lawSlug}`;
}

/**
 * Proxy decision for `/lei/...`: returns the canonical path when the request
 * must be 301-redirected, or null when it is already canonical (or unknown).
 */
export function canonicalLegalRequestPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() !== "lei" || segments.length < 2 || segments.length > 3) return null;
  const law = segments[1].toLowerCase();
  const canonicalLaw = STATIC_LAW_ALIASES[law] ?? law;
  let target = `/lei/${canonicalLaw}`;
  if (segments.length === 3) {
    const article = normalizeArticleSegment(segments[2]);
    target += `/${article ?? segments[2]}`;
  }
  return target === pathname ? null : target;
}
