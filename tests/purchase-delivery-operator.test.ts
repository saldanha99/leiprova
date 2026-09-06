import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runner = resolve("scripts/run-purchase-delivery.ts");
// Ambiente fechado: estes testes não carregam .env nem herdam banco/credenciais do operador.
const safeEnv: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH, NODE_PATH: resolve("node_modules/next/dist/compiled"), PURCHASE_DELIVERY_ENABLED: "false" };
const nodeArgs = ["--conditions=react-server", "--import", "tsx", runner];

describe("operador da fila de compras", () => {
  it("resolve server-only no runtime servidor e só faz prévia por padrão", () => {
    const result = spawnSync(process.execPath, nodeArgs, { env: safeEnv, encoding: "utf8", timeout: 10_000 });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ preview: true, sendsExecuted: false, limit: 10 });
  });

  it("não toca banco nem provedor com flag da entrega desligada", () => {
    const result = spawnSync(process.execPath, [...nodeArgs, "--run"], { env: safeEnv, encoding: "utf8", timeout: 10_000 });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ disabled: true, claimed: 0, queued: 0, retry: 0, manual_review: 0, cancelled: 0, leaseLost: 0 });
  });

  it.each([["--loop"], ["--run", "--limit=101"], ["--run", "--run"]])("rejeita opções inválidas sem detalhes internos: %j", (...args) => {
    const result = spawnSync(process.execPath, [...nodeArgs, ...args], { env: safeEnv, encoding: "utf8", timeout: 10_000 });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("purchase_delivery_worker_failed");
  });

  it("encerra loop ao receber SIGTERM sem esperar o minuto inteiro", async () => {
    const result = await new Promise<{ code: number | null; output: string; error: string }>((resolveResult, reject) => {
      const child = spawn(process.execPath, [...nodeArgs, "--run", "--loop"], { env: safeEnv });
      let output = "", error = "";
      const deadline = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("worker_stop_timeout")); }, 10_000);
      child.on("error", (err) => { clearTimeout(deadline); reject(err); });
      child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("\n")) child.kill("SIGTERM"); });
      child.stderr.on("data", (chunk) => { error += chunk; });
      child.on("close", (code) => { clearTimeout(deadline); resolveResult({ code, output, error }); });
    });
    expect(result.code).toBe(0);
    expect(result.error).toBe("");
    expect(JSON.parse(result.output).disabled).toBe(true);
  });

  it("isola serviço sem credenciais Stripe, volumes ou capacidades elevadas", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const service = compose.split("  purchase-delivery:\n")[1]?.split("\n  migrate:")[0];
    expect(service).toBeTruthy();
    expect(service).toContain("target: migrator");
    expect(service).toContain('user: "1000:1000"');
    expect(service).toContain("read_only: true");
    expect(service).toContain("no-new-privileges:true");
    expect(service).toContain("cap_drop:\n      - ALL");
    expect(service).toContain("DATABASE_POOL_SIZE: 2");
    expect(service).toContain("PURCHASE_DELIVERY_ENABLED: ${PURCHASE_DELIVERY_ENABLED:-false}");
    expect(service).toContain("--run --loop --limit=10");
    expect(service).not.toMatch(/STRIPE_|CHECKOUT_ENABLED|OWNER_PASSWORD|\n    ports:|\n    volumes:/);
  });

  it("limita grants ao registro operacional e histórico append-only", () => {
    const grants = readFileSync("deploy/purchase-delivery-grants.sql", "utf8").replace(/--[^\n]*/g, "");
    expect(grants).toContain('grant select, insert, update on public.purchase_delivery_outbox to :"app_user";');
    expect(grants).toContain('grant select, insert on public.purchase_delivery_events to :"app_user";');
    expect(grants).not.toMatch(/\b(delete|create|alter|revoke|all privileges|sequences)\b/i);
  });
});
