/** Sitemap XML (sitemaps.org 0.9). No changefreq/priority: Google ignores both. */

export const ARTICLES_PER_SITEMAP = 5000;

export type SitemapUrl = Readonly<{ url: string; lastModified: Date }>;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export function urlsetXml(entries: readonly SitemapUrl[]): string {
  const body = entries
    .map((entry) => `<url><loc>${escapeXml(entry.url)}</loc><lastmod>${day(entry.lastModified)}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(entries: readonly SitemapUrl[]): string {
  const body = entries
    .map((entry) => `<sitemap><loc>${escapeXml(entry.url)}</loc><lastmod>${day(entry.lastModified)}</lastmod></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

export function latest(entries: readonly SitemapUrl[], fallback: Date): Date {
  if (entries.length === 0) return fallback;
  return entries.reduce((max, entry) => (entry.lastModified > max ? entry.lastModified : max), entries[0].lastModified);
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
