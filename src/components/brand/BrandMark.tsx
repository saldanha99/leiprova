import Link from "next/link";

import { EditalumeLogo } from "@/components/brand/EditalumeLogo";
import { ElsLogo } from "@/components/brand/ElsLogo";
import { BRAND_NAME } from "@/lib/brand";

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
  /** "els": monograma novo do redesenho (tema claro). */
  variant?: "classic" | "els";
};

export function BrandMark({ href = "#inicio", compact = false, variant = "classic" }: BrandMarkProps) {
  return (
    <Link
      className={`brand-mark${compact ? " brand-mark--compact" : ""}`}
      href={href}
      aria-label={`${BRAND_NAME} — ir para o início`}
    >
      {variant === "els" ? <ElsLogo compact={compact} /> : <EditalumeLogo compact={compact} />}
    </Link>
  );
}
