import { describe, expect, it } from "vitest";

import {
  buildDirectOfficialDocumentCandidate,
  discoverOfficialDocumentCandidatesFromHtml,
  isProhibitedExamMaterial,
} from "@/lib/opportunities/official-document-policy";
import { parseOfficialOpportunityDocumentUrl } from "@/lib/opportunities/source-monitor-policy";

describe("política de captura de documentos oficiais", () => {
  it("aceita o diretório de arquivos do mesmo host oficial sem ampliar a origem", () => {
    expect(
      parseOfficialOpportunityDocumentUrl(
        "https://www.ssp.ma.gov.br/wp-content/uploads/2026/08/edital-abertura.pdf#pagina=2",
        "ssp-maranhao",
      ),
    ).toMatchObject({
      hostname: "www.ssp.ma.gov.br",
      url: "https://www.ssp.ma.gov.br/wp-content/uploads/2026/08/edital-abertura.pdf",
    });
    expect(() =>
      parseOfficialOpportunityDocumentUrl(
        "https://arquivos.example/edital.pdf",
        "ssp-maranhao",
      ),
    ).toThrow(/mesma origem oficial/i);
  });

  it("bloqueia material de prova mesmo quando o arquivo está no host permitido", () => {
    expect(isProhibitedExamMaterial("Caderno de prova objetiva e gabarito definitivo")).toBe(true);
    expect(() =>
      buildDirectOfficialDocumentCandidate(
        "https://conhecimento.fgv.br/exames/enam/caderno-prova.pdf",
        "fgv-conhecimento",
        "Edital",
      ),
    ).toThrow(/não podem ser capturados/i);
  });

  it("descobre, ordena e deduplica apenas editais e anexos elegíveis", () => {
    const result = discoverOfficialDocumentCandidatesFromHtml(
      `
        <a href="/sites/default/files/conteudo-programatico.pdf">Conteúdo programático</a>
        <a href="/sites/default/files/edital-01.pdf">Edital de abertura</a>
        <a href="/sites/default/files/gabarito.pdf">Gabarito oficial</a>
        <a href="https://evil.example/edital.pdf">Edital espelho</a>
        <a href="/sites/default/files/conteudo-programatico.pdf">Anexo repetido</a>
      `,
      "https://www.ssp.ma.gov.br/editais-seletivos-concursos/policia-civil/",
      "ssp-maranhao",
    );

    expect(result).toHaveLength(2);
    expect(result[0].label).toMatch(/Conteúdo programático/i);
    expect(result.map((item) => item.url)).not.toContain(
      "https://www.ssp.ma.gov.br/sites/default/files/gabarito.pdf",
    );
  });
});
