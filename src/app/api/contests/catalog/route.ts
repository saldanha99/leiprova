import { isDatabaseConfigured } from "@/lib/db/client";
import { listReleasedContestProducts } from "@/lib/commerce/store";

export const dynamic = "force-dynamic";
export async function GET() {
  const rows = isDatabaseConfigured()
    ? await listReleasedContestProducts()
    : [];
  return Response.json(
    { releasedSlugs: rows.map((item) => item.slug) },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
