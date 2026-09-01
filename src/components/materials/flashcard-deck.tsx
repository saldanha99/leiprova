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
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center">
        <Layers3 className="mx-auto size-7 text-slate-600" />
        <p className="mt-3 text-sm font-semibold text-slate-300">Nenhum flashcard publicado</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">Os cartões aparecerão quando houver dispositivos revisados no acervo.</p>
      </div>
    );
  }

  const trainHref = `/app/treinar?tema=${encodeURIComponent(card.topic)}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{index + 1} de {cards.length}</span>
        <span className="truncate">{card.actTitle}</span>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-expanded={revealed}
        className="mt-3 flex min-h-72 w-full flex-col rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,.09),transparent_38%),#07101a] p-6 text-left transition hover:border-amber-300/20 sm:p-8"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">{card.articleRef}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-emerald-300">{revealed ? "Literalidade oficial" : "Recuperação ativa"}</span>
        </div>

        <div className="my-auto py-7">
          {revealed ? (
            <blockquote className="border-l-2 border-emerald-300/40 pl-4 text-base leading-8 text-slate-100 sm:text-lg">
              {card.literalText}
            </blockquote>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-500">{card.topic}</p>
              <p className="mt-3 max-w-2xl text-xl font-semibold leading-8 text-white sm:text-2xl">
                Sem consultar, recite a redação de {card.articleRef}.
              </p>
            </>
          )}
        </div>

        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
          {revealed ? <RefreshCcw className="size-3.5" /> : <Eye className="size-3.5" />}
          {revealed ? "Ocultar resposta" : "Revelar literalidade"}
        </span>
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Flashcard anterior" className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"><ArrowLeft className="size-4" /></button>
          <button type="button" onClick={() => move(1)} aria-label="Próximo flashcard" className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"><ArrowRight className="size-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {revealed && (
            <a href={card.officialUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-emerald-300">
              Fonte oficial <ExternalLink className="size-3.5" />
            </a>
          )}
          <Link href={trainHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-slate-950">
            Treinar este tema <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
      {revealed && <p className="mt-3 text-[11px] text-slate-600">Redação verificada em {new Intl.DateTimeFormat("pt-BR").format(new Date(card.verifiedAt))}. O enunciado de recuperação é original da Editalume.</p>}
    </div>
  );
}
