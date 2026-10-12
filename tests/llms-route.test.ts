import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("guia de descoberta para assistentes", () => {
  it("acompanha o domínio configurado sem congelar o inventário comercial", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://editaleiseca.com.br");
    vi.resetModules();
    const { GET } = await import("@/app/llms.txt/route");
    const response = GET();
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(text).toContain("# Edital Lei Seca");
    expect(text).toContain("https://editaleiseca.com.br/concursos");
    expect(text).toContain("https://editaleiseca.com.br/sitemap.xml");
    expect(text).not.toContain("https://leiprova.2b.app.br");
    expect(text).not.toMatch(/zero publicados|12 itens beta|84.*disponíveis/);
    expect(text).toContain("não equivale a revisão humana independente");
    expect(text).toContain("não garante rastreamento, indexação, ranking ou citação");
  });
});
