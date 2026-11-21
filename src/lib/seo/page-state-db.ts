import "server-only";

import { inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { seoPageState } from "@/lib/db/schema";
import type { LawSnapshot } from "@/lib/seo/legal-snapshot";
import {
  type CurrentPage,
  type PageStateRow,
  type StoredPage,
  isUndefinedTableError,
} from "@/lib/seo/page-state";

/**
 * Reads stored states. Before migration 0057 is applied the table does not
 * exist: callers fall back to data dates and the site keeps working.
 */
export async function readPageStates(paths?: readonly string[]): Promise<Map<string, StoredPage>> {
  try {
    const query = getDb()
      .select({
        path: seoPageState.path,
        type: seoPageState.type,
        indexable: seoPageState.indexable,
        inboundLinks: seoPageState.inboundLinks,
        contentHash: seoPageState.contentHash,
        contentChangedAt: seoPageState.contentChangedAt,
      })
      .from(seoPageState);
    const rows = paths ? await query.where(inArray(seoPageState.path, [...paths])) : await query;
    return new Map(
      rows.flatMap((row) =>
        row.type === "law" || row.type === "article" || row.type === "hub"
          ? [[row.path, { ...row, type: row.type }] as const]
          : [],
      ),
    );
  } catch (error) {
    if (isUndefinedTableError(error)) return new Map();
    throw error;
  }
}

export async function writePageStates(rows: readonly PageStateRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  for (let start = 0; start < rows.length; start += 500) {
    const batch = rows.slice(start, start + 500).map((row) => ({ ...row, checkedAt: new Date() }));
    await db
      .insert(seoPageState)
      .values(batch)
      .onConflictDoUpdate({
        target: seoPageState.path,
        set: {
          type: sql`excluded.type`,
          indexable: sql`excluded.indexable`,
          reason: sql`excluded.reason`,
          contentHash: sql`excluded.content_hash`,
          contentChangedAt: sql`excluded.content_changed_at`,
          inboundLinks: sql`excluded.inbound_links`,
          checkedAt: sql`excluded.checked_at`,
        },
      });
  }
}

/** Current state of every law and article page (all waves). */
export function currentLegalPages(snapshots: readonly LawSnapshot[]): CurrentPage[] {
  return snapshots.flatMap((snapshot) => [
    {
      path: snapshot.path,
      type: "law" as const,
      indexable: snapshot.gate.status === "index",
      reason: snapshot.gate.reasons.join(",") || null,
      contentHash: snapshot.contentHash,
      contentDate: snapshot.contentDate,
      inboundLinks: 1,
    },
    ...snapshot.articles.map((article) => ({
      path: article.path,
      type: "article" as const,
      indexable: article.gate.status === "index",
      reason: article.gate.reasons.join(",") || null,
      contentHash: article.contentHash,
      contentDate: article.contentDate,
      inboundLinks: article.inboundLinks,
    })),
  ]);
}
