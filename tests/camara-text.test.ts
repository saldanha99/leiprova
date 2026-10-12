import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { assertCamaraRobotsAllowed, CAMARA_LGPD_SOURCE, parseCamaraLgpdConsolidatedHtml } from "@/lib/official-sources/camara-text";
import { fetchOfficialConsolidatedLegalText } from "@/lib/official-sources/fetch";
import { isAllowedOfficialLegalTextUrl } from "@/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "@/lib/official-sources/legal-text";

import { parseLawLoadArgs } from "../scripts/load-official-laws";

const url = CAMARA_LGPD_SOURCE.url;
// Generated test paragraphs, not a versioned copy of the official full corpus.
const references = [...Array.from({ length: 65 }, (_, index) => String(index + 1)), "14-A", ..."ABCDEFGHIJKLM".split("").map((suffix) => `55-${suffix}`), "58-A", "58-B"];
const html = (extras = "") => `<html><body><p>CÂMARA DOS DEPUTADOS</p><p>Centro de Documentação e Informação</p><p>LEI Nº 13.709, DE 14 DE AGOSTO DE 2018</p>${extras}${references.map((reference) => `<p><font>Art.\n${reference}. Texto sintético da norma para conferir a preservação dos dispositivos neste teste de captura.</font></p>`).join("")}<p>Brasília, 14 de agosto de 2018.</p><p>ASSINATURA</p></body></html>`;

afterEach(() => vi.unstubAllGlobals());

