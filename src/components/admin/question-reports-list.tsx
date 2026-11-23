import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, MessageSquareText, UserRound } from "lucide-react";

import { QuestionReportStatusForm } from "@/components/admin/question-report-status-form";
import type { AdminQuestionReport, AdminQuestionReportsPage } from "@/lib/db/question-reports-admin";
import { QUESTION_REPORT_REASONS } from "@/lib/study/question-bar-contract";
import {
  QUESTION_REPORT_STATUS_LABELS,
  QUESTION_REPORT_STATUSES,
  type QuestionReportFilters,
  type QuestionReportStatus,
  questionReportFiltersHref,
  questionReportReasonLabel,
} from "@/lib/study/question-report-admin";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const numberFormatter = new Intl.NumberFormat("pt-BR");

const statusTone: Record<QuestionReportStatus, string> = {
  open: "bg-els-amber/10 text-els-amber-ink",
  reviewing: "bg-els-info/10 text-els-info-ink",
  resolved: "bg-els-green/10 text-els-green-ink",
  dismissed: "bg-els-raise text-els-fg-3",
};

const quizModeLabels: Record<string, string> = {
  dry_law: "Lei seca",
  original_style: "Inédita no estilo",
  previous_exam: "Prova anterior",
};

function StatusFilters({ filters, counts }: { filters: QuestionReportFilters; counts: Record<QuestionReportStatus, number> }) {
  const total = QUESTION_REPORT_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  const items = [
    ...QUESTION_REPORT_STATUSES.map((status) => ({ value: status, label: QUESTION_REPORT_STATUS_LABELS[status], count: counts[status] })),
    { value: "all" as const, label: "Todos", count: total },
  ];
  return (
    <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = filters.status === item.value;
        return (
          <Link
            key={item.value}
            href={questionReportFiltersHref({ ...filters, status: item.value, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
              active
                ? "border-els-amber/30 bg-els-amber/12 text-els-amber-ink"
                : "border-els-line text-els-fg-3 hover:border-els-line-strong hover:text-els-fg",
            )}
          >
            {item.label}
            <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-els-amber/20" : "bg-els-raise")}>
              {numberFormatter.format(item.count)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function ReasonFilter({ filters }: { filters: QuestionReportFilters }) {
  return (
    <form method="get" action="/admin/relatos" className="flex flex-wrap items-center gap-2">
      {filters.status !== "open" ? <input type="hidden" name="status" value={filters.status} /> : null}
      <label htmlFor="report-reason-filter" className="text-xs font-semibold text-els-fg-3">
        Motivo
      </label>
      <select
        id="report-reason-filter"
        name="motivo"
        defaultValue={filters.reason ?? ""}
        className="min-h-9 rounded-lg border border-els-line bg-els-surface px-2 text-xs font-semibold text-els-fg-2 outline-none focus:border-els-amber/40"
      >
        <option value="">Todos os motivos</option>
        {QUESTION_REPORT_REASONS.map((reason) => (
          <option key={reason.value} value={reason.value}>
            {reason.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="min-h-9 rounded-lg border border-els-line px-3 text-xs font-bold text-els-fg-2 transition hover:border-els-line-strong hover:text-els-fg"
      >
        Filtrar
      </button>
    </form>
  );
}

function QuestionDetails({ question }: { question: AdminQuestionReport["question"] }) {
  return (
    <details className="group mt-3 rounded-xl border border-els-line bg-black/15">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-bold text-els-amber-ink hover:text-els-amber-ink">
        <span>Abrir questão</span>
        <ChevronRight aria-hidden="true" className="size-4 transition group-open:rotate-90" />
      </summary>
      <div className="space-y-4 border-t border-els-line p-3 text-sm leading-6 text-els-fg-2">
        <p className="text-[11px] text-els-fg-3">
          Somente leitura · {quizModeLabels[question.quizMode] ?? question.quizMode} · status editorial {question.editorialStatus}
        </p>
        <p className="whitespace-pre-line text-els-fg-2">{question.prompt}</p>
        {question.options.length ? (
          <ol className="space-y-2">
            {question.options.map((option) => (
              <li
                key={option.key}
                className={cn(
                  "flex gap-2 rounded-lg border px-3 py-2 text-[13px]",
                  option.isCorrect ? "border-els-green/25 bg-els-green/[.06] text-els-fg" : "border-els-line text-els-fg-3",
                )}
              >
                <strong className={cn("shrink-0 uppercase", option.isCorrect ? "text-els-green-ink" : "text-els-fg-3")}>
                  {option.key})
                </strong>
                <span className="min-w-0 whitespace-pre-line">{option.text}</span>
                {option.isCorrect ? (
                  <span className="ml-auto shrink-0 self-start rounded-full bg-els-green/15 px-2 text-[10px] font-bold text-els-green-ink">
                    Gabarito
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-els-fg-3">Questão sem alternativas cadastradas.</p>
        )}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-els-fg-3">Explicação</p>
          <p className="mt-1 whitespace-pre-line text-[13px] text-els-fg-3">{question.explanation}</p>
        </div>
        <p className="text-[11px] text-els-fg-3">
          Fonte: {question.lawShortTitle ?? "sem lei vinculada"}
          {question.articleRef ? `, ${question.articleRef}` : ""}
        </p>
      </div>
    </details>
  );
}

function ReportRow({ report }: { report: AdminQuestionReport }) {
  const { question } = report;
  const activeCount = report.activeReportsForQuestion;
  return (
    <article className="rounded-2xl border border-els-line bg-els-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-els-fg-3">
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", statusTone[report.status])}>
              {QUESTION_REPORT_STATUS_LABELS[report.status]}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-els-fg-2">
              <Flag aria-hidden="true" className="size-3.5 text-els-danger-ink" />
              {questionReportReasonLabel(report.reason)}
            </span>
            <span>·</span>
            <time dateTime={report.createdAt.toISOString()}>{dateFormatter.format(report.createdAt)}</time>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <UserRound aria-hidden="true" className="size-3" />
              {report.reporterId}
            </span>
            {report.resolvedAt ? (
              <>
                <span>·</span>
                <span>fechado em {dateFormatter.format(report.resolvedAt)}</span>
              </>
            ) : null}
          </div>

          <p className="mt-3 text-xs font-semibold text-els-fg-3">
            {question.lawShortTitle ?? "Sem lei vinculada"}
            {question.articleRef ? ` · ${question.articleRef}` : ""}
            <span className="ml-2 break-all font-mono text-[10px] font-normal text-els-fg-4">{question.publicId}</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-els-fg-2">{question.promptPreview}</p>

          {report.notes ? (
            <blockquote className="mt-3 flex gap-2 rounded-xl border border-els-line bg-els-raise px-3 py-2 text-[13px] leading-5 text-els-fg-2">
              <MessageSquareText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-els-fg-3" />
              <span className="min-w-0 whitespace-pre-line break-words">{report.notes}</span>
            </blockquote>
          ) : (
            <p className="mt-3 text-[11px] text-els-fg-4">Sem observação do aluno.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:w-64 lg:items-end">
          <span
            className={cn(
              "self-start rounded-lg px-2.5 py-1 text-[11px] font-bold lg:self-end",
              activeCount > 1 ? "bg-els-danger/10 text-els-danger-ink" : "bg-els-raise text-els-fg-3",
            )}
          >
            {numberFormatter.format(activeCount)} {activeCount === 1 ? "relato ativo" : "relatos ativos"} nesta questão
          </span>
          <QuestionReportStatusForm reportId={report.id} status={report.status} />
        </div>
      </div>
      <QuestionDetails question={question} />
    </article>
  );
}

export function QuestionReportsList({ data, filters }: { data: AdminQuestionReportsPage; filters: QuestionReportFilters }) {
  return (
    <section className="mt-5 space-y-4" aria-label="Relatos de questões">
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-els-line bg-els-surface p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <StatusFilters filters={filters} counts={data.statusCounts} />
        <ReasonFilter filters={filters} />
      </div>

      {data.reports.length ? (
        data.reports.map((report) => <ReportRow key={report.id} report={report} />)
      ) : (
        <p className="rounded-2xl border border-dashed border-els-line p-8 text-center text-sm text-els-fg-3">
          Nenhum relato com esses filtros.
        </p>
      )}

      {filters.page > 1 || data.hasNextPage ? (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3 pt-1 text-xs font-bold">
          {filters.page > 1 ? (
            <Link
              href={questionReportFiltersHref({ ...filters, page: filters.page - 1 })}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-els-line px-3 text-els-fg-2 hover:text-els-fg"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-els-fg-3">Página {numberFormatter.format(filters.page)}</span>
          {data.hasNextPage ? (
            <Link
              href={questionReportFiltersHref({ ...filters, page: filters.page + 1 })}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-els-line px-3 text-els-fg-2 hover:text-els-fg"
            >
              Próximos
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

export function QuestionReportsHeader() {
  return (
    <header className="relative overflow-hidden rounded-[1.75rem] border border-els-danger/15 bg-[linear-gradient(145deg,var(--els-surface)_0%,var(--els-bg-2)_60%,var(--els-bg-2)_100%)] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-els-danger/8 blur-3xl" />
      <div className="relative max-w-4xl">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-els-danger-ink">
          <Flag aria-hidden="true" className="size-3.5" />
          Relatos dos alunos
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-els-fg sm:text-4xl">Problemas apontados nas questões.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-els-fg-3 sm:text-base">
          Cada relato vem da barra da questão. Confira enunciado, gabarito e artigo antes de decidir; o aluno aparece
          só por um identificador anônimo, e toda mudança de status fica na auditoria.
        </p>
      </div>
    </header>
  );
}
