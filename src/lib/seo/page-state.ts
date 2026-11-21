/**
 * Content-hash bookkeeping for sitemap lastmod (spec 4.4) and IndexNow (4.5).
 * Pure; the database access lives in `page-state-db.ts`.
 */

export type PageType = "law" | "article" | "hub";

export type CurrentPage = Readonly<{
  path: string;
  type: PageType;
  indexable: boolean;
  reason: string | null;
  contentHash: string;
  /** Best date available from the data when the page is seen for the first time. */
  contentDate: Date;
  inboundLinks: number;
}>;

export type StoredPage = Readonly<{
  path: string;
  type: PageType;
  indexable: boolean;
  inboundLinks: number;
  contentHash: string;
  contentChangedAt: Date;
}>;

export type PageStateRow = Readonly<{
  path: string;
  type: PageType;
  indexable: boolean;
  reason: string | null;
  contentHash: string;
  contentChangedAt: Date;
  inboundLinks: number;
}>;

export type PageStatePlan = Readonly<{
  rows: readonly PageStateRow[];
  /** URLs that entered the index, changed content or left it (IndexNow). */
  changedPaths: readonly string[];
}>;

/** lastmod: stored change date while the hash matches, else the data date. */
export function resolveLastModified(stored: StoredPage | undefined, current: Pick<CurrentPage, "contentHash" | "contentDate">): Date {
  return stored && stored.contentHash === current.contentHash ? stored.contentChangedAt : current.contentDate;
}

export function planPageState(
  current: readonly CurrentPage[],
  stored: ReadonlyMap<string, StoredPage>,
  now: Date,
): PageStatePlan {
  const changedPaths: string[] = [];
  const seen = new Set<string>();
  const rows = current.map((page) => {
    seen.add(page.path);
    const previous = stored.get(page.path);
    const hashChanged = !previous || previous.contentHash !== page.contentHash;
    const contentChangedAt = !previous ? page.contentDate : hashChanged ? now : previous.contentChangedAt;
    const indexChanged = (previous?.indexable ?? false) !== page.indexable;
    if (indexChanged || (page.indexable && hashChanged)) changedPaths.push(page.path);
    return {
      path: page.path,
      type: page.type,
      indexable: page.indexable,
      reason: page.reason,
      contentHash: page.contentHash,
      contentChangedAt,
      inboundLinks: page.inboundLinks,
    };
  });
  // Pages that disappeared (404) leave the index; the row is kept as history.
  const removed: PageStateRow[] = [];
  for (const [path, previous] of stored) {
    if (seen.has(path) || !previous.indexable) continue;
    changedPaths.push(path);
    removed.push({ ...previous, indexable: false, reason: "not_found" });
  }
  return { rows: [...rows, ...removed], changedPaths };
}

export function isUndefinedTableError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && (current as { code?: unknown }).code === "42P01") return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}
