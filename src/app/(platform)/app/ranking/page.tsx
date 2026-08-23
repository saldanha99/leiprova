import { Medal, Sparkles, Trophy } from "lucide-react";

import { PageHeader } from "@/components/platform/page-header";
import { getMonthlyRanking } from "@/lib/db/queries";

export default async function RankingPage() {
  const ranking = await getMonthlyRanking();
  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader eyebrow="Constância, não competição vazia" title="Ranking mensal" description="XP considera treinos concluídos e revisões no prazo. A precisão vem primeiro; responder aleatoriamente não acelera o progresso." icon={Medal} />
      <section className="mt-8 overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#09131f]">
        <div className="flex items-center justify-between border-b border-white/8 p-5"><div><h2 className="font-semibold">Pódio de agosto</h2><p className="mt-1 text-xs text-slate-500">atividade real dos alunos</p></div><Trophy className="size-5 text-amber-300" /></div>
        {ranking.length ? (
          <ol className="divide-y divide-white/6">
            {ranking.map((entry, index) => (
              <li key={entry.publicId} className="flex items-center gap-4 px-5 py-4">
                <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${index === 0 ? "bg-amber-300 text-slate-950" : index === 1 ? "bg-slate-300 text-slate-950" : index === 2 ? "bg-orange-400 text-slate-950" : "bg-white/5 text-slate-500"}`}>{index + 1}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm">Estudante {entry.publicId.slice(0, 6).toUpperCase()}</strong><span className="text-xs text-slate-500">{entry.answered} questões · identidade protegida</span></span>
                <strong className="text-sm text-emerald-300">{entry.xp} XP</strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="p-12 text-center"><Sparkles className="mx-auto size-7 text-slate-600" /><h2 className="mt-4 font-semibold">O ranking começa com o primeiro treino</h2><p className="mt-2 text-sm text-slate-500">Ainda não há atividade neste mês.</p></div>
        )}
      </section>
    </main>
  );
}
