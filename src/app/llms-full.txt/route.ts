import { buildLlmsFullTxt, textResponse } from "@/lib/seo/llms";
import { llmsLaws } from "@/lib/seo/llms-data";

export const dynamic = "force-dynamic";

/** Versão estendida: ficha de cada lei e os artigos com mais questões, sem texto literal nem questões. */
export async function GET() {
  return textResponse(buildLlmsFullTxt(await llmsLaws(), new Date()));
}
