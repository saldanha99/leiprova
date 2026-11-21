#!/usr/bin/env node
// Liga/desliga a instância Codex (leiprova-editorial-codex.service) pelo orçamento da principal
// (decisão do proprietário em 21/11/2026): roda enquanto a principal estiver fora da API no mês UTC
// corrente (US$ 50 esgotados) e para na renovação mensal. Executado como root, oneshot, por
// leiprova-codex-switch.path (campainha gravada pelo worker) e leiprova-codex-switch.timer (rede de segurança).
// Só lê o api-budget.json; nunca o altera. Sem login do Codex (auth.json), não liga nada.
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { codexShouldRun } from "./editorial-budget.mjs";

export const CODEX_UNIT = "leiprova-editorial-codex.service";

/**
 * Decide a ação sem efeitos colaterais.
 * @param {{ budget: unknown, now: string, loginPresent: boolean, active: boolean }} state
 * @returns {{ action: "start" | "stop" | "none", reason: string }}
 */
export function decideCodex({ budget, now, loginPresent, active }) {
  if (!budget || typeof budget !== "object") return { action: "none", reason: "budget_unreadable" };
  const wanted = codexShouldRun(budget, now);
  if (!wanted) return active ? { action: "stop", reason: "api_available" } : { action: "none", reason: "api_available" };
  if (active) return { action: "none", reason: "codex_running" };
  if (!loginPresent) return { action: "none", reason: "codex_login_missing" };
  return { action: "start", reason: "api_exhausted" };
}

function run(bin, args) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => resolve({ code: -1, output: String(error.message) }));
    child.on("close", (code) => resolve({ code, output }));
  });
}

/** @param {Record<string, string | undefined>} [env] */
export async function main(env = process.env) {
  const budgetFile = env.CODEX_SWITCH_BUDGET_FILE || "/var/lib/leiprova-realtime/api-budget.json";
  const authFile = env.CODEX_SWITCH_AUTH_FILE || "/var/lib/leiprova-codex/codex-home/auth.json";
  const systemctl = env.CODEX_SWITCH_SYSTEMCTL || "systemctl";
  const unit = env.CODEX_SWITCH_UNIT || CODEX_UNIT;
  const budget = await readFile(budgetFile, "utf8").then(JSON.parse, () => null);
  const loginPresent = await access(authFile).then(() => true, () => false);
  const active = (await run(systemctl, ["is-active", "--quiet", unit])).code === 0;
  const decision = decideCodex({ budget, now: new Date().toISOString(), loginPresent, active });
  // --no-block: a parada é graciosa (até 30 min) e não deve prender este oneshot.
  const result = decision.action === "none" ? null : await run(systemctl, [decision.action, "--no-block", unit]);
  console.log(JSON.stringify({ at: new Date().toISOString(), unit, active, loginPresent, mode: budget?.mode ?? null,
    month: budget?.month ?? null, ...decision, ...(result ? { exit: result.code } : {}) }));
  if (result && result.code !== 0) { console.error(result.output.trim().slice(0, 300)); process.exitCode = 1; }
  return decision;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
}
