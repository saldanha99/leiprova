/** Regras puras da tela /admin/relatos: status, transições, filtros e identificadores seguros. */

import { z } from "zod";

import { QUESTION_REPORT_REASONS, type QuestionReportReason } from "@/lib/study/question-bar-contract";

/** Mesmos valores do check `question_reports_status_check`. */
export const QUESTION_REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type QuestionReportStatus = (typeof QUESTION_REPORT_STATUSES)[number];

export const QUESTION_REPORT_STATUS_LABELS: Record<QuestionReportStatus, string> = {
  open: "Aberto",
  reviewing: "Em análise",
  resolved: "Resolvido",
  dismissed: "Descartado",
};

/**
 * Resolvido e descartado são finais: o aluno pode abrir um relato novo depois, e reabrir o antigo
 * criaria dois relatos ativos do mesmo aluno para a mesma questão.
 */
export const QUESTION_REPORT_TRANSITIONS: Record<QuestionReportStatus, readonly QuestionReportStatus[]> = {
  open: ["reviewing", "resolved", "dismissed"],
  reviewing: ["resolved", "dismissed", "open"],
  resolved: [],
  dismissed: [],
};

/** Ainda ativo para o aluno: enquanto houver um, ele não abre outro para a mesma questão. */
export const ACTIVE_QUESTION_REPORT_STATUSES = ["open", "reviewing"] as const satisfies readonly QuestionReportStatus[];

export function canTransitionQuestionReport(from: QuestionReportStatus, to: QuestionReportStatus) {
  return QUESTION_REPORT_TRANSITIONS[from].includes(to);
}

/** `resolved_at` marca o fechamento (resolvido ou descartado); voltar a aberto limpa a data. */
export function resolvedAtForStatus(status: QuestionReportStatus, now: Date): Date | null {
  return status === "resolved" || status === "dismissed" ? now : null;
}

export const QUESTION_REPORTS_PAGE_SIZE = 50;
export const QUESTION_REPORT_PROMPT_PREVIEW_CHARS = 180;

export type QuestionReportStatusFilter = QuestionReportStatus | "all";

export type QuestionReportFilters = {
  status: QuestionReportStatusFilter;
  reason: QuestionReportReason | null;
  page: number;
};

const reasonValues = QUESTION_REPORT_REASONS.map((reason) => reason.value) as [
  QuestionReportReason,
  ...QuestionReportReason[],
];

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const filtersSchema = z.object({
  status: z.preprocess(firstValue, z.enum([...QUESTION_REPORT_STATUSES, "all"]).catch("open")),
  reason: z.preprocess(firstValue, z.enum(reasonValues).nullable().catch(null)),
  page: z.preprocess(
    (value) => Number(firstValue(value) ?? 1),
    z.number().int().min(1).max(10_000).catch(1),
  ),
});

/** Valor estranho na URL volta ao padrão (abertos, todos os motivos, página 1). */
export function parseQuestionReportFilters(params: Record<string, string | string[] | undefined>): QuestionReportFilters {
  const parsed = filtersSchema.parse({ status: params.status, reason: params.motivo ?? null, page: params.pagina });
  return { status: parsed.status, reason: parsed.reason, page: parsed.page };
}

export function questionReportFiltersHref(filters: QuestionReportFilters) {
  const params = new URLSearchParams();
  if (filters.status !== "open") params.set("status", filters.status);
  if (filters.reason) params.set("motivo", filters.reason);
  if (filters.page > 1) params.set("pagina", String(filters.page));
  const query = params.toString();
  return query ? `/admin/relatos?${query}` : "/admin/relatos";
}

export function questionReportReasonLabel(reason: string) {
  return QUESTION_REPORT_REASONS.find((item) => item.value === reason)?.label ?? "Motivo desconhecido";
}

export function truncatePreview(text: string, max = QUESTION_REPORT_PROMPT_PREVIEW_CHARS) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}
