import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { LeiProvaMark } from "@/components/ui/leiprova-mark";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#060b13] text-white lg:grid-cols-[1.05fr_.95fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(16,185,129,.1),transparent_32%),radial-gradient(circle_at_78%_30%,rgba(251,191,36,.08),transparent_30%)]" />
      <section className="relative hidden min-h-screen border-r border-white/8 px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <LeiProvaMark />
        <div className="max-w-xl pb-10">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-emerald-200">
            <Sparkles className="size-3.5" /> Laboratório de literalidade
          </span>
          <h2 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-.045em] xl:text-5xl">
            Leia o artigo. Encontre a mutação. Lembre na prova.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-400">
            Treinos curtos, feedback imediato e revisões no momento certo para fixar prazos, exceções e competências.
          </p>
          <ul className="mt-9 grid gap-4 text-sm text-slate-300">
            {["Questões originais ligadas à fonte oficial", "Histórico da redação e data de verificação", "Progresso por artigo, tema e tipo de erro"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-emerald-300" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="size-4" /> Seus dados de pagamento são processados pela Stripe.
        </p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><LeiProvaMark /></div>
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/72 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Sua preparação, artigo por artigo</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">{title}</h1>
            <p className="mb-8 mt-3 text-sm leading-6 text-slate-400">{description}</p>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
