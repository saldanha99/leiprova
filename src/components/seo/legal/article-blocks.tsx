import type { PublicQuestion } from "@/lib/seo/legal-snapshot";
import { parseLiteralText } from "@/lib/seo/literal-text";

const INDENT = ["", "pl-4 sm:pl-6", "pl-8 sm:pl-12", "pl-12 sm:pl-16"] as const;

/** Literal text with one anchor per caput, paragraph, inciso and alínea. */
export function LiteralText({ literalText }: { literalText: string }) {
  const blocks = parseLiteralText(literalText);
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-[#08111c] p-5 font-serif text-[15px] leading-7 text-slate-200">
      {blocks.map((block) => (
        <p className={`${INDENT[Math.min(block.depth, 3)]} scroll-mt-24`} id={block.id} key={block.id}>
          {block.label ? (
            <a className="mr-1 font-sans font-bold text-amber-200 hover:underline" href={`#${block.id}`}>
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
    <article className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5" id={question.anchorId}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        Questão {index} · <span className="text-amber-200">{question.origin.label}</span>
      </p>
      <p className="mt-3 text-[15px] leading-7 text-slate-100">{question.prompt}</p>
      {isTrueFalse ? (
        <p className="mt-3 text-sm font-semibold text-slate-400">Certo ou errado?</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          {question.options.map((option) => (
            <li key={option.key}>
              <span className="mr-2 font-bold text-slate-400">{option.key})</span>
              {option.text}
            </li>
          ))}
        </ol>
      )}
      <details className="mt-4 rounded-xl border border-white/10 bg-[#08111c] p-4 text-sm leading-7 text-slate-300">
        <summary className="cursor-pointer font-bold text-amber-300">Ver gabarito e comentário</summary>
        <p className="mt-3">
          <strong className="text-white">Gabarito: </strong>
          {question.correct ? (isTrueFalse ? question.correct.text : `${question.correct.key}) ${question.correct.text}`) : "não informado"}
        </p>
        <p className="mt-2">{question.explanation}</p>
        {question.options.some((option) => option.rationale) ? (
          <ul className="mt-3 space-y-1 text-slate-400">
            {question.options
              .filter((option) => option.rationale)
              .map((option) => (
                <li key={option.key}>
                  <strong className="text-slate-300">{isTrueFalse ? option.text : option.key}:</strong> {option.rationale}
                </li>
              ))}
          </ul>
        ) : null}
      </details>
    </article>
  );
}
