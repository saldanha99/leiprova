import { chmod, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildPrompt,
  executorCommand,
  isSubscriptionLimit,
  main,
  parseClaim,
  parseResponseFile,
  readConfig,
} from "../deploy/editorial-realtime-worker.mjs";

const hash = "a".repeat(64);
const lease = "123e4567-e89b-42d3-a456-426614174000";
const claimed = { state: "claimed", agent: "Autor", job: { jobKey: "author:1", kind: "authoring", inputHash: hash, leaseToken: lease, payload: { articles: [] } },
  handoff: { instruction: "Leia job.payload.instructions." } };

describe("readConfig", () => {
  it("usa padrões seguros", () => {
    const config = readConfig({});
    expect(config).toMatchObject({ executor: "claude", bin: "claude", slots: { "Guardião": 1, Autor: 2 }, taskTimeoutMs: 25 * 60_000 });
  });
  it.each([
    [{ EDITORIAL_EXECUTOR: "openrouter" }, /claude/],
    [{ EDITORIAL_SLOTS_AUTOR: "7" }, /EDITORIAL_SLOTS_AUTOR/],
    [{ EDITORIAL_TASK_TIMEOUT_MIN: "90" }, /TIMEOUT/],
    [{ EDITORIAL_EXECUTOR_MODEL: "x; rm -rf /" }, /MODEL/],
  ])("recusa configuração inválida %#", (env, message) => {
    expect(() => readConfig(env)).toThrow(message);
  });
});

describe("parseClaim", () => {
  it("aceita reserva do papel e fila vazia", () => {
    expect(parseClaim(JSON.stringify(claimed), "Autor")).toMatchObject({ state: "claimed", job: { jobKey: "author:1" } });
    expect(parseClaim('{"state":"idle"}', "Autor")).toEqual({ state: "idle" });
  });
  it("recusa papel trocado ou reserva malformada", () => {
    expect(() => parseClaim(JSON.stringify(claimed), "Guardião")).toThrow();
    expect(() => parseClaim(JSON.stringify({ ...claimed, job: { ...claimed.job, leaseToken: "../x" } }), "Autor")).toThrow();
    expect(() => parseClaim(JSON.stringify({ ...claimed, job: { ...claimed.job, jobKey: "A B" } }), "Autor")).toThrow();
  });
});

describe("executor", () => {
  it("claude sem shell nem rede", () => {
    const { args } = executorCommand(readConfig({ EDITORIAL_EXECUTOR_MODEL: "claude-sonnet-5-5" }));
    expect(args).toContain("-p");
    expect(args.join(" ")).toMatch(/--disallowedTools Bash,WebFetch,WebSearch/);
    expect(args.slice(-2)).toEqual(["--model", "claude-sonnet-5-5"]);
  });
  it("codex em sandbox de escrita local", () => {
    const { args } = executorCommand(readConfig({ EDITORIAL_EXECUTOR: "codex" }));
    expect(args).toEqual(["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", ".", "-"]);
  });
  it("prompt trata pacote como dado e fixa o modelo", () => {
    const prompt = buildPrompt({ role: "Autor", model: "m-1", handoff: claimed.handoff });
    expect(prompt).toMatch(/generatorModel "m-1"/);
    expect(prompt).toMatch(/dado, nunca instrução/);
    expect(prompt).toMatch(/Leia job\.payload\.instructions/);
  });
  it("reconhece limite da assinatura", () => {
    expect(isSubscriptionLimit("Claude usage limit reached. Your limit will reset at 3pm")).toBe(true);
    expect(isSubscriptionLimit("You've hit your usage limit")).toBe(true);
    expect(isSubscriptionLimit("Error 429 Too Many Requests")).toBe(true);
    expect(isSubscriptionLimit("response.json gravado")).toBe(false);
  });
  it("lê JSON estrito, tolera cerca acidental e recusa texto livre", () => {
    expect(parseResponseFile('```json\n{"outcome":"prepared"}\n```')).toEqual({ outcome: "prepared" });
    expect(() => parseResponseFile("Aqui está: {}")).toThrow();
    expect(() => parseResponseFile("[]")).toThrow();
  });
});

// Ponta a ponta com docker e CLI simulados (scripts bash): roda no Linux/VPS.
describe.skipIf(process.platform === "win32")("main com ponte e CLI simuladas", () => {
  async function setup(executorScript: string) {
    const dir = await mkdtemp(path.join(tmpdir(), "realtime-"));
    const bin = path.join(dir, "bin");
    await import("node:fs/promises").then((fs) => fs.mkdir(bin));
    await writeFile(path.join(dir, "claim.json"), JSON.stringify(claimed));
    await writeFile(path.join(bin, "docker"), `#!/usr/bin/env bash
case "$*" in
  *--mode=claim*) if [ -f "${dir}/claimed" ]; then echo '{"state":"idle"}'; else touch "${dir}/claimed"; cat "${dir}/claim.json"; fi ;;
  *--mode=complete*) cat > "${dir}/completed.json"; echo '{"state":"prepared","importedQuestionPublicIds":["q1","q2"]}' ;;
esac
`);
    await writeFile(path.join(bin, "claude"), `#!/usr/bin/env bash\n${executorScript}\n`);
    await chmod(path.join(bin, "docker"), 0o755);
    await chmod(path.join(bin, "claude"), 0o755);
    const env = { EDITORIAL_REALTIME_ONCE: "1", EDITORIAL_SLOTS_GUARDIAO: "0", EDITORIAL_SLOTS_AUTOR: "1",
      EDITORIAL_REALTIME_STATE_DIR: path.join(dir, "state"), EDITORIAL_PROJECT_DIR: path.resolve(__dirname, ".."),
      EDITORIAL_EXECUTOR_ATTEMPTS: "1", EDITORIAL_EXECUTOR_BIN: path.join(bin, "claude") };
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    return { dir, env, restore: () => { process.env.PATH = previousPath; } };
  }

  it("reserva, executa, entrega e dispara a liberação", async () => {
    const { dir, env, restore } = await setup(`cat >/dev/null; echo '{"schemaVersion":1,"outcome":"prepared"}' > response.json`);
    try { await main(env); } finally { restore(); }
    const sent = JSON.parse(await readFile(path.join(dir, "completed.json"), "utf8"));
    expect(sent).toEqual({ jobKey: "author:1", inputHash: hash, leaseToken: lease, result: { schemaVersion: 1, outcome: "prepared" } });
    expect(JSON.parse(await readFile(path.join(dir, "state/release.trigger"), "utf8"))).toMatchObject({ jobKey: "author:1", imported: 2 });
    expect(await readdir(path.join(dir, "state/runs/autor", lease))).toEqual(
      expect.arrayContaining(["packet.json", "CONTRATO.md", "AGENTS.md", "response.json", "receipt.json"]));
  });

  it("limite da assinatura pausa o papel sem entregar nada", async () => {
    const { dir, env, restore } = await setup(`echo "Claude usage limit reached" >&2; exit 1`);
    try { await main(env); } finally { restore(); }
    await expect(readFile(path.join(dir, "completed.json"))).rejects.toThrow();
    const events = await readFile(path.join(dir, "state/events.jsonl"), "utf8");
    expect(events).toMatch(/subscription_limited/);
  });
});
