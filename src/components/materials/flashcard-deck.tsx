"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Eye,
  Layers3,
  RefreshCcw,
} from "lucide-react";

type Flashcard = {
  id: number;
  topic: string;
  articleRef: string;
  literalText: string;
  actTitle: string;
  officialUrl: string;
  verifiedAt: Date;
};

export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = cards[index];

  function move(direction: -1 | 1) {
    setIndex((current) => (current + direction + cards.length) % cards.length);
    setRevealed(false);
  }

  if (!card) {
    return (
      <div className="rounded-2xl border border-dashed border-els-line bg-els-bg/20 p-8 text-center">
        <Layers3 className="mx-auto size-7 text-els-fg-4" />
        <p className="mt-3 text-sm font-semibold text-els-fg-2">Nenhum flashcard publicado</p>
        <p className="mt-1 text-xs leading-5 text-els-fg-4">Os cartões aparecerão quando houver dispositivos revisados no acervo.</p>
      </div>
    );
  }

  const trainHref = `/app/treinar?tema=${encodeURIComponent(card.topic)}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs text-els-fg-3">
        <span>{index + 1} de {cards.length}</span>
        <span className="truncate">{card.actTitle}</span>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-expanded={revealed}
        className="mt-3 flex min-h-72 w-full flex-col rounded-2xl border border-els-line bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--els-green)_9%,transparent),transparent_38%),var(--els-bg)] p-6 text-left transition hover:border-els-amber/20 sm:p-8"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <span className="rounded-full bg-els-amber/10 px-2.5 py-1 text-[11px] font-bold text-els-amber-ink">{card.articleRef}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-els-green-ink">{revealed ? "Literalidade oficial" : "Recuperação ativa"}</span>
        </div>

        <div className="my-auto py-7">
          {revealed ? (
            <blockquote className="border-l-2 border-els-green/40 pl-4 text-base leading-8 text-els-fg sm:text-lg">
              {card.literalText}
            </blockquote>
          ) : (
            <>
              <p className="text-xs font-semibold text-els-fg-3">{card.topic}</p>
              <p className="mt-3 max-w-2xl text-xl font-semibold leading-8 text-els-fg sm:text-2xl">
                Sem consultar, recite a redação de {card.articleRef}.
              </p>
            </>
          )}
        </div>

        <span className="inline-flex items-center gap-2 text-xs font-semibold text-els-fg-3">
          {revealed ? <RefreshCcw className="size-3.5" /> : <Eye className="size-3.5" />}
          {revealed ? "Ocultar resposta" : "Revelar literalidade"}
        </span>
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Flashcard anterior" className="grid size-10 place-items-center rounded-xl border border-els-line text-els-fg-3 transition hover:border-els-line-strong hover:text-els-fg"><ArrowLeft className="size-4" /></button>
          <button type="button" onClick={() => move(1)} aria-label="Próximo flashcard" className="grid size-10 place-items-center rounded-xl border border-els-line text-els-fg-3 transition hover:border-els-line-strong hover:text-els-fg"><ArrowRight className="size-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {revealed && (
            <a href={card.officialUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-els-green-ink min-h-11">
              Fonte oficial <ExternalLink className="size-3.5" />
            </a>
          )}
          <Link href={trainHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-els-amber px-4 text-xs font-bold text-els-on-amber">
            Treinar este tema <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
      {revealed && <p className="mt-3 text-[11px] text-els-fg-4">Redação verificada em {new Intl.DateTimeFormat("pt-BR").format(new Date(card.verifiedAt))}. O enunciado de recuperação é original da Edital Lei Seca.</p>}
    </div>
  );
}
