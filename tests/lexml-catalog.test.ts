import { afterEach, describe, expect, it, vi } from "vitest";

import { LegalCatalogLookupError, lookupLegalActMetadata } from "@/lib/official-sources/lexml-catalog";

const LAW_8112_URN = "urn:lex:br:federal:lei:1990-12-11;8112";
const CONSTITUTION_URN = "urn:lex:br:federal:constituicao:1988-10-05;1988";

function sruResponse({
  urn = LAW_8112_URN,
  title = "Lei nº 8.112, de 11 de dezembro de 1990",
  contentType = "application/xml; charset=utf-8",
}: {
  urn?: string;
  title?: string;
  contentType?: string;
} = {}) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
      <srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/" xmlns:srw_dc="info:srw/schema/1/dc-v1.1" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <srw:version>1.1</srw:version>
        <srw:numberOfRecords>1</srw:numberOfRecords>
        <srw:records>
          <srw:record>
            <srw:recordIdentifier>registro-8112</srw:recordIdentifier>
            <srw:recordData>
              <srw_dc:dc>
                <dc:title>${title}</dc:title>
                <dc:date>1990-12-11</dc:date>
                <dc:identifier>${urn}</dc:identifier>
              </srw_dc:dc>
            </srw:recordData>
          </srw:record>
        </srw:records>
      </srw:searchRetrieveResponse>`,
    { status: 200, headers: { "content-type": contentType } },
  );
}

function senateResponse({
  urn = LAW_8112_URN,
  type = "LEI-n",
  number = "8112",
  signingDate = "1990-12-11",
}: {
  urn?: string;
  type?: string;
  number?: string | null;
  signingDate?: string;
} = {}) {
  return new Response(
    JSON.stringify({
      DetalheDocumento: {
        documentos: {
          documento: [
            {
              id: 549988,
              identificacao: {
                tipo: type,
                descricao: "Lei federal",
                ...(number === null ? {} : { numero: number }),
                normaNome: "Lei nº 8.112, de 11 de dezembro de 1990",
                dataassinatura: signingDate,
                urlDocumento: `https://normas.leg.br/?urn=${encodeURIComponent(urn)}`,
              },
            },
          ],
        },
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-length": "738498",
      },
    },
  );
}

