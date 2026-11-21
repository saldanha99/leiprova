"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";

import {
  changeQuestionReportStatusAction,
  type QuestionReportActionState,
} from "@/app/admin/relatos/actions";
import {
  QUESTION_REPORT_STATUS_LABELS,
  QUESTION_REPORT_TRANSITIONS,
  type QuestionReportStatus,
} from "@/lib/study/question-report-admin";

const initialState: QuestionReportActionState = { status: "idle", message: "" };

export function QuestionReportStatusForm({ reportId, status }: { reportId: number; status: QuestionReportStatus }) {
  const [state, formAction, pending] = useActionState(changeQuestionReportStatusAction, initialState);
  const targets = QUESTION_REPORT_TRANSITIONS[status];

  if (!targets.length) {
    return <p className="text-[11px] text-slate-600">Status final.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="from" value={status} />
      <label className="sr-only" htmlFor={`report-status-${reportId}`}>
        Novo status
      </label>
      <select
        id={`report-status-${reportId}`}
        name="to"
        defaultValue={targets[0]}
        className="min-h-9 rounded-lg border border-white/10 bg-[#0b1724] px-2 text-xs font-semibold text-slate-200 outline-none focus:border-amber-300/40"
      >
        {targets.map((target) => (
          <option key={target} value={target}>
            {QUESTION_REPORT_STATUS_LABELS[target]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-xs font-extrabold text-amber-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-50"
      >
        <Check aria-hidden="true" className="size-3.5" />
        {pending ? "Salvando..." : "Aplicar"}
      </button>
      {state.message ? (
        <p
          aria-live="polite"
          className={`basis-full text-[11px] ${state.status === "success" ? "text-emerald-200" : "text-rose-200"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
