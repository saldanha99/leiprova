import { readFileSync } from "node:fs";
import { chmod, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  budgetAllows,
  buildPrompt,
  chargeBudget,
  loadBudget,
  parseApiSecret,
  parseCliResult,
  contractForRole,
  contractRejection,
  dedupeMappings,
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
  it("lê produtos de foco", () => {
    expect(readConfig({ EDITORIAL_FOCUS_PRODUCTS: " tj-ba-juiz-2026, mpe-go " }).focus).toEqual(["tj-ba-juiz-2026", "mpe-go"]);
    expect(readConfig({}).focus).toEqual([]);
  });
  it("usa padrões seguros", () => {
    const config = readConfig({});
    expect(config).toMatchObject({ executor: "claude", bin: "claude", slots: { "Guardião": 1, Autor: 2 }, taskTimeoutMs: 25 * 60_000 });
  });
  it.each([
    [{ EDITORIAL_EXECUTOR: "openrouter" }, /claude/],
    [{ EDITORIAL_SLOTS_AUTOR: "9" }, /EDITORIAL_SLOTS_AUTOR/],
    [{ EDITORIAL_TASK_TIMEOUT_MIN: "90" }, /TIMEOUT/],
    [{ EDITORIAL_EXECUTOR_MODEL: "x; rm -rf /" }, /MODEL/],
    [{ EDITORIAL_FOCUS_PRODUCTS: "tj-ba,../x" }, /FOCUS/],
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
    expect(args.join(" ")).toMatch(/--output-format json/);
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
  it("sem rede, não reserva legal_change nem descoberta", async () => {
    const { ROLE_KINDS } = await import("../deploy/editorial-realtime-worker.mjs");
    expect(ROLE_KINDS).toEqual({ "Guardião": "legal_mapping", Autor: "authoring" });
  });
  it("reconhece limite da assinatura", () => {
    expect(isSubscriptionLimit("Claude usage limit reached. Your limit will reset at 3pm")).toBe(true);
    expect(isSubscriptionLimit("You've hit your usage limit")).toBe(true);
    expect(isSubscriptionLimit("Error 429 Too Many Requests")).toBe(true);
    // Mensagem real de 11/11/2026, com saída 0, que o padrão anterior não reconhecia.
    expect(isSubscriptionLimit("You've hit your 5-hour limit · resets 8:50pm (UTC)")).toBe(true);
    expect(isSubscriptionLimit("Your weekly limit resets Monday")).toBe(true);
    expect(isSubscriptionLimit("response.json gravado")).toBe(false);
  });
  it("lê a chave do arquivo privado sem aceitar outras variáveis", () => {
    expect(parseApiSecret("# comentário\nANTHROPIC_API_KEY=sk-ant-test_123\n")).toBe("sk-ant-test_123");
    expect(parseApiSecret('ANTHROPIC_API_KEY="sk-ant-x"')).toBe("sk-ant-x");
    expect(parseApiSecret("OTHER_KEY=abc")).toBeNull();
  });
  it("lê custo e texto do JSON da CLI e ignora saída sem JSON", () => {
    expect(parseCliResult('{"type":"result","is_error":false,"result":"OK","total_cost_usd":0.0123}')).toEqual({ text: "OK", isError: false, cost: 0.0123 });
    expect(parseCliResult('aviso\n{"result":"x","total_cost_usd":-1}')).toEqual({ text: "x", isError: false, cost: null });
    expect(parseCliResult("texto livre")).toBeNull();
  });
  it("orçamento: reserva em andamento, parada preventiva e sem volta automática à API", () => {
    const now = "2026-11-19T22:00:00.000Z";
    let budget = loadBudget(null, { capUsd: 50, stopAtUsd: 48, hasKey: true, now });
    expect(budget).toMatchObject({ mode: "api", spentUsd: 0, runs: 0, exhaustedAt: null });
    expect(budgetAllows(budget, 0, 0.25)).toBe(true);
    expect(budgetAllows({ ...budget, spentUsd: 47.6 }, 0.25, 0.25)).toBe(false);
    budget = chargeBudget(budget, "Guardião", 0.02, 0.25, now);
    budget = chargeBudget(budget, "Autor", null, 0.25, now);
    expect(budget).toMatchObject({ spentUsd: 0.27, runs: 2, unmeteredRuns: 1,
      byRole: { "Guardião": { runs: 1, spentUsd: 0.02 }, Autor: { runs: 1, spentUsd: 0.25 } } });
    budget = chargeBudget({ ...budget, spentUsd: 47.9 }, "Autor", 0.2, 0.25, now);
    expect(budget).toMatchObject({ mode: "subscription", exhaustedAt: now });
    expect(budgetAllows(budget, 0, 0)).toBe(false);
    const reloaded = loadBudget(JSON.parse(JSON.stringify(budget)), { capUsd: 50, stopAtUsd: 48, hasKey: true, now });
    expect(reloaded).toMatchObject({ mode: "subscription", exhaustedAt: now, spentUsd: 48.1 });
    expect(loadBudget(null, { capUsd: 50, stopAtUsd: 48, hasKey: false, now }).mode).toBe("subscription");
  });
  it("envia ao Guardião só o formato e ao Autor também as conferências", () => {
    const doc = "# Contrato\n\n**Conferência** X\n\n## Recortes retidos\n\nY\n\n## Responsabilidades\n\nZ\n\n## Formato de response.json\n\nF\n\n## Inspeção\n\nI\n";
    expect(contractForRole(doc, "Guardião")).toBe("# Contrato\n\n## Formato de response.json\n\nF\n");
    const autor = contractForRole(doc, "Autor");
    expect(autor).toContain("**Conferência** X");
    expect(autor).toContain("## Recortes retidos");
    expect(autor).toContain("## Formato de response.json\n\nF");
    expect(autor).not.toContain("Responsabilidades");
    expect(autor).not.toContain("Inspeção");
    expect(contractForRole("# Sem formato\n", "Guardião")).toBe("# Sem formato\n");
  });
  it("mantém um vínculo por artigo, na ordem da resposta", () => {
    const response = { outcome: "prepared", mappings: [{ articleId: 2, quote: "a" }, { articleId: 1, quote: "b" }, { articleId: 2, quote: "c" }] };
    expect(dedupeMappings(response)).toEqual({ dropped: 1, response: { outcome: "prepared", mappings: [{ articleId: 2, quote: "a" }, { articleId: 1, quote: "b" }] } });
    expect(dedupeMappings({ outcome: "blocked" })).toEqual({ dropped: 0, response: { outcome: "blocked" } });
  });
  it("lê só o motivo fixo da recusa do contrato", () => {
    expect(contractRejection("x\ncontract_rejected: Mapeamento duplicado.\nOperação editorial não concluída.")).toBe("Mapeamento duplicado.");
    expect(contractRejection("Operação editorial não concluída.")).toBeNull();
  });
  it("lê JSON estrito, tolera cerca acidental e recusa texto livre", () => {
    expect(parseResponseFile('```json\n{"outcome":"prepared"}\n```')).toEqual({ outcome: "prepared" });
    expect(() => parseResponseFile("Aqui está: {}")).toThrow();
    expect(() => parseResponseFile("[]")).toThrow();
  });
});

// Ponta a ponta com docker e CLI simulados (scripts bash): roda no Linux/VPS.
describe.skipIf(process.platform === "win32")("main com ponte e CLI simuladas", () => {
  async function setup(executorScript: string, probeScript = "echo OK; exit 0") {
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
    // A sonda de disponibilidade recebe "Responda apenas: OK"; probeScript decide a resposta dela.
    await writeFile(path.join(bin, "claude"), `#!/usr/bin/env bash
input=$(cat)
if [ "$input" = "Responda apenas: OK" ]; then ${probeScript}; fi
${executorScript}
`);
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

  it("conclusão aplicada com falha posterior é recuperada por replay, sem nova autoria", async () => {
    const { dir, env, restore } = await setup(`cat >/dev/null; n=$(cat calls 2>/dev/null || echo 0); echo $((n+1)) > calls; echo '{"outcome":"prepared"}' > response.json`);
    // Primeira conclusão sai com erro (follow-up falhou); a repetição devolve o recibo.
    const docker = path.join(dir, "bin/docker");
    await writeFile(docker, (await readFile(docker, "utf8")).replace(
      `*--mode=complete*) cat > "${dir}/completed.json";`,
      `*--mode=complete*) cat > "${dir}/completed.json"; if [ ! -f "${dir}/failed" ]; then touch "${dir}/failed"; exit 1; fi;`));
    try { await main(env); } finally { restore(); }
    expect(await readFile(path.join(dir, "state/runs/autor", lease, "calls"), "utf8")).toBe("1\n");
    const events = await readFile(path.join(dir, "state/events.jsonl"), "utf8");
    expect(events).toMatch(/complete_retry/);
    expect(events).toMatch(/"state":"prepared"/);
  });

  it("limite na sonda pausa tudo sem reservar nenhuma tarefa", async () => {
    const limited = `echo "You've hit your 5-hour limit · resets 8:50pm (UTC)"; exit 0`;
    const { dir, env, restore } = await setup(limited, limited);
    try { await main(env); } finally { restore(); }
    await expect(readFile(path.join(dir, "claimed"))).rejects.toThrow();
    await expect(readFile(path.join(dir, "completed.json"))).rejects.toThrow();
    const events = await readFile(path.join(dir, "state/events.jsonl"), "utf8");
    expect(events).toMatch(/subscription_limited/);
    expect(events).not.toMatch(/"claimed"/);
  });

  it("limite durante a tarefa com saída 0 pausa sem repetir a CLI", async () => {
    const { dir, env, restore } = await setup(
      `n=$(cat calls 2>/dev/null || echo 0); echo $((n+1)) > calls; echo "You've hit your 5-hour limit · resets 8:50pm (UTC)"; exit 0`);
    try { await main({ ...env, EDITORIAL_EXECUTOR_ATTEMPTS: "2" }); } finally { restore(); }
    expect(await readFile(path.join(dir, "state/runs/autor", lease, "calls"), "utf8")).toBe("1\n");
    await expect(readFile(path.join(dir, "completed.json"))).rejects.toThrow();
    const events = await readFile(path.join(dir, "state/events.jsonl"), "utf8");
    expect(events).toMatch(/subscription_limited/);
    expect(events).not.toMatch(/no_valid_response/);
  });

  it("instância Codex paralela: login próprio, trava da ponte e gatilho da instância principal", async () => {
    const { dir, env, restore } = await setup("");
    // Codex simulado: registra o ambiente recebido e grava a resposta.
    const codex = path.join(dir, "bin/codex");
    await writeFile(codex, `#!/usr/bin/env bash
input=$(cat)
if [ "$input" = "Responda apenas: OK" ]; then echo OK; exit 0; fi
echo "CODEX_HOME=$CODEX_HOME ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY:-none} ARGS=$*" > "${dir}/codex-env"
echo '{"schemaVersion":1,"outcome":"prepared"}' > response.json
`);
    await chmod(codex, 0o755);
    // Uma chave existente no caminho padrão não pode chegar ao Codex.
    const secret = path.join(dir, "secret");
    await writeFile(secret, "ANTHROPIC_API_KEY=sk-ant-should-not-leak\n");
    const mainState = path.join(dir, "main-state");
    await import("node:fs/promises").then((fs) => fs.mkdir(mainState));
    const docker = path.join(dir, "bin/docker");
    // A ponte só roda com a trava compartilhada segura (flock mantém o descritor aberto).
    await writeFile(docker, (await readFile(docker, "utf8")).replace("case \"$*\" in",
      `if flock -n "${mainState}/bridge.lock" true; then echo "lock livre durante a ponte" >> "${dir}/lock-violations"; fi\ncase "$*" in`));
    try {
      await main({ ...env, EDITORIAL_EXECUTOR: "codex", EDITORIAL_EXECUTOR_BIN: codex, EDITORIAL_EXECUTOR_MODEL: "gpt-6-luna",
        EDITORIAL_API_SECRET_FILE: secret, CODEX_HOME: path.join(dir, "codex-home"),
        EDITORIAL_RELEASE_TRIGGER_FILE: path.join(mainState, "release.trigger"),
        EDITORIAL_BRIDGE_LOCK_FILE: path.join(mainState, "bridge.lock") });
    } finally { restore(); }
    expect(await readFile(path.join(dir, "codex-env"), "utf8")).toBe(
      `CODEX_HOME=${path.join(dir, "codex-home")} ANTHROPIC_API_KEY=none ARGS=exec --sandbox workspace-write --skip-git-repo-check -C . -m gpt-6-luna -\n`);
    await expect(readFile(path.join(dir, "lock-violations"))).rejects.toThrow();
    // Gatilho no arquivo da instância principal; heartbeat e orçamento no estado próprio.
    expect(JSON.parse(await readFile(path.join(mainState, "release.trigger"), "utf8"))).toMatchObject({ jobKey: "author:1", imported: 2 });
    await expect(readFile(path.join(dir, "state/release.trigger"))).rejects.toThrow();
    expect(JSON.parse(await readFile(path.join(dir, "state/heartbeat.json"), "utf8"))).toHaveProperty("pid", process.pid);
    expect(JSON.parse(await readFile(path.join(dir, "state/api-budget.json"), "utf8"))).toMatchObject({ mode: "subscription", spentUsd: 0 });
    await expect(readFile(path.join(mainState, "heartbeat.json"))).rejects.toThrow();
  });
});

describe("unidade Codex paralela", () => {
  const unit = readFileSync(new URL("../deploy/systemd/leiprova-editorial-codex.service", import.meta.url), "utf8");
  const envFile = readFileSync(new URL("../deploy/systemd/editorial-codex.env.example", import.meta.url), "utf8");
  const installer = readFileSync(new URL("../deploy/install-editorial-codex.sh", import.meta.url), "utf8");
  it("estado próprio, sem chave da API e com o mesmo worker", () => {
    expect(unit).toContain("Environment=EDITORIAL_REALTIME_STATE_DIR=/var/lib/leiprova-codex");
    expect(unit).toContain("StateDirectory=leiprova-codex");
    expect(unit).toContain("Environment=EDITORIAL_API_SECRET_FILE=/nonexistent/");
    expect(unit).toContain("ExecStart=/usr/bin/env node /opt/leiprova/deploy/editorial-realtime-worker.mjs");
    expect(unit).not.toMatch(/leiprova-realtime\b(?!\/release\.trigger)/u);
  });
  it("só Autor, 2 vagas, gpt-6-luna, login e gatilho/trava compartilhados", () => {
    const config = readConfig(Object.fromEntries(envFile.split("\n").filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])));
    expect(config).toMatchObject({ executor: "codex", model: "gpt-6-luna", slots: { "Guardião": 0, Autor: 2 },
      codexHome: "/var/lib/leiprova-codex/codex-home",
      releaseTriggerFile: "/var/lib/leiprova-realtime/release.trigger",
      bridgeLockFile: "/var/lib/leiprova-realtime/bridge.lock" });
    expect(envFile).not.toMatch(/ANTHROPIC|OPENAI_API_KEY|sk-/u);
  });
  it("instalador não liga, não inicia e não faz login", () => {
    const commands = installer.split("\n").filter((line) => !line.trimStart().startsWith("#")).join("\n");
    expect(commands).not.toMatch(/codex login|editorial-realtime\.env|api-budget/u);
    expect(installer).not.toMatch(/systemctl (enable|start|restart)(?! --now "\$UNIT" \|\| true)/u);
  });
  it("valida os caminhos novos", () => {
    expect(readConfig({}).releaseTriggerFile).toBe("/var/lib/leiprova-realtime/release.trigger");
    expect(readConfig({}).bridgeLockFile).toBe("");
    expect(() => readConfig({ EDITORIAL_BRIDGE_LOCK_FILE: "relativo/lock" })).toThrow(/EDITORIAL_BRIDGE_LOCK_FILE/);
    expect(() => readConfig({ EDITORIAL_RELEASE_TRIGGER_FILE: "/var/lib/../etc/x" })).toThrow(/EDITORIAL_RELEASE_TRIGGER_FILE/);
    expect(() => readConfig({ CODEX_HOME: "/tmp/a b" })).toThrow(/CODEX_HOME/);
  });
});
