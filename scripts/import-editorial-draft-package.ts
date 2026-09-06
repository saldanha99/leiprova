import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import * as schema from "../src/lib/db/schema";
import { draftOperationFingerprint, requireDraftOperationTarget } from "../src/lib/editorial/draft-operation-target";
import { LocalImportError, parseLocalImport } from "../src/lib/editorial/local-import-plan";
import { importLocalDrafts } from "../src/lib/editorial/local-import-service";

const manifestSchema = z.object({
  schemaVersion: z.literal(1), sourceBundleId: z.string().min(1).max(160),
  operatorPublicId: z.uuid(),
  batchFiles: z.array(z.string().regex(/^[a-z0-9-]+\.json$/u)).min(1).max(4),
  purpose: z.literal("import_drafts_only"), publicationAllowed: z.literal(false),
}).strict().refine((value) => new Set(value.batchFiles).size === value.batchFiles.length,
  "Lotes duplicados no manifesto.");

async function main() {
  const args = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const match = /^--(directory|mode|fingerprint)=(.+)$/u.exec(argument);
    if (!match || args.has(match[1])) throw new LocalImportError("Use --directory=PASTA --mode=preview|apply e --fingerprint=SHA256 ao aplicar. Nunca aprova questões.");
    args.set(match[1], match[2]);
  }
  const mode = args.get("mode") ?? "preview";
  if (mode !== "preview" && mode !== "apply") throw new LocalImportError("Modo inválido; aprovação não existe neste operador.");
  const production = process.env.NODE_ENV === "production";
  if (production && args.has("directory")) throw new LocalImportError("Produção só lê o volume fixo /draft-input.");
  const allowedRoot = await realpath(production ? "/draft-input" : fileURLToPath(new URL("../.local/editorial/", import.meta.url)));
  if (!production && !args.get("directory")) throw new LocalImportError("Escolha uma pasta dentro de .local/editorial do LeiProva.");
  const directory = production ? allowedRoot : await realpath(path.resolve(args.get("directory")!));
  if (!production && !directory.startsWith(allowedRoot + path.sep)) throw new LocalImportError("Pacote fora do diretório editorial deste projeto.");
  async function readJson(name: string) {
    const candidate = path.join(directory, name);
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(directory + path.sep)) throw new LocalImportError("Arquivo fora do pacote autorizado.");
    const file = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat();
      if (!before.isFile() || before.size > 1_048_576 || await realpath(candidate) !== resolved) {
        throw new LocalImportError("Arquivo editorial inválido, alterado ou maior que 1 MiB.");
      }
      // Validação e leitura usam o mesmo descritor, sem seguir troca por symlink.
      const text = await file.readFile("utf8");
      const after = await file.stat();
      if (Buffer.byteLength(text) > 1_048_576 || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
        throw new LocalImportError("Arquivo editorial alterado durante a leitura ou excede 1 MiB.");
      }
      return JSON.parse(text) as unknown;
    } finally { await file.close(); }
  }
  const manifest = manifestSchema.parse(await readJson("manifest.json"));
  const sources = await readJson("sources.json");
  const batches = await Promise.all(manifest.batchFiles.map(readJson));
  const mapping = await readJson("mapping.json");
  const input = parseLocalImport(sources, batches, mapping);
  if (manifest.sourceBundleId !== input.sources.id) throw new LocalImportError("Manifesto pertence a outro pacote.");
  const target = requireDraftOperationTarget(process.env.LEIPROVA_DRAFT_IMPORT_DATABASE_URL, {
    nodeEnv: process.env.NODE_ENV, appUrl: process.env.APP_URL,
    approval: process.env.LEIPROVA_DRAFT_IMPORT_APPROVED, sourceBundleId: input.sources.id,
  });
  const client = postgres(target.connectionString, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string; role: string; superuser: boolean }>(sql`
      select current_database() as name, current_user as role, (select rolsuper from pg_roles where rolname = current_user) as superuser
    `);
    if (identity.name !== target.database || (production && (identity.role !== "leiprova_app" || identity.superuser))) {
      throw new LocalImportError("Identidade do banco ou privilégio diferente do destino autorizado.");
    }
    const request = { sources, batches, mapping, actorPublicId: manifest.operatorPublicId };
    const preview = await importLocalDrafts(db, { ...request, mode: "preview" });
    const operationFingerprint = draftOperationFingerprint(preview.fingerprint, manifest);
    if (mode === "apply" && args.get("fingerprint") !== operationFingerprint) {
      throw new LocalImportError("Pacote, operador ou contexto mudou; confira uma nova prévia antes de aplicar.");
    }
    const result = mode === "apply" ? await importLocalDrafts(db, { ...request,
      mode: "apply", expectedFingerprint: preview.fingerprint }) : preview;
    console.log(JSON.stringify({ database: identity.name, sourceBundleId: input.sources.id, ...result,
      contentFingerprint: result.fingerprint, fingerprint: operationFingerprint }, null, 2));
  } finally { await client.end(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof LocalImportError ? error.message : "Importação de rascunhos falhou. Confira pacote, contrato e destino; nenhuma revisão humana foi registrada. Não exponha credenciais.");
  process.exitCode = 1;
});
