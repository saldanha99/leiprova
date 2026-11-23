"use client";

import { Download } from "lucide-react";

export function PrintStudyView({ label = "Salvar em PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-els-line bg-els-raise px-4 text-xs font-bold text-els-fg transition hover:border-els-amber/30 hover:bg-els-raise-hover print:hidden"
    >
      <Download className="size-3.5" /> {label}
    </button>
  );
}
