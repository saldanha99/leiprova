import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const common = resolve("deploy/procurement-monitor-common.sh");
const wrapper = resolve("deploy/verify-procurement-supplementary-sources.sh");
const installer = resolve("deploy/install-procurement-supplementary-monitor.sh");
const privateFixtures: string[] = [];
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
function bash(script: string) {
  return spawnSync("bash", ["-c", script], { encoding: "utf8", timeout: 5_000 });
}
function fixture(name: string, content: string) {
  const dir = mkdtempSync(join(tmpdir(), "leiprova-monitor-test-"));
  privateFixtures.push(dir);
  const path = join(dir, name);
  writeFileSync(path, content, { mode: 0o600 });
  return path;
}
afterEach(() => { for (const dir of privateFixtures.splice(0)) rmSync(dir, { recursive: true }); });

describe("monitor complementar restrito à VPS de destino", () => {
  function guard(overrides = "") {
    const env = fixture(".env", "FICTIONAL=1\n");
    return bash(`cd ${shellQuote(resolve(env, ".."))}; source ${shellQuote(common)};
      uname() { echo Linux; }; id() { echo 0; }; pwd() { echo /opt/leiprova; };
      ip() { echo '2: eth0 inet 179.236.255.4/24 scope global eth0'; }; stat() { echo 600:0; };
      ${overrides || ":"}; procurement_monitor_guard`);
  }
  it("aceita somente contexto Linux/root/raiz física/IP e env privado", () => {
    expect(guard().status).toBe(0);
    for (const rejected of [
      "uname() { echo Darwin; }", "id() { echo 501; }", "pwd() { echo /opt/outro-projeto; }",
      "ip() { echo '2: eth0 inet 187.127.46.251/24 scope global eth0'; }",
      "ip() { echo '2: eth0 inet 179.236.255.40/24 scope global eth0'; }",
      "stat() { echo 644:0; }", "stat() { echo 600:501; }", "rm .env",
    ]) expect(guard(rejected).status, rejected).toBe(1);
  });
  it("recusa .env symlink mesmo que alvo tenha permissão adequada", () => {
    expect(guard("mv .env real.env; ln -s real.env .env").status).toBe(1);
  });
  it("mantém um único agendamento horário estável e não altera o diário existente", () => {
    const cron = bash(`source ${shellQuote(installer)}; procurement_monitor_cron`).stdout;
    expect(cron.split("\n").filter((line) => /^17 \*/.test(line))).toEqual([
      "17 * * * * root /opt/leiprova/deploy/verify-procurement-supplementary-sources.sh >> /var/log/leiprova-supplementary-monitor.log 2>&1",
    ]);
    expect(bash(`source ${shellQuote(installer)}; procurement_monitor_cron`).stdout).toBe(cron);
    const file = readFileSync(installer, "utf8");
    expect(file).toContain("${1:---preview}");
    expect(file).toContain('mv -f -- "$staged_cron" "$cron"');
    expect(file).not.toContain("crontab -");
    expect(file).not.toContain("check-official-sources.ts");
  });
  it("detecta cron da CLI ou wrapper fora do arquivo próprio, ignorando comentários", () => {
    const duplicate = fixture("cron", "5 * * * * root pnpm exec tsx scripts/verify-procurement-supplementary-sources.ts --apply\n");
    const comment = fixture("cron", "# futuro verify-procurement-supplementary-sources.sh\n0 * * * * root outro-worker\n");
    expect(bash(`source ${shellQuote(installer)}; procurement_monitor_has_duplicate ${shellQuote(duplicate)}`).status).toBe(0);
    expect(bash(`source ${shellQuote(installer)}; procurement_monitor_has_duplicate ${shellQuote(comment)}`).status).toBe(1);
  });
  it("exige recibo do par com IDs reais; distingue suspensão auditada de sucesso", () => {
    for (const [receipt, code] of [
      [{ mode: "verified", sourceIds: [21, 22], auditId: 7001, humanReview: false }, 0],
      [{ mode: "suspended", sourceIds: [21, 22], auditId: 7002, humanReview: false }, 10],
      [{ mode: "no_approved_sources", databaseWrites: 0 }, 11],
      [{ mode: "verified", sourceIds: [21, 21], auditId: 7001, humanReview: false }, 11],
      [{ mode: "verified", sourceIds: [21, 22], auditId: null, humanReview: false }, 11],
      [{ mode: "verified", sourceIds: [21, 22], auditId: 7001, humanReview: true }, 11],
      [[], 11],
    ] as const) {
      const path = fixture("receipt.json", JSON.stringify(receipt));
      expect(bash(`source ${shellQuote(wrapper)}; procurement_monitor_validate_receipt ${shellQuote(path)}`).status).toBe(code);
    }
    const path = fixture("receipt.json", "not-json");
    expect(bash(`source ${shellQuote(wrapper)}; procurement_monitor_validate_receipt ${shellQuote(path)}`).status).toBe(11);
  });
  it("limita um run sem build/pull ou APIs alternativas e preserva env no Compose", () => {
    const script = readFileSync(wrapper, "utf8");
    const config = readFileSync("deploy/docker-compose.supplementary-monitor.yml", "utf8");
    expect(script).toContain("flock -n 9");
    expect(script).toContain("--signal=TERM --kill-after=15s 240s");
    expect(script).toContain("--rm --no-deps -T --name");
    expect(script).toContain("scripts/verify-procurement-supplementary-sources.ts --apply");
    expect(script).toContain("--env-file-if-exists=.env");
    expect(script).toContain("--env-file /opt/leiprova/.env");
    expect(script).toContain("owner-standing-2026-10-12:official-sources-programs");
    expect(script).not.toMatch(/\bdocker\s+(?:build|pull)\b|\bsource\s+.*[.]env/);
    expect(config).toContain("pull_policy: never");
    expect(config).toContain("mem_limit: 384m");
    expect(config).toContain("cpus: 0.35");
    expect(config).toContain("--max-old-space-size=256");
    expect(config).not.toContain("MIGRATION_DATABASE_URL:");
  });
});
