import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { assertCamaraProcurementRobotsAllowed, CAMARA_PROCUREMENT_SOURCE, extractCamaraProcurementPdf, parseCamaraProcurementPageTexts } from "@/lib/official-sources/camara-procurement-text";
import { fetchOfficialConsolidatedLegalText } from "@/lib/official-sources/fetch";
import { isAllowedOfficialLegalTextUrl } from "@/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "@/lib/official-sources/legal-text";

const url = CAMARA_PROCUREMENT_SOURCE.url;
const header = "CÂMARA DOS DEPUTADOS\nCentro de Documentação e Informação\nLEI Nº 14.133, DE 1º DE ABRIL DE 2021\n";
function pages() {
  const lines = Array.from({ length: 194 }, (_, index) => {
    const number = index + 1;
    return `Art. ${number}. ${[172, 188].includes(number) ? "(VETADO)." : "Texto sintético do artigo para testar a compilação completa, preservando a fonte exata."}${number === 44 || number === 184 ? `\nArt. ${number}-A. Texto sintético do artigo acrescentado.` : ""}`;
  });
  return [header + lines.slice(0, 97).join("\n"), lines.slice(97).join("\n") + "\nBrasília, 1º de abril de 2021.\nASSINATURA"];
}

afterEach(() => vi.unstubAllGlobals());

