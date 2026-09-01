import { ArrowRight, BookOpenCheck, Home } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LeiProvaMark } from "@/components/ui/leiprova-mark";

export function PublicGuideShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060b13] text-slate-100">
      <a
        href="#conteudo"
        className="fixed left-3 top-3 z-50 -translate-y-40 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition-transform focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-white/8 bg-[#07101b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <LeiProvaMark />
          <nav className="flex items-center gap-2 text-sm font-semibold text-slate-400" aria-label="Navegação pública">
            <Link className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white md:inline-flex" href="/concursos">
              Concursos
            </Link>
            <Link className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white md:inline-flex" href="/metodologia">
              Metodologia
            </Link>
            <Link className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white sm:inline-flex" href="/fontes-e-atualizacao">
              Fontes
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 hover:border-white/20 hover:text-white" href="/">
              <Home aria-hidden="true" className="size-4" />
              Início
            </Link>
          </nav>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="border-t border-white/8 bg-[#050a11]">
        <div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 text-sm text-slate-500 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-300">
              <BookOpenCheck aria-hidden="true" className="size-4 text-amber-300" />
              LeiProva
            </p>
            <p className="mt-2 max-w-xl leading-6">
              Conteúdo meramente informativo e não oficial. Consulte a publicação vigente no diário oficial e o edital do seu concurso.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <Link className="hover:text-white" href="/concursos">Concursos</Link>
            <Link className="hover:text-white" href="/metodologia">Metodologia</Link>
            <Link className="hover:text-white" href="/demo">Demonstração</Link>
            <Link className="hover:text-white" href="/fontes-e-atualizacao">Fontes</Link>
            <Link className="hover:text-white" href="/termos">Termos</Link>
            <Link className="hover:text-white" href="/privacidade">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function GuideBreadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
      <Link className="hover:text-amber-300" href="/">Início</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="text-amber-300">{current}</span>
    </nav>
  );
}

export function GuideCta({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <aside className="rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,.16),transparent_48%),#0b1624] p-6 sm:p-9">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">Experimente na prática</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
      <Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-200" href="/demo">
        Fazer uma sessão gratuita
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </aside>
  );
}
