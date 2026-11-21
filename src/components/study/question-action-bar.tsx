"use client";

import { useId, useState, type FormEvent } from "react";
import {
  BarChart3,
  BookmarkPlus,
  CalendarClock,
  Check,
  Flag,
  History,
  LoaderCircle,
  X,
} from "lucide-react";

import { NotebookPicker } from "@/components/materials/study-library-forms";
import {
  CLASS_STATS_MIN_ANSWERS,
  QUESTION_REPORT_NOTES_MAX,
  QUESTION_REPORT_REASONS,
  type QuestionBarResponse,
  type QuestionHistoryEntry,
  type QuestionReportReason,
} from "@/lib/study/question-bar-contract";
import type { QuestionBarRequest } from "@/lib/study/question-bar-schema";
import { cn } from "@/lib/utils";

type Panel = "notebook" | "report" | "history" | "stats";
type NotebookOption = { publicId: string; name: string; questionCount: number };
type Loadable<T> = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

type HistoryData = Extract<QuestionBarResponse, { action: "history" }>;
type StatsData = Extract<QuestionBarResponse, { action: "stats" }>;
type ReviewData = Extract<QuestionBarResponse, { action: "review" }>;

const GENERIC_ERROR = "Não foi possível concluir agora. Tente novamente.";

async function callQuestionBar(body: QuestionBarRequest): Promise<QuestionBarResponse> {
  const response = await fetch("/api/study/question-bar", {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (QuestionBarResponse & { message?: string }) | { message?: string } | null;
  if (!response.ok) {
    throw new Error(response.status === 404 ? "Questão indisponível para sua conta." : data?.message ?? GENERIC_ERROR);
  }
  if (!data || !("action" in data) || data.action !== body.action) throw new Error(GENERIC_ERROR);
  return data;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : GENERIC_ERROR;
}

/**
 * Barra por questão no gabarito do quiz e do "Treinar agora": caderno, revisar depois,
 * reportar erro, meu histórico e acerto da turma. Nada é buscado até o aluno clicar.
 */
export function QuestionActionBar({
  questionPublicId,
  notebooks,
  optionLabels,
  className,
}: {
  questionPublicId: string;
  notebooks: NotebookOption[];
  /** Rótulo exibido para cada `optionKey` (o quiz mostra A, B, C… pela ordem). */
  optionLabels?: Record<string, string>;
  className?: string;
}) {
  const baseId = useId();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [history, setHistory] = useState<Loadable<HistoryData>>({ status: "idle" });
  const [stats, setStats] = useState<Loadable<StatsData>>({ status: "idle" });
  const [review, setReview] = useState<Loadable<ReviewData>>({ status: "idle" });

  async function load<T extends QuestionBarResponse>(action: "history" | "stats", setter: (value: Loadable<T>) => void) {
    setter({ status: "loading" });
    try {
      setter({ status: "ready", data: (await callQuestionBar({ action, questionId: questionPublicId })) as T });
    } catch (error) {
      setter({ status: "error", message: errorMessage(error) });
    }
  }

  function toggle(next: Panel) {
    const opening = panel !== next;
    setPanel(opening ? next : null);
    if (!opening) return;
    if (next === "history" && history.status !== "ready" && history.status !== "loading") void load("history", setHistory);
    if (next === "stats" && stats.status !== "ready" && stats.status !== "loading") void load("stats", setStats);
  }

  async function queueReview() {
    if (review.status === "loading" || review.status === "ready") return;
    setReview({ status: "loading" });
    try {
      setReview({ status: "ready", data: (await callQuestionBar({ action: "review", questionId: questionPublicId })) as ReviewData });
    } catch (error) {
      setReview({ status: "error", message: errorMessage(error) });
    }
  }

  const panelId = (name: Panel) => `${baseId}-${name}`;
  const reviewQueued = review.status === "ready" && review.data.status === "queued";

  return (
    <div className={cn("border-t border-white/8 pt-4", className)}>
      <div aria-label="Ações desta questão" className="flex flex-wrap gap-2" role="toolbar">
        <BarButton active={panel === "notebook"} controls={panelId("notebook")} icon={BookmarkPlus} label="Caderno" onClick={() => toggle("notebook")} />
        <button
          className={cn(barButtonClass, reviewQueued && "border-emerald-300/30 bg-emerald-300/10 text-emerald-200")}
          disabled={review.status === "loading"}
          onClick={() => void queueReview()}
          type="button"
        >
          {review.status === "loading" ? <LoaderCircle className="size-3.5 animate-spin" /> : reviewQueued ? <Check className="size-3.5" /> : <CalendarClock className="size-3.5" />}
          {reviewQueued ? "Na revisão de hoje" : "Revisar depois"}
        </button>
        <BarButton active={panel === "report"} controls={panelId("report")} icon={Flag} label="Reportar erro" onClick={() => toggle("report")} />
        <BarButton active={panel === "history"} controls={panelId("history")} icon={History} label="Meu histórico" onClick={() => toggle("history")} />
        <BarButton active={panel === "stats"} controls={panelId("stats")} icon={BarChart3} label="Turma" onClick={() => toggle("stats")} />
      </div>

      <div aria-live="polite">
        {review.status === "ready" && (
          <p className={cn("mt-2 text-[11px] leading-5", review.data.status === "queued" ? "text-emerald-300" : "text-slate-500")}>
            {review.data.status === "queued"
              ? "Esta questão já aparece em Revisões para hoje. Ao respondê-la, o intervalo volta a seguir seu desempenho."
              : "Esta questão não entra na fila de revisão: a revisão usa só questões de lei seca vinculadas ao artigo."}
          </p>
        )}
        {review.status === "error" && <p className="mt-2 text-[11px] leading-5 text-rose-300" role="alert">{review.message}</p>}
      </div>

      {panel === "notebook" && (
        <PanelFrame id={panelId("notebook")} title="Guardar em um caderno">
          <NotebookPicker key={questionPublicId} notebooks={notebooks} questionPublicId={questionPublicId} />
        </PanelFrame>
      )}
      {panel === "report" && (
        <PanelFrame id={panelId("report")} title="Reportar erro nesta questão">
          <ReportForm questionPublicId={questionPublicId} onCancel={() => setPanel(null)} />
        </PanelFrame>
      )}
      {panel === "history" && (
        <PanelFrame id={panelId("history")} title="Suas respostas nesta questão">
          <LoadableView state={history} onRetry={() => void load("history", setHistory)}>
            {(data) => <HistoryList entries={data.entries} optionLabels={optionLabels} />}
          </LoadableView>
        </PanelFrame>
      )}
      {panel === "stats" && (
        <PanelFrame id={panelId("stats")} title="Acerto da turma">
          <LoadableView state={stats} onRetry={() => void load("stats", setStats)}>
            {(data) => <ClassStats data={data} />}
          </LoadableView>
        </PanelFrame>
      )}
    </div>
  );
}

const barButtonClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.03] px-3 text-[11px] font-semibold text-slate-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-wait disabled:opacity-60";

function BarButton({ active, controls, icon: Icon, label, onClick }: { active: boolean; controls: string; icon: typeof Flag; label: string; onClick: () => void }) {
  return (
    <button aria-controls={controls} aria-expanded={active} className={cn(barButtonClass, active && "border-amber-300/40 bg-amber-300/10 text-amber-100")} onClick={onClick} type="button">
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

function PanelFrame({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mt-3 rounded-xl border border-white/8 bg-slate-950/40 p-4" id={id}>
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LoadableView<T>({ state, onRetry, children }: { state: Loadable<T>; onRetry: () => void; children: (data: T) => React.ReactNode }) {
  if (state.status === "ready") return <>{children(state.data)}</>;
  if (state.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs" role="alert">
        <span className="text-rose-300">{state.message}</span>
        <button className="font-bold text-slate-200 underline underline-offset-4" onClick={onRetry} type="button">Tentar de novo</button>
      </div>
    );
  }
  return <p className="inline-flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="size-3.5 animate-spin" />Carregando…</p>;
}

const ORIGIN_LABEL: Record<QuestionHistoryEntry["origin"], string> = { treino: "Treino", quiz: "Quiz", simulado: "Simulado" };

function HistoryList({ entries, optionLabels }: { entries: QuestionHistoryEntry[]; optionLabels?: Record<string, string> }) {
  if (!entries.length) return <p className="text-xs leading-5 text-slate-500">Nenhuma resposta registrada ainda nesta questão.</p>;
  const correct = entries.filter((entry) => entry.isCorrect).length;
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return (
    <>
      <p className="text-xs text-slate-400">
        <strong className="text-slate-100">{correct}</strong> {correct === 1 ? "acerto" : "acertos"} em <strong className="text-slate-100">{entries.length}</strong> {entries.length === 1 ? "resposta" : "respostas"}
      </p>
      <ol className="mt-3 grid gap-1.5">
        {entries.map((entry, index) => {
          const label = entry.optionKey ? optionLabels?.[entry.optionKey] ?? entry.optionKey.toUpperCase() : "—";
          return (
            <li key={`${entry.answeredAt}-${index}`} className="flex items-center gap-3 rounded-lg bg-white/[.03] px-3 py-2 text-xs">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", entry.isCorrect ? "bg-emerald-300 text-slate-950" : "bg-rose-300/15 text-rose-200")}>
                {entry.isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-200">{entry.isCorrect ? "Acertou" : "Errou"} · marcou {label}</span>
                <span className="block text-[11px] text-slate-500">{formatter.format(new Date(entry.answeredAt))}</span>
              </span>
              <span className="shrink-0 rounded-full border border-white/8 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{ORIGIN_LABEL[entry.origin]}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function ClassStats({ data }: { data: StatsData }) {
  if (!data.available) {
    return (
      <p className="text-xs leading-5 text-slate-500">
        Poucas respostas ainda. O percentual da turma aparece a partir de {CLASS_STATS_MIN_ANSWERS} respostas de alunos.
      </p>
    );
  }
  const tone = data.correctPercent >= 70 ? "bg-emerald-300" : data.correctPercent >= 40 ? "bg-amber-300" : "bg-rose-300";
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p><strong className="text-2xl font-semibold text-slate-100">{data.correctPercent}%</strong> <span className="text-xs text-slate-400">de acerto</span></p>
        <span className="text-[11px] text-slate-500">{data.answers.toLocaleString("pt-BR")} respostas</span>
      </div>
      <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/7">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${data.correctPercent}%` }} />
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-600">Todas as respostas de alunos nesta questão, no treino e no quiz. Atualizado a cada poucos minutos.</p>
    </div>
  );
}

function ReportForm({ questionPublicId, onCancel }: { questionPublicId: string; onCancel: () => void }) {
  const fieldId = useId();
  const [reason, setReason] = useState<QuestionReportReason | "">("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<Loadable<"created" | "already_open">>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || state.status === "loading") return;
    if (reason === "other" && notes.trim().length < 10) {
      setState({ status: "error", message: "Descreva o problema em pelo menos 10 caracteres." });
      return;
    }
    setState({ status: "loading" });
    try {
      const data = await callQuestionBar({ action: "report", questionId: questionPublicId, reason, notes: notes.trim() || undefined });
      setState(data.action === "report" ? { status: "ready", data: data.status } : { status: "error", message: GENERIC_ERROR });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  }

  if (state.status === "ready") {
    return (
      <p className="flex items-start gap-2 text-xs leading-5 text-emerald-200" role="status">
        <Check className="mt-0.5 size-3.5 shrink-0" />
        {state.data === "created"
          ? "Relato recebido. A equipe editorial confere a questão na fonte oficial e corrige se for o caso."
          : "Você já tem um relato aberto para esta questão. Ele continua em análise; não é preciso enviar de novo."}
      </p>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300" htmlFor={`${fieldId}-reason`}>
        O que está errado?
        <select
          className="min-h-10 rounded-lg border border-white/10 bg-slate-950/55 px-3 text-xs text-white outline-none focus:border-amber-300/50"
          id={`${fieldId}-reason`}
          onChange={(event) => setReason(event.target.value as QuestionReportReason | "")}
          required
          value={reason}
        >
          <option value="">Escolha o motivo</option>
          {QUESTION_REPORT_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300" htmlFor={`${fieldId}-notes`}>
        <span>Detalhes <span className="font-normal text-slate-600">{reason === "other" ? "obrigatório" : "opcional"}</span></span>
        <textarea
          className="min-h-20 resize-y rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-slate-600 focus:border-amber-300/50"
          id={`${fieldId}-notes`}
          maxLength={QUESTION_REPORT_NOTES_MAX}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex.: o inciso citado foi alterado pela Lei nº …"
          value={notes}
        />
        <span className="justify-self-end text-[10px] font-normal text-slate-600">{notes.length}/{QUESTION_REPORT_NOTES_MAX}</span>
      </label>
      {state.status === "error" && <p className="text-[11px] text-rose-300" role="alert">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-xs font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!reason || state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
          Enviar relato
        </button>
        <button className="inline-flex min-h-10 items-center px-3 text-xs font-semibold text-slate-500 transition hover:text-white" onClick={onCancel} type="button">Cancelar</button>
      </div>
    </form>
  );
}
