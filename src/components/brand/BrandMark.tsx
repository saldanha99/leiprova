import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
};

export function BrandMark({ href = "#inicio", compact = false }: BrandMarkProps) {
  return (
    <Link
      className={`brand-mark${compact ? " brand-mark--compact" : ""}`}
      href={href}
      aria-label="LeiProva — ir para o início"
    >
      <span className="brand-mark__symbol" aria-hidden="true">
        <svg viewBox="0 0 44 44" role="img">
          <path
            className="brand-mark__book"
            d="M10.5 11.5h9.25c3.2 0 5.25 1.7 5.25 4.75v16.5c0-2.45-1.85-4.05-4.75-4.05H10.5V11.5Z"
          />
          <path
            className="brand-mark__book"
            d="M33.5 11.5h-8.25c-3.2 0-5.25 1.7-5.25 4.75v16.5c0-2.45 1.85-4.05 4.75-4.05h8.75V11.5Z"
          />
          <path className="brand-mark__check" d="m16.6 20.8 3.25 3.15 7.1-7.35" />
        </svg>
      </span>
      <span className="brand-mark__copy">
        <strong>LeiProva</strong>
        {!compact && <small>lei seca que permanece</small>}
      </span>
    </Link>
  );
}
