import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Indexing state of each public SEO page (spec 4.4). `content_changed_at` moves
 * only when `content_hash` changes, so the sitemap lastmod reflects real content
 * changes and never a source re-verification.
 */
export const seoPageState = pgTable(
  "seo_page_state",
  {
    path: text("path").primaryKey(),
    type: text("type").notNull(),
    indexable: boolean("indexable").notNull(),
    reason: text("reason"),
    contentHash: text("content_hash").notNull(),
    contentChangedAt: timestamp("content_changed_at", { withTimezone: true }).notNull(),
    inboundLinks: integer("inbound_links").notNull().default(0),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("seo_page_state_type_indexable_idx").on(table.type, table.indexable),
    check("seo_page_state_type_check", sql`${table.type} in ('law', 'article', 'hub')`),
    check("seo_page_state_path_check", sql`${table.path} ~ '^/[a-z0-9/-]*$'`),
    check("seo_page_state_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check("seo_page_state_inbound_check", sql`${table.inboundLinks} >= 0`),
  ],
);

export type SeoPageState = typeof seoPageState.$inferSelect;
