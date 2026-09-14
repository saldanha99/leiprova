import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, BrainCircuit, ExternalLink, Gauge, Map, Target } from "lucide-react";

import { PrintStudyView } from "@/components/materials/print-study-view";
import { HighlightedLegalText, normalizeLegalHighlightTheme } from "@/components/materials/highlighted-legal-text";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getLegalActStudyView } from "@/lib/db/legal-library";
import { listLegalLibrary } from "@/lib/db/queries";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export const metadata: Metadata = {
  title: "Mapas de revisão",
  description: "Revisão visual por lei e intervalo de artigos.",
};

type SearchParams = Promise<{
  lei?: string | string[];
  de?: string | string[];
  ate?: string | string[];
  tema?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function selectedOrder(value: string | undefined, available: number[], fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && available.includes(parsed) ? parsed : fallback;
}

export default async function ReviewMapsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const user = await requireUser("/app/mapas");
  const entitlement = await getStudyEntitlement(user.id);
  const acts = await listLegalLibrary(entitlement);
  const selectableActs = acts.filter((item) => item.questionCount > 0);
  const requestedSlug = first(query.lei);
  const highlightTheme = normalizeLegalHighlightTheme(first(query.tema));
  const selectedAct = selectableActs.find((item) => item.slug === requestedSlug) ?? selectableActs[0];
  const act = selectedAct
    ? await getLegalActStudyView(user.id, selectedAct.slug, entitlement)
    : null;

  if (!act) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
        <PageHeader eyebrow="Revisão visual" title="Mapas de revisão" description="Os mapas aparecem quando a literalidade revisada é liberada para sua conta." icon={Map} />
        <section className="mt-8 rounded-[1.75rem] border border-dashed border-white/10 bg-[#09131f] p-10 text-center">
          <BrainCircuit className="mx-auto size-8 text-slate-600" />
          <h2 className="mt-4 font-semibold">Nenhum mapa disponível neste acesso</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">A Editalume não cria resumos jurídicos sem fonte e revisão. Assim que um conjunto de artigos for liberado, o mapa passa a ser montado a partir dele.</p>
        </section>
      </main>
    );
  }

  const available = act.articles.filter((article) => article.questionCount > 0);
  const orders = available.map((article) => article.articleOrder);
  const firstOrder = orders[0] ?? act.articles[0]?.articleOrder ?? 0;
  const lastOrder = orders.at(-1) ?? act.articles.at(-1)?.articleOrder ?? firstOrder;
  let startOrder = selectedOrder(first(query.de), orders, firstOrder);
  let endOrder = selectedOrder(first(query.ate), orders, lastOrder);
  if (startOrder > endOrder) [startOrder, endOrder] = [endOrder, startOrder];
  const selectedArticles = act.articles
    .filter((article) => article.articleOrder >= startOrder && article.articleOrder <= endOrder)
    .slice(0, 12);

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10 print:max-w-none print:bg-white print:text-slate-950">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader eyebrow="Revisão visual" title="Mapas de revisão" description="Conecte artigo, ideia central, volume de treino e seu desempenho. O mapa usa somente texto legal revisado e pode ser salvo em PDF pelo navegador." icon={Map} />
        <PrintStudyView />
      </div>

      <section className="mt-8 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 print:border-slate-300 print:bg-white">
        <form method="get" className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-end print:hidden">
          <label className="grid gap-2 text-xs font-semibold text-slate-300">Lei
            <select name="lei" defaultValue={act.slug} className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white">
              {selectableActs.map((item) => <option key={item.id} value={item.slug}>{item.shortTitle}</option>)}
            </select>
          </label>
          <RangeSelect name="de" label="Do artigo" articles={available} selected={startOrder} />
          <RangeSelect name="ate" label="Até o artigo" articles={available} selected={endOrder} />
          <label className="grid gap-2 text-xs font-semibold text-slate-300">Marcação
            <select name="tema" defaultValue={highlightTheme === "ink" ? "preto" : "cores"} className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white">
              <option value="cores">Cores semânticas</option>
              <option value="preto">Preto para impressão</option>
            </select>
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-950">Montar mapa <ArrowRight className="size-4" /></button>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5 print:mt-0 print:border-slate-200 print:pt-0">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-amber-300 print:text-amber-700">{act.shortTitle}</p><h2 className="mt-1 text-2xl font-semibold">{selectedArticles[0]?.articleRef} a {selectedArticles.at(-1)?.articleRef}</h2></div>
          <a href={act.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 print:text-emerald-700">Fonte oficial <ExternalLink className="size-3.5" /></a>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2" aria-label="Mapa dos artigos selecionados">
        {selectedArticles.map((article) => (
          <article key={article.id} className="relative overflow-hidden rounded-[1.5rem] border border-emerald-300/12 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,.07),transparent_44%),#09131f] p-5 print:break-inside-avoid print:border-slate-300 print:bg-white">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-amber-300/10 text-sm font-black text-amber-200 print:bg-amber-100 print:text-amber-800">{article.articleRef}</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-500 print:bg-slate-100 print:text-slate-600">{article.questionCount} questões</span>
            </div>
            <h3 className="mt-5 text-sm font-semibold text-slate-100 print:text-slate-950">{article.heading || "Literalidade vigente"}</h3>
            <blockquote className="mt-3 line-clamp-6 border-l-2 border-emerald-300/35 pl-3 text-xs leading-5 text-slate-400 print:hidden"><HighlightedLegalText text={article.literalText} theme={highlightTheme} /></blockquote>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/7 pt-4 text-[11px] print:border-slate-200">
              <span className="rounded-lg bg-white/[.035] p-2 text-slate-500 print:bg-slate-50"><Target className="mb-1 size-3.5 text-emerald-300 print:text-emerald-700" />Treino: {article.attemptCount}</span>
              <span className="rounded-lg bg-white/[.035] p-2 text-slate-500 print:bg-slate-50"><Gauge className="mb-1 size-3.5 text-sky-300 print:text-sky-700" />Precisão: {article.accuracy === null ? "—" : `${article.accuracy}%`}</span>
            </div>
            <details className="group mt-4 print:block"><summary className="cursor-pointer text-xs font-semibold text-emerald-300 print:hidden">Ver texto completo</summary><p className="mt-2 hidden text-xs leading-5 text-slate-600 group-open:block print:block print:text-slate-700"><HighlightedLegalText text={article.literalText} theme={highlightTheme} /></p></details>
          </article>
        ))}
      </section>

      <div className="mt-6 flex justify-end print:hidden">
        <Link href={`/app/treinar?lei=${encodeURIComponent(act.slug)}&de=${startOrder}&ate=${endOrder}&ordem=sequencial`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-bold text-slate-950"><BookOpenCheck className="size-4" />Treinar estes artigos</Link>
      </div>
    </main>
  );
}

function RangeSelect({ name, label, articles, selected }: { name: string; label: string; articles: Array<{ articleOrder: number; articleRef: string }>; selected: number }) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-slate-300">{label}
      <select name={name} defaultValue={selected} className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white">
        {articles.map((article) => <option key={article.articleOrder} value={article.articleOrder}>{article.articleRef}</option>)}
      </select>
    </label>
  );
}
