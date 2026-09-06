import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { QaEnvironmentNotice } from "@/components/qa-environment-notice";

afterEach(() => vi.unstubAllEnvs());

describe("aviso de homologação", () => {
  it("não aparece em produção sem a flag exata", async () => {
    vi.stubEnv("LEIPROVA_QA_ENVIRONMENT", "false");
    expect(await QaEnvironmentNotice()).toBeNull();
  });
  it("identifica os dados fictícios apenas no ambiente sintético", async () => {
    vi.stubEnv("LEIPROVA_QA_ENVIRONMENT", "synthetic");
    const html = renderToStaticMarkup(await QaEnvironmentNotice());
    expect(html).toContain("DADOS FICTÍCIOS");
    expect(html).toContain("Não insira dados reais de clientes");
  });
});
