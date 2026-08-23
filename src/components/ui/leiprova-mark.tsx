import Link from "next/link";
import { BookCheck } from "lucide-react";

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
      className={cn("inline-flex items-center gap-2.5 font-semibold tracking-[-0.03em]", className)}
      aria-label="LeiProva — página inicial"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-amber-400 text-slate-950 shadow-[0_8px_28px_rgba(251,191,36,.22)]">
        <BookCheck className="size-[19px]" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-[1.08rem] text-white">
          Lei<span className="text-amber-300">Prova</span>
        </span>
      )}
    </Link>
  );
}
