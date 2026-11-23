import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  GenerateRequirementButton,
  NoticeSourceForm,
  NoticeSourceReviewControls,
  NoticeDocumentReviewControls,
  OfficialDocumentDiscoveryControls,
  ExtractSnapshotButton,
  RequirementMappingControls,
  RequirementReviewControls,
  SyllabusImportForm,
  OpportunityEditionForm,
  RetryEditorialJobButton,
} from "@/components/admin/notice-engine-controls";
import { requireAdmin } from "@/lib/auth";
import { getNoticeEngineSnapshot } from "@/lib/db/notice-engine-admin";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const statusLabels: Record<string, string> = {
  pending_review: "Aguardando revisão",
  approved: "Fonte aprovada",
  rejected: "Rejeitada",
  superseded: "Substituída",
  reviewed: "Requisito revisado",
  suspended: "Suspenso",
  draft: "Aguardando mapeamento",
  pending: "Na fila",
  running: "Em execução",
  retry: "Nova tentativa agendada",
  succeeded: "Concluída",
  blocked: "Aguardando correção editorial",
  failed: "Tentativas esgotadas",
};

function statusClass(status: string) {
  if (status === "approved" || status === "reviewed") {
    return "border-els-green/20 bg-els-green/8 text-els-green-ink";
  }
  if (status === "pending_review") {
    return "border-els-amber/20 bg-els-amber/8 text-els-amber-ink";
  }
  if (status === "rejected" || status === "suspended") {
    return "border-els-danger/20 bg-els-danger/8 text-els-danger-ink";
  }
  return "border-els-line bg-els-raise text-els-fg-3";
}

