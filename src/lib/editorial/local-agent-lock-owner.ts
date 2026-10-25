import { randomUUID } from "node:crypto";
import { constants, closeSync, lstatSync, openSync, readSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { writePrivateFileAtomically } from "./atomic-private-file";

const filename = "owner.json";
type Identity = { dev: number; ino: number };
type Owner = { version: 1; token: string; pid: number; host: string; createdAt: string; interrupted: boolean };
export type LocalAgentLockDiagnostic = {
  state: "absent" | "legacy" | "invalid" | "pid_present" | "pid_missing" | "unverifiable";
  pid?: number; createdAt?: string; interrupted?: boolean;
};
const same = (left: Identity, right: Identity) => left.dev === right.dev && left.ino === right.ino;
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

function directoryIdentity(lock: string) {
  const info = lstatSync(lock);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Reserva local com tipo inválido; inspeção necessária.");
  return { dev: info.dev, ino: info.ino };
}
function readOwner(lock: string): Owner {
  const fd = openSync(path.join(lock, filename), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const bytes = Buffer.alloc(4097);
    const length = readSync(fd, bytes, 0, bytes.length, 0);
    if (length === 0 || length > 4096) throw new Error("Metadados de trava inválidos.");
    const owner: unknown = JSON.parse(bytes.subarray(0, length).toString("utf8"));
    if (!owner || typeof owner !== "object" || Array.isArray(owner)) throw new Error("Metadados de trava inválidos.");
    const value = owner as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== "createdAt,host,interrupted,pid,token,version" || value.version !== 1 ||
      typeof value.token !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value.token) ||
      !Number.isSafeInteger(value.pid) || Number(value.pid) < 1 || typeof value.host !== "string" || !value.host || value.host.length > 255 ||
      typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.interrupted !== "boolean") {
      throw new Error("Metadados de trava inválidos.");
    }
    return value as Owner;
  } finally { closeSync(fd); }
}

/** Read-only evidence, never permission to recover: a missing local PID says nothing about remote work. */
export function inspectAgentLockDirectory(lock: string): LocalAgentLockDiagnostic {
  let identity: Identity;
  try { identity = directoryIdentity(lock); }
  catch (error) { return { state: isMissing(error) ? "absent" : "invalid" }; }
  let owner: Owner;
  try { owner = readOwner(lock); }
  catch (error) { return { state: isMissing(error) ? "legacy" : "invalid" }; }
  try { if (!same(identity, directoryIdentity(lock))) return { state: "unverifiable" }; }
  catch { return { state: "unverifiable" }; }
  const detail = { pid: owner.pid, createdAt: owner.createdAt, interrupted: owner.interrupted };
  if (owner.host !== hostname()) return { state: "unverifiable", ...detail };
  try { process.kill(owner.pid, 0); return { state: "pid_present", ...detail }; }
  catch (error) { return { state: (error as NodeJS.ErrnoException).code === "ESRCH" ? "pid_missing" : "unverifiable", ...detail }; }
}

/** Call only immediately after successful mkdir. Persist ownership before any external work. */
export function createAgentLockOwner(lock: string) {
  const identity = directoryIdentity(lock);
  const owner: Owner = { version: 1, token: randomUUID(), pid: process.pid, host: hostname(), createdAt: new Date().toISOString(), interrupted: false };
  // A crash between mkdir and this write can still leave a legacy/invalid lock: fail closed.
  writeFileSync(path.join(lock, filename), JSON.stringify(owner), { flag: "wx", mode: 0o600, flush: true });
  const assertOwnership = (directory = lock) => {
    if (!same(identity, directoryIdentity(directory)) || readOwner(directory).token !== owner.token) {
      throw new Error("Reserva local mudou de proprietário; trava preservada para inspeção.");
    }
  };
  return {
    release() {
      assertOwnership();
      if (readdirSync(lock).some(entry => entry !== filename)) throw new Error("Reserva local contém arquivos inesperados; trava preservada.");
      // Atomically detach the finished owner before deleting its metadata. A kill during cleanup
      // can leave this private artifact, never an empty canonical lock that blocks the next run.
      const released = `${lock}.released-${owner.token}`;
      renameSync(lock, released);
      assertOwnership(released);
      unlinkSync(path.join(released, filename));
      if (!same(identity, directoryIdentity(released))) throw new Error("Reserva local mudou de proprietário; trava preservada para inspeção.");
      rmdirSync(released);
    },
    async interrupted() {
      assertOwnership();
      await writePrivateFileAtomically(path.join(lock, filename), JSON.stringify({ ...owner, interrupted: true }));
      // Retain the lock even after the local callback unwinds: cancellation may leave remote work alive.
    },
  };
}
