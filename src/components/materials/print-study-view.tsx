"use client";

import { Download } from "lucide-react";

export function PrintStudyView({ label = "Salvar em PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-white transition hover:border-amber-300/30 hover:bg-white/8 print:hidden"
    >
      <Download className="size-3.5" /> {label}
    </button>
  );
}
