import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), fetch: vi.fn(), getDocumentProxy: vi.fn(), extractText: vi.fn(), cleanup: vi.fn(),
}));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("unpdf", () => ({ getDocumentProxy: mocks.getDocumentProxy, extractText: mocks.extractText }));

import { safeEditorialError } from "@/lib/editorial/safe-error";
import { captureOfficialPdf, discoverOfficialDocumentCandidates } from "@/lib/opportunities/official-document-fetch";
import { OfficialDocumentFetchError, normalizeOfficialDocumentFetchError } from "@/lib/opportunities/official-document-fetch-error";
import {
  buildDirectOfficialDocumentCandidate, discoverOfficialDocumentCandidatesFromHtml,
  MAX_OFFICIAL_DOCUMENT_BYTES, MAX_OFFICIAL_DOCUMENT_TEXT_LENGTH,
} from "@/lib/opportunities/official-document-policy";

const sourceId = "fgv-conhecimento" as const;
const page = "https://conhecimento.fgv.br/exames/enam/6exame";
const pdfUrl = "https://conhecimento.fgv.br/edital.pdf";
const candidate = { url: pdfUrl, hostname: "conhecimento.fgv.br", label: "Edital", score: 90 };
const secret = "SEGREDO_SINTETICO_NAO_PROPAGAR";
const unsafeError = () => Object.assign(new Error(`https://user:${secret}@host/file?token=${secret}`), {
  headers: { authorization: secret, cookie: secret }, body: secret,
});
const validResponse = () => new Response("%PDF-1.7\nfixture", { headers: { "content-type": "application/pdf" } });
const capture = () => captureOfficialPdf(candidate, sourceId);
const discover = () => discoverOfficialDocumentCandidates(page, sourceId);

