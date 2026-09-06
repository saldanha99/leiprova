import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { LocalImportError } from "../src/lib/editorial/local-import-plan";
import { reviewImportedPackage } from "../src/lib/editorial/package-review-service";
import { parseReview80Arguments, parseReview80Package, requireReview80ApplyFingerprint, requireReviewOperationTarget,
  REVIEW_80_BATCH_FILES, review80OperationFingerprint } from "../src/lib/editorial/review-operation-target";

async function main() {
  const args = parseReview80Arguments(process.argv.slice(2));
  const production = process.env.NODE_ENV === "production";
  if (production && args.directory) throw new LocalImportError("Produção só lê o volume fixo /review-80-input.");
  const allowedRoot = await realpath(production ? "/review-80-input" : fileURLToPath(new URL("../.local/editorial/", import.meta.url)));
  if (!production && !args.directory) throw new LocalImportError("Escolha uma pasta dentro de .local/editorial do LeiProva.");
  const directory = production ? allowedRoot : await realpath(path.resolve(args.directory!));
  if (!production && !directory.startsWith(allowedRoot + path.sep)) throw new LocalImportError("Pacote fora do diretório editorial deste projeto.");
  async function readJson(name: string) {
    const candidate = path.join(directory, name);
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(directory + path.sep)) throw new LocalImportError("Arquivo fora do pacote de revisão autorizado.");
    const file = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat();
      if (!before.isFile() || before.size > 1_048_576 || await realpath(candidate) !== resolved) {
        throw new LocalImportError("Arquivo de revisão inválido, alterado ou maior que 1 MiB.");
      }
      // O mesmo descritor é validado e lido; não segue troca por link simbólico.
      const text = await file.readFile("utf8");
      const after = await file.stat();
      if (Buffer.byteLength(text) > 1_048_576 || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
        throw new LocalImportError("Arquivo de revisão alterado durante a leitura ou excede 1 MiB.");
      }
      return JSON.parse(text) as unknown;
    } finally { await file.close(); }
  }
  const sources = await readJson("sources.json");
  const batches = await Promise.all(REVIEW_80_BATCH_FILES.map(readJson));
  const mapping = await readJson("mapping.json");
  // A confirmação deve existir antes da execução; este comando nunca a fabrica.
  const { input, authorization } = parseReview80Package(sources, batches, mapping, await readJson("authorization.json"));
  const target = requireReviewOperationTarget(process.env.LEIPROVA_REVIEW_80_DATABASE_URL, {
    nodeEnv: process.env.NODE_ENV, appUrl: process.env.APP_URL, approval: process.env.LEIPROVA_REVIEW_80_APPROVED,
  });
  const client = postgres(target.connectionString, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string; role: string; superuser: boolean }>(sql`
      select current_database() as name, current_user as role, (select rolsuper from pg_roles where rolname = current_user) as superuser
    `);
    if (!identity || identity.name !== target.database || (production && (identity.role !== "leiprova_app" || identity.superuser))) {
      throw new LocalImportError("Identidade ou privilégio do banco não corresponde ao destino da revisão.");
    }
    const request = { sources, batches, mapping, authorization };
    const preview = await reviewImportedPackage(db, { ...request, mode: "preview" });
    const operationFingerprint = review80OperationFingerprint(preview.fingerprint, authorization);
    if (args.mode === "apply") requireReview80ApplyFingerprint(args.fingerprint, operationFingerprint);
    const result = args.mode === "apply" ? await reviewImportedPackage(db, { ...request,
      mode: "apply", expectedFingerprint: preview.fingerprint }) : preview;
    console.log(JSON.stringify({ database: identity.name, sourceBundleId: input.sources.id, ...result,
      reviewFingerprint: result.fingerprint, fingerprint: operationFingerprint,
      productBindingsApproved: 0, commercialReleaseAllowed: false }, null, 2));
  } finally { await client.end(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof LocalImportError ? error.message : "Revisão dos 80 itens interrompida. Confira pacote, declarações humanas e destino; não exponha credenciais ou SQL.");
  process.exitCode = 1;
});
