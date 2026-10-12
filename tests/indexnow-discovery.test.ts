import { describe, expect, it, vi } from "vitest";
import { ORIGIN, KEY_LOCATION, OWNERSHIP_KEY, INDEXNOW_ENDPOINT, parseArguments, parseSitemapUrls,
  runDiscovery, validatePublicHtml } from "../scripts/indexnow-discovery.mjs";

const page = `${ORIGIN}/concursos`;
const sitemap = (urls: string[]) => `<?xml version="1.0"?><urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
const xml = () => new Response(sitemap([page]), { headers: { "Content-Type": "application/xml" } });
const html = () => new Response(`<head><link rel="canonical" href="${page}"></head><h1>Concursos</h1>`, { headers: { "Content-Type": "text/html" } });
const key = () => new Response(OWNERSHIP_KEY, { headers: { "Content-Type": "text/plain" } });

describe("descoberta IndexNow delimitada", () => {
  it("preview faz somente leitura do sitemap, sem notificação ou chave remota", async () => {
    const fetcher = vi.fn().mockResolvedValue(xml());
    const report = await runDiscovery({ fetcher });
    expect(report).toMatchObject({ mode: "preview", notificationSent: false, indexed: false, urlCount: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${ORIGIN}/sitemap.xml`);
    expect(parseArguments([])).toEqual({ apply: false });
    expect(() => parseArguments(["--host=evil.invalid"])).toThrow();
  });
  it.each(["https://evil.invalid/concursos", `${ORIGIN}/app`, `${ORIGIN}/admin/x`, `${ORIGIN}/api/health`,
    `${ORIGIN}/entrar`, `${ORIGIN}/checkout/enam`, `${ORIGIN}/concursos?preview=1`, `${ORIGIN}/%61pp`,
    "https://www.editaleiseca.com.br/", `${ORIGIN}/concursos#privado`])("recusa URL %s antes de outras chamadas", (url) => {
    expect(() => parseSitemapUrls(sitemap([url]))).toThrow();
  });
  it("recusa sitemap vazio, repetido, acima do limite e entidades externas", () => {
    for (const text of [sitemap([]), sitemap([page, page]), sitemap(Array(257).fill(page)),
      '<!DOCTYPE urlset SYSTEM "https://evil.invalid/file"><urlset></urlset>']) {
      expect(() => parseSitemapUrls(text)).toThrow();
    }
  });
  it("apply exige prova válida, canonical próprio e indexação permitida antes do POST", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(xml()).mockResolvedValueOnce(new Response("errado"));
    await expect(runDiscovery({ apply: true, fetcher })).rejects.toThrow("titularidade");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe(KEY_LOCATION);
    expect(fetcher.mock.calls.every((call) => call[0] !== INDEXNOW_ENDPOINT)).toBe(true);
  });
  it.each([200, 202])("envia lote único após validação e distingue HTTP %s de indexação", async (status) => {
    const fetcher = vi.fn().mockResolvedValueOnce(xml()).mockResolvedValueOnce(key())
      .mockResolvedValueOnce(html()).mockResolvedValueOnce(new Response("", { status }));
    const report = await runDiscovery({ apply: true, fetcher });
    expect(report).toMatchObject({ notificationSent: true, accepted: true, indexed: false,
      httpStatus: status, keyValidationPending: status === 202 });
    expect(fetcher).toHaveBeenCalledTimes(4);
    const [url, init] = fetcher.mock.calls[3];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(JSON.parse(init.body)).toMatchObject({ host: "editaleiseca.com.br", key: OWNERSHIP_KEY, urlList: [page] });
  });
  it("recusa noindex, canonical divergente e páginas privadas antes da notificação", () => {
    for (const text of [`<link rel="canonical" href="${page}"><meta name="robots" content="noindex"><h1>X</h1>`,
      '<link rel="canonical" href="https://evil.invalid"><h1>X</h1>']) {
      expect(() => validatePublicHtml(text, page, new Headers())).toThrow();
    }
    expect(() => validatePublicHtml(`<link rel="canonical" href="${page}"><h1>X</h1>`, page,
      new Headers({ "X-Robots-Tag": "noindex" }))).toThrow();
  });
  it("não tenta reenviar 429", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(xml()).mockResolvedValueOnce(key())
      .mockResolvedValueOnce(html()).mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(runDiscovery({ apply: true, fetcher })).rejects.toThrow("429");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