async function failure(promise: Promise<unknown>) {
  try { await promise; } catch (error) {
    expect(error).toBeInstanceOf(OfficialDocumentFetchError);
    const typed = error as OfficialDocumentFetchError;
    expect(typed).not.toHaveProperty("cause");
    expect(JSON.stringify(typed)).not.toContain(secret);
    expect(typed.stack).not.toContain(secret);
    expect(JSON.parse(safeEditorialError(typed))).toEqual({ code: typed.code });
    return typed;
  }
  throw new Error("Era esperada uma falha tipada.");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  mocks.fetch.mockImplementation(validResponse);
  mocks.getDocumentProxy.mockResolvedValue({ numPages: 1, cleanup: mocks.cleanup });
  mocks.extractText.mockResolvedValue({ totalPages: 1, text: ["Conteúdo sintético de edital. ".repeat(8)] });
  mocks.cleanup.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("política e seleção de candidatos", () => {
  it("reproduz a rejeição SSP-BA antes de DNS/HTTP, sem classificar como WAF", async () => {
    const error = await failure(discoverOfficialDocumentCandidates(
      "https://www.ba.gov.br/ssp/sites/site-ssp/files/2026-05/Relatorio_de_Gestao_2025___rev.final___consolidado___2026.04.23.pdf",
      "governo-bahia",
      "Polícia Civil da Bahia — concurso autorizado em 2026 — authorization (Secretaria da Segurança Pública da Bahia)",
    ));
    expect(error).toMatchObject({ code: "document_not_eligible", stage: "policy", sourceId: "governo-bahia" });
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("remove âncoras e links da própria notícia ENFAM sem ampliar a origem para FGV", () => {
    const news = "https://www.enfam.jus.br/publicado-o-edital-da-sexta-edicao-do-exame-nacional-da-magistratura/";
    const result = discoverOfficialDocumentCandidatesFromHtml(`
      <a href="#mobile-menu"></a><a href="#">Menu</a><a href="${news}#top">Edital</a>
      <a href="${news}">Notícia</a><a href="https://conhecimento.fgv.br/exames/enam/6exame">edital completo</a>
      <a href="/arquivos/edital.pdf#page=2">Edital oficial</a>
    `, news, "enfam");
    expect(result.map((item) => item.url)).toEqual(["https://www.enfam.jus.br/arquivos/edital.pdf"]);
  });

  it("preserva downloads sem extensão, ordenação, deduplicação e bloqueio de provas", () => {
    const result = discoverOfficialDocumentCandidatesFromHtml(`
      <a href="/download?id=123">Edital de abertura</a>
      <a href="/download?id=123">Edital de abertura</a>
      <a href="/anexo.pdf">Conteúdo programático</a>
      <a href="/gabarito.pdf">Edital</a>
      <a href="/search/edital">Edital</a>
    `, page, sourceId);
    expect(result.map((item) => item.url)).toEqual([
      "https://conhecimento.fgv.br/anexo.pdf", "https://conhecimento.fgv.br/download?id=123",
    ]);
  });

  it.each(["/concursos/pgmam126/index.html", "/rss/edital", "/edital.pdf?download=1"])(
    "recusa FCC %s sem DNS ou rede", async (path) => {
      const error = await failure(captureOfficialPdf({ ...candidate, url: `https://www.concursosfcc.com.br${path}` }, "fcc-concursos"));
      expect(error.code).toBe("robots_path_disallowed");
      expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  it("recusa a descoberta FCC sem depender do runner", async () => {
    expect((await failure(discoverOfficialDocumentCandidates("https://www.concursosfcc.com.br/concursos/pgmam126/index.html", "fcc-concursos"))).code).toBe("robots_path_disallowed");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(["http://conhecimento.fgv.br/edital.pdf", "https://evil.example/edital.pdf", `https://user:${secret}@conhecimento.fgv.br/edital.pdf`, "https://conhecimento.fgv.br:444/edital.pdf"])(
    "mantém a validação de documento para %s", async (url) => {
      expect((await failure(captureOfficialPdf({ ...candidate, url }, sourceId))).code).toBe("invalid_document_url");
      expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.lookup).not.toHaveBeenCalled();
    },
  );

  it("tipa URL de fonte inválida e material proibido", async () => {
    expect((await failure(discoverOfficialDocumentCandidates(`https://${secret}.invalid`, sourceId))).code).toBe("invalid_source_url");
    expect((await failure(captureOfficialPdf({ ...candidate, label: "Edital e gabarito" }, sourceId))).code).toBe("prohibited_exam_material");
    expect(() => buildDirectOfficialDocumentCandidate(pdfUrl, sourceId, "Gabarito")).toThrow(OfficialDocumentFetchError);
  });
});

describe("DNS, transporte e redirects", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.16.0.1", "192.168.1.1", "::1", "fc00::1", "fe80::1"])("bloqueia resolução privada %s", async (address) => {
    mocks.lookup.mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }]);
    expect((await failure(capture())).code).toBe("unsafe_source_address");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("bloqueia DNS vazio ou misto público/privado", async () => {
    mocks.lookup.mockResolvedValueOnce([]).mockResolvedValueOnce([{ address: "8.8.8.8" }, { address: "10.0.0.1" }]);
    expect((await failure(capture())).code).toBe("unsafe_source_address");
    expect((await failure(capture())).code).toBe("unsafe_source_address");
  });
  it("tipa falha DNS desconhecida sem expor detalhes", async () => {
    mocks.lookup.mockRejectedValue(unsafeError());
    expect((await failure(capture())).code).toBe("official_dns_failed");
  });
  it.each([
    ["ENOTFOUND", "official_dns_failed"], ["EAI_AGAIN", "official_dns_failed"],
    ["CERT_HAS_EXPIRED", "official_tls_failed"], ["ERR_TLS_CERT_ALTNAME_INVALID", "official_tls_failed"],
    ["ECONNRESET", "official_connection_failed"], ["ETIMEDOUT", "official_timeout"],
    ["UND_ERR_CONNECT_TIMEOUT", "official_timeout"], [secret, "official_request_failed"],
  ])("classifica código de transporte %s sem copiar causa", async (code, expected) => {
    mocks.fetch.mockRejectedValue(Object.assign(unsafeError(), { cause: { code, message: secret } }));
    expect((await failure(capture())).code).toBe(expected);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["AbortError", "TimeoutError"])("tipa %s e preserva timeout de 15 segundos", async (name) => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    mocks.fetch.mockRejectedValue(new DOMException(secret, name));
    expect((await failure(capture())).code).toBe("official_timeout");
    expect(timeout).toHaveBeenCalledWith(15_000);
  });
  it.each([401, 403, 404, 429, 503])("registra HTTP %i sem retry nem corpo/cabeçalhos externos", async (status) => {
    mocks.fetch.mockResolvedValue(new Response(secret, { status, headers: { "set-cookie": secret, "retry-after": "60" } }));
    expect(await failure(capture())).toMatchObject({ code: `official_http_${status}`, httpStatus: status, stage: "request", sourceId });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.getDocumentProxy).not.toHaveBeenCalled();
  });
  it.each([`https://evil.example/${secret}`, `https://user:${secret}@conhecimento.fgv.br/edital.pdf`, "http://conhecimento.fgv.br/edital.pdf", "https://conhecimento.fgv.br:444/edital.pdf", "https://["])("recusa redirect inseguro %s", async (location) => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    expect((await failure(capture())).code).toBe("redirect_disallowed");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("recusa redirect para caminho proibido antes de consultá-lo", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: "/search/edital" } }));
    expect((await failure(capture())).code).toBe("robots_path_disallowed");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("verifica DNS novamente após redirect permitido", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: "/novo-edital.pdf" } }));
    mocks.lookup.mockResolvedValueOnce([{ address: "8.8.8.8" }]).mockResolvedValueOnce([{ address: "127.0.0.1" }]);
    expect((await failure(capture())).code).toBe("unsafe_source_address");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("mantém no máximo quatro redirects e libera os corpos", async () => {
    const cancel = vi.fn();
    mocks.fetch.mockImplementation(() => new Response(new ReadableStream({ cancel }), { status: 302, headers: { location: "/outro-edital.pdf" } }));
    expect((await failure(capture())).code).toBe("redirect_limit");
    expect(mocks.fetch).toHaveBeenCalledTimes(5);
    expect(cancel).toHaveBeenCalledTimes(5);
    expect(mocks.fetch.mock.calls.every(([, init]) => init.redirect === "manual")).toBe(true);
  });
  it("distingue redirect sem destino mesmo se cancelamento falhar", async () => {
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({ cancel() { throw unsafeError(); } }), { status: 302 }));
    expect((await failure(capture())).code).toBe("redirect_missing_location");
  });
});

