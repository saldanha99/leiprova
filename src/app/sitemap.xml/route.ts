import { absoluteUrl } from "@/lib/seo";
import { sitemapIndexXml, xmlResponse } from "@/lib/seo/sitemap-xml";
import { segmentLastModified, sitemapSegments } from "@/lib/seo/sitemaps";

export const dynamic = "force-dynamic";

/** Sitemap index (spec 4.4): one file per page type, only non-empty segments. */
export async function GET() {
  const segments = await sitemapSegments();
  const entries = [...segments.entries()]
    .filter(([, urls]) => urls.length > 0)
    .map(([name, urls]) => ({ url: absoluteUrl(`/sitemap/${name}.xml`), lastModified: segmentLastModified(urls) }));
  return xmlResponse(sitemapIndexXml(entries));
}
