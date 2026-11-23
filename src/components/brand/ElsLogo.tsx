import { cn } from "@/lib/utils";

/**
 * Monograma ELS (conceito 2 da pasta de marca, redesenhado em vetor plano).
 * E e S herdam a cor do texto (azul-marinho no tema claro, branco no escuro);
 * o L fica sempre em âmbar. Funciona em 32 px e em fundo claro ou escuro.
 */
export function ElsMonogram({ className }: { className?: string }) {
  return (
    <svg
      className={cn("els-monogram", className)}
      viewBox="0 0 128 72"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M14 8h30l-4 10H22v9h16v9H22v10h20v10H14a8 8 0 0 1-8-8V18Z" />
        <path d="M78 8h44l-5 10H82a3 3 0 0 0 0 6h22a14 14 0 0 1 0 28H92l7-10h5a4 4 0 0 0 0-8H82a13 13 0 0 1-4-26Z" />
      </g>
      <path fill="#F2A51A" d="M46 14l14-8v40h28l-8 10H46Z" />
    </svg>
  );
}

/** Assinatura completa: monograma + "Edital / Lei Seca" em duas linhas. */
export function ElsLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("els-logo", compact && "els-logo--compact", className)} aria-hidden="true">
      <ElsMonogram />
      {!compact ? (
        <span className="els-logo__word">
          <span>Edital</span>
          <span className="els-logo__accent">Lei Seca</span>
        </span>
      ) : null}
    </span>
  );
}
