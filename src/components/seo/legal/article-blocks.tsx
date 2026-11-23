import type { PublicQuestion } from "@/lib/seo/legal-snapshot";
import { parseLiteralText } from "@/lib/seo/literal-text";

const INDENT = ["", "pl-4 sm:pl-6", "pl-8 sm:pl-12", "pl-12 sm:pl-16"] as const;

/** Literal text with one anchor per caput, paragraph, inciso and alínea. */
export function LiteralText({ literalText }: { literalText: string }) {
  const blocks = parseLiteralText(literalText);
  return (
    <div className="space-y-2 rounded-2xl border border-els-line bg-els-surface p-5 font-serif text-[15px] leading-7 text-els-fg-2">
      {blocks.map((block) => (
        <p className={`${INDENT[Math.min(block.depth, 3)]} scroll-mt-24`} id={block.id} key={block.id}>
          {block.label ? (
            <a className="mr-1 font-sans font-bold text-els-amber-ink hover:underline" href={`#${block.id}`}>
              {block.label}
              {block.kind === "inciso" ? " –" : ""}
            </a>
          ) : null}
          {block.text}
        </p>
      ))}
    </div>
  );
}

export function PublicQuestionCard({ question, index }: { question: PublicQuestion; index: number }) {
  const isTrueFalse = question.type === "true_false";
  return (
    <article className="scroll-mt-24 rounded-2xl border border-els-line bg-els-raise p-5" id={question.anchorId}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-els-fg-3">
        Questão {index} · <span className="text-els-amber-ink">{question.origin.label}</span>
      </p>
      <p className="mt-3 text-[15px] leading-7 text-els-fg">{question.prompt}</p>
      {isTrueFalse ? (
        <p className="mt-3 text-sm font-semibold text-els-fg-3">Certo ou errado?</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm leading-6 text-els-fg-2">
          {question.options.map((option) => (
            <li key={option.key}>
              <span className="mr-2 font-bold text-els-fg-3">{option.key})</span>
              {option.text}
            </li>
          ))}
        </ol>
      )}
      <details className="mt-4 rounded-xl border border-els-line bg-els-surface p-4 text-sm leading-7 text-els-fg-2">
        <summary className="cursor-pointer font-bold text-els-amber-ink">Ver gabarito e comentário</summary>
        <p className="mt-3">
          <strong className="text-els-fg">Gabarito: </strong>
          {question.correct ? (isTrueFalse ? question.correct.text : `${question.correct.key}) ${question.correct.text}`) : "não informado"}
        </p>
        <p className="mt-2">{question.explanation}</p>
        {question.options.some((option) => option.rationale) ? (
          <ul className="mt-3 space-y-1 text-els-fg-3">
            {question.options
              .filter((option) => option.rationale)
              .map((option) => (
                <li key={option.key}>
                  <strong className="text-els-fg-2">{isTrueFalse ? option.text : option.key}:</strong> {option.rationale}
                </li>
              ))}
          </ul>
        ) : null}
      </details>
    </article>
  );
}
