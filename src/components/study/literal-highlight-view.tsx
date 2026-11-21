import type { LiteralFeedback } from "@/lib/study/literal-highlight";
import { cn } from "@/lib/utils";

/**
 * Trecho literal do artigo no gabarito: verde = o que a lei diz e o item confirma;
 * vermelho = a palavra da lei que a alternativa trocou (o ponto da pegadinha).
 */
export function LiteralHighlightView({ literal, className }: { literal: LiteralFeedback; className?: string }) {
  return (
    <figure className={cn("rounded-xl border border-white/8 bg-slate-950/40 p-4", className)}>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[.14em]">
        <span className="text-amber-200">{literal.articleRef}</span>
        <span className="text-slate-500">{literal.actTitle}</span>
        <span className="ml-auto flex items-center gap-3 normal-case tracking-normal font-semibold">
          <span className="inline-flex items-center gap-1.5 text-emerald-200"><span aria-hidden className="size-2 rounded-full bg-emerald-300" />o item confirma</span>
          {literal.hasTrap && <span className="inline-flex items-center gap-1.5 text-rose-200"><span aria-hidden className="size-2 rounded-full bg-rose-400" />ponto da pegadinha</span>}
        </span>
      </figcaption>
      <blockquote className="whitespace-pre-line text-sm leading-7 text-slate-300">
        {literal.segments.map((segment, index) =>
          segment.kind === "plain" ? (
            <span key={index}>{segment.text}</span>
          ) : segment.kind === "match" ? (
            <mark key={index} className="rounded bg-emerald-300/15 px-0.5 text-emerald-50">{segment.text}</mark>
          ) : (
            <mark key={index} className="rounded bg-rose-400/25 px-0.5 font-semibold text-rose-50 underline decoration-rose-300 decoration-2 underline-offset-4">
              {segment.text}
            </mark>
          ),
        )}
      </blockquote>
    </figure>
  );
}
