"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { auditLogs, questionReports } from "@/lib/db/schema";
import {
  canTransitionQuestionReport,
  QUESTION_REPORT_STATUS_LABELS,
  QUESTION_REPORT_STATUSES,
  resolvedAtForStatus,
} from "@/lib/study/question-report-admin";

export type QuestionReportActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const statusChangeSchema = z.object({
  reportId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  from: z.enum(QUESTION_REPORT_STATUSES),
  to: z.enum(QUESTION_REPORT_STATUSES),
});

/**
 * Muda o status de um relato. A tabela não tem nota do admin, `updated_at` nem revisor: grava só
 * status e `resolved_at`; quem fez e quando fica em `audit_logs`. O `where status = from` evita
 * sobrescrever a decisão de outra pessoa feita entre o carregamento da página e o envio.
 */
export async function changeQuestionReportStatusAction(
  _state: QuestionReportActionState,
  formData: FormData,
): Promise<QuestionReportActionState> {
  const user = await requireAdmin("/admin/relatos");
  const parsed = statusChangeSchema.safeParse({
    reportId: formData.get("reportId"),
    from: formData.get("from"),
    to: formData.get("to"),
  });
  if (!parsed.success) return { status: "error", message: "Revise os dados da mudança de status." };
  const { reportId, from, to } = parsed.data;
  if (!canTransitionQuestionReport(from, to)) {
    return { status: "error", message: "Essa mudança de status não é permitida." };
  }

  try {
    const now = new Date();
    const changed = await getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(questionReports)
        .set({ status: to, resolvedAt: resolvedAtForStatus(to, now) })
        .where(and(eq(questionReports.id, reportId), eq(questionReports.status, from)))
        .returning({ id: questionReports.id, questionId: questionReports.questionId });
      if (!updated) return false;
      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: "question_report.status_changed",
        entityType: "question_report",
        entityId: String(updated.id),
        metadata: { from, to, questionId: updated.questionId },
      });
      return true;
    });
    if (!changed) {
      return { status: "error", message: "O relato mudou de status ou não existe mais. Recarregue a página." };
    }
  } catch (error) {
    console.error("Falha ao mudar o status do relato.", error instanceof Error ? error.name : "erro desconhecido");
    return { status: "error", message: "Não foi possível salvar o novo status." };
  }

  revalidatePath("/admin/relatos");
  return { status: "success", message: `Relato marcado como ${QUESTION_REPORT_STATUS_LABELS[to].toLowerCase()}.` };
}
