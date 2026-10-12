import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchOfficialConsolidatedLegalText } from "@/lib/official-sources/fetch";
import { isAllowedOfficialLegalTextUrl } from "@/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "@/lib/official-sources/legal-text";
import { assertPlanaltoRobotsAllowed, decodePlanaltoHtml, parsePlanaltoConsolidatedHtml, PLANALTO_CONSOLIDATED_SOURCES } from "@/lib/official-sources/planalto-text";

const lgpd = PLANALTO_CONSOLIDATED_SOURCES[0];
const licitacoes = PLANALTO_CONSOLIDATED_SOURCES[1];
const page = (source: typeof lgpd | typeof licitacoes, extras = "") => `<html><body><h1>LEI Nº ${source.number}</h1>${extras}${Array.from({ length: source.maximumArticle }, (_, index) => `<p>Art. ${index + 1}. Texto oficial de teste do artigo ${index + 1}, preservado para conferência da captura.</p>`).join("")}<p>Brasília, data de publicação.</p></body></html>`;

afterEach(() => vi.unstubAllGlobals());

describe("compilações exatas do Planalto, sem aprovação automática", () => {
  it("rejeita a LGPD histórica, lei alteradora 12.737, parâmetros e domínio parecido", () => {
    expect(isAllowedOfficialLegalTextUrl(lgpd.url)).toBe(true);
    expect(isAllowedOfficialLegalTextUrl(licitacoes.url)).toBe(true);
    for (const url of [lgpd.url.replace("compilado", ""), lgpd.url + "?download=1", lgpd.url.replace("www.planalto.gov.br", "planalto.gov.br.example"), "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12737.htm"]) {
      expect(isAllowedOfficialLegalTextUrl(url)).toBe(false);
      expect(() => parsePlanaltoConsolidatedHtml(page(lgpd), url)).toThrow(/permitidas/u);
    }
  });

  it("remove redações tachadas em elementos, estilo inline e classes CSS antes de separar artigos", () => {
    const html = page(lgpd, `<style>.revogada { text-decoration: line-through; }</style><p class="revogada">Art. 1. Redação antiga.</p><p><s>Art. 1. Outra antiga.</s></p><p style="text-decoration-line:line-through">Art. 1. Terceira antiga.</p>`);
    const captured = parsePlanaltoConsolidatedHtml(html, lgpd.url);
    expect(captured.articles.filter((article) => article.path === "art-1")).toHaveLength(1);
    expect(captured.normalizedContent).not.toContain("antiga");
    expect(captured.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(parseConsolidatedLegalArticles(captured.normalizedContent)).toEqual(captured.articles);
  });

  it("não confunde alterações de outro código com artigos próprios nem promove sua redação histórica", () => {
    const html = page(licitacoes).replace(/<p>Art\. 178\.[\s\S]*?<\/p>/u, `<p>Art. 178. O Código Penal passa a vigorar.</p><blockquote><p>Art. 337-E. Redação alteradora histórica.</p></blockquote>`);
    const captured = parsePlanaltoConsolidatedHtml(html, licitacoes.url);
    expect(captured.excludedAmendmentArticles).toEqual([177, 178, 179]);
    expect(captured.normalizedContent).not.toContain("337-E");
    expect(captured.articles.some((article) => article.path === "art-178")).toBe(false);
    expect(captured.articles.some((article) => article.path === "art-180")).toBe(true);
    const lgpdCapture = parsePlanaltoConsolidatedHtml(page(lgpd), lgpd.url);
    expect(lgpdCapture.articles.some((article) => article.path === "art-60")).toBe(false);
  });

  it("preserva disposições válidas apenas recuadas por blockquote", () => {
    const html = page(lgpd).replace("<p>Art. 2.", `<blockquote><p>§ 1º Disposição válida do artigo primeiro.</p></blockquote><p>Art. 2.`);
    expect(parsePlanaltoConsolidatedHtml(html, lgpd.url).articles[0].literalText).toContain("§ 1º Disposição válida");
  });

  it("falha com duplicatas, artigo estrangeiro, identidade trocada, página parcial ou erro de charset", () => {
    expect(() => parsePlanaltoConsolidatedHtml(page(lgpd, "<p>Art. 1. Antiga sem marcação.</p>"), lgpd.url)).toThrow(/duplicadas/u);
    expect(() => parsePlanaltoConsolidatedHtml(page(lgpd, "<p>Art. 337-E. Estrangeiro.</p>"), lgpd.url)).toThrow(/estrangeiro/u);
    expect(() => parsePlanaltoConsolidatedHtml(page(lgpd).replace("13.709", "14.133"), lgpd.url)).toThrow(/identidade/u);
    expect(() => parsePlanaltoConsolidatedHtml("<h1>LEI Nº 13.709</h1><p>Art. 1. Parcial.</p>", lgpd.url)).toThrow(/incompleta/u);
    expect(() => parsePlanaltoConsolidatedHtml(page(lgpd) + "\ufffd", lgpd.url)).toThrow(/decodificação/u);
  });

  it("decodifica HTML legado Windows-1252 e UTF-8 declarado sem substituir bytes inválidos", () => {
    expect(decodePlanaltoHtml(new Uint8Array([0x41, 0xe7, 0xe3, 0x6f]), "text/html")).toBe("Ação");
    expect(decodePlanaltoHtml(new TextEncoder().encode("Ação"), "text/html;charset=utf-8")).toBe("Ação");
    expect(() => decodePlanaltoHtml(new Uint8Array([0xff]), "text/html;charset=utf-8")).toThrow();
    expect(() => decodePlanaltoHtml(new Uint8Array([0xff]), "text/html;charset=unsupported")).toThrow(/suportada/u);
  });

  it("respeita robots e a regra permitida mais específica, rejeitando HTML em lugar da política", () => {
    expect(() => assertPlanaltoRobotsAllowed("User-agent: *\nDisallow: /ccivil_03/", lgpd.url)).toThrow(/proíbe/u);
    expect(() => assertPlanaltoRobotsAllowed("User-agent: *\nDisallow: /\nAllow: /ccivil_03/_ato2015-2018/", lgpd.url)).not.toThrow();
    expect(() => assertPlanaltoRobotsAllowed("User-agent: *\nDisallow: /*compilado.htm$", lgpd.url)).toThrow(/proíbe/u);
    expect(() => assertPlanaltoRobotsAllowed("<html>bloqueado</html>", lgpd.url)).toThrow(/interpretado/u);
  });

  it("consulta robots antes da página e devolve captura com hash/data, sem escrever ou ativar corpus", async () => {
    const mocked = vi.fn().mockResolvedValueOnce(new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } })).mockResolvedValueOnce(new Response(page(lgpd), { headers: { "content-type": "text/html;charset=utf-8" } }));
    vi.stubGlobal("fetch", mocked);
    const captured = await fetchOfficialConsolidatedLegalText(lgpd.monitorUrl);
    expect(mocked.mock.calls.map((call) => call[0])).toEqual(["https://www.planalto.gov.br/robots.txt", lgpd.url]);
    expect(captured.articleCount).toBe(64);
    expect(captured.fetchedAt).toBeInstanceOf(Date);
    expect(captured.parserVersion).toBe("planalto-consolidated-v1.0.0");
    expect(captured.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("não busca página quando robots falha ou proíbe, sem trocar user-agent para contornar", async () => {
    const mocked = vi.fn().mockResolvedValue(new Response("Proibido", { status: 403 }));
    vi.stubGlobal("fetch", mocked);
    await expect(fetchOfficialConsolidatedLegalText(lgpd.monitorUrl)).rejects.toThrow(/bloqueada/u);
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});
