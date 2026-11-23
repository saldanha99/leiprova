import Link from "next/link";
import { ArrowRight, CalendarCheck2, Clock3, FileStack, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getDueReviewSummary } from "@/lib/db/queries";

export default async function ReviewsPage() {
  const user = await requireUser("/app/revisoes");
  const summary = await getDueReviewSummary(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader eyebrow="Memória de longo prazo" title="Fila de revisões" description="Cada item volta em intervalos progressivos. Erros, demora e baixa confiança encurtam o próximo intervalo." icon={FileStack} />

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Vencidas hoje", value: summary.due, icon: RotateCcw, color: "text-els-amber" },
          { label: "Próximas", value: summary.upcoming, icon: Clock3, color: "text-els-info" },
          { label: "Pontos que exigem reforço", value: summary.lapses, icon: CalendarCheck2, color: "text-els-green" },
        ].map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-els-line bg-els-surface p-5">
            <Icon className={`size-5 ${color}`} />
            <p className="mt-6 text-4xl font-semibold tracking-[-.04em]">{value}</p>
            <p className="mt-1 text-sm text-els-fg-3">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-[1.75rem] border border-els-line bg-els-surface p-7 text-center sm:p-10">
        {summary.due > 0 ? (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-els-amber/10 text-els-amber"><RotateCcw className="size-6" /></span>
            <h2 className="mt-5 text-2xl font-semibold">Sua revisão está pronta</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-els-fg-3">Comece pelos itens que mais precisam de recuperação ativa.</p>
            <Link href="/app/treinar?modo=revisao" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber">Revisar agora <ArrowRight className="size-4" /></Link>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-els-green/10 text-els-green"><CalendarCheck2 className="size-6" /></span>
            <h2 className="mt-5 text-2xl font-semibold">Fila em dia</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-els-fg-3">Conclua um novo treino para alimentar sua agenda adaptativa de revisões.</p>
            <Link href="/app/treinar" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-els-line bg-els-raise px-5 text-sm font-semibold text-els-fg">Treinar novo conteúdo <ArrowRight className="size-4" /></Link>
          </>
        )}
      </section>
    </main>
  );
}
