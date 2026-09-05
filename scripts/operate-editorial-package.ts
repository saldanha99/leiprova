import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { importFingerprint, LocalImportError, parseLocalImport } from "../src/lib/editorial/local-import-plan";
import { importLocalDrafts } from "../src/lib/editorial/local-import-service";
import { requireEditorialOperationTarget } from "../src/lib/editorial/operation-target";
import { packageReviewAuthorizationSchema, reviewImportedPackage } from "../src/lib/editorial/package-review-service";

async function main() {
  const args = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const match = /^--(phase|fingerprint)=(.+)$/u.exec(argument);
    if (!match || args.has(match[1])) throw new LocalImportError("Use --phase=import-preview|import-apply|review-preview|review-apply e --fingerprint=SHA256 ao aplicar.");
    args.set(match[1], match[2]);
  }
  const phase = args.get("phase") ?? "import-preview";
  if (!["import-preview", "import-apply", "review-preview", "review-apply"].includes(phase)) throw new LocalImportError("Fase editorial inválida.");
  const production = process.env.NODE_ENV === "production";
  const directory = await realpath(production ? "/editorial-input" : fileURLToPath(new URL("../.local/editorial/input/", import.meta.url)));
  async function readJson(name: string) {
    const resolved = await realpath(path.join(directory, name));
    if (!resolved.startsWith(directory + path.sep)) throw new LocalImportError("Arquivo fora do pacote editorial autorizado.");
    const metadata = await stat(resolved);
    if (!metadata.isFile() || metadata.size > 1_048_576) throw new LocalImportError("Arquivo editorial inválido ou maior que 1 MiB.");
    const text = await readFile(resolved, "utf8");
    if (Buffer.byteLength(text) > 1_048_576) throw new LocalImportError("Arquivo editorial excede 1 MiB.");
    return JSON.parse(text) as unknown;
  }
  const sources = await readJson("sources.json");
  const batches = await Promise.all(["claude-fgv.json", "prism-fcc.json", "radar-vunesp.json", "forge-cebraspe.json"].map(readJson));
  const mapping = await readJson("mapping.json");
  const authorization = packageReviewAuthorizationSchema.parse(await readJson("authorization.json"));
  const input = parseLocalImport(sources, batches, mapping);
  if (production && (input.sources.id !== "cf-direitos-fundamentais-2026-09-05" || input.validation.totalQuestions !== 160)) {
    throw new LocalImportError("Esta operação de produção está limitada ao lote autorizado de 160 questões.");
  }
  if (authorization.sourceBundleId !== input.sources.id || authorization.sourcesSha256 !== input.validation.sourcesSha256 ||
      authorization.mappingSha256 !== importFingerprint(input.mapping) ||
      authorization.banks.length !== input.validation.banks.length ||
      input.validation.banks.some((bank) => !authorization.banks.some((confirmed) => confirmed.bank === bank.bank && confirmed.sha256 === bank.sha256))) {
    throw new LocalImportError("Pacote diferente daquele confirmado pelo responsável.");
  }
  const target = requireEditorialOperationTarget(process.env.LEIPROVA_EDITORIAL_OPERATION_DATABASE_URL, {
    nodeEnv: process.env.NODE_ENV, appUrl: process.env.APP_URL, approval: process.env.LEIPROVA_EDITORIAL_OPERATION_APPROVED,
  });
  const client = postgres(target.connectionString, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string; role: string; superuser: boolean }>(sql`
      select current_database() as name, current_user as role, (select rolsuper from pg_roles where rolname = current_user) as superuser
    `);
    if (identity.name !== target.database || (production && (identity.role !== "leiprova_app" || identity.superuser))) {
      throw new LocalImportError("Identidade ou privilégio do banco não corresponde ao destino autorizado.");
    }
    const mode = phase.endsWith("apply") ? "apply" as const : "preview" as const;
    const result = phase.startsWith("import")
      ? await importLocalDrafts(db, { sources, batches, mapping, actorPublicId: authorization.actorPublicId, mode, expectedFingerprint: args.get("fingerprint") })
      : await reviewImportedPackage(db, { sources, batches, mapping, authorization, mode, expectedFingerprint: args.get("fingerprint") });
    console.log(JSON.stringify({ phase, database: identity.name, ...result }, null, 2));
  } finally { await client.end(); }
}
main().catch((error: unknown) => {
  console.error(error instanceof LocalImportError ? error.message : "A operação editorial falhou. Confira arquivos, autorização e destino; não exponha credenciais ou SQL no relatório.");
  process.exitCode = 1;
});
