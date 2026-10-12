import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { classifyStandingProgrammeSubjects } from "../src/lib/editorial/programme-subject-classification";

async function main() {
  const args = new Map<string, string>(); let apply = false;
  for (const argument of process.argv.slice(2)) {
    if (argument === "--apply" && !apply) { apply = true; continue; }
    const match = /^--(input|actor|fingerprint)=(.+)$/u.exec(argument);
    if (!match || args.has(match[1])) throw new Error("Use --input=ARQUIVO --actor=UUID; --apply exige --fingerprint=SHA256 da prévia.");
    args.set(match[1], match[2]);
  }
  if (!args.get("input") || !args.get("actor")) throw new Error("Dossiê privado e administrador explícito obrigatórios.");
  const raw = await readFile(args.get("input")!, "utf8");
  if (Buffer.byteLength(raw) > 150_000) throw new Error("Lote excede o limite permitido.");
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const [identity] = await client`select current_database() as name,current_user as username`;
    if (identity.name !== "leiprova" || identity.username !== "leiprova_owner") throw new Error("Banco não corresponde ao projeto.");
    console.log(JSON.stringify(await classifyStandingProgrammeSubjects(drizzle(client, { schema }), { input: JSON.parse(raw), actorPublicId: args.get("actor")!,
      approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE, mode: apply ? "apply" : "preview", expectedFingerprint: args.get("fingerprint") }), null, 2));
  } finally { await client.end(); }
}
main().catch(() => { console.error("Classificação não aplicada. Confira fonte literal, cargo, páginas, disciplina, reservas e fingerprint; conexão omitida."); process.exitCode = 1; });
