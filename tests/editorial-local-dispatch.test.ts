import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { hasPendingLocalAgentLease, withLocalAgentLock } from "@/lib/editorial/local-agent-dispatch";

const roots: string[] = [];
async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "editalume-dispatch-")); roots.push(root);
  const dir = path.join(root, "11111111-1111-4111-8111-111111111111"); await mkdir(dir);
  await writeFile(path.join(dir, "packet.json"), JSON.stringify({ agent: "Autor", job: { leaseExpiresAt: "2026-09-07T03:00:00Z" } }));
  return { root, dir };
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
it("serializa disparos concorrentes do mesmo papel", async () => {
  const { root } = await setup();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const pending = withLocalAgentLock(root, "Autor", async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); return 1; });
  await started;
  const duplicate = vi.fn();
  expect(await withLocalAgentLock(root, "Autor", duplicate)).toEqual({ acquired: false });
  expect(duplicate).not.toHaveBeenCalled();
  expect(await withLocalAgentLock(root, "Radar", async () => 2)).toEqual({ acquired: true, value: 2 });
  release(); expect(await pending).toEqual({ acquired: true, value: 1 });
  expect(await withLocalAgentLock(root, "Autor", async () => 3)).toEqual({ acquired: true, value: 3 });
});
it("libera a trava quando o processo retorna erro", async () => {
  const { root } = await setup();
  await expect(withLocalAgentLock(root, "Autor", async () => { throw new Error("falha"); })).rejects.toThrow("falha");
  expect((await withLocalAgentLock(root, "Autor", async () => 1)).acquired).toBe(true);
});
it("não rouba trava abandonada nem aceita papel desconhecido", async () => {
  const { root } = await setup(); await mkdir(path.join(root, ".dispatch-Autor.lock"));
  expect((await withLocalAgentLock(root, "Autor", async () => 1)).acquired).toBe(false);
  await expect(withLocalAgentLock(root, "Forge", async () => 1)).rejects.toThrow("Papel incompatível");
});
it("não reserva outro trabalho enquanto o pacote estiver ativo, mesmo com resposta pronta", async () => {
  const { root, dir } = await setup(); const now = Date.parse("2026-09-07T02:00:00Z");
  expect(await hasPendingLocalAgentLease([root], "Autor", now)).toBe(true);
  await writeFile(path.join(dir, "response.json"), "{}");
  expect(await hasPendingLocalAgentLease([root], "Autor", now)).toBe(true);
  expect(await hasPendingLocalAgentLease([root], "Guardião", now)).toBe(false);
  expect(await hasPendingLocalAgentLease([root], "Autor", now + 3600000)).toBe(false);
  await writeFile(path.join(dir, "receipt.json"), "{}");
  expect(await hasPendingLocalAgentLease([root], "Autor", now)).toBe(false);
});
it("consulta também fila legada e não segue diretório simbólico", async () => {
  const { root, dir } = await setup(); const other = await setup();
  await rm(path.join(other.dir, "packet.json"));
  await symlink(dir, path.join(other.root, "22222222-2222-4222-8222-222222222222"));
  const now = Date.parse("2026-09-07T02:00:00Z");
  expect(await hasPendingLocalAgentLease([other.root], "Autor", now)).toBe(false);
  expect(await hasPendingLocalAgentLease([other.root, root], "Autor", now)).toBe(true);
});
it("falha fechado diante de pacote parcial ou simbólico", async () => {
  const { root, dir } = await setup(); const file = path.join(dir, "packet.json");
  await writeFile(file, "{"); await expect(hasPendingLocalAgentLease([root], "Autor")).rejects.toThrow();
  await rm(file); await symlink(path.join(dir, "response.json"), file);
  await expect(hasPendingLocalAgentLease([root], "Autor")).rejects.toThrow("Arquivo de reserva inválido");
});
