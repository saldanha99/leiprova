import Link from "next/link";

import { EditalumeLogo } from "@/components/brand/EditalumeLogo";
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
      aria-label="Editalume — página inicial"
    >
      <EditalumeLogo compact={compact} />
    </Link>
  );
}
