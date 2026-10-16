import { describe, expect, it } from "vitest";

import {
  isOfficialOpportunitySourceUrl,
  normalizeOpportunitySourceMetadata,
  parseOfficialOpportunitySourceUrl,
  resolveOfficialOpportunityRedirect,
} from "@/lib/opportunities/source-monitor-policy";

describe("allowlist de fontes oficiais de oportunidades", () => {
  it("admite o edital MPRJ aprovado sem liberar cadernos ou outro edital", () => {
    const url="https://conhecimento.fgv.br/sites/default/files/concursos/edital-xxxix-concurso.pdf";
    expect(parseOfficialOpportunitySourceUrl(url,"fgv-conhecimento").url).toBe(url);
    expect(()=>parseOfficialOpportunitySourceUrl(url.replace('xxxix','xxxviii'),"fgv-conhecimento")).toThrow();
    expect(()=>parseOfficialOpportunitySourceUrl(url.replace('edital-xxxix-concurso','promotor-de-justica-substituto-cns001-tipo-1'),"fgv-conhecimento")).toThrow();
    expect(()=>parseOfficialOpportunitySourceUrl(url,"cnj")).toThrow();
  });
  it("admite somente o edital MPMT compilado aprovado, sem abrir cadernos ou outros PDFs", () => {
    const url = "https://conhecimento.fgv.br/sites/default/files/concursos/edital_n_01_2026_compilado_ate_a_1_a_retificacao_de_20_07_2026-1.pdf";
    expect(parseOfficialOpportunitySourceUrl(url, "fgv-conhecimento").url).toBe(url);
    expect(() => parseOfficialOpportunitySourceUrl(`${url}/outro`, "fgv-conhecimento")).toThrow();
    expect(() => parseOfficialOpportunitySourceUrl("https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns100-tipo-1_1.pdf", "fgv-conhecimento")).toThrow();
    expect(() => parseOfficialOpportunitySourceUrl(url, "cnj")).toThrow();
  });
  it("admite o comunicado MPMT exato sem liberar outros assets da FGV", () => {
    const url = "https://conhecimento.fgv.br/sites/default/files/concursos/comunicado_n_05_2026_resultado_definitivo_p_objetiva_04_08_2026_assinado.pdf";
    expect(parseOfficialOpportunitySourceUrl(url, "fgv-conhecimento").url).toBe(url);
    expect(() => parseOfficialOpportunitySourceUrl(`${url}/outro`, "fgv-conhecimento")).toThrow();
    expect(() => parseOfficialOpportunitySourceUrl("https://conhecimento.fgv.br/sites/default/files/concursos/outro.pdf", "fgv-conhecimento")).toThrow();
    expect(() => parseOfficialOpportunitySourceUrl(url, "cnj")).toThrow();
  });
  it("aceita somente host e caminho registrados e remove fragmentos", () => {
    expect(
      parseOfficialOpportunitySourceUrl(
        "https://conhecimento.fgv.br/exames/enam/6exame#edital",
        "fgv-conhecimento",
      ),
    ).toEqual({
      sourceId: "fgv-conhecimento",
      publisher: "FGV Conhecimento",
      hostname: "conhecimento.fgv.br",
      url: "https://conhecimento.fgv.br/exames/enam/6exame",
    });

    expect(
      isOfficialOpportunitySourceUrl(
        "https://www.ssp.ma.gov.br/editais-seletivos-concursos/policia-civil/",
        "ssp-maranhao",
      ),
    ).toBe(true);
    expect(isOfficialOpportunitySourceUrl("https://www.ssp.ma.gov.br/noticias/", "ssp-maranhao")).toBe(
      false,
    );
  });

  it("rejeita HTTP, credenciais, portas, domínio semelhante e origem trocada", () => {
    expect(() =>
      parseOfficialOpportunitySourceUrl("http://conhecimento.fgv.br/exames/enam/6exame"),
    ).toThrow(/HTTPS público/);
    expect(() =>
      parseOfficialOpportunitySourceUrl(
        "https://usuario:segredo@conhecimento.fgv.br/exames/enam/6exame",
      ),
    ).toThrow(/credenciais/);
    expect(() =>
      parseOfficialOpportunitySourceUrl("https://conhecimento.fgv.br:8443/exames/enam/6exame"),
    ).toThrow(/porta padrão/);
    expect(() =>
      parseOfficialOpportunitySourceUrl("https://conhecimento.fgv.br.example.com/exames/enam"),
    ).toThrow(/origem oficial/);
    expect(() =>
      parseOfficialOpportunitySourceUrl(
        "https://conhecimento.fgv.br/exames/enam/6exame",
        "cnj",
      ),
    ).toThrow(/origem oficial/);
  });

  it("valida cada destino de redirecionamento antes de permitir nova requisição", () => {
    expect(
      resolveOfficialOpportunityRedirect(
        "https://conhecimento.fgv.br/exames/enam/6exame",
        "/exames/enam/6exame/edital",
        "fgv-conhecimento",
      ).url,
    ).toBe("https://conhecimento.fgv.br/exames/enam/6exame/edital");

    expect(() =>
      resolveOfficialOpportunityRedirect(
        "https://conhecimento.fgv.br/exames/enam/6exame",
        "http://127.0.0.1:3000/admin",
        "fgv-conhecimento",
      ),
    ).toThrow(/HTTPS público|origem oficial/);
    expect(() =>
      resolveOfficialOpportunityRedirect(
        "https://conhecimento.fgv.br/exames/enam/6exame",
        "https://evil.example/internal",
        "fgv-conhecimento",
      ),
    ).toThrow(/origem oficial/);
  });
});

