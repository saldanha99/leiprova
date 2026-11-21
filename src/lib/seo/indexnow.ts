import { SITE_URL } from "@/lib/seo";

/**
 * IndexNow (spec 4.5). OFF by default: without `INDEXNOW_KEY` nothing is sent.
 * The key is a public ownership proof served at `/{key}.txt` (public/), not a
 * secret. Google does not use IndexNow; Bing, Yandex, Seznam and Naver do.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_BATCH = 10_000;

export type IndexNowResult =
  | Readonly<{ sent: false; reason: "disabled" | "empty" }>
  | Readonly<{ sent: true; batches: readonly Readonly<{ status: number; count: number }>[] }>;

export type IndexNowOptions = Readonly<{
  key?: string;
  origin?: string;
  fetcher?: typeof fetch;
}>;

export function indexNowPayloads(urls: readonly string[], key: string, origin: string) {
  const host = new URL(origin).host;
  const own = [...new Set(urls)].filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === origin && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  });
  const payloads = [];
  for (let start = 0; start < own.length; start += INDEXNOW_BATCH) {
    payloads.push({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: own.slice(start, start + INDEXNOW_BATCH) });
  }
  return payloads;
}

export async function submitIndexNow(urls: readonly string[], options: IndexNowOptions = {}): Promise<IndexNowResult> {
  const key = (options.key ?? process.env.INDEXNOW_KEY ?? "").trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) return { sent: false, reason: "disabled" };
  const payloads = indexNowPayloads(urls, key, options.origin ?? SITE_URL);
  if (payloads.length === 0) return { sent: false, reason: "empty" };
  const fetcher = options.fetcher ?? fetch;
  const batches: { status: number; count: number }[] = [];
  for (const payload of payloads) {
    const response = await fetcher(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    batches.push({ status: response.status, count: payload.urlList.length });
    // No retry: 4xx/5xx stops the run and is reported; the next job resends.
    if (response.status !== 200 && response.status !== 202) break;
  }
  return { sent: true, batches };
}
