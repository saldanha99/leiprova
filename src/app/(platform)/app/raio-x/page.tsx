import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, Crosshair, FileSearch, LockKeyhole, RotateCcw, ShieldCheck, XCircle } from "lucide-react";

import { PrintStudyView } from "@/components/materials/print-study-view";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getBankArticleXRay, getUserXRay } from "@/lib/db/xray-queries";
import { quizBanks } from "@/lib/quiz/catalog";
import { getStudyEntitlement } from "@/lib/study/entitlement";

const MUTATION_LABELS: Record<string, string> = {
  literal: "Literalidade exata",
  addition: "Acréscimo indevido",
  condition: "Condição alterada",
  deadline: "Prazo ou número",
  frequency: "Frequência",
  institution: "Órgão ou instituição",
  modality: "Verbo modal",
  negation: "Negação ou inversão",
  "normative-source": "Fonte normativa",
  omission: "Omissão",
  scope: "Alteração de alcance",
  sequence: "Ordem ou sequência",
  substitution: "Substituição de termo",
  unclassified: "Ainda não classificada",
};

function mutationLabel(kind: string) {
  return MUTATION_LABELS[kind] ?? kind.replaceAll("-", " ");
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function XRayPage({
  searchParams,
}: {
  searchParams: Promise<{ banca?: string | string[] }>;
}) {
  const query = await searchParams;
  const user = await requireUser("/app/raio-x");
  const entitlement = await getStudyEntitlement(user.id);
  const selectedBank = quizBanks.find((bank) => bank.slug === first(query.banca)) ?? quizBanks[0];
  const [personal, bankStats] = await Promise.all([
    getUserXRay(user.id),
    entitlement.hasFullAccess
      ? getBankArticleXRay(selectedBank.slug)
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10 print:max-w-none print:bg-white print:text-slate-950">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader eyebrow="Prioridade objetiva" title="Raio-X da literalidade" description="Cruze a frequência histórica licenciada da banca com os artigos que mais exigem reforço no seu próprio desempenho." icon={BarChart3} />
        <PrintStudyView label="Salvar relatório em PDF" />
      </div>

      <section className="mt-8 rounded-[1.75rem] border border-sky-300/12 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,.07),transparent_38%),#09131f] p-5 sm:p-7 print:border-slate-300 print:bg-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-sky-300 print:text-sky-700">Cobrança histórica por banca</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Top 100 dos últimos 10 anos</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 print:text-slate-700">A amostra inclui somente provas reais com autorização vigente, caderno completo e gabarito revisado. O percentual mede incidência no corpus histórico licenciado; não é promessa de cobrança futura.</p>
          </div>
          <form method="get" className="flex gap-2 print:hidden">
            <label className="sr-only" htmlFor="xray-bank">Banca</label>
            <select id="xray-bank" name="banca" defaultValue={selectedBank.slug} className="min-h-11 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white">
              {quizBanks.map((bank) => <option key={bank.slug} value={bank.slug}>{bank.name}</option>)}
            </select>
            <button type="submit" className="min-h-11 rounded-xl bg-sky-300 px-4 text-sm font-bold text-slate-950">Analisar</button>
          </form>
        </div>

        {!entitlement.hasFullAccess ? (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-5 sm:flex-row sm:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><LockKeyhole className="size-5" /></span>
            <div className="flex-1"><h3 className="font-semibold">Raio-X por banca faz parte do acesso Master</h3><p className="mt-1 text-xs leading-5 text-slate-500">Seu Raio-X pessoal continua disponível abaixo. O ranking histórico é liberado para assinantes Master quando existir amostra licenciada.</p></div>
            <Link href="/app/assinatura" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-slate-950">Ver Master <ArrowRight className="size-3.5" /></Link>
          </div>
        ) : bankStats?.articles.length ? (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-400 print:bg-slate-100">{selectedBank.name}</span><span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-400 print:bg-slate-100">{bankStats.questionCount} questões</span><span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-400 print:bg-slate-100">{bankStats.editionCount} edições</span></div>
            <ol className="grid gap-2 print:grid-cols-2">
              {bankStats.articles.map((article) => (
                <li key={article.articleId} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/7 bg-slate-950/25 p-3 print:break-inside-avoid print:border-slate-200 print:bg-white">
                  <span className="grid size-9 place-items-center rounded-lg bg-sky-300/10 text-xs font-black text-sky-200 print:bg-sky-100 print:text-sky-800">{article.rank}</span>
                  <div className="min-w-0"><strong className="block truncate text-sm text-slate-100 print:text-slate-950">{article.legalAct} · {article.articleRef}</strong><span className="text-[11px] text-slate-600">{article.questionCount} incidências · {article.editionCount} edições · última em {article.lastExamDate}</span></div>
                  <strong className="text-sm text-emerald-300 print:text-emerald-700">{article.sharePercent}%</strong>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <FileSearch className="mx-auto size-7 text-slate-600" />
            <h3 className="mt-3 font-semibold">Amostra licenciada ainda insuficiente para {selectedBank.name}</h3>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-500">A estrutura estatística está pronta, mas permanece vazia até as autorizações escritas, a importação completa e a revisão independente das provas. Questões autorais não são usadas para fingir frequência histórica.</p>
          </div>
        )}
      </section>

      <section className="mt-8 print:break-before-page">
        <div><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-300 print:text-emerald-700">Seu desempenho</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Raio-X pessoal</h2></div>
        {personal.answered === 0 ? (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-[#09131f] p-8 text-center print:border-slate-300 print:bg-white"><BarChart3 className="mx-auto size-7 text-slate-600" /><h3 className="mt-3 font-semibold">Seu histórico começa após a primeira resposta</h3><Link href="/app/treinar" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-slate-950 print:hidden">Começar treino <ArrowRight className="size-3.5" /></Link></div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[{ label: "Respostas", value: personal.answered, icon: BookOpenCheck }, { label: "Precisão", value: `${personal.accuracy}%`, icon: ShieldCheck }, { label: "Erros", value: personal.incorrect, icon: XCircle }, { label: "Artigos", value: personal.articlesStudied, icon: CheckCircle2 }].map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-white/8 bg-[#09131f] p-4 print:border-slate-300 print:bg-white"><Icon className="size-4 text-amber-300 print:text-amber-700" /><strong className="mt-4 block text-2xl">{value}</strong><span className="text-xs text-slate-500">{label}</span></article>)}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 print:border-slate-300 print:bg-white"><h3 className="flex items-center gap-2 font-semibold"><Crosshair className="size-4 text-amber-300" />Pegadinhas que mais causam erro</h3><div className="mt-4 grid gap-2">{personal.byMutation.map((item) => <div key={item.mutationKind} className="flex items-center justify-between rounded-xl bg-white/[.035] p-3 text-sm print:bg-slate-50"><span>{mutationLabel(item.mutationKind)}</span><strong>{item.incorrect} erros</strong></div>)}</div></article>
              <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 print:border-slate-300 print:bg-white"><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-emerald-300" />Artigos para reforçar</h3><div className="mt-4 grid gap-2">{personal.byArticle.slice(0, 12).map((article) => <div key={article.articleId} className="flex items-center justify-between rounded-xl bg-white/[.035] p-3 text-sm print:bg-slate-50"><span className="min-w-0 truncate">{article.legalAct} · {article.articleRef}</span><strong className="ml-3 shrink-0">{article.accuracy}%</strong></div>)}</div></article>
            </div>
            <div className="mt-5 flex justify-end print:hidden"><Link href="/app/revisoes" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950">Abrir revisões <RotateCcw className="size-4" /></Link></div>
          </>
        )}
      </section>
    </main>
  );
}
