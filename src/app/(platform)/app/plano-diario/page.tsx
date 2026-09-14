import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Check, Circle, ExternalLink, ListChecks, Map, Route } from "lucide-react";

import { completeDailyStudyStepAction } from "@/app/actions/daily-plan";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getDailyStudyPlan } from "@/lib/db/daily-plan";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export const metadata: Metadata = {
  title: "Plano diário",
  description: "Leitura, questões e revisão visual no mesmo recorte de artigos.",
};

export default async function DailyPlanPage() {
  const user = await requireUser("/app/plano-diario");
  const entitlement = await getStudyEntitlement(user.id);
  const plan = await getDailyStudyPlan(user.id, entitlement);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader eyebrow="Seu roteiro de hoje" title="Plano diário" description="A mesma faixa de artigos atravessa as três etapas: primeiro leitura ativa, depois questões em ordem e, por fim, revisão visual." icon={Route} />

      {!plan ? (
        <section className="mt-8 rounded-[1.75rem] border border-dashed border-white/10 bg-[#09131f] p-10 text-center">
          <Route className="mx-auto size-8 text-slate-600" /><h2 className="mt-4 font-semibold">Plano aguardando conteúdo liberado</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">A trilha é montada somente com artigos e questões autorais revisados disponíveis para sua conta.</p>
        </section>
      ) : (
        <>
          <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.1),transparent_40%),#09131f] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[.15em] text-amber-300">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date(`${plan.dateIso}T12:00:00-03:00`))}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{plan.target.title}</h2><p className="mt-2 text-sm text-slate-500">{plan.target.articles[0].articleRef} a {plan.target.articles.at(-1)?.articleRef} · {plan.target.questionCount} questões no recorte</p></div>
              <a href={plan.target.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300">Fonte oficial <ExternalLink className="size-3.5" /></a>
            </div>
            <div className="mt-6 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-300" style={{ width: `${Math.round((plan.completedCount / 3) * 100)}%` }} /></div><strong className="text-sm">{plan.completedCount}/3</strong></div>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            <DailyStep number="01" title="Ler os artigos" description="Leia a redação vigente e identifique prazos, competências, exceções e trocas de termos." href={plan.steps.reading.href} completed={Boolean(plan.steps.reading.completedAt)} icon={BookOpenCheck} actionStep="reading" />
            <DailyStep number="02" title="Resolver as questões" description={`Responda as ${plan.target.questionCount} questões exatamente na ordem dos artigos estudados.`} href={plan.steps.practice.href} completed={Boolean(plan.steps.practice.completedAt)} icon={ListChecks} helper={plan.steps.practice.answered ? `${plan.steps.practice.answered} respondidas hoje` : undefined} />
            <DailyStep number="03" title="Revisar pelo mapa" description="Feche o ciclo conectando literalidade, volume de cobrança e seu desempenho no recorte." href={plan.steps.review.href} completed={Boolean(plan.steps.review.completedAt)} icon={Map} actionStep="review" />
          </section>
        </>
      )}
    </main>
  );
}

function DailyStep({ number, title, description, href, completed, icon: Icon, actionStep, helper }: { number: string; title: string; description: string; href: string; completed: boolean; icon: typeof Route; actionStep?: "reading" | "review"; helper?: string }) {
  return (
    <article className={`flex min-h-72 flex-col rounded-[1.5rem] border p-6 ${completed ? "border-emerald-300/20 bg-emerald-300/[.045]" : "border-white/8 bg-[#09131f]"}`}>
      <div className="flex items-start justify-between"><span className={`grid size-11 place-items-center rounded-xl ${completed ? "bg-emerald-300 text-slate-950" : "bg-white/5 text-slate-500"}`}><Icon className="size-5" /></span><span className="text-xs font-black tracking-[.16em] text-slate-600">{number}</span></div>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>{helper && <p className="mt-2 text-xs font-semibold text-emerald-300">{helper}</p>}
      <div className="mt-auto grid gap-2 pt-6">
        <Link href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-950">{completed ? "Abrir novamente" : "Começar etapa"}<ArrowRight className="size-4" /></Link>
        {actionStep && !completed ? <form action={completeDailyStudyStepAction}><input type="hidden" name="step" value={actionStep} /><button type="submit" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-300"><Circle className="size-3.5" />Marcar como concluída</button></form> : completed ? <span className="inline-flex min-h-10 items-center justify-center gap-2 text-xs font-bold text-emerald-300"><Check className="size-4" />Concluída hoje</span> : null}
      </div>
    </article>
  );
}
