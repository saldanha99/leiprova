import { afterEach, describe, expect, it, vi } from "vitest";
import { getDocumentProxy } from "unpdf";
import { extractFirstPageText, MPRJ_MC5_FORMAT_EVIDENCE as target, observeMprjMc5Cover, parseMprjType1Cover } from "@/lib/editorial/mprj-format-evidence";

vi.mock("unpdf", () => ({ getDocumentProxy: vi.fn() }));
// Synthetic instructions only. No official booklet or question text in fixtures.
const cover = "XXXIX Concurso P R O M O T O R D E J U S T I Ç A S U B S T I T U T O Tipo – 1. 100 (cem) questões objetivas. As questões objetivas têm 5 (cinco) opções de resposta (A, B, C, D e E) e somente uma delas está correta.";
const response = (body: string | Uint8Array, mime: string, status = 200) => new Response(body as BodyInit, { status, headers: { "content-type": mime } });
const fetcher = (robots = "User-agent: *\nAllow: /\n", pdf: Response = response("%PDF-" + "x".repeat(1100), "application/pdf")) => vi.fn<typeof fetch>()
  .mockResolvedValueOnce(response(robots, "text/plain")).mockResolvedValueOnce(pdf);
afterEach(() => vi.clearAllMocks());
describe("evidência transitória MPRJ: somente capa", () => {
  it("valida heading espaçado e retorna só fatos e hash", () => {
    const facts = parseMprjType1Cover(cover);
    expect(facts).toMatchObject({ optionCount: 5, questionCount: 100, singleCorrect: true, pageNumber: 1 });
    expect(JSON.stringify(facts)).not.toContain("questões");
  });
  it.each([
    cover.replace("XXXIX", "XXXVIII"), cover.replace("S U B S T I T U T O", "T I T U L A R"),
    cover.replace("Tipo – 1", "Tipo 2"), cover.replace("Tipo – 1", "Tipo 10"),
    cover.replace("5 (cinco)", "4 (quatro)"), cover.replace("5 (cinco)", "6 (seis)"),
    cover.replace("somente uma delas está correta", "somente uma delas não está correta"),
    cover.replace("somente uma delas está correta", "duas delas estão corretas"),
    cover.replace("somente uma delas está correta", "somente uma delas deve ser marcada"),
    cover.replace("As questões", "Não é verdade que as questões"),
    cover + " Outra etapa: julgamento CERTO ou ERRADO.",
  ])("recusa identidade/formato incompleto ou negado", text => expect(() => parseMprjType1Cover(text)).toThrow());
  it("buffer real vira Uint8Array independente; pede só página1 e destrói loadingTask", async () => {
    const download = Buffer.from("%PDF-" + "x".repeat(1100));
    const destroy = vi.fn().mockResolvedValue(undefined);
    const getPage = vi.fn().mockResolvedValue({ getTextContent: async () => ({ items: [{ str: cover }] }) });
    vi.mocked(getDocumentProxy).mockImplementation(async input => {
      expect(input).toBeInstanceOf(Uint8Array); expect(Buffer.isBuffer(input)).toBe(false);
      expect((input as Uint8Array).buffer).not.toBe(download.buffer);
      return { numPages: 20, getPage, loadingTask: { destroy } } as never;
    });
    expect(await extractFirstPageText(download)).toBe(cover);
    expect(getPage.mock.calls).toEqual([[1]]); expect(destroy).toHaveBeenCalledOnce();
    expect(download.subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("destrói PDF mesmo quando a página falha e limpa a cópia", async () => {
    let copy: Uint8Array | undefined;
    const destroy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDocumentProxy).mockImplementation(async input => {
      copy = input as Uint8Array;
      return { numPages: 20, getPage: async () => { throw new Error("synthetic parse failure"); }, loadingTask: { destroy } } as never;
    });
    await expect(extractFirstPageText(Buffer.from("%PDF-" + "x".repeat(1100)))).rejects.toThrow("synthetic");
    expect(destroy).toHaveBeenCalledOnce(); expect(copy?.every(byte => byte === 0)).toBe(true);
  });
  it("robots precede PDF; saída nunca contém texto; bytes temporários são limpos", async () => {
    const f = fetcher(); let downloaded: Uint8Array | undefined;
    const observed = await observeMprjMc5Cover({ fetcher: f, extractPageOne: async bytes => { downloaded = bytes; return cover; } });
    expect(observed.sourceUrl).toBe(target.sourceUrl); expect(f.mock.calls[0][0]).toContain("robots.txt");
    expect(downloaded?.every(byte => byte === 0)).toBe(true);
    expect(Object.keys(observed)).not.toContain("text"); expect(JSON.stringify(observed)).not.toContain("questões");
  });
  it("robots proibindo impede até baixar o PDF", async () => {
    const f = fetcher("User-agent: *\nDisallow: /sites/\n");
    await expect(observeMprjMc5Cover({ fetcher: f })).rejects.toThrow(); expect(f).toHaveBeenCalledOnce();
  });
  it.each([response("bad", "text/html"), response("bad", "application/pdf", 403),
    response("bad", "application/pdf", 302), response("", "application/pdf"),
    new Response("bad", { headers: { "content-type": "application/pdf", "content-length": "99999999" } }),
  ])("recusa MIME/status/redirect/limite/vazio", async pdf => {
    const extract = vi.fn(); await expect(observeMprjMc5Cover({ fetcher: fetcher(undefined, pdf), extractPageOne: extract })).rejects.toThrow();
    expect(extract).not.toHaveBeenCalled();
  });
  it("URL final divergente bloqueia mesmo com status200", async () => {
    const pdf = response("%PDF-" + "x".repeat(1100), "application/pdf"); Object.defineProperty(pdf, "url", { value: "https://example.invalid/a.pdf" });
    await expect(observeMprjMc5Cover({ fetcher: fetcher(undefined, pdf) })).rejects.toThrow("redirecionada");
  });
});
