import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FilePenLine,
  FileLock2,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

import { AuthoringForm } from "@/components/admin/authoring-form";
import { ClaimDraftControls } from "@/components/admin/claim-draft-controls";
import { ReviewControls } from "@/components/admin/review-controls";
import { requireAdmin } from "@/lib/auth";
import { getEditorialFactorySnapshot } from "@/lib/db/editorial-admin";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const sourceDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

const statusLabels: Record<string, string> = {
  pending_review: "Aguardando revisão",
  reviewed: "Liberada",
  suspended: "Reprovada",
  draft: "Rascunho",
};

const statusClasses: Record<string, string> = {
  pending_review: "border-amber-300/20 bg-amber-300/8 text-amber-200",
  reviewed: "border-emerald-300/20 bg-emerald-300/8 text-emerald-200",
  suspended: "border-rose-300/20 bg-rose-300/8 text-rose-200",
  draft: "border-white/10 bg-white/5 text-slate-300",
};

export default async function EditorialFactoryPage() {
  const user = await requireAdmin();
  const snapshot = await getEditorialFactorySnapshot();

  const metrics = [
    { label: "Autorais registradas", value: snapshot.metrics.total, icon: Fingerprint, tone: "text-sky-300 bg-sky-300/10" },
    { label: "Rascunhos de IA", value: snapshot.metrics.drafts, icon: FilePenLine, tone: "text-violet-300 bg-violet-300/10" },
    { label: "Na fila", value: snapshot.metrics.pending, icon: Clock3, tone: "text-amber-300 bg-amber-300/10" },
    { label: "Liberadas", value: snapshot.metrics.reviewed, icon: CheckCircle2, tone: "text-emerald-300 bg-emerald-300/10" },
    { label: "Reprovadas", value: snapshot.metrics.suspended, icon: FileLock2, tone: "text-rose-300 bg-rose-300/10" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-[linear-gradient(145deg,#101a27_0%,#091521_62%,#0d211f_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-amber-300/8 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-amber-300">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Fábrica autoral clean-room
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-white sm:text-4xl">
            Estilo reconhecível. Questão genuinamente inédita.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            O perfil da banca orienta forma e dificuldade; o conteúdo nasce somente da lei oficial. Nenhuma questão
            entra no catálogo sem responsabilidade editorial registrada e revisão por outra pessoa.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-2"><BookOpenCheck className="size-4 text-amber-300" /> fonte oficial</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" /> declaração clean-room</span>
            <span className="inline-flex items-center gap-2"><Fingerprint className="size-4 text-sky-300" /> similaridade interna verificada</span>
            <span className="inline-flex items-center gap-2"><UserRoundCheck className="size-4 text-sky-300" /> revisor independente</span>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores editoriais">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-white/8 bg-[#09131f] p-4">
            <div className={`grid size-9 place-items-center rounded-xl ${tone}`}>
              <Icon aria-hidden="true" className="size-4" />
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-[-.04em] text-white">{numberFormatter.format(value)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      {snapshot.metrics.drafts > 0 ? (
        <section
          className="mt-5 rounded-[1.5rem] border border-violet-300/15 bg-[linear-gradient(120deg,rgba(167,139,250,.08),rgba(56,189,248,.035))] p-5 sm:p-6"
          aria-labelledby="pilot-title"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-violet-200">
                <Sparkles aria-hidden="true" className="size-3.5" />
                Lote piloto ativo
              </span>
              <h2 id="pilot-title" className="mt-2 text-xl font-semibold text-white">
                {numberFormatter.format(snapshot.metrics.drafts)} questões inéditas aguardam conferência editorial
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Foram geradas somente a partir de artigos oficiais já revisados. Permanecem fora do catálogo até um
                responsável confirmar a fonte e outra pessoa aprovar o conteúdo.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
              <span className="rounded-xl border border-violet-300/12 bg-black/10 px-3 py-3 text-violet-200">1. Conferir</span>
              <span className="rounded-xl border border-amber-300/12 bg-black/10 px-3 py-3 text-amber-200">2. Revisar</span>
              <span className="rounded-xl border border-emerald-300/12 bg-black/10 px-3 py-3 text-emerald-200">3. Liberar</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-5" aria-labelledby="profiles-title">
        <div className="mb-3">
          <h2 id="profiles-title" className="text-lg font-semibold text-white">Perfis editoriais internos</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Características abstratas de forma; nunca texto, caso ou alternativa de prova.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {snapshot.profiles.map((profile) => (
            <article key={profile.id} className="rounded-2xl border border-white/8 bg-[#09131f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white">{profile.bankName}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-600">Perfil interno v{profile.version}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[.1em] text-amber-300">
                  {profile.format === "true_false" ? "C / E" : "A — E"}
                </span>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-400">{profile.commandStyle}</p>
              <p className="mt-3 border-t border-white/7 pt-3 text-[11px] leading-5 text-slate-600">{profile.disclaimer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-amber-300">Nova questão</span>
            <h2 className="mt-2 text-xl font-semibold tracking-[-.025em] text-white">Enviar conteúdo inédito à revisão</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">O envio cria um item pendente. O responsável nunca pode aprovar o próprio trabalho.</p>
          </div>
          <AuthoringForm
            profiles={snapshot.profiles}
            articles={snapshot.articles}
            subjects={snapshot.subjects}
            topics={snapshot.topics}
          />
        </article>

        <aside className="space-y-4">
          <article className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-300/[.045] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-emerald-100">
              <ShieldCheck aria-hidden="true" className="size-5" />
              Protocolo obrigatório
            </h2>
            <ol className="mt-5 space-y-4">
              {[
                ["1", "Escolher a lei oficial", "Somente artigo revisado e versão vigente."],
                ["2", "Redigir em ambiente limpo", "Sem consultar ou adaptar questões de terceiros."],
                ["3", "Registrar procedência", "Autor, fonte, método e declaração ficam auditáveis."],
                ["4", "Revisão por outra pessoa", "Só a aprovação independente muda o item para liberado."],
              ].map(([step, title, detail]) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-300/12 text-xs font-extrabold text-emerald-200">{step}</span>
                  <span>
                    <strong className="block text-sm text-slate-200">{title}</strong>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </article>

          <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5">
            <h2 className="font-semibold text-white">Detalhes do perfil selecionado</h2>
            <div className="mt-4 space-y-5">
              {snapshot.profiles.map((profile) => (
                <details key={profile.id} className="group rounded-xl border border-white/8 bg-black/10 p-3">
                  <summary className="cursor-pointer list-none text-sm font-bold text-slate-300">{profile.bankName}</summary>
                  <div className="mt-3 border-t border-white/7 pt-3">
                    <p className="text-xs font-semibold text-sky-200">Demanda de raciocínio</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{profile.reasoningDemand}</p>
                    <p className="mt-4 text-xs font-semibold text-amber-200">Diretrizes</p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
                      {profile.authoringGuidelines.map((guideline) => <li key={guideline}>• {guideline}</li>)}
                    </ul>
                    <p className="mt-4 text-xs font-semibold text-rose-200">Limites clean-room</p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
                      {profile.prohibitedPatterns.map((pattern) => <li key={pattern}>• {pattern}</li>)}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6" aria-labelledby="queue-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-sky-300">Governança editorial</span>
            <h2 id="queue-title" className="mt-2 text-xl font-semibold text-white">Fila e histórico recente</h2>
          </div>
          <p className="text-xs text-slate-600">Até 60 itens mais recentes</p>
        </div>

        {snapshot.queue.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.queue.map((item) => {
              const canReview = item.editorialStatus === "pending_review" && item.creatorUserId !== user.id;
              const canClaim = item.editorialStatus === "draft" && !item.creatorUserId;
              return (
                <article key={item.publicId} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${statusClasses[item.editorialStatus] ?? statusClasses.draft}`}>
                      {statusLabels[item.editorialStatus] ?? item.editorialStatus}
                    </span>
                    <span className="text-[11px] text-slate-600">{dateFormatter.format(item.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                    <span className="text-amber-200">{item.bankName}</span>
                    <span>{item.sourceTitle} · {item.articleRef}</span>
                    <span>{item.subjectName}{item.topicName ? ` / ${item.topicName}` : ""}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-200">{item.prompt}</p>
                  {item.learningObjective ? <p className="mt-2 text-xs leading-5 text-slate-500"><strong className="text-slate-400">Objetivo:</strong> {item.learningObjective}</p> : null}

                  <details className="group mt-4 overflow-hidden rounded-xl border border-white/8 bg-[#07111d]">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-bold text-sky-200 outline-none transition hover:bg-white/[.025] focus-visible:ring-2 focus-visible:ring-sky-300/50">
                      <span className="inline-flex items-center gap-2">
                        <BookOpenCheck aria-hidden="true" className="size-4" />
                        Abrir dossiê de conferência
                      </span>
                      <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-4 border-t border-white/7 p-3.5 sm:p-4">
                      <section aria-label="Fonte legal do item">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-amber-300">Texto oficial de controle</p>
                            <p className="mt-1 text-[11px] text-slate-600">
                              Verificado em {sourceDateFormatter.format(item.sourceVerifiedAt)}
                            </p>
                          </div>
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300/15 bg-amber-300/[.045] px-2.5 text-[11px] font-bold text-amber-100 transition hover:bg-amber-300/[.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
                          >
                            Conferir no portal oficial
                            <ExternalLink aria-hidden="true" className="size-3.5" />
                          </a>
                        </div>
                        <blockquote className="mt-3 rounded-lg border-l-2 border-amber-300/40 bg-amber-300/[.035] px-3 py-2.5 text-xs leading-6 text-slate-300">
                          {item.literalText}
                        </blockquote>
                      </section>

                      <section aria-label="Alternativas e gabarito">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-sky-300">Alternativas e gabarito</p>
                          <span className="text-[10px] font-semibold text-slate-600">
                            {item.type === "true_false" ? "Certo ou errado" : "Múltipla escolha"} · dificuldade {item.difficulty}/5
                          </span>
                        </div>
                        {item.options.length ? (
                          <ol className="mt-3 space-y-2">
                            {item.options.map((option) => (
                              <li
                                key={option.optionKey}
                                className={`rounded-lg border p-3 ${
                                  option.isCorrect
                                    ? "border-emerald-300/20 bg-emerald-300/[.055]"
                                    : "border-white/7 bg-black/10"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className={`grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-extrabold ${
                                      option.isCorrect
                                        ? "bg-emerald-300 text-emerald-950"
                                        : "bg-white/7 text-slate-400"
                                    }`}
                                  >
                                    {option.optionKey}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-xs leading-5 text-slate-200">{option.text}</p>
                                      {option.isCorrect ? (
                                        <span className="rounded-md bg-emerald-300/12 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.08em] text-emerald-200">
                                          Gabarito
                                        </span>
                                      ) : null}
                                    </div>
                                    {option.rationale ? (
                                      <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{option.rationale}</p>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-3 rounded-lg border border-rose-300/15 bg-rose-300/[.045] p-3 text-xs text-rose-100">
                            Alternativas indisponíveis. Não assuma este item até a correção.
                          </p>
                        )}
                      </section>

                      <section className="rounded-lg border border-white/7 bg-black/10 p-3" aria-label="Explicação editorial">
                        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-violet-300">Explicação proposta</p>
                        <p className="mt-2 text-xs leading-6 text-slate-400">{item.explanation}</p>
                      </section>
                    </div>
                  </details>

                  <div className="mt-4 border-t border-white/7 pt-3 text-[11px] leading-5 text-slate-600">
                    Responsável editorial: {item.creatorName ?? "a definir"} · método {item.authorshipMethod === "ai_assisted" ? "assistido por IA" : "humano"}
                    {item.generatorModel ? ` · gerador: ${item.generatorModel}` : ""}
                    {item.promptVersion ? ` · protocolo: ${item.promptVersion}` : ""}
                    {item.reviewerName ? ` · revisor: ${item.reviewerName}` : ""}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-sky-300/80">
                    Originalidade textual interna: {Math.max(0, 100 - Math.round(item.similarityMaxBps / 100))}%
                    {item.similarityReferencePublicId ? " · comparação registrada" : " · primeiro item da base"}
                  </p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-white/[.035] p-2 text-xs leading-5 text-slate-400">Nota: {item.reviewNotes}</p> : null}
                  {canClaim ? <ClaimDraftControls publicId={item.publicId} /> : null}
                  {canReview ? <ReviewControls publicId={item.publicId} /> : null}
                  {item.editorialStatus === "pending_review" && item.creatorUserId === user.id ? (
                    <p className="mt-3 rounded-lg border border-amber-300/12 bg-amber-300/[.045] p-2.5 text-xs leading-5 text-amber-100/70">
                      Você é o responsável editorial. Outro administrador precisa revisar este item.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
            A fila está vazia. O primeiro rascunho ou envio editorial aparecerá aqui.
          </div>
        )}
      </section>
    </main>
  );
}
