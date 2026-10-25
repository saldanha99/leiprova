import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile, mkdir, mkdtemp, rm, rename, lstat, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { inspectLocalAgentLock, withLocalAgentLock } from "@/lib/editorial/local-agent-dispatch";
const roots: string[] = [], children: ChildProcess[] = [];
const fixture = fileURLToPath(new URL("./fixtures/local-agent-lock-child.mts", import.meta.url));
async function setup() { const root = await mkdtemp(path.join(tmpdir(), "forge-lock-owner-")); roots.push(root); return root; }
const lockPath = (root: string) => path.join(root, ".dispatch-Autor.lock");
async function stop(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit"); child.kill(signal); await exited;
}
async function start(root: string, mode = "hold") {
  const child = spawn(process.execPath, ["--import", "tsx", fixture, root, mode], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  children.push(child);
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => reject(new Error("Synthetic lock child exited before readiness.")));
    child.on("message", message => { if ((message as {stage?:string}).stage === "entered") resolve(); });
  });
  return child;
}
afterEach(async () => {
  for (const child of children.splice(0)) await stop(child);
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
it("persiste dono privado antes do callback e remove sincronamente após conclusão", async () => {
  const root = await setup();
  await withLocalAgentLock(root, "Autor", async () => {
    expect(inspectLocalAgentLock(root, "Autor")).toMatchObject({ state: "pid_present", pid: process.pid, interrupted: false });
    expect((await lstat(path.join(lockPath(root), "owner.json"))).mode & 0o777).toBe(0o600);
    return 1;
  });
  expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "absent" });
});
it("outro processo vivo permanece exclusivo, inclusive com metadata muito antiga", async () => {
  const root = await setup(), child = await start(root);
  const file = path.join(lockPath(root), "owner.json"), owner = JSON.parse(await readFile(file, "utf8"));
  owner.createdAt = "2000-01-01T00:00:00.000Z"; await writeFile(file, JSON.stringify(owner));
  expect(inspectLocalAgentLock(root, "Autor")).toMatchObject({ state: "pid_present", pid: child.pid });
  const callback = vi.fn(); expect(await withLocalAgentLock(root, "Autor", callback)).toEqual({ acquired: false }); expect(callback).not.toHaveBeenCalled();
  const released = new Promise<void>(resolve => child.on("message", message => { if ((message as {stage?:string}).stage === "released") resolve(); }));
  child.send("release"); await released;
  expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "absent" });
}, 10000);
it.each(["SIGTERM", "SIGKILL"] as const)("cancelamento %s deixa evidência do dono morto e nunca rouba a trava", async signal => {
  const root = await setup(), child = await start(root);
  const file = path.join(lockPath(root), "owner.json"), before = await readFile(file, "utf8");
  await stop(child, signal);
  expect(inspectLocalAgentLock(root, "Autor")).toMatchObject({ state: "pid_missing", pid: child.pid });
  const callback = vi.fn(); expect(await withLocalAgentLock(root, "Autor", callback)).toEqual({ acquired: false }); expect(callback).not.toHaveBeenCalled();
  expect(await readFile(file, "utf8")).toBe(before);
}, 10000);
it("morte local não libera exclusão mesmo com operação remota sintética ainda viva", async () => {
  const root = await setup(), owner = await start(root);
  const remote = spawn(process.execPath, ["-e", "process.send({ready:true});setInterval(()=>{},1000)"], { stdio: ["ignore", "ignore", "ignore", "ipc"] }); children.push(remote);
  await once(remote, "message"); await stop(owner);
  expect(remote.exitCode).toBeNull(); expect(remote.signalCode).toBeNull();
  expect(inspectLocalAgentLock(root, "Autor").state).toBe("pid_missing");
  expect(await withLocalAgentLock(root, "Autor", async () => "duplicate")).toEqual({ acquired: false });
}, 10000);
it("abort cooperativo não solta a trava enquanto o callback ainda pode ter trabalho remoto", async () => {
  const root = await setup(), controller = new AbortController();
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const pending = withLocalAgentLock(root, "Autor", async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); }, { signal: controller.signal });
  await started; controller.abort();
  expect(await withLocalAgentLock(root, "Autor", async () => 2)).toEqual({ acquired: false });
  const failed = expect(pending).rejects.toMatchObject({ name: "AbortError" }); release(); await failed;
  expect(inspectLocalAgentLock(root, "Autor")).toMatchObject({ state: "pid_present", interrupted: true });
  expect(await withLocalAgentLock(root, "Autor", async () => 3)).toEqual({ acquired: false });
});
it("abort prévio não cria trava nem inicia callback", async () => {
  const root = await setup(), controller = new AbortController(); controller.abort(); const callback = vi.fn();
  await expect(withLocalAgentLock(root, "Autor", callback, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(callback).not.toHaveBeenCalled(); expect(await readdir(root)).toEqual([]);
});
it("não remove diretório substituído por outro dono durante o callback", async () => {
  const root = await setup(); let saved = "";
  await expect(withLocalAgentLock(root, "Autor", async () => {
    saved = await readFile(path.join(lockPath(root), "owner.json"), "utf8");
    await rename(lockPath(root), path.join(root, "preserved")); await mkdir(lockPath(root));
    await writeFile(path.join(lockPath(root), "owner.json"), saved.replace(/"token":"[^"]+"/u, '"token":"11111111-1111-4111-8111-111111111111"'));
  })).rejects.toThrow("proprietário");
  expect(inspectLocalAgentLock(root, "Autor").state).toBe("pid_present");
  expect(await readFile(path.join(root, "preserved/owner.json"), "utf8")).toBe(saved);
});
it("arquivos inesperados não são apagados e metadata não é perdida", async () => {
  const root = await setup();
  await expect(withLocalAgentLock(root, "Autor", async () => { await writeFile(path.join(lockPath(root), "unexpected"), "preserve"); })).rejects.toThrow("inesperados");
  expect(await readFile(path.join(lockPath(root), "unexpected"), "utf8")).toBe("preserve");
  expect(inspectLocalAgentLock(root, "Autor").state).toBe("pid_present");
});
it("legado vazio, JSON truncado e symlink permanecem fechados; diagnóstico não revela conteúdo", async () => {
  const root = await setup(); await mkdir(lockPath(root));
  expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "legacy" });
  const file = path.join(lockPath(root), "owner.json"); await writeFile(file, "{private-truncated");
  expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "invalid" });
  await rm(file); const other = path.join(root, "outside"); await writeFile(other, "must-not-read"); await symlink(other, file);
  expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "invalid" });
  expect(await withLocalAgentLock(root, "Autor", async () => 1)).toEqual({ acquired: false });
  expect(await readFile(other, "utf8")).toBe("must-not-read");
});
it("não libera o mesmo inode se o token de ownership mudou", async () => {
  const root = await setup(), file = path.join(lockPath(root), "owner.json");
  await expect(withLocalAgentLock(root, "Autor", async () => {
    const owner = JSON.parse(await readFile(file, "utf8"));
    owner.token = "11111111-1111-4111-8111-111111111111"; await writeFile(file, JSON.stringify(owner));
  })).rejects.toThrow("proprietário");
  expect(JSON.parse(await readFile(file, "utf8")).token).toBe("11111111-1111-4111-8111-111111111111");
});
it("não segue nem remove diretório de trava simbólico", async () => {
  const root = await setup(), target = await setup(); await writeFile(path.join(target, "preserve"), "keep");
  await symlink(target, lockPath(root));
  expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "invalid" });
  expect(await withLocalAgentLock(root, "Autor", async () => 1)).toEqual({ acquired: false });
  expect(await readFile(path.join(target, "preserve"), "utf8")).toBe("keep");
});

it.each(["kill-before-detach", "kill-after-detach"])("morte na liberação atômica: %s", async mode => {
  const root = await setup(), child = await start(root, mode);
  const exited = once(child, "exit"); child.send("release"); await exited;
  expect(child.signalCode).toBe("SIGKILL");
  if (mode === "kill-before-detach") {
    expect(inspectLocalAgentLock(root, "Autor").state).toBe("pid_missing");
    expect(await withLocalAgentLock(root, "Autor", async () => 2)).toEqual({ acquired: false });
  } else {
    expect(inspectLocalAgentLock(root, "Autor")).toEqual({ state: "absent" });
    const artifacts = (await readdir(root)).filter(name => name.startsWith(".dispatch-Autor.lock.released-"));
    expect(artifacts).toHaveLength(1);
    const record = path.join(root, artifacts[0], "owner.json"), before = await readFile(record, "utf8");
    expect(await withLocalAgentLock(root, "Autor", async () => 2)).toEqual({ acquired: true, value: 2 });
    expect(await readFile(record, "utf8")).toBe(before);
  }
}, 10000);
