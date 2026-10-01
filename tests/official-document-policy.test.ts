import { describe, expect, it } from "vitest";

import {
  buildDirectOfficialDocumentCandidate,
  cebraspeEventApiUrl,
  cebraspeEventIdFromSourceUrl,
  discoverCebraspeEventDocumentCandidates,
  discoverOfficialDocumentCandidatesFromHtml,
  isProhibitedExamMaterial,
} from "@/lib/opportunities/official-document-policy";
import {
  parseOfficialOpportunityDocumentUrl,
  parseOfficialOpportunitySourceUrl,
} from "@/lib/opportunities/source-monitor-policy";

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

  it("aceita o edital da Cebraspe no CDN e barra o caderno da mesma página", () => {
    const pdf = "https://cdn.cebraspe.org.br/concursos/PC_AL_26/arquivos/5D5AD5B60F3E7BDD8865B1E3FB9965D652ADB351313D202E409B68BE1CEEFCC5.pdf";

    expect(buildDirectOfficialDocumentCandidate(pdf, "cebraspe", "Edital nº 1 - Abertura")).toMatchObject({
      hostname: "cdn.cebraspe.org.br",
    });
    expect(() =>
      buildDirectOfficialDocumentCandidate(pdf, "cebraspe", "PROVA OBJETIVA - CARGO 1"),
    ).toThrow(/não podem ser capturados/i);
    expect(() =>
      parseOfficialOpportunityDocumentUrl("https://cdn.example/concursos/edital.pdf", "cebraspe"),
    ).toThrow(/mesma origem oficial/i);
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

  it("lê a lista oficial de editais da Cebraspe, que a página monta por JavaScript", () => {
    expect(cebraspeEventIdFromSourceUrl("https://www.cebraspe.org.br/concursos/TC_DF_26_ANALISTA")).toBe("TC_DF_26_ANALISTA");
    expect(cebraspeEventIdFromSourceUrl("https://www.cebraspe.org.br/concursos/")).toBeNull();
    expect(cebraspeEventIdFromSourceUrl("https://cdn.cebraspe.org.br/concursos/TC_DF_26_ANALISTA")).toBeNull();
    expect(cebraspeEventIdFromSourceUrl("https://www.cebraspe.org.br/concursos/../x")).toBeNull();
    expect(cebraspeEventApiUrl("TC_DF_26_ANALISTA")).toBe("https://apis.cebraspe.org.br/cebraspe/eventos/TC_DF_26_ANALISTA");
    // A API só serve para listar: fora de /concursos/ não vira fonte de oportunidade.
    expect(() => parseOfficialOpportunitySourceUrl("https://apis.cebraspe.org.br/cebraspe/eventos/TC_DF_26_ANALISTA")).toThrow();

    const file = (descricaoArquivo: string, nomeArquivo: string, extra: Record<string, unknown> = {}) => ({
      tipoExtensaoArquivo: nomeArquivo.endsWith(".pdf") ? "_.pdf" : "_.html",
      nomeArquivo,
      descricaoArquivo,
      isGuid: false,
      ...extra,
    });
    const result = discoverCebraspeEventDocumentCandidates({
      eventoURL: "TC_DF_26_ANALISTA",
      arquivosEdital: [
        file("Edital nº 2 - Retificação da alínea a do subitem 10.1, bem como a renumeração de tópicos de Direito Previdenciário", "5CB4.pdf"),
        file("Edital nº 1 – Abertura – Atualizado conforme retificações", "1328.pdf"),
        file("Edital n° 1 - Abertura", "7971.pdf"),
        file("Edital n° 1 - Abertura - Vlibras", "7972.html"),
        file("Edital nº 3 - Relação final dos candidatos com isenção deferida", "C506.pdf"),
        file("Edital nº 5 - Resultado final na prova objetiva e convocação", "AB12.pdf"),
        file("Edital nº 1 - Abertura", "../../segredo.pdf"),
        file("Edital nº 1 - Abertura", "GUID.pdf", { isGuid: true }),
      ],
    }, "TC_DF_26_ANALISTA");

    expect(result.map((item) => item.label)).toEqual([
      "Edital nº 1 – Abertura – Atualizado conforme retificações",
      "Edital n° 1 - Abertura",
      "Edital nº 2 - Retificação da alínea a do subitem 10.1, bem como a renumeração de tópicos de Direito Previdenciário",
    ]);
    expect(result[0].url).toBe("https://cdn.cebraspe.org.br/concursos/TC_DF_26_ANALISTA/arquivos/1328.pdf");
    expect(() => discoverCebraspeEventDocumentCandidates({ eventoURL: "OUTRO_26", arquivosEdital: [] }, "TC_DF_26_ANALISTA"))
      .toThrow();
    expect(() => discoverCebraspeEventDocumentCandidates([], "TC_DF_26_ANALISTA")).toThrow();
  });
});
