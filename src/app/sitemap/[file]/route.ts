import { urlsetXml, xmlResponse } from "@/lib/seo/sitemap-xml";
import { type SitemapSegment, sitemapSegments } from "@/lib/seo/sitemaps";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/sitemap/[file]">) {
  const { file } = await context.params;
  const match = /^([a-z0-9-]+)\.xml$/.exec(file);
  const urls = match ? (await sitemapSegments()).get(match[1] as SitemapSegment) : undefined;
  if (!urls || urls.length === 0) return new Response("Not found", { status: 404 });
  return xmlResponse(urlsetXml(urls));
}
