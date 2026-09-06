import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { settleLocalAgentResults } from "@/lib/editorial/local-agent-results";

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
  it("não repete uma entrega com recibo", async () => {
    const { root, dir } = await setup(); await writeFile(path.join(dir, "receipt.json"), "{}");
    const complete = vi.fn(); await settleLocalAgentResults(root, "Autor", complete); expect(complete).not.toHaveBeenCalled();
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
});
