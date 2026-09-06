import { BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

type EditalumeLogoProps = {
  compact?: boolean;
  className?: string;
};

/**
 * Marca da Editalume desenhada em vetor para o fundo escuro do produto.
 * Os traços principais herdam `currentColor` e os acentos usam os tokens
 * --emerald / --amber, então a logo assenta em qualquer superfície do tema
 * sem precisar do cartão branco que o PNG antigo exigia.
 */
export function EditalumeLogo({ compact = false, className }: EditalumeLogoProps) {
  return (
    <span
      className={cn("editalume-logo", compact && "editalume-logo--compact", className)}
      aria-hidden="true"
    >
      <svg
        className="editalume-logo__mark"
        viewBox="0 0 426 321"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        {/* feixes de luz */}
        <g
          fill="var(--emerald, #2dd4a4)"
          stroke="var(--emerald, #2dd4a4)"
          strokeWidth="12"
          strokeLinejoin="round"
        >
          <path d="M127 129 L106 100 L201 22 L382 22 Z" />
          <path d="M127 192 L106 221 L201 299 L382 299 Z" />
        </g>
        {/* barra central */}
        <rect x="121" y="131" width="297" height="63" rx="31.5" fill="var(--amber, #ffbd43)" />
        {/* barras externas */}
        <rect x="200" y="5" width="218" height="63" rx="31.5" fill="currentColor" />
        <rect x="200" y="253" width="218" height="63" rx="31.5" fill="currentColor" />
        {/* fonte de luz */}
        <path d="M90 96 A82 67.5 0 0 0 90 231 Z" fill="currentColor" />
      </svg>
      {!compact ? (
        <span className="editalume-logo__word">
          <span className="editalume-logo__name">
            edita<em>lume</em>
          </span>
          <span className="editalume-logo__tagline">{BRAND_TAGLINE.toLowerCase()}</span>
        </span>
      ) : null}
    </span>
  );
}
