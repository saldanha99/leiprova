import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { importFingerprint, LocalImportError } from "../src/lib/editorial/local-import-plan";
import {
  packageReviewAuthorizationSchema,
  reviewImportedPackage,
} from "../src/lib/editorial/package-review-service";

const sha256 = /^[a-f0-9]{64}$/u;

function parseArguments(arguments_: readonly string[]) {
  const args = new Map<string, string>();
  for (const argument of arguments_) {
    const match = /^--(directory|mode|fingerprint)=(.+)$/u.exec(argument);
    if (!match || args.has(match[1])) {
      throw new LocalImportError(
        "Use --directory=PASTA --mode=preview|apply; a aplicação exige --fingerprint=SHA256.",
      );
    }
    args.set(match[1], match[2]);
  }
  const mode = args.get("mode") ?? "preview";
  const fingerprint = args.get("fingerprint");
  if (mode !== "preview" && mode !== "apply") {
    throw new LocalImportError("Modo inválido. Use preview ou apply.");
  }
  if (
    (mode === "apply" && !sha256.test(fingerprint ?? "")) ||
    (mode === "preview" && fingerprint !== undefined)
  ) {
    throw new LocalImportError(
      "A aplicação exige a impressão SHA256 da prévia; a prévia não recebe impressão.",
    );
  }
  return { directory: args.get("directory"), fingerprint, mode } as const;
}

function requireTarget(sourceBundleId: string) {
  const connectionString = process.env.LEIPROVA_REVIEW_PACKAGE_DATABASE_URL;
  if (!connectionString) {
    throw new LocalImportError(
      "Defina LEIPROVA_REVIEW_PACKAGE_DATABASE_URL explicitamente.",
    );
  }
  let target: URL;
  try {
    target = new URL(connectionString);
  } catch {
    throw new LocalImportError("Destino editorial inválido.");
  }
  const production = process.env.NODE_ENV === "production";
  const local =
    target.hostname === "127.0.0.1" &&
    target.pathname === "/leiprova_editorial_local";
  const approvedProduction =
    production &&
    process.env.APP_URL === "https://leiprova.2b.app.br" &&
    process.env.LEIPROVA_REVIEW_PACKAGE_APPROVED ===
      `review-package:${sourceBundleId}` &&
    ["leiprova-pooler", "pooler"].includes(target.hostname) &&
    (!target.port || target.port === "5432") &&
    target.pathname === "/leiprova" &&
    target.username === "leiprova_app";
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.search ||
    target.hash ||
    !target.username ||
    (!local && !approvedProduction)
  ) {
    throw new LocalImportError(
      "A revisão exige o banco editorial local ou o pooler restrito da Editalume com autorização exata do pacote.",
    );
  }
  return {
    connectionString,
    database: target.pathname.slice(1),
    production: approvedProduction,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const production = process.env.NODE_ENV === "production";
  if (production && args.directory) {
    throw new LocalImportError("Produção só lê o volume fixo /review-package-input.");
  }
  const allowedRoot = await realpath(
    production
      ? "/review-package-input"
      : fileURLToPath(new URL("../.local/editorial/", import.meta.url)),
  );
  if (!production && !args.directory) {
    throw new LocalImportError(
      "Escolha uma pasta dentro de .local/editorial do projeto.",
    );
  }
  const directory = production
    ? allowedRoot
    : await realpath(path.resolve(args.directory!));
  if (!production && !directory.startsWith(allowedRoot + path.sep)) {
    throw new LocalImportError("Pacote fora do diretório editorial privado.");
  }

  async function readJson(name: string) {
    if (!/^[a-z0-9][a-z0-9._-]*\.json$/iu.test(name)) {
      throw new LocalImportError("Nome de arquivo editorial inválido.");
    }
    const candidate = path.join(directory, name);
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(directory + path.sep)) {
      throw new LocalImportError("Arquivo fora do pacote editorial autorizado.");
    }
    const file = await open(
      candidate,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const before = await file.stat();
      if (
        !before.isFile() ||
        before.size > 2_097_152 ||
        (await realpath(candidate)) !== resolved
      ) {
        throw new LocalImportError("Arquivo editorial inválido ou maior que 2 MiB.");
      }
      const content = await file.readFile("utf8");
      const after = await file.stat();
      if (
        Buffer.byteLength(content) > 2_097_152 ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs
      ) {
        throw new LocalImportError("Arquivo editorial mudou durante a leitura.");
      }
      return JSON.parse(content) as unknown;
    } finally {
      await file.close();
    }
  }

  const manifest = (await readJson("manifest.json")) as {
    sourceBundleId?: unknown;
    batchFiles?: unknown;
  };
  if (
    typeof manifest.sourceBundleId !== "string" ||
    !Array.isArray(manifest.batchFiles) ||
    manifest.batchFiles.length < 1 ||
    manifest.batchFiles.length > 4 ||
    manifest.batchFiles.some((name) => typeof name !== "string")
  ) {
    throw new LocalImportError("Manifesto do pacote inválido.");
  }
  const sources = await readJson("sources.json");
  const mapping = await readJson("mapping.json");
  const authorization = packageReviewAuthorizationSchema.parse(
    await readJson("authorization.json"),
  );
  if (authorization.sourceBundleId !== manifest.sourceBundleId) {
    throw new LocalImportError("Manifesto e autorização identificam pacotes diferentes.");
  }
  const batches = await Promise.all(
    (manifest.batchFiles as string[]).map((name) => readJson(name)),
  );
  const target = requireTarget(manifest.sourceBundleId);
  const client = postgres(target.connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 10,
  });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{
      name: string;
      role: string;
      superuser: boolean;
    }>(sql`
      select current_database() as name, current_user as role,
        (select rolsuper from pg_roles where rolname=current_user) as superuser
    `);
    if (
      !identity ||
      identity.name !== target.database ||
      (target.production &&
        (identity.role !== "leiprova_app" || identity.superuser))
    ) {
      throw new LocalImportError(
        "Identidade ou privilégio do banco não corresponde ao destino autorizado.",
      );
    }
    const request = { authorization, batches, mapping, sources };
    const preview = await reviewImportedPackage(db, {
      ...request,
      mode: "preview",
    });
    const operationFingerprint = importFingerprint({
      version: "review-editorial-package-operation-v1",
      sourceBundleId: manifest.sourceBundleId,
      reviewFingerprint: preview.fingerprint,
      authorizationSha256: importFingerprint(authorization),
    });
    if (args.mode === "apply" && args.fingerprint !== operationFingerprint) {
      throw new LocalImportError(
        "Pacote, responsável, declaração ou contexto mudou. Confira uma nova prévia.",
      );
    }
    const result =
      args.mode === "apply"
        ? await reviewImportedPackage(db, {
            ...request,
            mode: "apply",
            expectedFingerprint: preview.fingerprint,
          })
        : preview;
    console.log(
      JSON.stringify(
        {
          database: identity.name,
          sourceBundleId: manifest.sourceBundleId,
          ...result,
          reviewFingerprint: result.fingerprint,
          fingerprint: operationFingerprint,
          commercialReleaseAllowed: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof LocalImportError
      ? error.message
      : `Revisão interrompida: ${
          error instanceof Error ? error.message.slice(0, 500) : "falha sem detalhe seguro"
        }. Nenhum conteúdo foi publicado.`,
  );
  process.exitCode = 1;
});
