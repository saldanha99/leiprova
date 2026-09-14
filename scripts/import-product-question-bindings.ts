import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import {
  productBindingPackageSchema,
  requireProductBindingTarget,
} from "../src/lib/commerce/product-binding-policy";
import { importProductQuestionBindings, ProductBindingError } from "../src/lib/commerce/product-binding-service";

async function main() {
  const args = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const match = /^--(input|actor|mode|fingerprint|requirements)=(.+)$/u.exec(argument);
    if (!match || args.has(match[1])) throw new ProductBindingError("Use --input=ARQUIVO --actor=UUID --mode=preview|import-pending --fingerprint=SHA256 [--requirements=ID,ID]. Não existe aprovação neste operador.");
    args.set(match[1], match[2]);
  }
  const mode = args.get("mode") ?? "preview";
  if (mode !== "preview" && mode !== "import-pending") throw new ProductBindingError("Modo inválido; somente preview ou importação pendente.");
  const target = requireProductBindingTarget(process.env.LEIPROVA_BINDING_DATABASE_URL, process.env.APP_URL,
    process.env.NODE_ENV, process.env.LEIPROVA_BINDING_IMPORT_APPROVED);
  if (target.production && args.has("input")) throw new ProductBindingError("Produção só lê /binding-input/proposals.json.");
  const root = await realpath(target.production ? "/binding-input" : fileURLToPath(new URL("../.local/editorial/", import.meta.url)));
  if (!target.production && !args.get("input")) throw new ProductBindingError("Escolha um pacote dentro de .local/editorial do LeiProva.");
  const candidate = target.production ? path.join(root, "proposals.json") : path.resolve(args.get("input")!);
  const resolved = await realpath(candidate);
  if (!resolved.startsWith(root + path.sep)) throw new ProductBindingError("O pacote está fora do diretório autorizado.");
  const file = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let input: unknown;
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > 2_097_152 || await realpath(candidate) !== resolved) {
      throw new ProductBindingError("Pacote inválido, alterado ou maior que 2 MiB.");
    }
    // Um só descritor para validar e ler; troca por symlink não é seguida.
    const content = await file.readFile("utf8");
    const after = await file.stat();
    if (Buffer.byteLength(content) > 2_097_152 || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new ProductBindingError("Pacote alterado durante a leitura ou excede 2 MiB.");
    }
    const parsedInput = productBindingPackageSchema.parse(JSON.parse(content));
    const requirementFilter = args.get("requirements");
    if (requirementFilter) {
      const ids = requirementFilter.split(",").map((value) => Number(value));
      if (!ids.length || ids.some((value) => !Number.isSafeInteger(value) || value <= 0) || new Set(ids).size !== ids.length) {
        throw new ProductBindingError("Filtro de requisitos inválido.");
      }
      const filteredInput = {
        ...parsedInput,
        items: parsedInput.items.filter((item) => ids.includes(item.requirementId)),
      };
      if (!filteredInput.items.length) throw new ProductBindingError("O filtro não selecionou propostas.");
      input = filteredInput;
    } else {
      input = parsedInput;
    }
  } finally { await file.close(); }
  const client = postgres(target.connectionString, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string; role: string; superuser: boolean }>(sql`
      select current_database() as name, current_user as role,
      (select rolsuper from pg_roles where rolname = current_user) as superuser
    `);
    if (identity.name !== target.database || (target.production && (identity.role !== "leiprova_app" || identity.superuser))) {
      throw new ProductBindingError("Identidade do banco ou privilégio diferente do destino autorizado.");
    }
    const result = await importProductQuestionBindings(db, { input, actorPublicId: args.get("actor") ?? "", mode,
      expectedFingerprint: args.get("fingerprint") });
    console.log(JSON.stringify({ database: identity.name, ...result }, null, 2));
  } finally { await client.end(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof ProductBindingError ? error.message : "Curadoria pendente falhou. Confira pacote, operador e destino. Nenhuma revisão humana foi registrada; não exponha credenciais.");
  process.exitCode = 1;
});
