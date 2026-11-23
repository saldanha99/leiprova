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
import {
  BATCH_APPROVAL_FORM_ID,
  BatchApprovalControls,
  BatchClaimControls,
} from "@/components/admin/batch-editorial-controls";
import { ClaimDraftControls } from "@/components/admin/claim-draft-controls";
import { ReviewControls } from "@/components/admin/review-controls";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

import { getEditorialFactorySnapshot, listEditorialContests } from "@/lib/db/editorial-admin";

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
  pending_review: "border-els-amber/20 bg-els-amber/8 text-els-amber-ink",
  reviewed: "border-els-green/20 bg-els-green/8 text-els-green-ink",
  suspended: "border-els-danger/20 bg-els-danger/8 text-els-danger-ink",
  draft: "border-els-line bg-els-raise text-els-fg-2",
};

export default async function EditorialFactoryPage({
  searchParams,
}: {
  searchParams: Promise<{ concurso?: string | string[] }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const contests = await listEditorialContests();
  // Só aceita concurso que existe na lista; valor estranho volta para a fila geral.
  const selectedContest = contests.find((contest) => contest.slug === query.concurso) ?? null;
  const snapshot = await getEditorialFactorySnapshot({ opportunitySlug: selectedContest?.slug });

  const metrics = [
    { label: "Autorais registradas", value: snapshot.metrics.total, icon: Fingerprint, tone: "text-els-info-ink bg-els-info/10" },
    { label: "Rascunhos gerados", value: snapshot.metrics.drafts, icon: FilePenLine, tone: "text-violet-300 bg-violet-300/10" },
    { label: "Na fila", value: snapshot.metrics.pending, icon: Clock3, tone: "text-els-amber-ink bg-els-amber/10" },
    { label: "Liberadas", value: snapshot.metrics.reviewed, icon: CheckCircle2, tone: "text-els-green-ink bg-els-green/10" },
    { label: "Reprovadas", value: snapshot.metrics.suspended, icon: FileLock2, tone: "text-els-danger-ink bg-els-danger/10" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-els-amber/15 bg-[linear-gradient(145deg,var(--els-surface)_0%,var(--els-bg-2)_62%,var(--els-bg-2)_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-els-amber/8 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-els-amber-ink">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Fábrica autoral clean-room
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-els-fg sm:text-4xl">
            Estilo reconhecível. Questão genuinamente inédita.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-els-fg-3 sm:text-base">
            O perfil da banca orienta forma e dificuldade; o conteúdo nasce somente da lei oficial. Nenhuma questão
            entra no catálogo sem responsabilidade editorial e revisão humana registradas.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-els-fg-2">
            <span className="inline-flex items-center gap-2"><BookOpenCheck className="size-4 text-els-amber-ink" /> fonte oficial</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-els-green-ink" /> declaração clean-room</span>
            <span className="inline-flex items-center gap-2"><Fingerprint className="size-4 text-els-info-ink" /> similaridade interna verificada</span>
            <span className="inline-flex items-center gap-2"><UserRoundCheck className="size-4 text-els-info-ink" /> revisão humana registrada</span>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores editoriais">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-els-line bg-els-surface p-4">
            <div className={`grid size-9 place-items-center rounded-xl ${tone}`}>
              <Icon aria-hidden="true" className="size-4" />
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-[-.04em] text-els-fg">{numberFormatter.format(value)}</p>
            <p className="mt-1 text-xs font-semibold text-els-fg-3">{label}</p>
          </article>
        ))}
      </section>

      {snapshot.metrics.drafts > 0 ? (
        <section
          className="mt-5 rounded-[1.5rem] border border-violet-300/15 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--els-info)_8%,transparent),color-mix(in_oklch,var(--els-info)_3.5%,transparent))] p-5 sm:p-6"
          aria-labelledby="pilot-title"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-violet-200">
                <Sparkles aria-hidden="true" className="size-3.5" />
                Lote piloto ativo
              </span>
              <h2 id="pilot-title" className="mt-2 text-xl font-semibold text-els-fg">
                {numberFormatter.format(snapshot.metrics.drafts)} questões inéditas aguardam conferência editorial
              </h2>
              <p className="mt-2 text-sm leading-6 text-els-fg-3">
                Foram geradas somente a partir de artigos oficiais já revisados. Permanecem fora do catálogo até um
                responsável confirmar a fonte e registrar a revisão humana do conteúdo.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-[.08em] text-els-fg-3">
              <span className="rounded-xl border border-violet-300/12 bg-black/10 px-3 py-3 text-violet-200">1. Conferir</span>
              <span className="rounded-xl border border-els-amber/12 bg-black/10 px-3 py-3 text-els-amber-ink">2. Revisar</span>
              <span className="rounded-xl border border-els-green/12 bg-black/10 px-3 py-3 text-els-green-ink">3. Liberar</span>
            </div>
          </div>
        </section>
      ) : null}

      <nav aria-label="Revisar por concurso" className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface/95 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[.14em] text-els-info-ink">Revisar por concurso</h2>
        <p className="mt-1 text-xs leading-5 text-els-fg-3">
          Cada concurso vende com 68 questões revisadas e vinculadas. Escolha um para ver só o que falta revisar dele.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li>
            <Link
              href="/admin/fabrica-autoral"
              className={`inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-bold ${selectedContest ? "border-els-line text-els-fg-2" : "border-els-info/40 bg-els-info/10 text-els-fg"}`}
            >
              Fila geral
            </Link>
          </li>
          {contests.map((contest) => (
            <li key={contest.slug}>
              <Link
                href={`/admin/fabrica-autoral?concurso=${contest.slug}`}
                className={`inline-flex min-h-10 flex-col justify-center rounded-xl border px-3 py-1.5 text-xs ${selectedContest?.slug === contest.slug ? "border-els-info/40 bg-els-info/10 text-els-fg" : "border-els-line text-els-fg-2"}`}
              >
                <span className="font-bold">{contest.title}</span>
                <span className="text-[11px] text-els-fg-3">
                  {numberFormatter.format(contest.drafts)} rascunhos · {numberFormatter.format(contest.pending)} na fila ·{" "}
                  {numberFormatter.format(contest.reviewed)} revisadas
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <BatchClaimControls
        claimableCount={selectedContest ? snapshot.queue.filter((item) => item.editorialStatus === "draft" && !item.creatorUserId).length : snapshot.metrics.claimable}
        opportunitySlug={selectedContest?.slug}
      />

      <section className="mt-5" aria-labelledby="profiles-title">
        <div className="mb-3">
          <h2 id="profiles-title" className="text-lg font-semibold text-els-fg">Perfis editoriais internos</h2>
          <p className="mt-1 text-xs leading-5 text-els-fg-3">Características abstratas de forma; nunca texto, caso ou alternativa de prova.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {snapshot.profiles.map((profile) => (
            <article key={profile.id} className="rounded-2xl border border-els-line bg-els-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-els-fg">{profile.bankName}</h3>
                  <p className="mt-0.5 text-[11px] text-els-fg-4">Perfil interno v{profile.version}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[.1em] text-els-amber-ink">
                  {profile.format === "true_false" ? "C / E" : "A — E"}
                </span>
              </div>
              <p className="mt-4 text-xs leading-5 text-els-fg-3">{profile.commandStyle}</p>
              <p className="mt-3 border-t border-els-line pt-3 text-[11px] leading-5 text-els-fg-4">{profile.disclaimer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-els-amber-ink">Nova questão</span>
            <h2 className="mt-2 text-xl font-semibold tracking-[-.025em] text-els-fg">Enviar conteúdo inédito à revisão</h2>
            <p className="mt-2 text-sm leading-6 text-els-fg-3">O envio cria um item pendente. A publicação exige uma confirmação posterior de revisão humana.</p>
          </div>
          <AuthoringForm
            profiles={snapshot.profiles}
            articles={snapshot.articles}
            subjects={snapshot.subjects}
            topics={snapshot.topics}
          />
        </article>

        <aside className="space-y-4">
          <article className="rounded-[1.5rem] border border-els-green/15 bg-els-green/[.045] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-els-green-ink">
              <ShieldCheck aria-hidden="true" className="size-5" />
              Protocolo obrigatório
            </h2>
            <ol className="mt-5 space-y-4">
              {[
                ["1", "Escolher a lei oficial", "Somente artigo revisado e versão vigente."],
                ["2", "Redigir em ambiente limpo", "Sem consultar ou adaptar questões de terceiros."],
                ["3", "Registrar procedência", "Autor, fonte, método e declaração ficam auditáveis."],
                ["4", "Confirmar a revisão humana", "Só a aprovação registrada muda o item para liberado."],
              ].map(([step, title, detail]) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-els-green/12 text-xs font-extrabold text-els-green-ink">{step}</span>
                  <span>
                    <strong className="block text-sm text-els-fg-2">{title}</strong>
                    <span className="mt-0.5 block text-xs leading-5 text-els-fg-3">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </article>

          <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5">
            <h2 className="font-semibold text-els-fg">Detalhes do perfil selecionado</h2>
            <div className="mt-4 space-y-5">
              {snapshot.profiles.map((profile) => (
                <details key={profile.id} className="group rounded-xl border border-els-line bg-black/10 p-3">
                  <summary className="cursor-pointer list-none text-sm font-bold text-els-fg-2">{profile.bankName}</summary>
                  <div className="mt-3 border-t border-els-line pt-3">
                    <p className="text-xs font-semibold text-els-info-ink">Demanda de raciocínio</p>
                    <p className="mt-1 text-xs leading-5 text-els-fg-3">{profile.reasoningDemand}</p>
                    <p className="mt-4 text-xs font-semibold text-els-amber-ink">Diretrizes</p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-els-fg-3">
                      {profile.authoringGuidelines.map((guideline) => <li key={guideline}>• {guideline}</li>)}
                    </ul>
                    <p className="mt-4 text-xs font-semibold text-els-danger-ink">Limites clean-room</p>
                    <ul className="mt-2 space-y-2 text-xs leading-5 text-els-fg-3">
                      {profile.prohibitedPatterns.map((pattern) => <li key={pattern}>• {pattern}</li>)}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6" aria-labelledby="queue-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-els-info-ink">Governança editorial</span>
            <h2 id="queue-title" className="mt-2 text-xl font-semibold text-els-fg">Fila e histórico recente</h2>
          </div>
          <p className="text-xs text-els-fg-4">Até 250 itens mais recentes</p>
        </div>

        {snapshot.queue.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.queue.map((item) => {
              const canReview = item.editorialStatus === "pending_review" && item.creatorUserId !== null;
              const canClaim = item.editorialStatus === "draft" && !item.creatorUserId;
              return (
                <article key={item.publicId} className="rounded-2xl border border-els-line bg-black/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${statusClasses[item.editorialStatus] ?? statusClasses.draft}`}>
                      {statusLabels[item.editorialStatus] ?? item.editorialStatus}
                    </span>
                    <span className="text-[11px] text-els-fg-4">{dateFormatter.format(item.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-els-fg-3">
                    <span className="text-els-amber-ink">{item.bankName}</span>
                    <span>{item.sourceTitle} · {item.articleRef}</span>
                    <span>{item.subjectName}{item.topicName ? ` / ${item.topicName}` : ""}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-els-fg-2">{item.prompt}</p>
                  {item.learningObjective ? <p className="mt-2 text-xs leading-5 text-els-fg-3"><strong className="text-els-fg-3">Objetivo:</strong> {item.learningObjective}</p> : null}

                  <details className="group mt-4 overflow-hidden rounded-xl border border-els-line bg-els-bg">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-bold text-els-info-ink outline-none transition hover:bg-els-raise-hover focus-visible:ring-2 focus-visible:ring-els-info/50">
                      <span className="inline-flex items-center gap-2">
                        <BookOpenCheck aria-hidden="true" className="size-4" />
                        Abrir dossiê de conferência
                      </span>
                      <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-4 border-t border-els-line p-3.5 sm:p-4">
                      <section aria-label="Fonte legal do item">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-els-amber-ink">Texto oficial de controle</p>
                            <p className="mt-1 text-[11px] text-els-fg-4">
                              Verificado em {sourceDateFormatter.format(item.sourceVerifiedAt)}
                            </p>
                          </div>
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-els-amber/15 bg-els-amber/[.045] px-2.5 text-[11px] font-bold text-els-amber-ink transition hover:bg-els-amber/[.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-els-amber/50"
                          >
                            Conferir no portal oficial
                            <ExternalLink aria-hidden="true" className="size-3.5" />
                          </a>
                        </div>
                        <blockquote className="mt-3 rounded-lg border-l-2 border-els-amber/40 bg-els-amber/[.035] px-3 py-2.5 text-xs leading-6 text-els-fg-2">
                          {item.literalText}
                        </blockquote>
                      </section>

                      <section aria-label="Alternativas e gabarito">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-els-info-ink">Alternativas e gabarito</p>
                          <span className="text-[10px] font-semibold text-els-fg-4">
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
                                    ? "border-els-green/20 bg-els-green/[.055]"
                                    : "border-els-line bg-black/10"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className={`grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-extrabold ${
                                      option.isCorrect
                                        ? "bg-els-green text-els-on-amber"
                                        : "bg-els-raise text-els-fg-3"
                                    }`}
                                  >
                                    {option.optionKey}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-xs leading-5 text-els-fg-2">{option.text}</p>
                                      {option.isCorrect ? (
                                        <span className="rounded-md bg-els-green/12 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.08em] text-els-green-ink">
                                          Gabarito
                                        </span>
                                      ) : null}
                                    </div>
                                    {option.rationale ? (
                                      <p className="mt-1.5 text-[11px] leading-5 text-els-fg-3">{option.rationale}</p>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-3 rounded-lg border border-els-danger/15 bg-els-danger/[.045] p-3 text-xs text-els-fg">
                            Alternativas indisponíveis. Não assuma este item até a correção.
                          </p>
                        )}
                      </section>

                      <section className="rounded-lg border border-els-line bg-black/10 p-3" aria-label="Explicação editorial">
                        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-violet-300">Explicação proposta</p>
                        <p className="mt-2 text-xs leading-6 text-els-fg-3">{item.explanation}</p>
                      </section>
                    </div>
                  </details>

                  <div className="mt-4 border-t border-els-line pt-3 text-[11px] leading-5 text-els-fg-4">
                    Responsável editorial: {item.creatorName ?? "a definir"} · método {item.authorshipMethod === "ai_assisted" ? "assistido por IA" : item.authorshipMethod === "rule_based" ? "gerado por regras verificáveis" : "humano"}
                    {item.generatorModel ? ` · gerador: ${item.generatorModel}` : ""}
                    {item.promptVersion ? ` · protocolo: ${item.promptVersion}` : ""}
                    {item.reviewerName ? ` · revisor: ${item.reviewerName}` : ""}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-els-info-ink/80">
                    Originalidade textual interna: {Math.max(0, 100 - Math.round(item.similarityMaxBps / 100))}%
                    {item.similarityReferencePublicId ? " · comparação registrada" : " · primeiro item da base"}
                  </p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-els-raise p-2 text-xs leading-5 text-els-fg-3">Nota: {item.reviewNotes}</p> : null}
                  {canReview ? (
                    <div className="mt-4 rounded-xl border border-els-green/20 bg-els-green/[.045] p-3.5">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          form={BATCH_APPROVAL_FORM_ID}
                          name="reviewedPublicIds"
                          value={item.publicId}
                          className="mt-0.5 size-5 shrink-0 accent-els-green"
                        />
                        <span className="text-xs leading-5 text-els-fg-2">
                          <strong className="font-bold text-els-green-ink">Conferi este item.</strong> Li o enunciado,
                          todas as alternativas, o gabarito, as justificativas e o texto oficial acima.
                        </span>
                      </label>
                      {/* Impressão digital do dossiê exibido, calculada no servidor.
                          A aprovação a recalcula sob transação e recusa se o conteúdo
                          tiver mudado depois desta leitura. */}
                      <input
                        type="hidden"
                        form={BATCH_APPROVAL_FORM_ID}
                        name="reviewedFingerprints"
                        value={`${item.publicId}:${item.dossierFingerprint}`}
                      />
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-4 text-els-fg-4">
                        <Fingerprint aria-hidden="true" className="size-3" />
                        Conferência vinculada a esta versão do dossiê ({item.dossierFingerprint.slice(0, 12)}).
                      </p>
                    </div>
                  ) : null}
                  {canClaim ? <ClaimDraftControls publicId={item.publicId} /> : null}
                  {canReview ? (
                    <ReviewControls
                      publicId={item.publicId}
                      dossierFingerprint={item.dossierFingerprint}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-els-line p-8 text-center text-sm text-els-fg-3">
            A fila está vazia. O primeiro rascunho ou envio editorial aparecerá aqui.
          </div>
        )}

        <BatchApprovalControls reviewableCount={snapshot.metrics.reviewable} />
      </section>
    </main>
  );
}
