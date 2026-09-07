import { lstat, mkdir, readFile, readdir, rmdir } from "node:fs/promises";
import path from "node:path";

const agents = ["Radar", "Guardião", "Autor"];

/** Exclusão entre processos. Uma trava abandonada exige inspeção, nunca roubo por timeout. */
export async function withLocalAgentLock<T>(root: string, agent: string, run: () => Promise<T>) {
  if (!agents.includes(agent)) throw new Error("Papel incompatível.");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = path.join(root, `.dispatch-${agent}.lock`);
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return { acquired: false as const };
    throw error;
  }
  try {
    return { acquired: true as const, value: await run() };
  } finally {
    await rmdir(lock);
  }
}

/** Pacote ainda reservado impede outra tarefa para o mesmo terminal, inclusive com resposta pronta. */
export async function hasPendingLocalAgentLease(roots: string[], agent: string, now = Date.now()) {
  if (!agents.includes(agent)) throw new Error("Papel incompatível.");
  for (const root of roots) {
    const entries = await readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name)) continue;
      const directory = path.join(root, entry.name);
      if (await lstat(path.join(directory, "receipt.json")).then(() => true, () => false)) continue;
      const file = path.join(directory, "packet.json");
      const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (!info) continue;
      if (!info.isFile() || info.size > 524288) throw new Error("Arquivo de reserva inválido.");
      // JSON parcial falha fechado: não reservar mais trabalho para encobrir o problema.
      const packet: unknown = JSON.parse(await readFile(file, "utf8"));
      if (!packet || typeof packet !== "object" || !("agent" in packet) || packet.agent !== agent) continue;
      if (!("job" in packet) || !packet.job || typeof packet.job !== "object" ||
          !("leaseExpiresAt" in packet.job) || typeof packet.job.leaseExpiresAt !== "string") {
        throw new Error("Arquivo de reserva inválido.");
      }
      const expiry = Date.parse(packet.job.leaseExpiresAt);
      if (!Number.isFinite(expiry)) throw new Error("Arquivo de reserva inválido.");
      if (expiry > now) return true;
    }
  }
  return false;
}
