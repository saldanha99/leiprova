import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { writePrivateFileAtomically } from "./atomic-private-file";

const settlementMarkerSchema = z.object({
  digest: z.string().regex(/^[a-f0-9]{64}$/u),
  attempts: z.number().int().min(1).max(3),
  at: z.iso.datetime(),
}).strict();

export type LocalAgentResultDiagnostic = "settlement_marker_empty" | "settlement_marker_invalid" | "settlement_marker_write_failed";

/** Recolhe respostas locais sem confiar nelas: a ponte valida reserva e conteúdo. */
export async function settleLocalAgentResults(
  queueRoot: string,
  agent: string,
  complete: (packetPath: string) => Promise<unknown>,
  limit = 3,
  persistMarker: typeof writePrivateFileAtomically = writePrivateFileAtomically,
  onDiagnostic: (diagnostic: LocalAgentResultDiagnostic) => void = () => undefined,
) {
  if (!["Radar", "Guardião", "Autor"].includes(agent)) throw new Error("Papel incompatível.");
  const summary = { attempted: 0, completed: 0, failed: 0 };
  let markerWriteFailures = 0;
  const entries = await readdir(queueRoot, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const maxAttempts = Math.max(0, Math.min(3, limit));
    if (summary.attempted >= maxAttempts || markerWriteFailures >= maxAttempts) break;
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name)) continue;
    const directory = path.join(queueRoot, entry.name);
    const packet = path.join(directory, "packet.json");
    const response = path.join(directory, "response.json");
    const marker = path.join(directory, "settlement.json");
    if (await lstat(path.join(directory, "receipt.json")).then(() => true, () => false)) continue;
    try {
      const [packetInfo, responseInfo] = await Promise.all([lstat(packet), lstat(response)]);
      if (!packetInfo.isFile() || !responseInfo.isFile() || packetInfo.size > 524288 || responseInfo.size > 524288) continue;
      const claim: unknown = JSON.parse(await readFile(packet, "utf8"));
      if (!claim || typeof claim !== "object" || !("agent" in claim) || claim.agent !== agent) continue;
      const digest = createHash("sha256").update(await readFile(response)).digest("hex");
      const markerInfo = await lstat(marker).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (markerInfo) {
        if (!markerInfo.isFile() || markerInfo.size > 2048) {
          onDiagnostic("settlement_marker_invalid");
          continue;
        }
        if (markerInfo.size === 0) {
          onDiagnostic("settlement_marker_empty");
          continue;
        }
      }
      let attempts = 0;
      if (markerInfo) {
        let previous: unknown;
        try {
          previous = JSON.parse(await readFile(marker, "utf8"));
        } catch {
          onDiagnostic("settlement_marker_invalid");
          continue;
        }
        const parsed = settlementMarkerSchema.safeParse(previous);
        if (!parsed.success) {
          onDiagnostic("settlement_marker_invalid");
          continue;
        }
        if (parsed.data.digest === digest) attempts = parsed.data.attempts;
      }
      if (attempts >= 3) continue;
      const nextMarker = JSON.stringify({ digest, attempts: attempts + 1, at: new Date().toISOString() });
      try {
        await persistMarker(marker, nextMarker);
      } catch {
        markerWriteFailures++;
        onDiagnostic("settlement_marker_write_failed");
        continue;
      }
      summary.attempted++;
      try {
        await complete(packet);
        summary.completed++;
      } catch {
        summary.failed++;
      }
    } catch {
      // Arquivo incompleto ou inválido não deve impedir o restante da fila.
      continue;
    }
  }
  return summary;
}
