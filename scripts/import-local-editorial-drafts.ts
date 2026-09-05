import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import * as schema from "../src/lib/db/schema";
import { LocalImportError } from "../src/lib/editorial/local-import-plan";
import { importLocalDrafts } from "../src/lib/editorial/local-import-service";
import { requireLocalImportTarget } from "../src/lib/editorial/local-import-target";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = new URL("../content/editorial/cf-direitos-fundamentais-2026-09-05/", import.meta.url);
const usage = "Use --mapping=content/editorial/arquivo.json --actor=UUID --mode=preview|apply [--fingerprint=SHA256]. Somente bancos locais dedicados; não aprova nem publica.";

async function boundedJson(filename: string) {
  const allowedRoot = await realpath(path.join(root, "content/editorial"));
  const resolved = await realpath(filename);
  if (!resolved.startsWith(allowedRoot + path.sep) || !resolved.endsWith(".json")) {
    throw new LocalImportError("Arquivo JSON fora do diretório editorial do projeto.");
  }
  const metadata = await stat(resolved);
  if (!metadata.isFile() || metadata.size > 1_048_576) throw new LocalImportError("Exige arquivo editorial regular de até 1 MiB.");
  const text = await readFile(resolved, "utf8");
  if (Buffer.byteLength(text, "utf8") > 1_048_576) throw new LocalImportError("Arquivo editorial excede 1 MiB.");
  return JSON.parse(text) as unknown;
}

async function main() {
  const args = new Map<string, string>();
  for (const value of process.argv.slice(2)) {
    const match = /^--(mapping|actor|mode|fingerprint)=(.+)$/u.exec(value);
    if (!match || args.has(match[1])) throw new LocalImportError(usage);
    args.set(match[1], match[2]);
  }
  const mode = args.get("mode") ?? "preview";
  if (!["preview", "apply"].includes(mode) || !args.get("mapping") || !z.uuid().safeParse(args.get("actor")).success) {
    throw new LocalImportError(usage);
  }
  const allowedRoot = await realpath(path.join(root, "content/editorial"));
  const filename = await realpath(path.resolve(root, args.get("mapping")!));
  if (!filename.startsWith(allowedRoot + path.sep) || !filename.endsWith(".json")) {
    throw new LocalImportError("O mapeamento precisa estar dentro de content/editorial deste projeto, sem symlink externo.");
  }
  const mapping = await boundedJson(filename);
  const sources = await boundedJson(fileURLToPath(new URL("sources.json", directory)));
  const batches = await Promise.all(["claude-fgv.json", "prism-fcc.json", "radar-vunesp.json", "forge-cebraspe.json"]
    .map((name) => boundedJson(fileURLToPath(new URL(name, directory)))));
  const target = requireLocalImportTarget(process.env.LEIPROVA_IMPORT_DATABASE_URL);
  const client = postgres(target.connectionString, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string }>(sql`select current_database() as name`);
    if (identity.name !== target.database) throw new LocalImportError("A identidade do banco não corresponde ao destino explícito.");
    const result = await importLocalDrafts(db, {
      sources, batches, mapping, actorPublicId: args.get("actor")!, mode: mode as "preview" | "apply",
      expectedFingerprint: args.get("fingerprint"),
    });
    console.log(JSON.stringify({ database: target.database, ...result }, null, 2));
  } finally { await client.end(); }
}

main().catch((error: unknown) => {
  // Não imprime conexão, SQL, documentos inteiros ou mensagens de bibliotecas contendo segredos.
  console.error(error instanceof LocalImportError ? error.message : "Não foi possível importar. Confira o contrato dos arquivos e o banco local dedicado; nenhuma aprovação foi registrada.");
  process.exitCode = 1;
});
