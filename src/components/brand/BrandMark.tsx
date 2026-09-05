import Link from "next/link";

import { EditalumeLogo } from "@/components/brand/EditalumeLogo";

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
};

export function BrandMark({ href = "#inicio", compact = false }: BrandMarkProps) {
  return (
    <Link
      className={`brand-mark${compact ? " brand-mark--compact" : ""}`}
      href={href}
      aria-label="Editalume — ir para o início"
    >
      <EditalumeLogo compact={compact} />
    </Link>
  );
}
