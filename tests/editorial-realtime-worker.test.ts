import { readFileSync } from "node:fs";
import { chmod, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  budgetAllows,
  budgetMonth,
  buildPrompt,
  chargeBudget,
  codexShouldRun,
  loadBudget,
  rolloverBudget,
  parseApiSecret,
  parseOauthToken,
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
import { decideCodex, main as codexSwitchMain } from "../deploy/editorial-codex-switch.mjs";

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
  it("sem rede: descoberta pelo Radar e alteração legal pelo Guardião, ambas com captura/diff feitos pelo servidor", async () => {
    const { ROLE_KINDS } = await import("../deploy/editorial-realtime-worker.mjs");
    expect(ROLE_KINDS).toEqual({ "Guardião": "legal_mapping,legal_change", Autor: "authoring", Radar: "discovery" });
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
  it("lê o token da assinatura alternativa e recusa outros formatos", () => {
    const token = "sk-ant-oat01-" + "a".repeat(40);
    expect(parseOauthToken(`${token}\n`)).toBe(token);
    expect(parseOauthToken(`CLAUDE_CODE_OAUTH_TOKEN="${token}"`)).toBe(token);
    expect(parseOauthToken("ANTHROPIC_API_KEY=sk-ant-api03-xyz")).toBeNull();
    expect(parseOauthToken("")).toBeNull();
  });
  it("token vencido ou a menos de 2 min do vencimento vale como ausente", () => {
    const token = "sk-ant-oat01-" + "b".repeat(40);
    const now = 1_800_000_000_000;
    expect(parseOauthToken(`CLAUDE_CODE_OAUTH_TOKEN=${token}\nEXPIRES_AT=${now + 3_600_000}\n`, now)).toBe(token);
    expect(parseOauthToken(`CLAUDE_CODE_OAUTH_TOKEN=${token}\nEXPIRES_AT=${now + 60_000}\n`, now)).toBeNull();
    expect(parseOauthToken(`CLAUDE_CODE_OAUTH_TOKEN=${token}\nEXPIRES_AT=${now - 1}\n`, now)).toBeNull();
  });
  it("arquivo de token é opcional e precisa ser caminho absoluto", () => {
    expect(readConfig({}).oauthTokenFile).toBe("");
    expect(readConfig({ EDITORIAL_OAUTH_TOKEN_FILE: "/etc/leiprova/editorial-oauth.secret" }).oauthTokenFile)
      .toBe("/etc/leiprova/editorial-oauth.secret");
    expect(() => readConfig({ EDITORIAL_OAUTH_TOKEN_FILE: "token.txt" })).toThrow();
  });
  it("lê custo e texto do JSON da CLI e ignora saída sem JSON", () => {
    expect(parseCliResult('{"type":"result","is_error":false,"result":"OK","total_cost_usd":0.0123}')).toEqual({ text: "OK", isError: false, cost: 0.0123 });
    expect(parseCliResult('aviso\n{"result":"x","total_cost_usd":-1}')).toEqual({ text: "x", isError: false, cost: null });
    expect(parseCliResult("texto livre")).toBeNull();
  });
  it("orçamento: reserva em andamento e parada em 100% (US$ 50) sem passar do teto", () => {
    const now = "2026-11-19T22:00:00.000Z";
    expect(readConfig({})).toMatchObject({ apiCapUsd: 50, apiStopUsd: 50, apiRunReserveUsd: 0.25 });
    let budget = loadBudget(null, { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true, now });
    expect(budget).toMatchObject({ mode: "api", month: "2026-11", spentUsd: 0, runs: 0, exhaustedAt: null, history: [] });
    expect(budgetAllows(budget, 0, 0.25)).toBe(true);
    // 49,40 gastos + 2 execuções em andamento (0,50) + a nova (0,25) = 50,15: não cabe.
    expect(budgetAllows({ ...budget, spentUsd: 49.4 }, 0.5, 0.25)).toBe(false);
    expect(budgetAllows({ ...budget, spentUsd: 49.4 }, 0.25, 0.25)).toBe(true);
    budget = chargeBudget(budget, "Guardião", 0.02, 0.25, now);
    budget = chargeBudget(budget, "Autor", null, 0.25, now);
    expect(budget).toMatchObject({ spentUsd: 0.27, runs: 2, unmeteredRuns: 1,
      byRole: { "Guardião": { runs: 1, spentUsd: 0.02 }, Autor: { runs: 1, spentUsd: 0.25 } } });
    // Em 48 não para mais: a antiga parada preventiva saiu.
    budget = chargeBudget({ ...budget, spentUsd: 47.9 }, "Autor", 0.2, 0.25, now);
    expect(budget).toMatchObject({ mode: "api", exhaustedAt: null, spentUsd: 48.1 });
    // Esgota quando não cabe mais nenhuma reserva antes de US$ 50.
    budget = chargeBudget({ ...budget, spentUsd: 49.6 }, "Autor", 0.2, 0.25, now);
    expect(budget).toMatchObject({ mode: "subscription", exhaustedAt: now, spentUsd: 49.8 });
    expect(budgetAllows(budget, 0, 0)).toBe(false);
    const reloaded = loadBudget(JSON.parse(JSON.stringify(budget)), { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true, now });
    expect(reloaded).toMatchObject({ mode: "subscription", exhaustedAt: now, spentUsd: 49.8 });
    expect(loadBudget(null, { capUsd: 50, stopAtUsd: 50, hasKey: false, now }).mode).toBe("subscription");
  });
  it("simula vagas concorrentes: o total cobrado nunca passa de US$ 50", () => {
    const now = "2026-11-25T10:00:00.000Z";
    let budget = loadBudget({ spentUsd: 45 }, { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true, now });
    let inflight = 0;
    const running: number[] = [];
    for (let tick = 0; tick < 500; tick += 1) {
      // 8 vagas tentam abrir uma execução a cada passo; cada uma custa até a reserva.
      while (running.length < 8 && budgetAllows(budget, inflight, 0.25)) { running.push(0.25 - (tick % 5) * 0.01); inflight += 0.25; }
      const cost = running.shift();
      if (cost === undefined) break;
      inflight -= 0.25;
      budget = chargeBudget(budget, "Autor", cost, 0.25, now);
      expect(budget.spentUsd).toBeLessThanOrEqual(50);
    }
    expect(budget).toMatchObject({ mode: "subscription", exhaustedAt: now });
    expect(budget.spentUsd).toBeGreaterThan(49.5);
  });
  it("migra o arquivo antigo (sem month, parada 48) como mês corrente e reabre até a nova parada", () => {
    const now = "2026-11-21T12:00:00.000Z";
    const production = { capUsd: 50, stopAtUsd: 48, spentUsd: 41.935233, runs: 3331, unmeteredRuns: 0,
      byRole: { Autor: { runs: 1433, spentUsd: 22.835769 } }, mode: "api", exhaustedAt: null, updatedAt: "2026-11-21T01:14:39.530Z" };
    const migrated = loadBudget(production, { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true, now });
    expect(migrated).toMatchObject({ month: "2026-11", stopAtUsd: 50, spentUsd: 41.935233, runs: 3331, mode: "api", history: [] });
    // Esgotado pela regra antiga de US$ 48: com a parada em 50, volta à API até 50.
    const exhaustedAt48 = { ...production, spentUsd: 48.01, mode: "subscription", exhaustedAt: "2026-11-21T05:00:00.000Z" };
    expect(loadBudget(exhaustedAt48, { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true, now }))
      .toMatchObject({ mode: "api", exhaustedAt: null, spentUsd: 48.01 });
    // Parada manual (exhaustedAt gravado à mão, mesma parada) continua respeitada no mês.
    const manual = { ...migrated, exhaustedAt: "2026-11-21T06:00:00.000Z" };
    expect(loadBudget(manual, { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true, now })).toMatchObject({ mode: "subscription" });
  });
  it("virada do mês UTC: zera o gasto, volta à API e guarda o histórico", () => {
    const opts = { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true };
    expect(budgetMonth("2026-11-30T23:59:59.999Z")).toBe("2026-11");
    expect(budgetMonth("2026-12-01T00:00:00.000Z")).toBe("2026-12");
    // 30/11 às 21h em Brasília (UTC-3) já é 01/12 00h UTC: o mês do orçamento é dezembro.
    expect(budgetMonth(new Date("2026-11-30T21:00:00-03:00").toISOString())).toBe("2026-12");
    let budget = loadBudget(null, { ...opts, now: "2026-11-20T10:00:00.000Z" });
    budget = chargeBudget({ ...budget, spentUsd: 49.7 }, "Guardião", 0.1, 0.25, "2026-11-28T10:00:00.000Z");
    expect(budget).toMatchObject({ mode: "subscription", exhaustedAt: "2026-11-28T10:00:00.000Z" });
    expect(rolloverBudget(budget, { hasKey: true, reserveUsd: 0.25, now: "2026-11-30T23:59:59.000Z" })).toEqual({ budget, rolled: false });
    const { budget: december, rolled } = rolloverBudget(budget, { hasKey: true, reserveUsd: 0.25, now: "2026-12-01T00:00:30.000Z" });
    expect(rolled).toBe(true);
    expect(december).toMatchObject({ month: "2026-12", spentUsd: 0, runs: 0, unmeteredRuns: 0, byRole: {}, exhaustedAt: null,
      mode: "api", renewedAt: "2026-12-01T00:00:30.000Z", capUsd: 50, stopAtUsd: 50 });
    expect(december.history).toEqual([{ month: "2026-11", spentUsd: 49.8, runs: 1, unmeteredRuns: 0,
      byRole: { "Guardião": { runs: 1, spentUsd: 0.1 } }, exhaustedAt: "2026-11-28T10:00:00.000Z", closedAt: "2026-12-01T00:00:30.000Z" }]);
    expect(budgetAllows(december, 0, 0.25)).toBe(true);
    // Sem chave, renova o mês mas segue pela assinatura.
    expect(rolloverBudget(budget, { hasKey: false, now: "2026-12-01T00:00:30.000Z" }).budget.mode).toBe("subscription");
    // Na partida, um arquivo de mês anterior já é renovado; o histórico fica limitado aos 24 meses mais recentes.
    const old = { ...budget, history: Array.from({ length: 30 }, (_, i) => ({ month: `20${10 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, spentUsd: 1 })) };
    const restarted = loadBudget(JSON.parse(JSON.stringify(old)), { ...opts, now: "2027-01-05T00:00:00.000Z" });
    expect(restarted).toMatchObject({ month: "2027-01", spentUsd: 0, mode: "api", exhaustedAt: null });
    expect(restarted.history).toHaveLength(24);
    expect(restarted.history.at(-1)).toMatchObject({ month: "2026-11", spentUsd: 49.8 });
  });
  it("Codex roda com a API esgotada no mês e para na renovação", () => {
    const opts = { capUsd: 50, stopAtUsd: 50, reserveUsd: 0.25, hasKey: true };
    const api = loadBudget(null, { ...opts, now: "2026-11-21T00:00:00.000Z" });
    expect(codexShouldRun(api, "2026-11-21T00:00:00.000Z")).toBe(false);
    const exhausted = chargeBudget({ ...api, spentUsd: 49.9 }, "Autor", 0.05, 0.25, "2026-11-22T00:00:00.000Z");
    expect(codexShouldRun(exhausted, "2026-11-22T00:00:01.000Z")).toBe(true);
    // Arquivo ainda de novembro já em dezembro: a API volta, Codex desliga mesmo antes do worker renovar.
    expect(codexShouldRun(exhausted, "2026-12-01T00:00:01.000Z")).toBe(false);
    const renewed = rolloverBudget(exhausted, { hasKey: true, reserveUsd: 0.25, now: "2026-12-01T00:00:01.000Z" }).budget;
    expect(codexShouldRun(renewed, "2026-12-01T00:00:02.000Z")).toBe(false);
    // Arquivo antigo de produção (sem month) com modo api: Codex desligado.
    expect(codexShouldRun({ mode: "api", spentUsd: 41.9 }, "2026-11-21T00:00:00.000Z")).toBe(false);
    expect(codexShouldRun(null, "2026-11-21T00:00:00.000Z")).toBe(false);
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

  it("API: renova o mês salvo, cobra o custo real, esgota em US$ 50 e toca a campainha do Codex", async () => {
    const { dir, env, restore } = await setup(
      `cat >/dev/null; echo '{"schemaVersion":1,"outcome":"prepared"}' > response.json; echo '{"type":"result","is_error":false,"result":"ok","total_cost_usd":0.2}'`);
    const secret = path.join(dir, "secret");
    await writeFile(secret, "ANTHROPIC_API_KEY=sk-ant-test\n");
    const state = path.join(dir, "state");
    await import("node:fs/promises").then((fs) => fs.mkdir(state));
    const thisMonth = new Date().toISOString().slice(0, 7);
    // Mês anterior esgotado: na partida vira o mês corrente zerado, em modo api, com histórico.
    await writeFile(path.join(state, "api-budget.json"), JSON.stringify({ capUsd: 50, stopAtUsd: 50, month: "2000-01", spentUsd: 49.9,
      runs: 10, unmeteredRuns: 0, byRole: {}, mode: "subscription", exhaustedAt: "2000-01-30T00:00:00.000Z", history: [] }));
    try { await main({ ...env, EDITORIAL_API_SECRET_FILE: secret }); } finally { restore(); }
    const budget = JSON.parse(await readFile(path.join(state, "api-budget.json"), "utf8"));
    expect(budget).toMatchObject({ month: thisMonth, spentUsd: 0.2, runs: 1, mode: "api", exhaustedAt: null, stopAtUsd: 50 });
    expect(budget.history).toEqual([expect.objectContaining({ month: "2000-01", spentUsd: 49.9, exhaustedAt: "2000-01-30T00:00:00.000Z" })]);
    expect(JSON.parse(await readFile(path.join(state, "codex-switch.signal"), "utf8"))).toMatchObject({ codexWanted: false, mode: "api" });
    expect(await readFile(path.join(dir, "state/events.jsonl"), "utf8")).toMatch(/"via":"api"/);

    // Segunda rodada no mesmo mês, a US$ 49,70: a execução cabe (49,95 < 50), esgota e a campainha muda.
    await writeFile(path.join(state, "api-budget.json"), JSON.stringify({ ...budget, spentUsd: 49.7 }));
    await import("node:fs/promises").then(async (fs) => {
      await fs.rm(path.join(dir, "claimed"));
      await fs.rm(path.join(state, "runs/autor", lease), { recursive: true });
    });
    process.env.PATH = `${path.join(dir, "bin")}:${process.env.PATH}`;
    try { await main({ ...env, EDITORIAL_API_SECRET_FILE: secret }); } finally { restore(); }
    const exhausted = JSON.parse(await readFile(path.join(state, "api-budget.json"), "utf8"));
    expect(exhausted).toMatchObject({ spentUsd: 49.9, mode: "subscription", month: thisMonth });
    expect(exhausted.spentUsd).toBeLessThanOrEqual(50);
    expect(JSON.parse(await readFile(path.join(state, "codex-switch.signal"), "utf8"))).toMatchObject({ codexWanted: true, mode: "subscription" });
    expect(await readFile(path.join(dir, "state/events.jsonl"), "utf8")).toMatch(/api_budget_exhausted/);
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
  it("instalador não habilita nem inicia a unidade Codex e não faz login; só liga o liga/desliga", () => {
    const commands = installer.split("\n").filter((line) => !line.trimStart().startsWith("#")).join("\n");
    expect(commands).not.toMatch(/codex login|editorial-realtime\.env|api-budget/u);
    const starts = commands.match(/systemctl (enable|start|restart)[^\n]*/gu) ?? [];
    expect(starts).toEqual(["systemctl enable --now leiprova-codex-switch.path leiprova-codex-switch.timer"]);
    expect(commands).toContain('cli_auth_credentials_store = "file"');
  });
  it("sem login a unidade Codex não parte nem entra em laço, e não é habilitada sozinha", () => {
    expect(unit).toMatch(/^\[Unit\][^[]*^ConditionPathExists=\/var\/lib\/leiprova-codex\/codex-home\/auth\.json$/mu);
    expect(unit).not.toMatch(/^\[Install\]/mu);
    const switchService = readFileSync(new URL("../deploy/systemd/leiprova-codex-switch.service", import.meta.url), "utf8");
    const switchPath = readFileSync(new URL("../deploy/systemd/leiprova-codex-switch.path", import.meta.url), "utf8");
    const switchTimer = readFileSync(new URL("../deploy/systemd/leiprova-codex-switch.timer", import.meta.url), "utf8");
    expect(switchService).toContain("Type=oneshot");
    expect(switchService).toContain("ExecStart=/usr/bin/env node /opt/leiprova/deploy/editorial-codex-switch.mjs");
    expect(switchService).not.toMatch(/^Restart=/mu);
    expect(switchPath).toContain("PathChanged=/var/lib/leiprova-realtime/codex-switch.signal");
    expect(switchPath).toContain("Unit=leiprova-codex-switch.service");
    expect(switchTimer).toMatch(/OnUnitActiveSec=10min/u);
    expect(readConfig({}).codexSwitchFile).toBe("/var/lib/leiprova-realtime/codex-switch.signal");
    expect(readConfig({ EDITORIAL_EXECUTOR: "codex" }).codexSwitchFile).toBe("");
  });
  it("valida os caminhos novos", () => {
    expect(readConfig({}).releaseTriggerFile).toBe("/var/lib/leiprova-realtime/release.trigger");
    expect(readConfig({}).bridgeLockFile).toBe("");
    expect(() => readConfig({ EDITORIAL_BRIDGE_LOCK_FILE: "relativo/lock" })).toThrow(/EDITORIAL_BRIDGE_LOCK_FILE/);
    expect(() => readConfig({ EDITORIAL_RELEASE_TRIGGER_FILE: "/var/lib/../etc/x" })).toThrow(/EDITORIAL_RELEASE_TRIGGER_FILE/);
    expect(() => readConfig({ CODEX_HOME: "/tmp/a b" })).toThrow(/CODEX_HOME/);
  });
});

describe("liga/desliga da instância Codex", () => {
  const exhausted = { month: "2026-11", mode: "subscription", spentUsd: 49.9, exhaustedAt: "2026-11-22T00:00:00.000Z" };
  const api = { month: "2026-11", mode: "api", spentUsd: 10, exhaustedAt: null };
  const now = "2026-11-25T00:00:00.000Z";
  it("esgotado liga; renovado desliga; sem login não liga", () => {
    expect(decideCodex({ budget: exhausted, now, loginPresent: true, active: false })).toEqual({ action: "start", reason: "api_exhausted" });
    expect(decideCodex({ budget: exhausted, now, loginPresent: true, active: true })).toEqual({ action: "none", reason: "codex_running" });
    expect(decideCodex({ budget: exhausted, now, loginPresent: false, active: false })).toEqual({ action: "none", reason: "codex_login_missing" });
    // Virada: arquivo ainda de novembro em dezembro, ou já renovado pelo worker.
    expect(decideCodex({ budget: exhausted, now: "2026-12-01T00:05:00.000Z", loginPresent: true, active: true })).toEqual({ action: "stop", reason: "api_available" });
    expect(decideCodex({ budget: { ...api, month: "2026-12" }, now: "2026-12-01T00:05:00.000Z", loginPresent: true, active: true }).action).toBe("stop");
    expect(decideCodex({ budget: api, now, loginPresent: true, active: false })).toEqual({ action: "none", reason: "api_available" });
    expect(decideCodex({ budget: null, now, loginPresent: true, active: true })).toEqual({ action: "none", reason: "budget_unreadable" });
  });

  describe.skipIf(process.platform === "win32")("com systemctl simulado", () => {
    async function runSwitch(budget: unknown, { login, active }: { login: boolean; active: boolean }) {
      const dir = await mkdtemp(path.join(tmpdir(), "codex-switch-"));
      const systemctl = path.join(dir, "systemctl");
      await writeFile(systemctl, `#!/usr/bin/env bash\necho "$*" >> "${dir}/calls"\n[ "$1" = "is-active" ] && exit ${active ? 0 : 3}\nexit 0\n`);
      await chmod(systemctl, 0o755);
      if (budget) await writeFile(path.join(dir, "api-budget.json"), JSON.stringify(budget));
      if (login) await writeFile(path.join(dir, "auth.json"), "{}");
      const decision = await codexSwitchMain({ CODEX_SWITCH_BUDGET_FILE: path.join(dir, "api-budget.json"),
        CODEX_SWITCH_AUTH_FILE: path.join(dir, "auth.json"), CODEX_SWITCH_SYSTEMCTL: systemctl });
      const calls = (await readFile(path.join(dir, "calls"), "utf8")).trim().split("\n");
      return { decision, calls };
    }
    const month = new Date().toISOString().slice(0, 7);
    it("esgotado com login: inicia sem bloquear", async () => {
      const { decision, calls } = await runSwitch({ ...exhausted, month }, { login: true, active: false });
      expect(decision.action).toBe("start");
      expect(calls).toEqual(["is-active --quiet leiprova-editorial-codex.service", "start --no-block leiprova-editorial-codex.service"]);
    });
    it("sem login: não chama start (sem laço de reinício)", async () => {
      const { decision, calls } = await runSwitch({ ...exhausted, month }, { login: false, active: false });
      expect(decision).toEqual({ action: "none", reason: "codex_login_missing" });
      expect(calls).toEqual(["is-active --quiet leiprova-editorial-codex.service"]);
    });
    it("API de volta com Codex rodando: para sem esperar as tarefas", async () => {
      const { decision, calls } = await runSwitch({ ...api, month }, { login: true, active: true });
      expect(decision.action).toBe("stop");
      expect(calls.at(-1)).toBe("stop --no-block leiprova-editorial-codex.service");
    });
    it("sem api-budget.json: não mexe em nada", async () => {
      const { decision, calls } = await runSwitch(null, { login: true, active: true });
      expect(decision.action).toBe("none");
      expect(calls).toHaveLength(1);
    });
  });
});
