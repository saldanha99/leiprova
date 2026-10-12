import { BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

type EditalumeLogoProps = {
  compact?: boolean;
  className?: string;
};

/**
 * Documento aberto com marcador: edital, texto legal e progresso de estudo.
 * Nome técnico preservado para compatibilidade com os componentes existentes.
 */
export function EditalumeLogo({ compact = false, className }: EditalumeLogoProps) {
  return (
    <span
      className={cn("editalume-logo", compact && "editalume-logo--compact", className)}
      aria-hidden="true"
    >
      <svg
        className="editalume-logo__mark"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <path d="M9 12h19l4 5 4-5h19v39H37l-5 5-5-5H9V12Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M32 18v36" stroke="var(--emerald, #2dd4a4)" strokeWidth="3" />
        <path d="M16 23h9M16 31h9M16 39h9M39 31h9M39 39h9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 8h8v18l-4-3-4 3V8Z" fill="var(--amber, #ffbd43)" />
      </svg>
      {!compact ? (
        <span className="editalume-logo__word">
          <span className="editalume-logo__name">
            Edital <em>Lei Seca</em>
          </span>
          <span className="editalume-logo__tagline">{BRAND_TAGLINE.toLowerCase()}</span>
        </span>
      ) : null}
    </span>
  );
}