describe("normalização metadata-only", () => {
  it("produz uma observação HEAD sem corpo armazenado", () => {
    const observation = normalizeOpportunitySourceMetadata({
      sourceId: "enfam",
      url: "https://www.enfam.jus.br/enam/normativos/#edital",
      httpStatus: 200,
      observedAt: "2026-08-31T12:30:00-03:00",
      contentType: "text/html; charset=UTF-8",
      contentLength: 1200,
      etag: '"abc"',
      lastModified: "Mon, 31 Aug 2026 12:00:00 GMT",
    });

    expect(observation).toMatchObject({
      requestMethod: "HEAD",
      sourcePolicy: "metadata_only",
      sourceContentStored: false,
      url: "https://www.enfam.jus.br/enam/normativos/",
      httpStatus: 200,
      contentLength: 1200,
    });
    expect(observation).not.toHaveProperty("body");
    expect(Object.isFrozen(observation)).toBe(true);
  });

  it("rejeita conteúdo, campos arbitrários e metadados inválidos", () => {
    expect(() =>
      normalizeOpportunitySourceMetadata({
        sourceId: "enfam",
        url: "https://www.enfam.jus.br/enam/normativos/",
        httpStatus: 200,
        observedAt: "2026-08-31T12:30:00Z",
        body: "<html>não deve entrar</html>",
      }),
    ).toThrow(/não é permitido/);
    expect(() =>
      normalizeOpportunitySourceMetadata({
        sourceId: "enfam",
        url: "https://www.enfam.jus.br/enam/normativos/",
        httpStatus: 99,
        observedAt: "2026-08-31T12:30:00Z",
      }),
    ).toThrow(/100 e 599/);
    expect(() =>
      normalizeOpportunitySourceMetadata({
        sourceId: "enfam",
        url: "https://www.enfam.jus.br/enam/normativos/",
        httpStatus: 200,
        observedAt: "data impossível",
      }),
    ).toThrow(/ISO válido/);
    expect(() =>
      normalizeOpportunitySourceMetadata({
        sourceId: "enfam",
        url: "https://www.enfam.jus.br/enam/normativos/",
        httpStatus: 200,
        observedAt: "2026-08-31",
      }),
    ).toThrow(/fuso horário/);
  });
});
