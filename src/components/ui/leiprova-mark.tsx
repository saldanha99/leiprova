import Link from "next/link";

import { EditalumeLogo } from "@/components/brand/EditalumeLogo";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function LeiProvaMark({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center", className)}
      aria-label={`${BRAND_NAME} — página inicial`}
    >
      <EditalumeLogo compact={compact} />
    </Link>
  );
}
