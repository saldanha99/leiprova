import type { ReactNode } from "react";

const HIGHLIGHT_PATTERN = /(\b\d+(?:[.,]\d+)?(?:\s*(?:dias?|meses?|anos?|horas?))?\b|\b(?:salvo|exceto|vedado|vedada|não|poderá|deverá|obrigatório|obrigatória)\b)/giu;
const DEADLINE_PATTERN = /^\d/u;
const EXCEPTION_PATTERN = /^(salvo|exceto)$/iu;
const DUTY_PATTERN = /^(poderá|deverá|obrigatório|obrigatória)$/iu;

export type LegalHighlightTheme = "colors" | "ink";

export function normalizeLegalHighlightTheme(value: string | undefined): LegalHighlightTheme {
  return value === "preto" ? "ink" : "colors";
}

export function HighlightedLegalText({ text, theme }: { text: string; theme: LegalHighlightTheme }) {
  const parts = text.split(HIGHLIGHT_PATTERN);
  const content: ReactNode[] = parts.map((part, index) => {
    if (!part || !part.match(HIGHLIGHT_PATTERN)) return part;
    const color = DEADLINE_PATTERN.test(part)
      ? "bg-els-info/20 text-els-fg print:bg-sky-100 print:text-sky-950"
      : EXCEPTION_PATTERN.test(part)
        ? "bg-els-amber/20 text-els-amber-ink print:bg-amber-100 print:text-amber-950"
        : DUTY_PATTERN.test(part)
          ? "bg-els-green/20 text-els-green-ink print:bg-emerald-100 print:text-emerald-950"
          : "bg-els-danger/20 text-els-fg print:bg-rose-100 print:text-rose-950";
    return (
      <mark
        className={`rounded-sm px-0.5 font-semibold ${theme === "ink" ? "bg-els-fg-2 text-els-on-amber print:bg-slate-200 print:text-black" : color}`}
        key={`${index}-${part}`}
      >
        {part}
      </mark>
    );
  });

  return <>{content}</>;
}
