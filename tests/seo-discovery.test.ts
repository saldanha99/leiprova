import { describe, expect, it, vi } from "vitest";

import { INDEXNOW_ENDPOINT, indexNowPayloads, submitIndexNow } from "@/lib/seo/indexnow";
import { LLMS_FULL_MAX_BYTES, LLMS_MAX_BYTES, type LlmsLaw, buildLlmsFullTxt, buildLlmsTxt } from "@/lib/seo/llms";
import { chunk, sitemapIndexXml, urlsetXml } from "@/lib/seo/sitemap-xml";
import { WAVE_0_ARTICLE_PATHS } from "@/lib/seo/waves/onda-0";
import { readFileSync } from "node:fs";

const law = (index: number): LlmsLaw => ({
  label: `Lei ${index}/1990`,
  title: `Lei nº ${index}, de 1º de janeiro de 1990`,
  shortTitle: `Norma ${index}`,
  path: `/lei/lei-${index}-1990`,
  officialUrl: `https://www.planalto.gov.br/ccivil_03/leis/l${index}.htm`,
  verifiedAt: new Date("2026-09-03T12:00:00Z"),
  reviewedQuestions: 100,
  topArticles: Array.from({ length: 10 }, (_, article) => ({
    label: `Art. ${article + 1}`,
    heading: "Dos deveres",
    path: `/lei/lei-${index}-1990/art-${article + 1}`,
    questions: 20,
    directAnswer: null,
  })),
});

describe("llms.txt e llms-full.txt", () => {
  const laws = Array.from({ length: 60 }, (_, index) => law(index + 1));
  const now = new Date("2026-11-21T12:00:00Z");

  it("llms.txt tem fatos, hubs, no máximo 30 leis e cabe em 30 KB", () => {
    const text = buildLlmsTxt(laws, now);
    expect(text).toContain("## Fatos sobre o Edital Lei Seca");
    expect(text).toContain("/leis");
    expect(text.match(/\/lei\/lei-/g)).toHaveLength(30);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(LLMS_MAX_BYTES);
    expect(text).toContain("Gerado em 21/11/2026");
  });

  it("sem leis no índice, não anuncia o hub de leis", () => {
    expect(buildLlmsTxt([], now)).not.toContain("/leis");
  });

  it("llms-full.txt traz ficha e artigos, sem texto literal nem questões, até 500 KB", () => {
    const text = buildLlmsFullTxt(laws, now);
    expect(text).toContain("Texto oficial: https://www.planalto.gov.br/ccivil_03/leis/l1.htm");
    expect(text).toContain("[Art. 1 — Dos deveres](https://leiprova.2b.app.br/lei/lei-1-1990/art-1): 20 questões.");
    expect(text).not.toMatch(/Enunciado|Gabarito/);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(LLMS_FULL_MAX_BYTES);
  });

  it("bloqueia link de concorrente", () => {
    expect(() => buildLlmsTxt([{ ...law(1), officialUrl: "x", shortTitle: "https://blog.decorandoaleiseca.com.br/x" }], now)).toThrow();
  });
});

describe("sitemaps", () => {
  it("gera urlset e índice com lastmod, sem changefreq/priority, escapando XML", () => {
    const xml = urlsetXml([{ url: "https://editaleiseca.com.br/lei/a&b", lastModified: new Date("2026-10-14T05:40:00Z") }]);
    expect(xml).toContain("<loc>https://editaleiseca.com.br/lei/a&amp;b</loc><lastmod>2026-10-14</lastmod>");
    expect(xml).not.toMatch(/changefreq|priority/);
    expect(sitemapIndexXml([{ url: "https://editaleiseca.com.br/sitemap/leis.xml", lastModified: new Date("2026-10-14T00:00:00Z") }])).toContain(
      "<sitemapindex",
    );
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("a lista da onda 0 em código é a mesma de docs/seo/onda-0-300.txt", () => {
    const file = readFileSync(new URL("../docs/seo/onda-0-300.txt", import.meta.url), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    expect([...WAVE_0_ARTICLE_PATHS]).toEqual(file);
    expect(new Set(file).size).toBe(file.length);
    expect(file.every((path) => /^\/lei\/[a-z0-9-]+\/art-[0-9]+(-[a-z])*$/.test(path))).toBe(true);
  });
});

describe("IndexNow desligado por padrão", () => {
  it("sem chave não envia nada", async () => {
    const fetcher = vi.fn();
    expect(await submitIndexNow(["https://editaleiseca.com.br/leis"], { key: "", fetcher })).toEqual({ sent: false, reason: "disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("com chave, envia só URLs do próprio domínio, em lote, sem retry", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 202 }));
    const result = await submitIndexNow(
      ["https://editaleiseca.com.br/leis", "https://editaleiseca.com.br/leis", "https://evil.invalid/x", "https://editaleiseca.com.br/a?x=1"],
      { key: "3f3de0bfb7e56de32de024a433b94f08", origin: "https://editaleiseca.com.br", fetcher: fetcher as typeof fetch },
    );
    expect(result).toEqual({ sent: true, batches: [{ status: 202, count: 1 }] });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(JSON.parse(init.body)).toEqual({
      host: "editaleiseca.com.br",
      key: "3f3de0bfb7e56de32de024a433b94f08",
      keyLocation: "https://editaleiseca.com.br/3f3de0bfb7e56de32de024a433b94f08.txt",
      urlList: ["https://editaleiseca.com.br/leis"],
    });
    expect(indexNowPayloads([], "k", "https://editaleiseca.com.br")).toEqual([]);
  });
});
