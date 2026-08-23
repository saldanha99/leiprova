import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { LITERAL_LAB_EXAMPLES } from "@/components/landing/LiteralLab";
import { DEMO_QUESTIONS } from "@/lib/demo-content";
import { serializeJsonLd } from "@/lib/seo";

describe("fundação GEO e SEO", () => {
  it("publica URLs canônicas de conteúdo com datas editoriais estáveis", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://leiprova.2b.app.br/",
        "https://leiprova.2b.app.br/demo",
        "https://leiprova.2b.app.br/como-memorizar-lei-seca",
        "https://leiprova.2b.app.br/fontes-e-atualizacao",
      ]),
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).not.toContain("https://leiprova.2b.app.br/contato");
    expect(
      entries.every((entry) =>
        entry.lastModified instanceof Date && !Number.isNaN(entry.lastModified.getTime()),
      ),
    ).toBe(true);
    expect(
      entries.every((entry) => {
        const timestamp =
          entry.lastModified instanceof Date
            ? entry.lastModified.getTime()
            : new Date(entry.lastModified!).getTime();
        return timestamp <= Date.now();
      }),
    ).toBe(true);
  });

  it("separa descoberta por busca de treinamento de modelos", () => {
    const rules = robots().rules;
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: "OAI-SearchBot", allow: "/" }),
        expect.objectContaining({ userAgent: "Googlebot", allow: "/" }),
        { userAgent: "GPTBot", disallow: "/" },
        { userAgent: "Google-Extended", disallow: "/" },
      ]),
    );
  });

  it("serializa JSON-LD sem permitir fechamento de script por conteúdo", () => {
    expect(serializeJsonLd({ value: "</script><script>alert(1)</script>" })).not.toContain("<");
    expect(serializeJsonLd({ value: "</script>" })).toContain("\\u003c/script>");
  });

  it("mantém a declaração pública do acervo alinhada ao inventário original", () => {
    expect(DEMO_QUESTIONS).toHaveLength(12);
    expect(new Set(DEMO_QUESTIONS.map((question) => question.officialUrl)).size).toBe(1);
    expect(new Set(DEMO_QUESTIONS.map((question) => question.verifiedAt))).toEqual(
      new Set(["2026-08-16"]),
    );
  });

  it("não apresenta um recorte adaptado do art. 37 como literalidade integral", () => {
    const article37 = LITERAL_LAB_EXAMPLES.find((example) => example.id === "administrativo");

    expect(article37?.prefix).toContain(
      "direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios",
    );
    expect(article37?.suffix).toBe("e eficiência e, também, ao seguinte:");
  });
});
