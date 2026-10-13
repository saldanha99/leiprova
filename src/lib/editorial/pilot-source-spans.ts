import type { WorkArticle } from "./agent-work-contract";

export type PilotSourceSpan = { id: number; articleId: number; text: string };

/** Copy whole contiguous lines from the verified input; never repair generated citations. */
export function pilotSourceSpans(articles: readonly WorkArticle[]): PilotSourceSpan[] {
  const spans: PilotSourceSpan[] = [];
  for (const article of articles) {
    const candidates = article.text.split(/\r?\n/u).map(line => line.trim())
      .filter(line => line.length >= 20 && line.length <= 1800);
    const count = Math.min(8, candidates.length);
    for (let i = 0; i < count; i++) {
      const line = candidates[Math.floor(i * candidates.length / count)];
      spans.push({ id: spans.length, articleId: article.id, text: line });
    }
  }
  if (!spans.length) throw new Error("Nenhum trecho contínuo elegível; não inventar citação.");
  return spans;
}

export function resolvePilotSourceSpan(spans: readonly PilotSourceSpan[], id: number) {
  const span = spans.find(item => item.id === id);
  if (!Number.isSafeInteger(id) || !span) throw new Error("Identificador de trecho ausente ou inválido.");
  return { articleId: span.articleId, quote: span.text };
}