describe("captura pendente da LGPD atualizada da Câmara", () => {
  it("permite só a identidade e a página atualizada exatas, mantendo o monitor Senado", () => {
    expect(CAMARA_LGPD_SOURCE.monitorUrl).toBe("https://legis.senado.leg.br/norma/27457334");
    expect(isAllowedOfficialLegalTextUrl(url)).toBe(true);
    for (const candidate of [url + "?download=1", url + "#art1", url.replace("normaatualizada", "publicacaooriginal"), url.replace("www2.camara.leg.br", "camara.leg.br.example"), url.replace("13709", "14133")]) {
      expect(isAllowedOfficialLegalTextUrl(candidate)).toBe(false);
      expect(() => parseCamaraLgpdConsolidatedHtml(html(), candidate)).toThrow(/exata/u);
    }
  });

  it("agrupa quebras dentro dos parágrafos, exclui art.60 e separa hashes por origem/parser", () => {
    const result = parseCamaraLgpdConsolidatedHtml(html(), url);
    expect(result.articles).toHaveLength(80);
    expect(result.articles[0].literalText).toContain("Art. 1. Texto sintético");
    expect(result.articles.some((article) => article.path === "art-60")).toBe(false);
    expect(result.normalizedContent).not.toContain("ASSINATURA");
    expect(parseConsolidatedLegalArticles(result.normalizedContent)).toEqual(result.articles);
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.rawHtmlChecksumSha256).not.toBe(result.checksumSha256);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.publicationAllowed).toBe(false);
  });

  it("remove notas, revogados e tachados CSS, sem apagar consentimento que pode ser revogado", () => {
    const source = html(`<style>.old {text-decoration:line-through}</style><p class="old">Art. 1. Redação antiga.</p><p><del>Art. 1. Antiga.</del></p>`)
      .replace("Art.\n55-B. Texto sintético da norma para conferir a preservação dos dispositivos neste teste de captura.", "Art. 55-B. (Artigo acrescido pela Lei nº 1 e revogado pela Lei nº 2)")
      .replace("Art.\n8. Texto sintético da norma para conferir a preservação dos dispositivos neste teste de captura.", "Art. 8. O consentimento pode ser revogado a qualquer momento. (Artigo com redação dada pela Lei nº 1)</font></p><p>§ 1º (Revogado pela Lei nº 2)</p><p>§ 2º Disposição válida.");
    const result = parseCamaraLgpdConsolidatedHtml(source, url);
    expect(result.normalizedContent).not.toMatch(/Antiga|Redação antiga|redação dada|acrescido pela|Revogado pela/u);
    expect(result.articles.some((article) => article.path === "art-55-b")).toBe(false);
    expect(result.articles.find((article) => article.path === "art-8")?.literalText).toContain("consentimento pode ser revogado");
    expect(result.normalizedContent).toContain("§ 2º Disposição válida.");
  });

  it("falha com resposta de erro HTTP200, sequência parcial, estrangeiro e duplicata ativa", () => {
    expect(() => parseCamaraLgpdConsolidatedHtml("<p>504 Gateway Time-out</p>", url)).toThrow(/não é o texto/u);
    expect(() => parseCamaraLgpdConsolidatedHtml(html().replace(/<p><font>Art\.\n55-M[\s\S]*?<\/p>/u, ""), url)).toThrow(/sequência integral/u);
    expect(() => parseCamaraLgpdConsolidatedHtml(html("<p>Art. 1. Outra redação.</p>"), url)).toThrow(/duplicada/u);
    expect(() => parseCamaraLgpdConsolidatedHtml(html("<p>Art. 337-E. Outra norma.</p>"), url)).toThrow(/estrangeiro/u);
    expect(() => parseCamaraLgpdConsolidatedHtml(html() + "\ufffd", url)).toThrow(/decodificação/u);
  });

  it("confere robots e rejeita acesso vedado ou política inválida", () => {
    expect(() => assertCamaraRobotsAllowed("User-agent: *\nDisallow: /legin/", url)).toThrow(/proíbe/u);
    expect(() => assertCamaraRobotsAllowed("User-agent: *\nDisallow: /*login_form", url)).not.toThrow();
    expect(() => assertCamaraRobotsAllowed("<html>bloqueado</html>", url)).toThrow(/interpretado/u);
  });

  it("usa provider Câmara por padrão só para LGPD e registra a URL real do hash", async () => {
    const mocked = vi.fn().mockResolvedValueOnce(new Response("User-agent: *\nDisallow: /login", { headers: { "content-type": "text/plain" } })).mockResolvedValueOnce(new Response(html(), { headers: { "content-type": "text/html;charset=utf-8" } }));
    vi.stubGlobal("fetch", mocked);
    const result = await fetchOfficialConsolidatedLegalText(CAMARA_LGPD_SOURCE.monitorUrl);
    expect(mocked.mock.calls.map((call) => call[0])).toEqual(["https://www2.camara.leg.br/robots.txt", url]);
    expect(result.sourceUrl).toBe(url);
    expect(result.parserVersion).toBe(CAMARA_LGPD_SOURCE.parserVersion);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });

  it("não aceita redirecionamento, bloqueio, charset inválido ou provider da lei errada", async () => {
    const mocked = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://example.com" } }));
    vi.stubGlobal("fetch", mocked);
    await expect(fetchOfficialConsolidatedLegalText(CAMARA_LGPD_SOURCE.monitorUrl)).rejects.toThrow(/bloqueada/u);
    expect(mocked).toHaveBeenCalledTimes(1);
    await expect(fetchOfficialConsolidatedLegalText("https://legis.senado.leg.br/norma/33382036", { provider: "camara" })).rejects.toThrow(/identidade exata/u);
    expect(mocked).toHaveBeenCalledTimes(1);
    mocked.mockReset().mockResolvedValueOnce(new Response("User-agent: *\nDisallow:")).mockResolvedValueOnce(new Response(html(), { headers: { "content-type": "text/html; charset=iso-8859-1" } }));
    await expect(fetchOfficialConsolidatedLegalText(CAMARA_LGPD_SOURCE.monitorUrl)).rejects.toThrow(/UTF-8/u);
  });

  it("loader explicita provider, mantém captura pendente e não altera a aprovação existente", () => {
    expect(parseLawLoadArgs(["--capture-only", "--provider=camara", "lei=lei-geral-protecao-dados-2018"]).provider).toBe("camara");
    expect(parseLawLoadArgs(["--capture-only", "--provider=planalto", "lei=lei-geral-protecao-dados-2018"]).provider).toBe("planalto");
    expect(() => parseLawLoadArgs(["--provider=inventado", "lei=lei-geral-protecao-dados-2018"])).toThrow(/inválido/u);
    expect(() => parseLawLoadArgs(["--provider=camara", "--provider=planalto", "lei=lei-geral-protecao-dados-2018"])).toThrow(/somente um/u);
    const loader = readFileSync(new URL("../scripts/load-official-laws.ts", import.meta.url), "utf8");
    expect(loader).toContain("getPlanaltoConsolidatedSource(source.monitorUrl) && !captureOnly");
    expect(loader).toContain("versionsActivated: 0");
    const snapshot = JSON.parse(readFileSync(new URL("../drizzle/meta/0050_snapshot.json", import.meta.url), "utf8"));
    expect(snapshot.tables["public.legal_text_snapshots"].checkConstraints.legal_text_snapshots_url_check.value).toContain(url);
  });
});