export default async function NoticeEnginePage() {
  const [user, snapshot] = await Promise.all([
    requireAdmin("/admin/motor-editais"),
    getNoticeEngineSnapshot(),
  ]);
  const opportunityOptions = snapshot.opportunities.map(({ publicId, title, editorialStatus }) => ({
    publicId,
    title,
    editorialStatus,
  }));
  const approvedSourceOptions = snapshot.sourceDocuments
    .filter((item) => item.status === "approved")
    .map(({ publicId, title, opportunityTitle }) => ({ publicId, title, opportunityTitle }));
  const articleOptions = snapshot.articles.map(({ id, actTitle, articleRef, heading }) => ({
    id,
    actTitle,
    articleRef,
    heading,
  }));
  const metrics = [
    { label: "Fontes aprovadas", value: snapshot.metrics.approvedSources, icon: FileCheck2, tone: "bg-els-green/10 text-els-green-ink" },
    { label: "Fontes pendentes", value: snapshot.metrics.pendingSources, icon: FileSearch, tone: "bg-els-amber/10 text-els-amber-ink" },
    { label: "PDFs aprovados", value: snapshot.metrics.approvedSnapshots, icon: Database, tone: "bg-els-info/10 text-els-info-ink" },
    { label: "Requisitos revisados", value: snapshot.metrics.reviewedRequirements, icon: CheckCircle2, tone: "bg-els-info/10 text-els-info-ink" },
    { label: "Rascunhos gerados", value: snapshot.metrics.generatedQuestions, icon: Sparkles, tone: "bg-els-info/10 text-els-info-ink" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-els-info/15 bg-[linear-gradient(145deg,var(--els-surface)_0%,var(--els-bg-2)_58%,var(--els-bg-2)_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-els-info/8 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-els-info-ink">
            <Radar aria-hidden="true" className="size-3.5" /> Motor de editais
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-els-fg sm:text-4xl">
            Do conteúdo oficial ao treino inédito, com trilha auditável.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-els-fg-3 sm:text-base">
            Registre a fonte oficial, transforme o conteúdo programático em requisitos e gere rascunhos fundamentados na legislação vigente e no perfil abstrato da banca. Nada é publicado automaticamente.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-els-fg-2">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-els-green-ink" /> origem permitida</span>
            <span className="inline-flex items-center gap-2"><BookOpenCheck className="size-4 text-els-amber-ink" /> norma oficial revisada</span>
            <span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-els-info-ink" /> geração por regras verificáveis</span>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores do motor">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-els-line bg-els-surface p-4">
            <div className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-4" /></div>
            <p className="mt-4 text-2xl font-semibold text-els-fg">{numberFormatter.format(value)}</p>
            <p className="mt-1 text-xs font-semibold text-els-fg-3">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-els-green/15 bg-els-green/[.035] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="Estado da automação editorial">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-els-green/10 text-els-green-ink">
            <RefreshCcw aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-els-green-ink">Automação editorial com execução rastreável</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-els-fg-3">Quando o agendador estiver ativo, a rotina procura PDFs elegíveis nas fontes aprovadas e cria pendências e rascunhos. O agendamento sugerido é a cada 6 horas. Nenhuma aprovação ou publicação é automática.</p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-semibold text-els-fg-3">
          {snapshot.automationRun
            ? `Última execução: ${dateFormatter.format(snapshot.automationRun.createdAt)}`
            : "Aguardando a primeira execução"}
        </p>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-4" aria-label="Fluxo editorial">
        {[
          ["1", "Confirmar a origem", "O sistema valida o endereço oficial e localiza o PDF elegível."],
          ["2", "Capturar e mapear", "O edital é lido por página e cada item recebe matéria, assunto e norma."],
          ["3", "Gerar o treino", "A questão nasce do artigo vigente, sem texto de prova anterior."],
          ["4", "Revisar e liberar", "A Fábrica Autoral exige responsável e revisão humana."],
        ].map(([step, title, detail]) => (
          <article key={step} className="rounded-2xl border border-els-line bg-els-surface p-4">
            <span className="grid size-7 place-items-center rounded-lg bg-els-info/10 text-xs font-extrabold text-els-info-ink">{step}</span>
            <h2 className="mt-3 text-sm font-bold text-els-fg">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-els-fg-3">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-amber/15 bg-els-surface p-5 sm:p-6" aria-labelledby="edition-mapping-title">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-els-amber-ink">Precisão do programa</span>
        <h2 id="edition-mapping-title" className="mt-2 text-xl font-semibold text-els-fg">Cada edição, seu próprio programa</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-els-fg-3">Carreira, banca e ano não identificam um concurso sozinhos. Sem este vínculo explícito, o treino por edição não recebe questões deste programa. O treino geral da banca permanece separado.</p>
        <OpportunityEditionForm opportunities={snapshot.opportunities} editions={snapshot.editions} />
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6" aria-labelledby="automation-queue-title">
        <h2 id="automation-queue-title" className="text-xl font-semibold text-els-fg">Fila de geração</h2>
        <p className="mt-2 text-sm leading-6 text-els-fg-3">Até 100 trabalhos recentes. Falhas temporárias recebem novas tentativas; pendências editoriais exigem correção. Solicitar reavaliação não dispensa os critérios de revisão.</p>
        {snapshot.automationJobs.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.automationJobs.map((job) => <article key={job.jobKey} className="min-w-0 rounded-xl border border-els-line p-4">
            <h3 className="text-sm font-bold text-els-fg-2">{job.kind === "draft_generation" ? "Requisito" : "Fonte"} #{job.subjectId}</h3>
            <p className="mt-2 text-xs font-semibold text-els-amber-ink">{statusLabels[job.status] ?? job.status}</p>
            <p className="mt-2 text-xs text-els-fg-3">{job.attempts}/5 tentativas · {dateFormatter.format(job.updatedAt)}</p>
            {job.status === "retry" ? <p className="mt-2 text-xs text-els-fg-3">Pode retomar a partir de {dateFormatter.format(job.nextAttemptAt)}</p> : null}
            {job.lastErrorCode ? <p className="mt-2 break-words font-mono text-[10px] text-els-fg-3">{job.lastErrorCode}</p> : null}
            {["blocked", "failed"].includes(job.status) ? <RetryEditorialJobButton jobKey={job.jobKey} /> : null}
          </article>)}
        </div> : <p className="mt-4 rounded-xl border border-dashed border-els-line p-5 text-sm text-els-fg-3">Ainda não há trabalhos enfileirados. Requisitos revisados entram na próxima execução da rotina.</p>}
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[.9fr_1.1fr]">
        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-els-amber-ink">Entrada segura</span>
          <h2 className="mt-2 text-xl font-semibold text-els-fg">Registrar uma fonte do concurso</h2>
          <p className="mt-2 text-sm leading-6 text-els-fg-3">
            O endereço precisa pertencer à lista de órgãos e bancas permitidos. Depois da revisão da origem, o motor consegue localizar e capturar apenas editais e anexos oficiais — nunca provas, gabaritos ou cadernos de questões.
          </p>
          <NoticeSourceForm opportunities={opportunityOptions} />
        </article>

        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-els-info-ink">Conteúdo programático</span>
          <h2 className="mt-2 text-xl font-semibold text-els-fg">Separar o edital em requisitos rastreáveis</h2>
          <p className="mt-2 text-sm leading-6 text-els-fg-3">
            Cole apenas o trecho do edital oficial. Cada linha vira um requisito pendente e permanece ligada ao local exato, matéria, assunto e dispositivo legal escolhido.
          </p>
          <SyllabusImportForm
            sources={approvedSourceOptions}
            subjects={snapshot.subjects}
            topics={snapshot.topics}
            articles={articleOptions}
          />
        </article>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-els-green-ink">Governança da fonte</span>
            <h2 className="mt-2 text-xl font-semibold text-els-fg">Documentos recentes</h2>
          </div>
          <p className="text-xs text-els-fg-4">Até 150 registros</p>
        </div>
        {snapshot.sourceDocuments.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.sourceDocuments.map((item) => {
              const canReview = item.status === "pending_review";
              return (
                <article key={item.publicId} className="rounded-2xl border border-els-line bg-els-sink p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-els-fg-3">{item.opportunityTitle}</p>
                      <h3 className="mt-1 font-semibold text-els-fg">{item.title}</h3>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-els-fg-4">
                    <span>HTTP {item.httpStatus}</span><span>·</span><span>{item.sourceHost}</span><span>·</span><span>{dateFormatter.format(item.observedAt)}</span>
                  </div>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-els-amber-ink hover:text-els-amber-ink min-h-11">
                    Abrir fonte oficial <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                  <p className="mt-3 text-[11px] leading-5 text-els-fg-4">
                    Registrada por {item.initiatorName ?? "monitor interno"}{item.reviewerName ? ` · revisada por ${item.reviewerName}` : ""} · conteúdo armazenado: {item.sourceContentStored ? "sim" : "não"}
                  </p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-els-raise p-2 text-xs text-els-fg-3">{item.reviewNotes}</p> : null}
                  {canReview ? <NoticeSourceReviewControls publicId={item.publicId} /> : null}
                  {item.status === "approved" ? <OfficialDocumentDiscoveryControls sourceDocumentPublicId={item.publicId} /> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-els-line p-7 text-center text-sm text-els-fg-3">Nenhuma fonte foi registrada ainda.</p>
        )}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-els-info-ink">Captura oficial</span>
            <h2 className="mt-2 text-xl font-semibold text-els-fg">Versões armazenadas dos editais</h2>
          </div>
          <p className="text-xs text-els-fg-4">PDF integral + texto por página + checksum</p>
        </div>
        {snapshot.documentSnapshots.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.documentSnapshots.map((item) => {
              const canReview = item.status === "pending_review";
              return (
                <article key={item.publicId} className="rounded-2xl border border-els-line bg-els-sink p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-els-info-ink">{item.opportunityTitle}</p>
                      <h3 className="mt-1 break-words font-semibold text-els-fg">{item.fileName}</h3>
                      <p className="mt-1 text-[11px] text-els-fg-3">{item.sourceDocumentTitle}</p>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{statusLabels[item.status] ?? item.status}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-els-fg-3 sm:grid-cols-4">
                    <div><dt>Páginas</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{item.pageCount}</dd></div>
                    <div><dt>Tamanho</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{(item.byteLength / 1024 / 1024).toFixed(1)} MB</dd></div>
                    <div><dt>Texto</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{numberFormatter.format(item.textLength)} caracteres</dd></div>
                    <div><dt>Prova de versão</dt><dd className="mt-0.5 font-mono text-els-fg-2">{item.checksumSha256.slice(0, 10)}…</dd></div>
                  </dl>
                  <a href={item.documentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-els-info-ink hover:text-els-info-ink">Abrir PDF oficial <ExternalLink aria-hidden="true" className="size-3.5" /></a>
                  <p className="mt-3 text-[11px] leading-5 text-els-fg-4">Capturado por {item.initiatorName ?? "rotina interna"}{item.reviewerName ? ` · revisado por ${item.reviewerName}` : ""} · autorização {item.authorizationScope}</p>
                  {item.status === "approved" ? (
                    <p className="mt-2 text-[11px] font-semibold text-els-fg-3">
                      Base da decisão: {item.approvalBasis === "owner_override" ? "aprovação explícita do proprietário" : "revisão humana independente"}.
                    </p>
                  ) : null}
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-els-raise p-2 text-xs text-els-fg-3">{item.reviewNotes}</p> : null}
                  {canReview ? <NoticeDocumentReviewControls snapshotPublicId={item.publicId} selfReview={item.initiatedByUserId === user.id} /> : null}
                  {item.status === "approved" ? <ExtractSnapshotButton snapshotPublicId={item.publicId} /> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-els-line p-7 text-center text-sm text-els-fg-3">Nenhum PDF foi capturado. Em uma fonte aprovada, use “Procurar PDF do edital”.</p>
        )}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-els-info-ink">Fila de geração</span>
            <h2 className="mt-2 text-xl font-semibold text-els-fg">Requisitos do edital</h2>
          </div>
          <Link href="/admin/fabrica-autoral" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-els-info/15 bg-els-info/[.045] px-3 text-xs font-bold text-els-info-ink">
            Abrir Fábrica Autoral <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
        {snapshot.requirements.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.requirements.map((item) => {
              const canReview = item.editorialStatus === "pending_review";
              const canGenerate = item.editorialStatus === "reviewed" && item.sourceDocumentStatus === "approved" && item.assignment;
              return (
                <article key={item.id} className="rounded-2xl border border-els-line bg-els-sink p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-els-info-ink">{item.opportunityTitle}</p>
                      <h3 className="mt-2 text-sm font-semibold leading-6 text-els-fg">{item.requirementText}</h3>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.editorialStatus)}`}>
                      {statusLabels[item.editorialStatus] ?? item.editorialStatus}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-[11px] text-els-fg-3 sm:grid-cols-2">
                    <div><dt>Mapa pedagógico</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{item.subjectName ?? "—"} / {item.topicName ?? "—"}</dd></div>
                    <div><dt>Fonte legal</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{item.actTitle ?? "—"} · {item.articleRef ?? "—"}</dd></div>
                    <div><dt>Local no edital</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{item.sourceLocator}</dd></div>
                    <div><dt>Perfil de geração</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{item.assignment ? `${item.assignment.bankName} · ${item.assignment.format === "true_false" ? "C/E" : "A—E"}` : "Banca não vinculada"}</dd></div>
                  </dl>
                  <p className="mt-3 text-[11px] text-els-fg-4">Importado por {item.creatorName ?? "rotina interna"}{item.reviewerName ? ` · revisado por ${item.reviewerName}` : ""}</p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-els-raise p-2 text-xs text-els-fg-3">{item.reviewNotes}</p> : null}
                  {item.editorialStatus === "draft" && item.sourceSnapshotPublicId ? (
                    <RequirementMappingControls
                      requirementId={item.id}
                      suggestedSubjectId={item.subjectId}
                      subjects={snapshot.subjects}
                      topics={snapshot.topics}
                      articles={articleOptions}
                    />
                  ) : null}
                  {canReview ? <RequirementReviewControls requirementId={item.id} /> : null}
                  {canGenerate ? <GenerateRequirementButton requirementId={item.id} /> : null}
                  {item.editorialStatus === "reviewed" && !item.assignment ? <p className="mt-3 text-xs text-els-amber-ink">A geração aguarda uma banca organizadora revisada.</p> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-els-line p-7 text-center text-sm text-els-fg-3">Ainda não há requisitos. Aprove uma fonte e importe o conteúdo programático.</p>
        )}
      </section>

      <aside className="mt-5 rounded-[1.5rem] border border-els-amber/15 bg-els-amber/[.04] p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-els-amber-ink"><ShieldCheck className="size-5" /> Escopo autorizado e protegido</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-els-fg-3">
          A captura automática está limitada a editais e anexos oficiais, com até 15 MB e 250 páginas. Provas, gabaritos, cadernos e questões são bloqueados antes do download. A extração preserva o texto oficial e só cria uma fila: o vínculo pedagógico, a norma, a aprovação e a publicação continuam humanos e auditáveis.
        </p>
      </aside>
    </main>
  );
}
