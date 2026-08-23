import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Crosshair,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getUserXRay } from "@/lib/db/xray-queries";

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

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export default async function XRayPage() {
  const user = await requireUser("/app/raio-x");
  const stats = await getUserXRay(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader eyebrow="Prioridade objetiva" title="Raio-X da literalidade" description="Analise seus próprios erros por artigo e tipo de mutação. A camada por banca será construída com padrões editoriais, sem copiar bancos de questões." icon={BarChart3} />

      {stats.answered === 0 ? (
        <section className="mt-8 rounded-[1.75rem] border border-white/8 bg-[#09131f] p-7 text-center sm:p-12">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
            <BarChart3 className="size-6" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold">Seu Raio-X começa após a primeira resposta</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Ainda não há tentativas no seu histórico. Faça um treino e volte aqui para ver seus acertos e pontos frágeis, sem dados simulados.
          </p>
          <Link href="/app/treinar" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
            Começar um treino <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Respostas registradas", value: stats.answered, icon: ListChecks, color: "text-sky-300" },
              { label: "Precisão real", value: `${stats.accuracy}%`, icon: ShieldCheck, color: "text-emerald-300" },
              { label: "Erros no histórico", value: stats.incorrect, icon: XCircle, color: "text-orange-300" },
              { label: "Artigos estudados", value: stats.articlesStudied, icon: BookOpenCheck, color: "text-amber-300" },
            ].map(({ label, value, icon: Icon, color }) => (
              <article key={label} className="rounded-2xl border border-white/8 bg-[#09131f] p-4 sm:p-5">
                <Icon className={`size-5 ${color}`} />
                <p className="mt-5 text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </article>
            ))}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Tipos de alteração encontrados</h2>
                  <p className="mt-1 text-xs text-slate-500">padrões das alternativas que você marcou</p>
                </div>
                <Crosshair className="size-5 shrink-0 text-amber-300" />
              </div>

              <div className="mt-6 grid gap-3">
                {stats.byMutation.map((item) => (
                  <div key={item.mutationKind} className="rounded-xl border border-white/7 bg-white/[.025] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong className="block text-sm text-slate-200">{mutationLabel(item.mutationKind)}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{plural(item.answered, "resposta")}</span>
                      </div>
                      <strong className="text-sm text-white">{plural(item.incorrect, "erro")}</strong>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/8 px-2.5 py-1 text-emerald-200">
                        <CheckCircle2 className="size-3" /> {plural(item.correct, "acerto")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-300/8 px-2.5 py-1 text-orange-200">
                        <XCircle className="size-3" /> {plural(item.incorrect, "erro")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Desempenho por artigo</h2>
                  <p className="mt-1 text-xs text-slate-500">pontos com mais erros aparecem primeiro</p>
                </div>
                <ShieldCheck className="size-5 shrink-0 text-emerald-300" />
              </div>

              <div className="mt-6 grid gap-3">
                {stats.byArticle.map((article) => (
                  <div key={article.articleId} className="rounded-xl border border-white/7 bg-white/[.025] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-amber-300">{article.legalAct}</span>
                        <strong className="mt-1 block text-base text-slate-100">{article.articleRef}</strong>
                        <span className="mt-1 block truncate text-xs text-slate-500">{article.topic}</span>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <strong className="block text-lg text-white">{article.accuracy}%</strong>
                        <span className="text-[11px] text-slate-500">{plural(article.answered, "tentativa")}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/6 pt-3 text-xs">
                      <span className="text-emerald-300">{plural(article.correct, "acerto")}</span>
                      <span className="text-orange-300">{plural(article.incorrect, "erro")}</span>
                      <time className="text-slate-600" dateTime={article.lastAnsweredAt.toISOString()}>
                        última tentativa em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(article.lastAnsweredAt)}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-4 flex flex-col items-start justify-between gap-5 rounded-[1.5rem] border border-amber-300/12 bg-amber-300/5 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-amber-300">
                <RotateCcw className="size-3.5" /> Próxima ação
              </span>
              <h2 className="mt-2 font-semibold">
                {stats.incorrect > 0
                  ? `Reforce ${mutationLabel(stats.byMutation.find((item) => item.incorrect > 0)?.mutationKind ?? "unclassified").toLowerCase()}`
                  : "Mantenha a recuperação ativa"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {stats.incorrect > 0
                  ? "Sua fila de revisão usa os erros registrados para antecipar os itens que precisam de recuperação."
                  : "Você ainda não errou neste histórico. Continue treinando para medir a retenção em novos artigos."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              {stats.incorrect > 0 && (
                <Link href="/app/revisoes" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/8">
                  Abrir revisões <RotateCcw className="size-4" />
                </Link>
              )}
              <Link href="/app/treinar" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
                Novo treino <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
