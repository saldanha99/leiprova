import { pathToFileURL } from "node:url";

export const ORIGIN = "https://editaleiseca.com.br";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
// Prova pública de titularidade, hospedada na raiz; não é credencial de acesso.
export const OWNERSHIP_KEY = "3f3de0bfb7e56de32de024a433b94f08";
export const KEY_LOCATION = `${ORIGIN}/${OWNERSHIP_KEY}.txt`;
const SITEMAP = `${ORIGIN}/sitemap.xml`;
const MAX_URLS = 256;
const MAX_BYTES = 2 * 1024 * 1024;
const PUBLIC_PATHS = new Set(["/", "/concursos", "/concursos/calendario", "/como-memorizar-lei-seca",
  "/fontes-e-atualizacao", "/metodologia", "/demo", "/termos", "/privacidade", "/reembolso"]);

export function validatePublicUrl(value) {
  const url = new URL(value);
  if (url.origin !== ORIGIN || url.username || url.password || url.search || url.hash ||
    url.port || url.href !== value || url.pathname.includes("%") ||
    !(PUBLIC_PATHS.has(url.pathname) || /^\/concursos\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+$/.test(url.pathname))) {
    throw new Error("URL fora do catálogo público canônico autorizado.");
  }
  return value;
}

export function parseSitemapUrls(xml) {
  if (Buffer.byteLength(xml) > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    !/<urlset\b/.test(xml) || !/<\/urlset>\s*$/.test(xml)) throw new Error("Sitemap XML inválido ou fora do limite.");
  const blocks = [...xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/g)];
  if (!blocks.length || blocks.length > MAX_URLS) throw new Error("Sitemap vazio ou excede 256 páginas.");
  const urls = blocks.map(([, block]) => {
    const locations = [...block.matchAll(/<loc>([^<]+)<\/loc>/g)];
    if (locations.length !== 1) throw new Error("Cada página deve ter uma localização única.");
    return validatePublicUrl(locations[0][1].trim());
  });
  if (new Set(urls).size !== urls.length) throw new Error("Sitemap com URLs repetidas.");
  return urls;
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([a-z-]+)\s*=\s*["']([^"']*)["']/gi)]
    .map(([, name, value]) => [name.toLowerCase(), value]));
}

export function validatePublicHtml(html, expectedUrl, headers) {
  if ((headers.get("x-robots-tag") ?? "").match(/\bnoindex\b/i)) throw new Error("Página marcada noindex no cabeçalho.");
  const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  if (tags.some((tag) => /^(robots|googlebot|bingbot)$/i.test(tag.name ?? "") && /\bnoindex\b/i.test(tag.content ?? ""))) {
    throw new Error("Página marcada noindex no HTML.");
  }
  const canonicals = tags.filter((tag) => /\bcanonical\b/i.test(tag.rel ?? ""));
  if (canonicals.length !== 1 || new URL(canonicals[0].href ?? "", ORIGIN).href !== expectedUrl || !/<h1\b/i.test(html)) {
    throw new Error("Página sem canonical próprio único ou sem H1 público.");
  }
}

async function requestText(fetcher, url, init = {}, maximumBytes = MAX_BYTES) {
  const response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "EditalLeiSeca-Discovery/1.0", ...init.headers } });
  if (!response.body) return { response, text: "" };
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) throw new Error("Resposta acima do limite de leitura.");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  return { response, text: Buffer.concat(chunks).toString("utf8") };
}

export async function runDiscovery({ apply = false, fetcher = fetch } = {}) {
  const sitemap = await requestText(fetcher, SITEMAP);
  if (sitemap.response.status !== 200 || !/xml/i.test(sitemap.response.headers.get("content-type") ?? "")) {
    throw new Error(`Sitemap indisponível ou sem XML: HTTP ${sitemap.response.status}`);
  }
  const urls = parseSitemapUrls(sitemap.text);
  const payload = { host: new URL(ORIGIN).hostname, key: OWNERSHIP_KEY, keyLocation: KEY_LOCATION, urlList: urls };
  const report = { generatedAt: new Date().toISOString(), mode: apply ? "apply" : "preview", endpoint: INDEXNOW_ENDPOINT,
    sitemap: SITEMAP, urlCount: urls.length, payload, notificationSent: false, indexed: false };
  if (!apply) return report;

  const ownership = await requestText(fetcher, KEY_LOCATION, {}, 1024);
  if (ownership.response.status !== 200 || !/^text\/plain\b/i.test(ownership.response.headers.get("content-type") ?? "") ||
    ownership.text.trim() !== OWNERSHIP_KEY) throw new Error("Prova pública de titularidade inválida ou ainda não publicada.");
  // Sequencial: no máximo 256 páginas, sem concorrência, redirects ou retries.
  for (const url of urls) {
    const page = await requestText(fetcher, url);
    if (page.response.status !== 200 || !/^text\/html\b/i.test(page.response.headers.get("content-type") ?? "")) {
      throw new Error(`Página pública inelegível: ${url}, HTTP ${page.response.status}`);
    }
    validatePublicHtml(page.text, url, page.response.headers);
  }
  const submission = await requestText(fetcher, INDEXNOW_ENDPOINT, { method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) }, 8192);
  const status = submission.response.status;
  if (status !== 200 && status !== 202) throw new Error(`Notificação IndexNow recusada: HTTP ${status}. Sem retry automático.`);
  return { ...report, notificationSent: true, httpStatus: status, accepted: true,
    keyValidationPending: status === 202, note: "Recebimento aceito; não comprova indexação, ranking ou citação por IA." };
}

export function parseArguments(args) {
  if (args.length === 0) return { apply: false };
  if (args.length === 1 && args[0] === "--apply") return { apply: true };
  throw new Error("Use node scripts/indexnow-discovery.mjs [--apply]. Preview é o padrão; domínio e endpoint são fixos.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDiscovery(parseArguments(process.argv.slice(2)))
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
