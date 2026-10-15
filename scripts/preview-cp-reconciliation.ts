import { mkdir, lstat, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { fetchCamaraCpCorrectionEvidence } from "../src/lib/official-sources/camara-cp-correction-parser";
import { validateCpReconciliationContext } from "../src/lib/editorial/cp-reconciliation-preview";

export function parseCpReconciliationPreviewArgs(args: readonly string[]) {
  const argv = args[0] === "--" ? args.slice(1) : [...args];
  if (argv.includes("--apply")) {
    throw new Error("Operador de prévia é estritamente somente leitura; --apply não é suportado.");
  }
  let outputName: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("output=")) {
      if (outputName) throw new Error("Opção output duplicada.");
      outputName = arg.slice("output=".length);
    } else {
      throw new Error(`Argumento desconhecido '${arg}'; use apenas output=<nome privado>.`);
    }
  }
  if (outputName && !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(outputName)) {
    throw new Error("Nome de saída privada inválido; use até 64 caracteres alfanuméricos e hífens.");
  }
  return { outputName };
}

export function requireCpReconciliationPreviewDatabase(url: string | undefined) {
  if (!url) throw new Error("Defina MIGRATION_DATABASE_URL existente somente na VPS.");
  const target = new URL(url);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    decodeURIComponent(target.username) !== "leiprova_owner" ||
    target.pathname !== "/leiprova"
  ) {
    throw new Error("Prévia exige leiprova_owner/banco leiprova; conexão estritamente somente leitura.");
  }
  return url;
}

async function createPrivateOutput(name: string) {
  const base = resolve(".local/editorial/cp-reconciliation-previews");
  for (const path of [resolve(".local"), resolve(".local/editorial"), base]) {
    try {
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error("Diretório privado inválido/symlink.");
      }
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
      await mkdir(path, { mode: 0o700 });
    }
  }
  const output = resolve(base, name);
  if (relative(base, output) !== name || dirname(output) !== base) {
    throw new Error("Saída fora da pasta privada autorizada.");
  }
  await mkdir(output, { mode: 0o700 });
  return output;
}

async function main() {
  const command = parseCpReconciliationPreviewArgs(process.argv.slice(2));
  const url = requireCpReconciliationPreviewDatabase(process.env.MIGRATION_DATABASE_URL);
  const fresh = await fetchCamaraCpCorrectionEvidence();
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  const db = drizzle(client, { schema });

  try {
    const preview = await db.transaction(
      async tx => {
        await tx.execute(sql`set local statement_timeout='30s'`);
        await tx.execute(sql`set local lock_timeout='5s'`);
        return validateCpReconciliationContext(tx, fresh);
      },
      { isolationLevel: "repeatable read", accessMode: "read only" }
    );

    let outputDirectory: string | undefined;
    if (command.outputName) {
      outputDirectory = await createPrivateOutput(command.outputName);
      await writeFile(
        resolve(outputDirectory, "plan.json"),
        JSON.stringify(preview, null, 2) + "\n",
        { mode: 0o600, flag: "wx" }
      );
      await writeFile(
        resolve(outputDirectory, "summary.json"),
        JSON.stringify(
          {
            mode: preview.mode,
            fingerprint: preview.fingerprint,
            observedAt: preview.observedAt,
            offersReleased: preview.offers.totalReleased,
            enacCurrent: preview.offers.enacDetail.currentValidCount,
            enacProjected: preview.offers.enacDetail.projectedValidCount,
            enacFloorCurrent: preview.offers.enacDetail.floorMetCurrent,
            enacFloorProjected: preview.offers.enacDetail.floorMetProjected,
            newAuthorialQuestions: preview.projection.newAuthorialQuestions,
            rehabilitatedLegacyQuestions: preview.projection.rehabilitatedLegacyQuestions,
            databaseWrites: preview.projection.databaseWrites,
            disclaimer: preview.disclaimer,
          },
          null,
          2
        ) + "\n",
        { mode: 0o600, flag: "wx" }
      );
    }

    console.log(
      JSON.stringify(
        {
          mode: preview.mode,
          fingerprint: preview.fingerprint,
          policy: preview.policy,
          sourceStatus: "canonical_matches_pins",
          articlesVerified: preview.source.articleCount,
          versions: {
            v63: preview.versions.v63.status,
            v112: preview.versions.v112.status,
          },
          receipt1: preview.receipt1.status,
          snapshots: {
            monitor: preview.snapshots.monitor2757.status,
            text: preview.snapshots.text1660.status,
          },
          releasedOffersCount: preview.offers.totalReleased,
          enacProjection: {
            current: preview.offers.enacDetail.currentValidCount,
            projected: preview.offers.enacDetail.projectedValidCount,
            netRehabilitated: preview.offers.enacDetail.netRehabilitated,
            floorCurrent: preview.offers.enacDetail.floorMetCurrent,
            floorProjected: preview.offers.enacDetail.floorMetProjected,
          },
          metrics: {
            newAuthorialQuestions: preview.projection.newAuthorialQuestions,
            rehabilitatedLegacyQuestions: preview.projection.rehabilitatedLegacyQuestions,
            databaseWrites: preview.projection.databaseWrites,
          },
          disclaimer: preview.disclaimer,
          outputDirectory,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("preview-cp-reconciliation.ts")) {
  void main().catch((error: unknown) => {
    const databaseError = error instanceof Error && (error.name === "PostgresError" || "cause" in error);
    const message =
      error instanceof Error && !databaseError
        ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]")
        : "Falha operacional; conferir diagnóstico privado na VPS.";
    console.error("Prévia de reconciliação CP bloqueada:", message);
    process.exitCode = 1;
  });
}
