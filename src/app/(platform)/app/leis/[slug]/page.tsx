import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Filter,
  Gauge,
  RotateCcw,
} from "lucide-react";

import { deleteStudyFilterAction } from "@/app/actions/study-library";
import { ConfirmDeleteButton, SavedFilterForm } from "@/components/materials/study-library-forms";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getLegalActStudyView, listSavedStudyFilters } from "@/lib/db/legal-library";
import { getStudyEntitlement } from "@/lib/study/entitlement";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ de?: string | string[]; ate?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function selectedOrder(value: string | undefined, available: number[], fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && available.includes(parsed) ? parsed : fallback;
}

export default async function LegalActPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/app/leis/${slug}`);
  const entitlement = await getStudyEntitlement(user.id);
  const act = await getLegalActStudyView(user.id, slug, entitlement);
  if (!act) notFound();

  const availableArticles = act.articles.filter((article) => article.questionCount > 0);
  const orders = availableArticles.map((article) => article.articleOrder);
  const firstOrder = orders[0] ?? act.articles[0]?.articleOrder ?? 0;
  const lastOrder = orders.at(-1) ?? act.articles.at(-1)?.articleOrder ?? firstOrder;
  let startOrder = selectedOrder(firstValue(query.de), orders, firstOrder);
  let endOrder = selectedOrder(firstValue(query.ate), orders, lastOrder);
  if (startOrder > endOrder) [startOrder, endOrder] = [endOrder, startOrder];

  const [savedFilters] = await Promise.all([listSavedStudyFilters(user.id, act.id)]);
  const selectedArticles = act.articles.filter(
    (article) => article.articleOrder >= startOrder && article.articleOrder <= endOrder,
  );
  const selectedQuestionCount = selectedArticles.reduce((total, article) => total + article.questionCount, 0);
  const selectedAttempts = selectedArticles.reduce((total, article) => total + article.attemptCount, 0);
  const selectedCorrect = selectedArticles.reduce((total, article) => total + article.correctCount, 0);
  const selectedAccuracy = selectedAttempts ? Math.round((selectedCorrect / selectedAttempts) * 100) : null;
  const trainHref = `/app/treinar?lei=${encodeURIComponent(act.slug)}&de=${startOrder}&ate=${endOrder}&ordem=sequencial`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <Link href="/app/leis" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-els-fg-3 transition hover:text-els-fg">
        <ArrowLeft className="size-3.5" /> Todas as leis
      </Link>
      <PageHeader
        eyebrow="Vade Mecum ativo"
        title={act.shortTitle}
        description="Escolha um intervalo, leia a redação vigente e treine as questões em ordem jurídica. Seu histórico e sua revisão adaptativa continuam conectados."
        icon={BookOpenCheck}
      />

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-5">
          <article className="rounded-[1.75rem] border border-els-amber/15 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--els-amber)_8%,transparent),transparent_38%),var(--els-bg-2)] p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-els-amber-ink">
                  <Filter className="size-3.5" /> Recorte de estudo
                </span>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Quais artigos você quer dominar agora?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-els-fg-3">
                  O treino começa por questões ainda não respondidas e preserva a ordem dos dispositivos selecionados.
                </p>
              </div>
              <a href={act.officialUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-semibold text-els-green-ink">
                Fonte oficial <ExternalLink className="size-3.5" />
              </a>
            </div>

            {availableArticles.length ? (
              <form method="get" className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <RangeSelect label="Do artigo" name="de" articles={availableArticles} selected={startOrder} />
                <RangeSelect label="Até o artigo" name="ate" articles={availableArticles} selected={endOrder} />
                <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-els-line bg-els-raise px-4 text-sm font-semibold text-els-fg transition hover:border-els-amber/25 hover:bg-els-raise-hover">
                  Aplicar recorte <ArrowRight className="size-4" />
                </button>
              </form>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-els-line bg-els-bg/25 p-6 text-center text-sm text-els-fg-3">
                Esta lei ainda não possui questões liberadas para sua conta.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Questões no recorte" value={selectedQuestionCount} icon={FileCheck2} />
              <Metric label="Tentativas registradas" value={selectedAttempts} icon={RotateCcw} />
              <Metric label="Precisão no recorte" value={selectedAccuracy === null ? "—" : `${selectedAccuracy}%`} icon={Gauge} />
            </div>

            <Link
              href={trainHref}
              aria-disabled={!selectedQuestionCount}
              className={cn(
                "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition",
                selectedQuestionCount
                  ? "bg-els-amber text-els-on-amber hover:bg-els-amber"
                  : "pointer-events-none bg-els-raise text-els-fg-4",
              )}
            >
              Treinar {selectedQuestionCount} {selectedQuestionCount === 1 ? "questão" : "questões"} em ordem
              <ArrowRight className="size-4" />
            </Link>
          </article>

          <section aria-labelledby="article-list-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-els-green-ink">Texto vigente e desempenho</p>
                <h2 id="article-list-title" className="mt-2 text-2xl font-semibold tracking-[-.03em]">Artigo por artigo</h2>
              </div>
              <span className="text-xs text-els-fg-4">verificado em {new Intl.DateTimeFormat("pt-BR").format(act.verifiedAt)}</span>
            </div>
            <div className="mt-5 grid gap-3">
              {act.articles.map((article) => {
                const selected = article.articleOrder >= startOrder && article.articleOrder <= endOrder;
                return (
                  <article key={article.id} className={cn("rounded-2xl border p-5 transition", selected ? "border-els-amber/15 bg-els-amber/[.035]" : "border-els-line bg-els-surface") }>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-base text-els-fg">{article.articleRef}</strong>
                          {selected && <span className="rounded-full bg-els-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-els-amber-ink">no recorte</span>}
                        </div>
                        {article.heading && <p className="mt-1 text-xs text-els-fg-3">{article.heading}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-els-raise px-2.5 py-1 text-els-fg-3">{article.questionCount} {article.questionCount === 1 ? "questão" : "questões"}</span>
                        <span className={cn("rounded-full px-2.5 py-1", article.accuracy === null ? "bg-els-raise text-els-fg-3" : article.accuracy >= 80 ? "bg-els-green/10 text-els-green-ink" : "bg-els-amber/10 text-els-amber-ink") }>
                          {article.accuracy === null ? "não treinado" : `${article.accuracy}% de precisão`}
                        </span>
                      </div>
                    </div>
                    <details className="group mt-4 border-t border-els-line pt-4">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-els-green-ink">
                        Ler a literalidade
                        <span className="text-els-fg-4 transition group-open:rotate-180">⌄</span>
                      </summary>
                      <blockquote className="mt-3 border-l-2 border-els-green/35 pl-4 text-sm leading-7 text-els-fg-2">
                        {article.literalText}
                      </blockquote>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5">
            <h2 className="font-semibold">Salvar este recorte</h2>
            <p className="mt-1 text-xs leading-5 text-els-fg-3">Dê um nome ao intervalo para retomá-lo sem configurar tudo de novo.</p>
            <div className="mt-5">
              {availableArticles.length ? (
                <SavedFilterForm
                  legalActSlug={act.slug}
                  articles={availableArticles}
                  defaultStart={startOrder}
                  defaultEnd={endOrder}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-els-line p-4 text-xs leading-5 text-els-fg-3">
                  O salvamento será liberado quando houver questões disponíveis nesta lei.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Filtros salvos</h2>
              <span className="rounded-full bg-els-raise px-2 py-0.5 text-[10px] text-els-fg-3">{savedFilters.length}/30</span>
            </div>
            {savedFilters.length ? (
              <div className="mt-4 grid gap-2">
                {savedFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2 rounded-xl border border-els-line bg-els-bg/25 p-2">
                    <Link href={`/app/leis/${filter.legalActSlug}?de=${filter.articleStartOrder}&ate=${filter.articleEndOrder}`} className="min-w-0 flex-1 rounded-lg px-2 py-1.5 transition hover:bg-els-raise-hover">
                      <strong className="block truncate text-xs text-els-fg-2">{filter.name}</strong>
                      <span className="mt-0.5 block text-[10px] text-els-fg-4">artigos {filter.articleStartOrder}–{filter.articleEndOrder}</span>
                    </Link>
                    <form action={deleteStudyFilterAction}>
                      <input name="filterId" type="hidden" value={filter.id} />
                      <input name="legalActSlug" type="hidden" value={act.slug} />
                      <ConfirmDeleteButton
                        label={`Excluir filtro ${filter.name}`}
                        message={`Excluir o filtro “${filter.name}”?`}
                      />
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-els-line p-5 text-center">
                <CheckCircle2 className="mx-auto size-5 text-els-fg-4" />
                <p className="mt-2 text-xs text-els-fg-4">Nenhum recorte salvo ainda.</p>
              </div>
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}

function RangeSelect({
  label,
  name,
  articles,
  selected,
}: {
  label: string;
  name: string;
  articles: Array<{ articleOrder: number; articleRef: string; questionCount: number }>;
  selected: number;
}) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-els-fg-2">
      {label}
      <select name={name} defaultValue={selected} className="min-h-11 rounded-xl border border-els-line bg-els-bg/50 px-3 text-sm text-els-fg outline-none focus:border-els-amber/50 focus:ring-4 focus:ring-els-amber/5">
        {articles.map((article) => (
          <option key={article.articleOrder} value={article.articleOrder}>{article.articleRef} · {article.questionCount}</option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Gauge }) {
  return (
    <div className="rounded-xl border border-els-line bg-els-bg/25 p-4">
      <Icon className="size-4 text-els-green-ink" />
      <strong className="mt-4 block text-2xl tracking-[-.03em] text-els-fg">{value}</strong>
      <span className="mt-1 block text-[11px] text-els-fg-3">{label}</span>
    </div>
  );
}
