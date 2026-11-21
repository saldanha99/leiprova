/**
 * Enfileira 1 tarefa de autoria por artigo "fino" (1 ou 2 questões revisadas com comentário),
 * pedindo 2–3 inéditas pela mesma linha de autoria e revisão (src/lib/editorial/thin-article-authoring.ts).
 * Decisão do proprietário em 21/11/2026 (volume e custo aprovados; sem OpenRouter/outro provedor).
 *
 *   pnpm editorial:thin-articles:enqueue -- --dry-run          # só lê: contagens e as 20 primeiras chaves
 *   pnpm editorial:thin-articles:enqueue -- --apply [--limit=N] # enfileira (idempotente)
 *   --wave0=<arquivo>  lista da onda 0 de SEO (padrão: docs/seo/onda-0-300.txt ou scripts/thin-articles-wave0.txt)
 *
 * Idempotente: artigo com 3+ questões revisadas sai da lista; artigo que já tem tarefa
 * `author-thin:` (qualquer estado, exceto substituída) é pulado. Rodar de novo não duplica.
 */
import { existsSync, readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { enqueueThinArticleAuthoring, parseWave0List } from "../src/lib/editorial/thin-article-authoring";

const DEFAULT_WAVE0_FILES = ["docs/seo/onda-0-300.txt", "scripts/thin-articles-wave0.txt"];

export function parseEnqueueArgs(argv: readonly string[]) {
  let dryRun: boolean | null = null, limit: number | undefined, wave0File: string | undefined;
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--dry-run" || arg === "--apply") {
      if (dryRun !== null) throw new Error("Use só um de --dry-run ou --apply.");
      dryRun = arg === "--dry-run";
    } else if (/^--limit=[0-9]{1,4}$/u.test(arg)) limit = Number(arg.slice(8));
    else if (/^--wave0=[A-Za-z0-9._/-]{1,200}$/u.test(arg) && !arg.includes("..")) wave0File = arg.slice(8);
    else throw new Error(`Argumento inválido: ${arg.slice(0, 40)}`);
  }
  if (dryRun === null) throw new Error("Informe --dry-run ou --apply.");
  if (limit !== undefined && limit < 1) throw new Error("--limit precisa ser positivo.");
  return { dryRun, limit, wave0File };
}

async function main() {
  const args = parseEnqueueArgs(process.argv.slice(2));
  const wave0File = args.wave0File ?? DEFAULT_WAVE0_FILES.find((file) => existsSync(file));
  if (args.wave0File && !existsSync(args.wave0File)) throw new Error("Lista da onda 0 não encontrada.");
  const wave0Paths = wave0File ? parseWave0List(readFileSync(wave0File, "utf8")) : [];
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Banco não configurado.");
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string; superuser: boolean }>(sql`
      select current_database() name, (select rolsuper from pg_roles where rolname = current_user) superuser`);
    if (identity.superuser) throw new Error("Use a identidade restrita da aplicação, não um superusuário.");
    const result = await enqueueThinArticleAuthoring(db, { dryRun: args.dryRun, wave0Paths, limit: args.limit });
    console.log(JSON.stringify({ database: identity.name, wave0File: wave0File ?? null, wave0Paths: wave0Paths.length, ...result }, null, 2));
    if (result.failed.length) process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("enqueue-thin-article-authoring.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha ao enfileirar artigos finos:", error instanceof Error ? error.message : "erro desconhecido");
    process.exitCode = 1;
  });
}
