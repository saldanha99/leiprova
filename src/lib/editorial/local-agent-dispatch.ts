import { lstat, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { createAgentLockOwner, inspectAgentLockDirectory } from "./local-agent-lock-owner";

export type { LocalAgentLockDiagnostic } from "./local-agent-lock-owner";

const agents = ["Radar", "Guardião", "Autor"];

/** Diagnóstico somente leitura: PID presente/ausente não prova o estado do trabalho remoto. */
export function inspectLocalAgentLock(root: string, agent: string) {
  if (!agents.includes(agent)) throw new Error("Papel incompatível.");
  return inspectAgentLockDirectory(path.join(root, `.dispatch-${agent}.lock`));
}

/** Exclusão entre processos. Uma trava abandonada exige inspeção, nunca roubo por timeout. */
export async function withLocalAgentLock<T>(root: string, agent: string, run: () => Promise<T>, options: { signal?: AbortSignal } = {}) {
  if (!agents.includes(agent)) throw new Error("Papel incompatível.");
  options.signal?.throwIfAborted();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = path.join(root, `.dispatch-${agent}.lock`);
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return { acquired: false as const };
    throw error;
  }
  // Failure to initialize ownership stays closed; no external callback has started.
  const owner = createAgentLockOwner(lock);
  let started = false;
  try {
    options.signal?.throwIfAborted();
    started = true;
    const value = await run();
    options.signal?.throwIfAborted();
    return { acquired: true as const, value };
  } finally {
    if (started && options.signal?.aborted) await owner.interrupted();
    else owner.release();
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
