import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { GET as sitemapIndex } from "@/app/sitemap.xml/route";
import { sitemapSegments } from "@/lib/seo/sitemaps";
import { LITERAL_LAB_EXAMPLES } from "@/components/landing/LiteralLab";
import { DEMO_QUESTIONS } from "@/lib/demo-content";
import { SITE_NAME, serializeJsonLd, siteIdentityGraph } from "@/lib/seo";
import { createPublicWebPageStructuredData } from "@/lib/seo/page-structured-data";

describe("fundação GEO e SEO", () => {
  it("publica URLs canônicas de conteúdo com datas editoriais estáveis", async () => {
    const segments = await sitemapSegments();
    const entries = segments.get("paginas") ?? [];
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://leiprova.2b.app.br/",
        "https://leiprova.2b.app.br/demo",
        "https://leiprova.2b.app.br/como-memorizar-lei-seca",
        "https://leiprova.2b.app.br/fontes-e-atualizacao",
        "https://leiprova.2b.app.br/concursos",
        "https://leiprova.2b.app.br/metodologia",
      ]),
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).not.toContain("https://leiprova.2b.app.br/contato");
    // Páginas de edição só entram pelo banco, depois de revisadas; o calendário é
    // a única subpágina fixa de /concursos. Sem SEO_WAVE, nenhuma lei ou artigo.
    expect(urls.filter((url) => url.startsWith("https://leiprova.2b.app.br/concursos/"))).toEqual([
      "https://leiprova.2b.app.br/concursos/calendario",
    ]);
    expect(urls.some((url) => /\/leis?(\/|$)/.test(new URL(url).pathname))).toBe(false);
    expect(segments.has("leis")).toBe(false);
    expect(
      entries.every((entry) => !Number.isNaN(entry.lastModified.getTime()) && entry.lastModified.getTime() <= Date.now()),
    ).toBe(true);

    const index = await (await sitemapIndex()).text();
    expect(index).toContain("<sitemapindex");
    expect(index).toContain("<loc>https://leiprova.2b.app.br/sitemap/paginas.xml</loc>");
    expect(index).not.toContain("changefreq");
  });

  it("libera busca, assistentes e treino de IA e bloqueia só as áreas privadas", () => {
    const rules = robots().rules;
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userAgent: expect.arrayContaining(["Googlebot", "OAI-SearchBot", "GPTBot", "Google-Extended", "ClaudeBot"]),
          allow: "/",
        }),
      ]),
    );
    // D2 (20/11/2026): treino de IA liberado; nenhum grupo bloqueia o site inteiro.
    expect(JSON.stringify(rules)).not.toContain('"disallow":"/"');
    const genericRule = Array.isArray(rules)
      ? rules.find((rule) => rule.userAgent === "*")
      : undefined;
    expect(genericRule?.disallow).toEqual([
      "/app$", "/app/", "/admin$", "/admin/", "/api$", "/api/",
      "/checkout", "/entrar", "/cadastro", "/ativar-acesso", "/recuperar-acesso", "/busca",
    ]);
  });

  it("serializa JSON-LD sem permitir fechamento de script por conteúdo", () => {
    expect(serializeJsonLd({ value: "</script><script>alert(1)</script>" })).not.toContain("<");
    expect(serializeJsonLd({ value: "</script>" })).toContain("\\u003c/script>");
  });

  it("publica a identidade e o logotipo vigentes da Edital Lei Seca", () => {
    expect(SITE_NAME).toBe("Edital Lei Seca");
    expect(siteIdentityGraph["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "Organization",
          name: "Edital Lei Seca",
          logo: expect.objectContaining({
            url: "https://leiprova.2b.app.br/brand/edital-lei-seca-logo.png",
            width: 1200,
            height: 400,
          }),
        }),
        expect.objectContaining({ "@type": "WebSite", name: "Edital Lei Seca" }),
      ]),
    );
  });

  it("descreve a página pública e a mesma trilha visível em JSON-LD", () => {
    const structuredData = createPublicWebPageStructuredData({
      path: "/concursos",
      name: "Concursos organizados por categoria, estado e edição",
      description: "Catálogo público revisado.",
      breadcrumbs: [
        { name: "Início", path: "/" },
        { name: "Concursos", path: "/concursos" },
      ],
      about: ["Concursos públicos"],
    });

    expect(structuredData["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "WebPage",
          url: "https://leiprova.2b.app.br/concursos",
          name: "Concursos organizados por categoria, estado e edição",
        }),
        expect.objectContaining({
          "@type": "BreadcrumbList",
          itemListElement: [
            expect.objectContaining({ position: 1, name: "Início", item: "https://leiprova.2b.app.br/" }),
            expect.objectContaining({
              position: 2,
              name: "Concursos",
              item: "https://leiprova.2b.app.br/concursos",
            }),
          ],
        }),
      ]),
    );
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