describe("leitura limitada e PDF", () => {
  it.each([null, ""])("distingue corpo vazio %s", async (body) => {
    mocks.fetch.mockResolvedValue(new Response(body));
    expect((await failure(capture())).code).toBe("empty_source_body");
  });
  it("mantém teto declarado de 15 MB e cancela antes do parser", async () => {
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "content-length": String(MAX_OFFICIAL_DOCUMENT_BYTES + 1) } }));
    expect((await failure(capture())).code).toBe("document_size_limit");
    expect(cancel).toHaveBeenCalled(); expect(mocks.getDocumentProxy).not.toHaveBeenCalled();
  });
  it("mantém teto real de 15 MB mesmo com tamanho declarado falso e cancelamento falho", async () => {
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_OFFICIAL_DOCUMENT_BYTES + 1)); },
      cancel() { throw unsafeError(); },
    }), { headers: { "content-length": "1" } }));
    expect((await failure(capture())).code).toBe("document_size_limit");
    expect(mocks.getDocumentProxy).not.toHaveBeenCalled();
  });
  it.each([true, false])("mantém teto HTML de 2 MB (declarado=%s)", async (declared) => {
    mocks.fetch.mockResolvedValue(new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { "content-type": "text/html", ...(declared ? { "content-length": "2097153" } : {}) } }));
    expect((await failure(discover())).code).toBe("discovery_size_limit");
  });
  it.each([false, true])("tipa falha durante leitura (timeout=%s)", async (timeout) => {
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({ start(c) { c.error(timeout ? new DOMException(secret, "TimeoutError") : unsafeError()); } })));
    expect((await failure(capture())).code).toBe(timeout ? "official_timeout" : "official_body_read_failed");
  });
  it("cancela conteúdo de tipo não aceito", async () => {
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/json" } }));
    expect((await failure(discover())).code).toBe("unsupported_source_type");
    expect(cancel).toHaveBeenCalled();
  });
  it("descobre PDF por content-type sem deixar corpo aberto", async () => {
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/pdf" } }));
    expect(await discover()).toHaveLength(1); expect(cancel).toHaveBeenCalled();
  });
  it("descobre links de HTML e PDF direto sem acessar o PDF antecipadamente", async () => {
    mocks.fetch.mockResolvedValue(new Response('<a href="/edital.pdf">Edital</a>', { headers: { "content-type": "text/html" } }));
    expect((await discover())[0].url).toBe(pdfUrl);
    mocks.fetch.mockClear();
    expect(await discoverOfficialDocumentCandidates("https://conhecimento.fgv.br/exames/edital.pdf", sourceId)).toHaveLength(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("recusa HTML com status 200 sem inferir WAF ou acionar parser", async () => {
    mocks.fetch.mockResolvedValue(new Response(`<html>${secret}</html>`));
    expect((await failure(capture())).code).toBe("invalid_pdf_signature");
    expect(mocks.getDocumentProxy).not.toHaveBeenCalled();
  });
  it("preserva bloqueio de prova no nome enviado pelo servidor", async () => {
    mocks.fetch.mockResolvedValue(new Response("%PDF-1.7", { headers: { "content-disposition": 'attachment; filename="gabarito.pdf"' } }));
    expect((await failure(capture())).code).toBe("prohibited_exam_material");
    expect(mocks.getDocumentProxy).not.toHaveBeenCalled();
  });
  it("isola erro do parser de mensagens e códigos de rede falsos", async () => {
    mocks.getDocumentProxy.mockRejectedValue(Object.assign(unsafeError(), { code: "ENOTFOUND" }));
    expect((await failure(capture())).code).toBe("pdf_parse_failed");
  });
  it("isola erro da extração e não o substitui por erro de limpeza", async () => {
    mocks.extractText.mockRejectedValue(unsafeError()); mocks.cleanup.mockRejectedValue(unsafeError());
    expect((await failure(capture())).code).toBe("pdf_extract_failed");
    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  });
  it.each([0, 251])("preserva limite de páginas: %s", async (numPages) => {
    mocks.getDocumentProxy.mockResolvedValue({ numPages, cleanup: mocks.cleanup });
    expect((await failure(capture())).code).toBe("pdf_page_limit");
    expect(mocks.extractText).not.toHaveBeenCalled(); expect(mocks.cleanup).toHaveBeenCalled();
  });
  it.each([["curto", "pdf_needs_ocr"], ["x".repeat(MAX_OFFICIAL_DOCUMENT_TEXT_LENGTH + 1), "pdf_text_limit"]])("preserva limites de texto (%#)", async (text, code) => {
    mocks.extractText.mockResolvedValue({ totalPages: 1, text: [text] });
    expect((await failure(capture())).code).toBe(code); expect(mocks.cleanup).toHaveBeenCalled();
  });
  it("tipa falha de limpeza quando não há erro anterior", async () => {
    mocks.cleanup.mockRejectedValue(unsafeError());
    expect((await failure(capture())).code).toBe("pdf_cleanup_failed");
  });
  it("mantém bytes próprios mesmo quando o parser transfere o buffer", async () => {
    mocks.getDocumentProxy.mockImplementation(async (bytes: Uint8Array) => {
      structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
      return { numPages: 1, cleanup: mocks.cleanup };
    });
    const result = await capture();
    expect(result.documentBytes.toString()).toBe("%PDF-1.7\nfixture");
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.pageCount).toBe(1); expect(result.textLength).toBeGreaterThan(100);
  });
});

describe("contrato de erro seguro", () => {
  it("não percorre causas cíclicas indefinidamente nem copia código arbitrário", () => {
    const error = Object.assign(unsafeError(), { code: secret, cause: {} }); error.cause = error;
    const safe = normalizeOfficialDocumentFetchError(error, "official_request_failed", "request", sourceId);
    expect(safe.code).toBe("official_request_failed"); expect(JSON.stringify(safe)).not.toContain(secret);
    expect(safe).not.toHaveProperty("cause");
  });
  it("normaliza códigos inválidos e fonte inválida em chamadas JavaScript", () => {
    const error = new OfficialDocumentFetchError(secret as "official_timeout", "request", secret as typeof sourceId);
    expect(error.code).toBe("official_request_failed"); expect(error.sourceId).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(secret);
  });
  it("tipa falha de descoberta sem carregar o erro original", () => {
    const error = normalizeOfficialDocumentFetchError(unsafeError(), "official_discovery_failed", "discovery", "enfam");
    expect(JSON.parse(safeEditorialError(error))).toEqual({ code: "official_discovery_failed" });
    expect(JSON.stringify(error)).not.toContain(secret);
  });
});
