import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimits, getRequestIp, rateLimitJsonResponse } from "@/lib/rate-limit";
import { canStudyQuestion } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";
import {
  cachedClassStats,
  createQuestionReport,
  enqueueQuestionForReview,
  findBarQuestion,
  isReviewable,
  loadQuestionHistory,
} from "@/lib/study/question-bar";
import { summarizeClassStats, type QuestionBarResponse } from "@/lib/study/question-bar-contract";
import { questionBarRequestSchema } from "@/lib/study/question-bar-schema";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function errorJson(error: string, status: number, message?: string) {
  return NextResponse.json(message ? { error, message } : { error }, { status, headers: noStore });
}

/** Barra por questão: histórico, turma, "revisar depois" e relato de erro, tudo sob demanda. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorJson("unauthorized", 401);

  const limited = await consumeRateLimits([
    { policy: "questionBarUserMinute", subject: { kind: "user", value: String(user.id) } },
    { policy: "questionBarIpMinute", subject: { kind: "ip", value: getRequestIp(request.headers) } },
  ]);
  if (limited) return rateLimitJsonResponse(limited, "Muitas ações seguidas. Aguarde um instante.");

  const parsed = questionBarRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorJson("invalid_request", 400, parsed.error.issues[0]?.message ?? "Pedido inválido.");
  }
  const input = parsed.data;

  const now = new Date();
  const entitlement = await getStudyEntitlement(user.id, now);
  if (!canStudyQuestion(entitlement, input.questionId)) return errorJson("question_not_found", 404);
  const question = await findBarQuestion(input.questionId, entitlement);
  if (!question) return errorJson("question_not_found", 404);

  try {
    let body: QuestionBarResponse;
    if (input.action === "history") {
      body = { action: "history", entries: await loadQuestionHistory(user.id, question.id) };
    } else if (input.action === "stats") {
      const stats = await cachedClassStats(question.id);
      body = summarizeClassStats(stats.answers, stats.correct);
    } else if (input.action === "review") {
      body = (await isReviewable(question))
        ? {
            action: "review",
            status: "queued",
            nextReviewAt: (await enqueueQuestionForReview(user.id, question.id, now)).toISOString(),
          }
        : { action: "review", status: "not_reviewable" };
    } else {
      const reportLimited = await consumeRateLimits([
        { policy: "questionReportUserDay", subject: { kind: "user", value: String(user.id) } },
      ]);
      if (reportLimited) {
        return rateLimitJsonResponse(reportLimited, "Você enviou muitos relatos hoje. Tente novamente amanhã.");
      }
      const status = await createQuestionReport({
        userId: user.id,
        questionId: question.id,
        reason: input.reason,
        notes: input.notes,
      });
      body = { action: "report", status };
    }
    return NextResponse.json(body, { headers: noStore });
  } catch (error) {
    console.error("question_bar_failed", {
      action: input.action,
      code: typeof error === "object" && error && "code" in error ? String(error.code) : "",
    });
    return errorJson("question_bar_failed", 500, "Não foi possível concluir agora. Tente novamente.");
  }
}
