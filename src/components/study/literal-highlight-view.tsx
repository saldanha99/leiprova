import type { LiteralFeedback, LiteralSegment } from "@/lib/study/literal-highlight";
import { cn } from "@/lib/utils";

/**
 * Trecho literal do artigo no gabarito: verde = o que a lei diz e o item confirma;
 * vermelho = a palavra da lei que a alternativa trocou (o ponto da pegadinha).
 */
function Segments({ segments }: { segments: LiteralSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "plain" ? (
          <span key={index}>{segment.text}</span>
        ) : segment.kind === "match" ? (
          <mark key={index} className="rounded bg-els-green/15 px-0.5 text-els-fg">{segment.text}</mark>
        ) : (
          <mark key={index} className="rounded bg-els-danger/25 px-0.5 font-semibold text-els-fg underline decoration-els-danger-ink decoration-2 underline-offset-4">
            {segment.text}
          </mark>
        ),
      )}
    </>
  );
}

export function LiteralHighlightView({ literal, className }: { literal: LiteralFeedback; className?: string }) {
  return (
    <figure className={cn("rounded-xl border border-els-line bg-els-bg/40 p-4", className)}>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[.14em]">
        <span className="text-els-amber-ink">{literal.articleRef}</span>
        <span className="text-els-fg-3">{literal.actTitle}</span>
        <span className="ml-auto flex items-center gap-3 normal-case tracking-normal font-semibold">
          <span className="inline-flex items-center gap-1.5 text-els-green-ink"><span aria-hidden className="size-2 rounded-full bg-els-green" />o item confirma</span>
          {literal.hasTrap && <span className="inline-flex items-center gap-1.5 text-els-danger-ink"><span aria-hidden className="size-2 rounded-full bg-els-danger" />ponto da pegadinha</span>}
        </span>
      </figcaption>
      <blockquote className="whitespace-pre-line text-sm leading-7 text-els-fg-2">
        <Segments segments={literal.excerpt ?? literal.segments} />
      </blockquote>
      {literal.excerpt && (
        <details className="mt-3 border-t border-els-line pt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-els-fg-3 hover:text-els-fg">Ver o artigo inteiro</summary>
          <blockquote className="mt-3 whitespace-pre-line text-sm leading-7 text-els-fg-3">
            <Segments segments={literal.segments} />
          </blockquote>
        </details>
      )}
    </figure>
  );
}
