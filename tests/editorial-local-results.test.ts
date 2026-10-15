import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { settleLocalAgentResults } from "@/lib/editorial/local-agent-results";
import { withLocalAgentLock } from "@/lib/editorial/local-agent-dispatch";
import { writePrivateFileAtomically } from "@/lib/editorial/atomic-private-file";

const roots: string[] = [];
async function setup(agent = "Autor") {
  const root = await mkdtemp(path.join(tmpdir(), "editalume-settle-")); roots.push(root);
  const dir = path.join(root, "11111111-1111-4111-8111-111111111111"); await mkdir(dir);
  await writeFile(path.join(dir, "packet.json"), JSON.stringify({ agent }));
  await writeFile(path.join(dir, "response.json"), JSON.stringify({ publicationAllowed: false }));
  return { root, dir };
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
describe("recolhimento local de respostas", () => {
  it("encaminha somente o papel escolhido à validação completa da ponte", async () => {
    const { root, dir } = await setup(); const complete = vi.fn().mockResolvedValue({});
    expect(await settleLocalAgentResults(root, "Guardião", complete)).toEqual({ attempted: 0, completed: 0, failed: 0 });
    expect(await settleLocalAgentResults(root, "Autor", complete)).toEqual({ attempted: 1, completed: 1, failed: 0 });
    expect(complete).toHaveBeenCalledWith(path.join(dir, "packet.json"));
  });
  it("recibo replayed evita nova conclusão e não volta a contar a tentativa", async () => {
    const { root, dir } = await setup(); await writePrivateFileAtomically(path.join(dir, "receipt.json"), JSON.stringify({ state: "prepared", replayed: true }));
    const complete = vi.fn();
    expect(await settleLocalAgentResults(root, "Autor", complete)).toEqual({ attempted: 0, completed: 0, failed: 0 });
    expect(await settleLocalAgentResults(root, "Autor", complete)).toEqual({ attempted: 0, completed: 0, failed: 0 });
    expect(complete).not.toHaveBeenCalled();
  });
  it("limita falhas a três tentativas por conteúdo", async () => {
    const { root, dir } = await setup(); const complete = vi.fn().mockRejectedValue(new Error("segredo que não deve ser persistido"));
    for (let i = 0; i < 5; i++) await settleLocalAgentResults(root, "Autor", complete);
    expect(complete).toHaveBeenCalledTimes(3);
    expect(await readFile(path.join(dir, "settlement.json"), "utf8")).not.toContain("segredo");
  });
  it("não segue links simbólicos de resposta", async () => {
    const { root, dir } = await setup(); await rm(path.join(dir, "response.json"));
    await symlink(path.join(dir, "packet.json"), path.join(dir, "response.json"));
    const complete = vi.fn(); await settleLocalAgentResults(root, "Autor", complete); expect(complete).not.toHaveBeenCalled();
  });
  it("ignora arquivo parcial e recusa papel desconhecido", async () => {
    const { root, dir } = await setup(); await writeFile(path.join(dir, "packet.json"), "{");
    const complete = vi.fn(); await settleLocalAgentResults(root, "Autor", complete); expect(complete).not.toHaveBeenCalled();
    await expect(settleLocalAgentResults(root, "Forge", complete)).rejects.toThrow("Papel incompatível");
  });
  it("diagnostica marcador vazio/corrompido com código seguro e falha fechado", async () => {
    const { root, dir } = await setup(); const complete = vi.fn(); const diagnostics: string[] = [];
    const marker = path.join(dir, "settlement.json");
    await writeFile(marker, "");
    expect(await settleLocalAgentResults(root, "Autor", complete, 3, undefined, event => diagnostics.push(event)))
      .toEqual({ attempted: 0, completed: 0, failed: 0 });
    expect(diagnostics).toEqual(["settlement_marker_empty"]);
    await writeFile(marker, '{"digest":"partial"');
    diagnostics.length = 0;
    await settleLocalAgentResults(root, "Autor", complete, 3, undefined, event => diagnostics.push(event));
    expect(diagnostics).toEqual(["settlement_marker_invalid"]);
    expect(complete).not.toHaveBeenCalled();
  });
  it("não conclui quando a tentativa não pode ser gravada atomicamente", async () => {
    const { root } = await setup(); const complete = vi.fn(); const diagnostics: string[] = [];
    const failWrite = vi.fn(async () => { throw new Error("private path unavailable"); });
    expect(await settleLocalAgentResults(root, "Autor", complete, 3, failWrite, event => diagnostics.push(event)))
      .toEqual({ attempted: 0, completed: 0, failed: 0 });
    expect(failWrite).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(diagnostics).toEqual(["settlement_marker_write_failed"]);
  });
  it("processa três respostas e não chama uma quarta conclusão no limite", async () => {
    const { root } = await setup();
    for (let index = 2; index <= 4; index++) {
      const dir = path.join(root, `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`);
      await mkdir(dir);
      await writeFile(path.join(dir, "packet.json"), JSON.stringify({ agent: "Autor" }));
      await writeFile(path.join(dir, "response.json"), JSON.stringify({ response: index }));
    }
    const complete = vi.fn().mockResolvedValue({ state: "prepared" });
    expect(await settleLocalAgentResults(root, "Autor", complete, 3)).toEqual({ attempted: 3, completed: 3, failed: 0 });
    expect(complete).toHaveBeenCalledTimes(3);
  });
  it("limita falhas de gravação separadamente e não chama complete", async () => {
    const { root } = await setup();
    for (let index = 2; index <= 4; index++) {
      const dir = path.join(root, `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`);
      await mkdir(dir);
      await writeFile(path.join(dir, "packet.json"), JSON.stringify({ agent: "Autor" }));
      await writeFile(path.join(dir, "response.json"), JSON.stringify({ response: index }));
    }
    const failWrite = vi.fn(async () => { throw new Error("private path unavailable"); });
    const complete = vi.fn();
    expect(await settleLocalAgentResults(root, "Autor", complete, 3, failWrite)).toEqual({ attempted: 0, completed: 0, failed: 0 });
    expect(failWrite).toHaveBeenCalledTimes(3);
    expect(complete).not.toHaveBeenCalled();
  });
  it("serializa recolhimentos concorrentes e persiste tentativas antes da conclusão", async () => {
    const { root } = await setup(); let conclusions = 0;
    const complete = vi.fn(async () => { conclusions++; await new Promise(resolve => setTimeout(resolve, 10)); return { state: "prepared" }; });
    const settle = () => withLocalAgentLock(root, "Autor", () => settleLocalAgentResults(root, "Autor", complete));
    const results = await Promise.all([settle(), settle()]);
    expect(conclusions).toBe(1);
    expect(results.filter(result => result.acquired && result.value?.completed === 1)).toHaveLength(1);
    const marker = JSON.parse(await readFile(path.join(root, "11111111-1111-4111-8111-111111111111", "settlement.json"), "utf8"));
    expect(marker.attempts).toBe(1);
  });
});
