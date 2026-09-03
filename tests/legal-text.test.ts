import { describe, expect, it } from "vitest";

import {
  discoverConsolidatedLegalTextUrl,
  extractConsolidatedLegalText,
  parseConsolidatedLegalArticles,
} from "@/lib/official-sources/legal-text";

describe("consolidated legal text", () => {
  it("discovers the Portuguese monovigente publication for the same official norm", () => {
    const html = `
      <table>
        <tr><td>[ Publicação Original ]</td><td><a href="552282/publicacao/1">ver</a></td></tr>
        <tr><td>[ Compilação Monovigente na CD ]</td><td><a href="552282/publicacao/34620807">ver</a></td></tr>
        <tr><td>[ Compilação Monovigente Traduzida ]</td><td><a href="552282/publicacao/9">ver</a></td></tr>
      </table>
    `;

    expect(
      discoverConsolidatedLegalTextUrl(html, "https://legis.senado.leg.br/norma/552282"),
    ).toBe("https://legis.senado.leg.br/norma/552282/publicacao/34620807");
  });

  it("rejects a publication that changes the official norm identity", () => {
    const html = `<table><tr><td>Compilação Monovigente</td><td><a href="/norma/9/publicacao/10">ver</a></td></tr></table>`;

    expect(() =>
      discoverConsolidatedLegalTextUrl(html, "https://legis.senado.leg.br/norma/552282"),
    ).toThrow("domínio oficial permitido");
  });

  it("removes revoked markup and editorial update links before normalization", () => {
    const html = `
      <main>
        <p><strike>Art. 1º Texto revogado.</strike></p>
        <p>Art. 1º Texto vigente. <a href="https://www2.camara.leg.br/x">(Artigo com redação dada pela Lei nº 1)</a></p>
      </main>
    `;

    expect(extractConsolidatedLegalText(html)).toContain("Art. 1º Texto vigente.");
    expect(extractConsolidatedLegalText(html)).not.toContain("revogado");
    expect(extractConsolidatedLegalText(html)).not.toContain("redação dada");
  });

  it("groups subordinate provisions, preserves official references and records headings", () => {
    const parsed = parseConsolidatedLegalArticles(`
      TÍTULO I
      DAS PESSOAS NATURAIS
      Art. 1º Toda pessoa é capaz de direitos e deveres.
      Parágrafo único. Regra complementar.
      CAPÍTULO II
      DA CAPACIDADE
      Art. 1.216-A. Texto do artigo acrescentado.
      I - primeiro inciso;
      II - segundo inciso.
      Brasília, 1º de janeiro de 2000.
      Assinatura
    `);

    expect(parsed).toEqual([
      {
        articleRef: "Art. 1º",
        articleOrder: 1,
        heading: "TÍTULO I · DAS PESSOAS NATURAIS",
        path: "art-1",
        literalText:
          "Art. 1º Toda pessoa é capaz de direitos e deveres.\nParágrafo único. Regra complementar.",
      },
      {
        articleRef: "Art. 1.216-A",
        articleOrder: 2,
        heading: "CAPÍTULO II · DA CAPACIDADE",
        path: "art-1216-a",
        literalText:
          "Art. 1.216-A. Texto do artigo acrescentado.\nI - primeiro inciso;\nII - segundo inciso.",
      },
    ]);
  });

  it("fails closed when two active blocks resolve to the same article reference", () => {
    expect(() =>
      parseConsolidatedLegalArticles("Art. 10. Primeiro texto.\nArt. 10 Segundo texto."),
    ).toThrow("referência duplicada");
  });

  it("discards a short introductory decree when an attached code restarts at article one", () => {
    const parsed = parseConsolidatedLegalArticles(`
      Art. 1º Fica aprovada a consolidação anexa.
      Art. 2º O decreto entra em vigor.
      CONSOLIDAÇÃO DAS LEIS
      Art. 1º Esta Consolidação estatui as normas aplicáveis.
      Art. 2º Considera-se empregador a empresa.
      Art. 3º Considera-se empregado toda pessoa física.
    `);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.literalText).toContain("Esta Consolidação estatui");
  });
});
