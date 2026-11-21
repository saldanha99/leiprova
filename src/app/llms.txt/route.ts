import { buildLlmsTxt, textResponse } from "@/lib/seo/llms";
import { llmsLaws } from "@/lib/seo/llms-data";

export const dynamic = "force-dynamic";

/** Guia auxiliar para assistentes (spec 4.2), gerado do banco. */
export async function GET() {
  return textResponse(buildLlmsTxt(await llmsLaws(), new Date()));
}
