import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Recolhe respostas locais sem confiar nelas: a ponte valida reserva e conteúdo. */
export async function settleLocalAgentResults(
  queueRoot: string,
  agent: string,
  complete: (packetPath: string) => Promise<unknown>,
) {
  if (!["Radar", "Guardião", "Autor"].includes(agent)) throw new Error("Papel incompatível.");
  const summary = { attempted: 0, completed: 0, failed: 0 };
  const entries = await readdir(queueRoot, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (summary.attempted >= 3) break;
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
      const markerInfo = await lstat(marker).catch(() => null);
      if (markerInfo && (!markerInfo.isFile() || markerInfo.size > 2048)) continue;
      const previous: unknown = markerInfo ? JSON.parse(await readFile(marker, "utf8")) : null;
      const attempts = previous && typeof previous === "object" && "digest" in previous && previous.digest === digest && "attempts" in previous && typeof previous.attempts === "number" ? previous.attempts : 0;
      if (attempts >= 3) continue;
      summary.attempted++;
      try {
        await complete(packet);
        summary.completed++;
      } catch {
        summary.failed++;
      }
      await writeFile(marker, JSON.stringify({ digest, attempts: attempts + 1, at: new Date().toISOString() }), { mode: 0o600 });
    } catch {
      // Arquivo incompleto ou inválido não deve impedir o restante da fila.
      continue;
    }
  }
  return summary;
}
