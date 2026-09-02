import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  GenerateRequirementButton,
  NoticeSourceForm,
  NoticeSourceReviewControls,
  RequirementReviewControls,
  SyllabusImportForm,
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
};

function statusClass(status: string) {
  if (status === "approved" || status === "reviewed") {
    return "border-emerald-300/20 bg-emerald-300/8 text-emerald-200";
  }
  if (status === "pending_review") {
    return "border-amber-300/20 bg-amber-300/8 text-amber-200";
  }
  if (status === "rejected" || status === "suspended") {
    return "border-rose-300/20 bg-rose-300/8 text-rose-200";
  }
  return "border-white/10 bg-white/5 text-slate-400";
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
    { label: "Fontes aprovadas", value: snapshot.metrics.approvedSources, icon: FileCheck2, tone: "bg-emerald-300/10 text-emerald-300" },
    { label: "Fontes pendentes", value: snapshot.metrics.pendingSources, icon: FileSearch, tone: "bg-amber-300/10 text-amber-300" },
    { label: "Requisitos revisados", value: snapshot.metrics.reviewedRequirements, icon: CheckCircle2, tone: "bg-sky-300/10 text-sky-300" },
    { label: "Rascunhos gerados", value: snapshot.metrics.generatedQuestions, icon: Sparkles, tone: "bg-violet-300/10 text-violet-300" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-sky-300/15 bg-[linear-gradient(145deg,#101a27_0%,#091521_58%,#0a1926_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-sky-300/8 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-sky-300">
            <Radar aria-hidden="true" className="size-3.5" /> Motor de editais
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-white sm:text-4xl">
            Do conteúdo oficial ao treino inédito, com trilha auditável.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Registre a fonte oficial, transforme o conteúdo programático em requisitos e gere rascunhos fundamentados na legislação vigente e no perfil abstrato da banca. Nada é publicado automaticamente.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" /> origem permitida</span>
            <span className="inline-flex items-center gap-2"><BookOpenCheck className="size-4 text-amber-300" /> norma oficial revisada</span>
            <span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-violet-300" /> geração por regras verificáveis</span>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do motor">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-white/8 bg-[#09131f] p-4">
            <div className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-4" /></div>
            <p className="mt-4 text-2xl font-semibold text-white">{numberFormatter.format(value)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-4" aria-label="Fluxo editorial">
        {[
          ["1", "Confirmar a origem", "O sistema consulta apenas metadados do endereço oficial."],
          ["2", "Mapear o programa", "O editor cola o trecho e vincula matéria, assunto e norma."],
          ["3", "Gerar o treino", "A questão nasce do artigo vigente, sem texto de prova anterior."],
          ["4", "Revisar e liberar", "A Fábrica Autoral exige responsável e revisão humana."],
        ].map(([step, title, detail]) => (
          <article key={step} className="rounded-2xl border border-white/8 bg-[#09131f] p-4">
            <span className="grid size-7 place-items-center rounded-lg bg-sky-300/10 text-xs font-extrabold text-sky-200">{step}</span>
            <h2 className="mt-3 text-sm font-bold text-white">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[.9fr_1.1fr]">
        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-amber-300">Entrada segura</span>
          <h2 className="mt-2 text-xl font-semibold text-white">Registrar uma fonte do concurso</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            O endereço precisa pertencer à lista de órgãos e bancas permitidos. Nesta primeira versão, só os metadados da fonte são consultados; nenhum PDF ou página completa é armazenado.
          </p>
          <NoticeSourceForm opportunities={opportunityOptions} />
        </article>

        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-sky-300">Conteúdo programático</span>
          <h2 className="mt-2 text-xl font-semibold text-white">Separar o edital em requisitos rastreáveis</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
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

      <section className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">Governança da fonte</span>
            <h2 className="mt-2 text-xl font-semibold text-white">Documentos recentes</h2>
          </div>
          <p className="text-xs text-slate-600">Até 150 registros</p>
        </div>
        {snapshot.sourceDocuments.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.sourceDocuments.map((item) => {
              const canReview = item.status === "pending_review" && item.initiatedByUserId !== user.id;
              return (
                <article key={item.publicId} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-500">{item.opportunityTitle}</p>
                      <h3 className="mt-1 font-semibold text-white">{item.title}</h3>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span>HTTP {item.httpStatus}</span><span>·</span><span>{item.sourceHost}</span><span>·</span><span>{dateFormatter.format(item.observedAt)}</span>
                  </div>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200">
                    Abrir fonte oficial <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                  <p className="mt-3 text-[11px] leading-5 text-slate-600">
                    Registrada por {item.initiatorName ?? "monitor interno"}{item.reviewerName ? ` · revisada por ${item.reviewerName}` : ""} · conteúdo armazenado: {item.sourceContentStored ? "sim" : "não"}
                  </p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-white/[.035] p-2 text-xs text-slate-400">{item.reviewNotes}</p> : null}
                  {canReview ? <NoticeSourceReviewControls publicId={item.publicId} /> : null}
                  {item.status === "pending_review" && item.initiatedByUserId === user.id ? <p className="mt-3 text-xs text-amber-200/70">Outra pessoa deve decidir esta fonte.</p> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">Nenhuma fonte foi registrada ainda.</p>
        )}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-violet-300">Fila de geração</span>
            <h2 className="mt-2 text-xl font-semibold text-white">Requisitos do edital</h2>
          </div>
          <Link href="/admin/fabrica-autoral" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-300/[.045] px-3 text-xs font-bold text-violet-200">
            Abrir Fábrica Autoral <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
        {snapshot.requirements.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.requirements.map((item) => {
              const canReview = item.editorialStatus === "pending_review" && item.createdByUserId !== user.id;
              const canGenerate = item.editorialStatus === "reviewed" && item.sourceDocumentStatus === "approved" && item.assignment;
              return (
                <article key={item.id} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-sky-200">{item.opportunityTitle}</p>
                      <h3 className="mt-2 text-sm font-semibold leading-6 text-white">{item.requirementText}</h3>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.editorialStatus)}`}>
                      {statusLabels[item.editorialStatus] ?? item.editorialStatus}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                    <div><dt>Mapa pedagógico</dt><dd className="mt-0.5 font-semibold text-slate-300">{item.subjectName ?? "—"} / {item.topicName ?? "—"}</dd></div>
                    <div><dt>Fonte legal</dt><dd className="mt-0.5 font-semibold text-slate-300">{item.actTitle ?? "—"} · {item.articleRef ?? "—"}</dd></div>
                    <div><dt>Local no edital</dt><dd className="mt-0.5 font-semibold text-slate-300">{item.sourceLocator}</dd></div>
                    <div><dt>Perfil de geração</dt><dd className="mt-0.5 font-semibold text-slate-300">{item.assignment ? `${item.assignment.bankName} · ${item.assignment.format === "true_false" ? "C/E" : "A—E"}` : "Banca não vinculada"}</dd></div>
                  </dl>
                  <p className="mt-3 text-[11px] text-slate-600">Importado por {item.creatorName ?? "rotina interna"}{item.reviewerName ? ` · revisado por ${item.reviewerName}` : ""}</p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-white/[.035] p-2 text-xs text-slate-400">{item.reviewNotes}</p> : null}
                  {canReview ? <RequirementReviewControls requirementId={item.id} /> : null}
                  {item.editorialStatus === "pending_review" && item.createdByUserId === user.id ? <p className="mt-3 text-xs text-amber-200/70">Outra pessoa deve revisar este requisito.</p> : null}
                  {canGenerate ? <GenerateRequirementButton requirementId={item.id} /> : null}
                  {item.editorialStatus === "reviewed" && !item.assignment ? <p className="mt-3 text-xs text-amber-200">A geração aguarda uma banca organizadora revisada.</p> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">Ainda não há requisitos. Aprove uma fonte e importe o conteúdo programático.</p>
        )}
      </section>

      <aside className="mt-5 rounded-[1.5rem] border border-amber-300/15 bg-amber-300/[.04] p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-amber-100"><ShieldCheck className="size-5" /> Limite intencional desta entrega</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          A captura automática do texto integral de PDFs ainda está fechada. Para ativá-la com segurança, cada origem precisa de autorização documental e política de retenção aprovadas. O motor atual já cobre verificação da fonte, mapeamento, geração autoral, auditoria e revisão humana sem armazenar o documento de terceiros.
        </p>
      </aside>
    </main>
  );
}
