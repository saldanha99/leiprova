import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("publicação de homologação — imagem de build QA obrigatória", () => {
  const script = readFileSync(
    new URL("../deploy/qa-start.sh", import.meta.url),
    "utf8",
  );
  it("confere a imagem fixa e o label QA antes de iniciar até mesmo o banco", () => {
    expect(script).toContain('docker image inspect "$qa_app_image"');
    expect(script).toContain("io.leiprova.build-profile");
    expect(script).toContain('test "$qa_build_profile" != qa');
    expect(script.indexOf('test "$qa_build_profile" != qa')).toBeLessThan(
      script.indexOf("qa_compose up -d db"),
    );
  });
  it("exige exatamente um ID de app e um ID de migrator, sem carregar o .env real", () => {
    expect(script).toContain("app != 1 || tools != 1");
    expect(script).toContain(
      "qa_env=/opt/leiprova/.local/commerce/qa-persistente/.env",
    );
    expect(script).toContain(
      'docker compose --env-file "$qa_env" -f /opt/leiprova/deploy/docker-compose.qa.yml',
    );
    expect(script).not.toMatch(/(?:source|\.)\s+["']?\/opt\/leiprova\/\.env/);
  });
});
