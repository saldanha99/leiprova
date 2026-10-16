/** pnpm exec tsx --env-file-if-exists=.env scripts/review-mprj-format-contract.ts --input=PRIVATE.json --actor=UUID --mode=preview
 * Apply: same args with --mode=apply --expected-fingerprint=SHA256. Refresh: add --refresh on BOTH invocations.
 */
import { open } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import * as schema from "../src/lib/db/schema";
import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { officialQuestionContractInputSchema } from "../src/lib/editorial/official-question-contract";
import { reviewOfficialQuestionContract } from "../src/lib/editorial/official-question-contract-review";

export function parseMprjFormatArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === "--refresh" && args.refresh === undefined) { args.refresh = true; continue; }
    const match = /^--(input|actor|mode|expected-fingerprint)=(.+)$/u.exec(arg);
    if (!match || args[match[1]] !== undefined) throw new Error("Argumento desconhecido ou duplicado.");
    args[match[1]] = match[2];
  }
  const result = z.object({ input: z.string().min(1), actor: z.uuid(), mode: z.enum(["preview", "apply"]),
    "expected-fingerprint": z.string().regex(/^[a-f0-9]{64}$/u).optional(), refresh: z.boolean().optional() }).strict().parse(args);
  if ((result.mode === "apply") !== !!result["expected-fingerprint"]) throw new Error("Apply exige fingerprint; preview não o aceita.");
  return result;
}

async function main() {
  const args = parseMprjFormatArgs(process.argv.slice(2));
  const file = await open(args.input, "r");
  let input: unknown;
  try {
    if (!(await file.stat()).isFile()) throw new Error("Entrada deve ser arquivo regular privado.");
    const bytes = Buffer.alloc(65_537);
    try {
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      if (bytesRead > 65_536) throw new Error("Entrada excede 64 KiB.");
      input = z.object({ contract: officialQuestionContractInputSchema }).strict().parse(JSON.parse(bytes.subarray(0, bytesRead).toString("utf8")));
    } finally { bytes.fill(0); }
  } finally { await file.close(); }
  const contract = (input as { contract: z.infer<typeof officialQuestionContractInputSchema> }).contract;
  if (contract.opportunityId !== 20 || contract.examEditionId !== 41) throw new Error("CLI exclusiva para MPRJ20/41.");
  const client = postgres(requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL),
    { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const [identity] = await client`select current_database() as name,current_user as username`;
    if (identity?.name !== "leiprova" || identity.username !== "leiprova_owner") throw new Error("Banco ou papel fora do escopo.");
    const result = await reviewOfficialQuestionContract(drizzle(client, { schema }), { input,
      actorPublicId: args.actor, approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE,
      mode: args.mode, expectedFingerprint: args["expected-fingerprint"], refreshMprjEvidence: args.refresh ?? false });
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Contrato MPRJ não aplicado: confira entrada, administrador, fonte atual e fingerprint. Conexão e conteúdo foram omitidos."); process.exitCode = 1; });
}
