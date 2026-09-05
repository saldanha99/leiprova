import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Flame,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getDashboardSnapshot, getInitialStudyFocuses } from "@/lib/db/queries";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export default async function DashboardPage() {
  const user = await requireUser("/app");
  const [stats, focuses] = await Promise.all([
    getDashboardSnapshot(user.id),
    getInitialStudyFocuses(),
  ]);
  const goal = 20;
  const goalProgress = Math.min(100, Math.round((stats.todayAnswered / goal) * 100));
  const firstName = user.name.split(" ")[0];

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-amber-300">
            <Sparkles className="size-3.5" /> Sessão de hoje
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Vamos fixar mais um artigo, {firstName}?</h1>
          <p className="mt-2 text-sm text-slate-500">Constância pequena, memória de longo prazo.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/8 bg-white/[.035] px-3 py-1.5 text-xs text-slate-400">
          <CalendarClock className="size-3.5 text-emerald-300" />
          {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </span>
      </header>

      <section className="mt-7 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <article className="relative overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-[linear-gradient(135deg,#111b28_0%,#0b1623_58%,#0d201e_100%)] p-6 shadow-2xl shadow-black/15 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-amber-300/8 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/8 px-3 py-1 text-xs font-semibold text-amber-200">
                <Target className="size-3.5" /> Quiz sob medida
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Treine por cargo, banca, matéria ou capítulo.</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">Monte uma sessão de literalidade, questões anteriores licenciadas ou inéditas autorais — em modo treino ou como uma prova real.</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-300" style={{ width: `${goalProgress}%` }} />
                </div>
                <span className="text-sm font-bold text-white">{stats.todayAnswered}/{goal}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <Link href="/app/quiz" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
                Montar meu quiz <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/app/treinar" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[.035] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[.07]">
                Treino rápido
              </Link>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-white/8 bg-[#0a1420] p-6">
          <div className="flex items-start justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-300"><RotateCcw className="size-5" /></span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-500">fila adaptativa</span>
          </div>
          <p className="mt-7 text-4xl font-semibold tracking-[-.04em]">{stats.dueReviews}</p>
          <h2 className="mt-1 font-semibold">revisões para hoje</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Erros e acertos de baixa confiança voltam antes.</p>
          <Link href="/app/revisoes" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">Abrir fila <ArrowRight className="size-4" /></Link>
        </article>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Sequência", value: `${stats.streak} dias`, icon: Flame, color: "text-orange-300" },
          { label: "Precisão geral", value: `${stats.accuracy}%`, icon: TrendingUp, color: "text-emerald-300" },
          { label: "Questões feitas", value: String(stats.answered), icon: CheckCircle2, color: "text-sky-300" },
          { label: "Plano atual", value: stats.plan?.name ?? "Gratuito", icon: BookOpenCheck, color: "text-amber-300" },
        ].map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-white/8 bg-[#09131f] p-4 sm:p-5">
            <Icon className={`size-5 ${color}`} />
            <p className="mt-5 truncate text-xl font-semibold tracking-[-.03em] sm:text-2xl">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_.72fr]">
        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="font-semibold">Ritmo dos últimos 7 dias</h2><p className="mt-1 text-xs text-slate-500">questões respondidas por dia</p></div>
            <BrainCircuit className="size-5 text-amber-300" />
          </div>
          <div className="mt-8 grid h-44 grid-cols-7 items-end gap-2 sm:gap-4">
            {stats.activity.map((day) => {
              const height = day.answered ? Math.max(12, Math.min(100, day.answered * 5)) : 5;
              const weekDay = WEEKDAYS[new Date(`${day.date}T12:00:00`).getDay()];
              return (
                <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-semibold text-slate-500">{day.answered || ""}</span>
                  <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-emerald-500/70 to-emerald-300" style={{ height: `${height}%`, opacity: day.answered ? 1 : 0.15 }} />
                  <span className="text-[11px] text-slate-600">{weekDay}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <h2 className="font-semibold">Próximos focos</h2>
          <p className="mt-1 text-xs text-slate-500">trilha inicial sugerida</p>
          <div className="mt-6 grid gap-3">
            {focuses.map(({ article, topic, count }, index) => (
              <Link key={`${article}-${topic}-${index}`} href="/app/treinar" className="group flex items-center gap-3 rounded-xl border border-white/7 bg-white/[.025] p-3 transition hover:border-amber-300/20 hover:bg-white/[.045]">
                <span className="grid size-9 place-items-center rounded-lg bg-amber-300/8 text-xs font-bold text-amber-200">{index + 1}</span>
                <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-200">{article}</strong><span className="block truncate text-xs text-slate-500">{topic}</span></span>
                <span className="text-[11px] text-slate-600">{count} {count === 1 ? "item" : "itens"}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