async function captureLookupError(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("A consulta deveria ter falhado.");
  } catch (error) {
    expect(error).toBeInstanceOf(LegalCatalogLookupError);
    return error as LegalCatalogLookupError;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catálogo jurídico LexML/Senado", () => {
  it("normaliza um registro SRU e não aciona a contingência", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sruResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupLegalActMetadata({ type: "lei", number: "8.112", year: 1990 });

    expect(result).toMatchObject({
      provider: "lexml_sru",
      urn: LAW_8112_URN,
      title: "Lei nº 8.112, de 11 de dezembro de 1990",
      actType: "lei",
      actNumber: "8112",
      actYear: 1990,
      signingDate: "1990-12-11",
      providerDocumentId: "registro-8112",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://www.lexml.gov.br/busca/SRU");
    expect(url.searchParams.get("operation")).toBe("searchRetrieve");
    expect(url.searchParams.get("query")).toContain("federal lei 1990 8112");
  });

  it("detecta a página do WAF e usa o endpoint do Senado por tipo, número e ano", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<!doctype html><title>Verificação de segurança — Senado Federal</title><form action=\"/_challenge\"></form>", {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        }),
      )
      .mockResolvedValueOnce(senateResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupLegalActMetadata({ type: "LEI", number: 8112, year: 1990 });

    expect(result.provider).toBe("senado_open_data");
    expect(result.urn).toBe(LAW_8112_URN);
    expect(result.officialUrl).toBe(`https://normas.leg.br/?urn=${encodeURIComponent(LAW_8112_URN)}`);
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallbackUrl.pathname).toBe("/dadosabertos/legislacao/LEI/8112/1990");
    expect(fallbackUrl.searchParams.get("v")).toBe("3");
  });

  it("consulta a contingência do Senado pelo parâmetro URN quando ele foi fornecido", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("SRU offline")).mockResolvedValueOnce(senateResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupLegalActMetadata({ urn: LAW_8112_URN });

    expect(result.provider).toBe("senado_open_data");
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallbackUrl.pathname).toBe("/dadosabertos/legislacao/urn");
    expect(fallbackUrl.searchParams.get("urn")).toBe(LAW_8112_URN);
  });

  it("cruza a URN com identidade independente e aceita Constituição sem inventar número", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("SRU offline"))
      .mockResolvedValueOnce(
        senateResponse({
          urn: CONSTITUTION_URN,
          type: "CON-v",
          number: null,
          signingDate: "05/10/1988",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupLegalActMetadata({
      urn: CONSTITUTION_URN,
      type: "constituicao",
      year: 1988,
    });

    expect(result).toMatchObject({
      provider: "senado_open_data",
      urn: CONSTITUTION_URN,
      actType: "constituicao",
      actNumber: "1988",
      actYear: 1988,
    });
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallbackUrl.pathname).toBe("/dadosabertos/legislacao/urn");
  });

  it("recusa uma URN válida quando ela diverge da identidade independente", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(
      lookupLegalActMetadata({
        urn: LAW_8112_URN,
        type: "lei",
        number: "8.069",
        year: 1990,
      }),
    );

    expect(error.code).toBe("invalid_query");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifica a resposta vazia válida do Senado como ato não encontrado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<!doctype html><title>Verificação de segurança — Senado Federal</title>", {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            DetalheDocumento: {
              Metadados: {
                VersaoServico: "3",
                DescricaoDataSet: "Obtém detalhes de uma Norma Jurídica por meio da sua URN.",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(
      lookupLegalActMetadata({ urn: "urn:lex:br:federal:lei:1990-12-11;99999" }),
    );

    expect(error.code).toBe("not_found");
    expect(error.attempts).toEqual([
      { provider: "lexml_sru", reason: "waf_challenge", httpStatus: 200 },
      { provider: "senado_open_data", reason: "not_found", httpStatus: null },
    ]);
  });

  it("restringe a consulta tipo/número/ano aos atos numerados suportados", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(
      lookupLegalActMetadata({ type: "constituicao", number: "1988", year: 1988 }),
    );

    expect(error.code).toBe("invalid_query");
    expect(error.message).toMatch(/informe a URN LexML/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifica a falha simultânea dos dois serviços como indisponibilidade", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("sem conexão"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }));

    expect(error.code).toBe("unavailable");
    expect(error.attempts).toEqual([
      { provider: "lexml_sru", reason: "network_error", httpStatus: null },
      { provider: "senado_open_data", reason: "network_error", httpStatus: null },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recusa registros cuja identidade não corresponde ao ato consultado", async () => {
    const wrongUrn = "urn:lex:br:federal:lei:1990-09-11;8078";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sruResponse({ urn: wrongUrn }))
      .mockResolvedValueOnce(senateResponse({ urn: wrongUrn, number: "8078", signingDate: "1990-09-11" }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }));

    expect(error.code).toBe("identity_mismatch");
    expect(error.attempts.map((attempt) => attempt.reason)).toEqual(["identity_mismatch", "identity_mismatch"]);
  });

  it("recusa data de assinatura divergente da data gravada na URN", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sruResponse({ urn: LAW_8112_URN }),
      )
      .mockResolvedValueOnce(
        senateResponse({ urn: LAW_8112_URN, signingDate: "1990-12-12" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupLegalActMetadata({
      urn: LAW_8112_URN,
      type: "lei",
      number: "8.112",
      year: 1990,
    });

    expect(result.provider).toBe("lexml_sru");

    fetchMock.mockReset();
    fetchMock
      .mockRejectedValueOnce(new TypeError("SRU offline"))
      .mockResolvedValueOnce(
        senateResponse({ urn: LAW_8112_URN, signingDate: "1990-12-12" }),
      );

    const error = await captureLookupError(
      lookupLegalActMetadata({
        urn: LAW_8112_URN,
        type: "lei",
        number: "8.112",
        year: 1990,
      }),
    );
    expect(error.code).toBe("identity_mismatch");
    expect(error.attempts.at(-1)?.reason).toBe("identity_mismatch");
  });

  it("exige content-type XML e a raiz searchRetrieveResponse no SRU", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sruResponse({ contentType: "text/plain" }))
      .mockResolvedValueOnce(new Response("{}", { status: 503, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const wrongContentType = await captureLookupError(
      lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }),
    );
    expect(wrongContentType.attempts[0]).toMatchObject({ provider: "lexml_sru", reason: "invalid_content_type" });

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        new Response("<?xml version=\"1.0\"?><resultado><numberOfRecords>0</numberOfRecords></resultado>", {
          status: 200,
          headers: { "content-type": "application/xml" },
        }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 503, headers: { "content-type": "application/json" } }));

    const wrongRoot = await captureLookupError(lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }));
    expect(wrongRoot.attempts[0]).toMatchObject({ provider: "lexml_sru", reason: "invalid_payload" });
  });

  it("recusa namespace SRU divergente e declarações de entidade", async () => {
    const invalidXmlResponses = [
      `<?xml version="1.0"?><searchRetrieveResponse xmlns="https://example.test/sru"><numberOfRecords>0</numberOfRecords></searchRetrieveResponse>`,
      `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY ext SYSTEM "file:///etc/passwd">]><srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/"><srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>`,
    ];

    for (const xml of invalidXmlResponses) {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(xml, { status: 200, headers: { "content-type": "application/xml" } }),
        )
        .mockResolvedValueOnce(
          new Response("{}", { status: 503, headers: { "content-type": "application/json" } }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const error = await captureLookupError(
        lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }),
      );
      expect(error.attempts[0]).toMatchObject({
        provider: "lexml_sru",
        reason: "invalid_payload",
      });
    }
  });

  it("interrompe respostas maiores que o limite configurado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("x", {
          status: 200,
          headers: { "content-type": "application/xml", "content-length": "2048" },
        }),
      )
      .mockRejectedValueOnce(new TypeError("fallback offline"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(
      lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }, { maxResponseBytes: 1024 }),
    );

    expect(error.attempts[0]).toMatchObject({ provider: "lexml_sru", reason: "response_too_large", httpStatus: 200 });
  });

  it("aplica timeout individual aos dois provedores", async () => {
    const fetchMock = vi.fn((_url: URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(
      lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }, { timeoutMs: 1 }),
    );

    expect(error.code).toBe("unavailable");
    expect(error.attempts.map((attempt) => attempt.reason)).toEqual(["timeout", "timeout"]);
  });

  it("classifica como timeout quando o prazo expira durante a leitura do corpo", async () => {
    const fetchMock = vi.fn((_url: URL, init?: RequestInit) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const signal = init?.signal;
          if (!signal) throw new Error("Sinal de timeout ausente.");
          const abort = () => controller.error(signal.reason);
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        },
      });
      return Promise.resolve(
        new Response(stream, { status: 200, headers: { "content-type": "application/xml" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await captureLookupError(
      lookupLegalActMetadata({ type: "LEI", number: "8112", year: 1990 }, { timeoutMs: 5 }),
    );

    expect(error.code).toBe("unavailable");
    expect(error.attempts).toEqual([
      { provider: "lexml_sru", reason: "timeout", httpStatus: 200 },
      { provider: "senado_open_data", reason: "timeout", httpStatus: 200 },
    ]);
  });
});