describe("PDF atualizado exato da Lei 14.133, sempre preparado para revisão", () => {
  it("valida URL, rejeitando HTML histórico, query, fragmento e domínio semelhante", () => {
    expect(isAllowedOfficialLegalTextUrl(url)).toBe(true);
    for (const candidate of [url.replace(".pdf", ".html"), url + "?download=1", url + "#art1", url.replace("normaatualizada", "publicacaooriginal"), url.replace("www2.camara.leg.br", "camara.leg.br.example")]) {
      expect(isAllowedOfficialLegalTextUrl(candidate)).toBe(false);
      expect(() => parseCamaraProcurementPageTexts(pages(), candidate)).toThrow(/URL exata/u);
    }
  });

  it("confere sequência194+extensões, exclui alterações estrangeiras/vetos vazios e preserva reparse", () => {
    const parsed = parseCamaraProcurementPageTexts(pages(), url);
    expect(parsed.articles).toHaveLength(191);
    expect(parsed.excludedAmendmentArticles).toEqual([177, 178, 179]);
    expect(parsed.articles.some((article) => ["art-172", "art-188", "art-178"].includes(article.path))).toBe(false);
    expect(parsed.normalizedContent).not.toContain("ASSINATURA");
    expect(parseConsolidatedLegalArticles(parsed.normalizedContent)).toEqual(parsed.articles);
    expect(parsed.publicationAllowed).toBe(false);
    expect(parsed.reviewRequired).toBe(true);
  });

  it("falha com erroHTTP200, sequência incompleta, duplicatas, artigo estrangeiro e Unicode inválido", () => {
    expect(() => parseCamaraProcurementPageTexts(["504 Gateway Time-out"], url)).toThrow(/oficial/u);
    expect(() => parseCamaraProcurementPageTexts([pages().join("\n").replace(/Art\. 12\.[^\n]*\n/u, "")], url)).toThrow(/incompleta/u);
    expect(() => parseCamaraProcurementPageTexts([pages().join("\n").replace("Art. 12.", "Art. 11.")], url)).toThrow(/duplicada/u);
    expect(() => parseCamaraProcurementPageTexts([pages().join("\n").replace("Art. 12.", "Art. 337-E.")], url)).toThrow(/estrangeira/u);
    expect(() => parseCamaraProcurementPageTexts([pages().join("\n") + "\ufffd"], url)).toThrow(/oficial/u);
  });

  it("não trata referência art.minúscula quebrada como novo artigo e recompõe compostos entre páginas", () => {
    const text = pages().join("\n").replace("Art. 18. Texto sintético do artigo para testar a compilação completa, preservando a fonte exata.", "Art. 18. Regra relacionada ao\nart. 12 desta Lei e à habilitação econômico-\nfinanceira.");
    const parsed = parseCamaraProcurementPageTexts([text], url);
    expect(parsed.articles.find((article) => article.path === "art-18")?.literalText).toContain("art. 12 desta Lei");
    expect(parsed.articles.find((article) => article.path === "art-18")?.literalText).toContain("econômico-financeira");
  });

  it("remove títulos e notas, mas mantém texto de veto posterior com alerta de conciliação", () => {
    const text = pages().join("\n")
      .replace("Art. 6.", "CAPÍTULO II\nDas Definições\nArt. 6.")
      .replace("Art. 75. Texto sintético do artigo para testar a compilação completa, preservando a fonte exata.", "Art. 75. Valor nominal legal R$ 50.000,00. (Vide Decreto nº 12.807, de 29/12/2025)\nI - Regra. (Vide ADI nº 6.890/2021)\n§ 1º (VETADO).\n§ 2º Texto substantivo oficial. (Parágrafo vetado pelo Presidente, mantido pelo Congresso e publicado no DOU)\n§ 3º Texto antigo retirado. (Parágrafo revogado pela Lei nº 1)" );
    const parsed = parseCamaraProcurementPageTexts([text], url);
    expect(parsed.normalizedContent).not.toMatch(/Das Definições|Vide Decreto|Vide ADI|VETADO/u);
    expect(parsed.normalizedContent).toContain("§ 2º Texto substantivo oficial.");
    expect(parsed.normalizedContent).not.toContain("Texto antigo retirado");
    expect(parsed.monetaryDependencyArticlePaths).toContain("art-75");
    expect(parsed.vetoReconciliationArticlePaths).toContain("art-75");
    expect(parsed.judicialDependencyArticlePaths).toContain("art-75");
    expect(parsed.reviewLimitations.join(" ")).toContain("não tratá-los como limites atuais");
  });

  it("bloqueia artigo revogado com corpo impresso para não mover parágrafos para o artigo anterior", () => {
    const text = pages().join("\n").replace("Art. 75. Texto sintético do artigo para testar a compilação completa, preservando a fonte exata.", "Art. 75. Texto antigo. (Artigo revogado pela Lei nº 1)\n§ 1º Parte antiga.");
    expect(() => parseCamaraProcurementPageTexts([text], url)).toThrow(/revogado/u);
  });

  it("não converte os artigosCP/CPC citados no bloco177–179 em artigos próprios", () => {
    const text = pages().join("\n").replace("Art. 178. Texto sintético do artigo para testar a compilação completa, preservando a fonte exata.", "Art. 178. O Código Penal fica acrescido.\nArt. 337-E. Redação de outra norma.\nPena - quatro anos.");
    expect(parseCamaraProcurementPageTexts([text], url).normalizedContent).not.toContain("337-E");
  });

  it("bloqueia assinatura/tamanho inválidos antes de chamar parser PDF", async () => {
    await expect(extractCamaraProcurementPdf(new TextEncoder().encode("<html>504</html>"), url)).rejects.toThrow(/Assinatura/u);
    await expect(extractCamaraProcurementPdf(new Uint8Array(15 * 1024 * 1024 + 1), url)).rejects.toThrow(/tamanho/u);
  });

  it("confere robots antes do PDF e rejeita MIME/assinatura de HTML200", async () => {
    expect(() => assertCamaraProcurementRobotsAllowed("User-agent: *\nDisallow: /legin/", url)).toThrow(/proíbe/u);
    const mocked = vi.fn().mockResolvedValueOnce(new Response("User-agent: *\nDisallow: /login")).mockResolvedValueOnce(new Response("<html>504 Gateway Time-out</html>", { headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", mocked);
    await expect(fetchOfficialConsolidatedLegalText(CAMARA_PROCUREMENT_SOURCE.monitorUrl, { provider: "camara" })).rejects.toThrow(/HTML\/erro HTTP200/u);
    expect(mocked.mock.calls.map((call) => call[0])).toEqual(["https://www2.camara.leg.br/robots.txt", url]);
  });

  it("migration permite uma URL PDF exata e loader continua pending sem extensão do CLIstanding", () => {
    const migration = readFileSync(new URL("../drizzle/0051_camara_procurement_pdf.sql", import.meta.url), "utf8");
    expect(migration).toContain(url);
    const loader = readFileSync(new URL("../scripts/load-official-laws.ts", import.meta.url), "utf8");
    expect(loader).toContain("reviewLimitations: CAMARA_PROCUREMENT_REVIEW_LIMITATIONS");
    expect(loader).toContain("versionsActivated: 0");
    const reviewer = readFileSync(new URL("../scripts/review-standing-official-law.ts", import.meta.url), "utf8");
    expect(reviewer).not.toContain("CAMARA_PROCUREMENT_SOURCE");
  });
});
