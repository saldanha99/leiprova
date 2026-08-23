import Link from "next/link";
import type { ReactNode } from "react";

import { LeiProvaMark } from "@/components/ui/leiprova-mark";

export function LegalDocument({
  title,
  updatedAt,
  notice,
  children,
}: {
  title: string;
  updatedAt: string;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#060b13] text-slate-200">
      <header className="border-b border-white/8 bg-[#07101b]"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><LeiProvaMark /><Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white">Voltar ao site</Link></div></header>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-300">Documento do produto</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">{title}</h1>
        <p className="mt-3 text-sm text-slate-500">Última atualização: {updatedAt}</p>
        {notice && <p className="mt-7 rounded-xl border border-amber-300/15 bg-amber-300/6 px-4 py-3 text-sm leading-6 text-amber-100/80">{notice}</p>}
        <div className="legal-copy mt-10 space-y-8 text-sm leading-7 text-slate-400">{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-3 text-xl font-semibold tracking-[-.025em] text-slate-100">{title}</h2><div className="space-y-3">{children}</div></section>;
}
