import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  user: vi.fn(),
  limits: vi.fn(),
  entitlement: vi.fn(),
  find: vi.fn(),
  history: vi.fn(),
  stats: vi.fn(),
  review: vi.fn(),
  report: vi.fn(),
  reviewable: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocked.user }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimits: mocked.limits,
  getRequestIp: () => "203.0.113.9",
  rateLimitJsonResponse: (_result: unknown, message: string) =>
    Response.json({ error: "rate_limited", message }, { status: 429 }),
}));
vi.mock("@/lib/study/entitlement", () => ({ getStudyEntitlement: mocked.entitlement }));
vi.mock("@/lib/study/question-bar", () => ({
  findBarQuestion: mocked.find,
  isReviewable: mocked.reviewable,
  loadQuestionHistory: mocked.history,
  cachedClassStats: mocked.stats,
  enqueueQuestionForReview: mocked.review,
  createQuestionReport: mocked.report,
}));

import { POST } from "@/app/api/study/question-bar/route";
import { questionBarRequestSchema } from "@/lib/study/question-bar-schema";
import { CLASS_STATS_MIN_ANSWERS, summarizeClassStats } from "@/lib/study/question-bar-contract";

const QUESTION = "cf-art-5-iv-manifestacao-pensamento";

function call(body: unknown) {
  return POST(
    new Request("https://qa.example.invalid/api/study/question-bar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("barra por questão: contrato", () => {
  it("aceita as cinco leituras/ações e recusa campos extras", () => {
    expect(questionBarRequestSchema.safeParse({ action: "history", questionId: QUESTION }).success).toBe(true);
    expect(questionBarRequestSchema.safeParse({ action: "stats", questionId: QUESTION }).success).toBe(true);
    expect(questionBarRequestSchema.safeParse({ action: "review", questionId: QUESTION }).success).toBe(true);
    expect(questionBarRequestSchema.safeParse({ action: "history", questionId: QUESTION, userId: 1 }).success).toBe(false);
    expect(questionBarRequestSchema.safeParse({ action: "delete", questionId: QUESTION }).success).toBe(false);
    expect(questionBarRequestSchema.safeParse({ action: "stats", questionId: "" }).success).toBe(false);
  });

  it("relato: motivo da lista, texto opcional com limite e obrigatório em 'outro'", () => {
    const ok = questionBarRequestSchema.safeParse({ action: "report", questionId: QUESTION, reason: "answer_key", notes: "   " });
    expect(ok.success && ok.data.action === "report" && ok.data.notes).toBeUndefined();
    expect(questionBarRequestSchema.safeParse({ action: "report", questionId: QUESTION, reason: "spam" }).success).toBe(false);
    expect(questionBarRequestSchema.safeParse({ action: "report", questionId: QUESTION, reason: "typo", notes: "x".repeat(601) }).success).toBe(false);
    expect(questionBarRequestSchema.safeParse({ action: "report", questionId: QUESTION, reason: "other" }).success).toBe(false);
    expect(questionBarRequestSchema.safeParse({ action: "report", questionId: QUESTION, reason: "other", notes: "O inciso mudou em 2024." }).success).toBe(true);
  });

  it("estatística da turma só a partir do mínimo de respostas", () => {
    expect(summarizeClassStats(CLASS_STATS_MIN_ANSWERS - 1, 10)).toEqual({ action: "stats", available: false, answers: 19 });
    expect(summarizeClassStats(40, 30)).toEqual({ action: "stats", available: true, answers: 40, correctPercent: 75 });
    expect(summarizeClassStats(20, 99)).toMatchObject({ correctPercent: 100 });
  });
});

describe("barra por questão: rota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.user.mockResolvedValue({ id: 7 });
    mocked.limits.mockResolvedValue(null);
    mocked.entitlement.mockResolvedValue({ hasFullAccess: false, questionPublicIds: [] });
    mocked.find.mockResolvedValue({ id: 42, publicId: QUESTION, quizMode: "dry_law" });
    mocked.reviewable.mockResolvedValue(true);
  });

  it("exige login", async () => {
    mocked.user.mockResolvedValue(null);
    const response = await call({ action: "history", questionId: QUESTION });
    expect(response.status).toBe(401);
    expect(mocked.limits).not.toHaveBeenCalled();
  });

  it("aplica o limite por usuário e por IP antes de qualquer leitura", async () => {
    mocked.limits.mockResolvedValue({ allowed: false });
    const response = await call({ action: "stats", questionId: QUESTION });
    expect(response.status).toBe(429);
    expect(mocked.limits.mock.calls[0]?.[0].map((item: { policy: string }) => item.policy)).toEqual([
      "questionBarUserMinute",
      "questionBarIpMinute",
    ]);
    expect(mocked.find).not.toHaveBeenCalled();
  });

  it("recusa pedido inválido com 400", async () => {
    const response = await call({ action: "report", questionId: QUESTION, reason: "spam" });
    expect(response.status).toBe(400);
    expect(mocked.find).not.toHaveBeenCalled();
  });

  it("não revela nada de questão fora do acesso do aluno", async () => {
    for (const action of ["history", "stats", "review"] as const) {
      const response = await call({ action, questionId: "questao-de-outro-concurso" });
      expect(response.status).toBe(404);
    }
    const report = await call({ action: "report", questionId: "questao-de-outro-concurso", reason: "typo" });
    expect(report.status).toBe(404);
    expect(mocked.find).not.toHaveBeenCalled();
    expect(mocked.history).not.toHaveBeenCalled();
    expect(mocked.stats).not.toHaveBeenCalled();
    expect(mocked.review).not.toHaveBeenCalled();
    expect(mocked.report).not.toHaveBeenCalled();
  });

  it("404 quando a questão não passa na régua editorial/licença", async () => {
    mocked.entitlement.mockResolvedValue({ hasFullAccess: true });
    mocked.find.mockResolvedValue(null);
    const response = await call({ action: "history", questionId: "prova-real-sem-produto" });
    expect(response.status).toBe(404);
    expect(mocked.history).not.toHaveBeenCalled();
  });

  it("histórico do próprio aluno", async () => {
    mocked.history.mockResolvedValue([{ answeredAt: "2026-11-20T12:00:00.000Z", isCorrect: false, optionKey: "b", origin: "treino" }]);
    const response = await call({ action: "history", questionId: QUESTION });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      action: "history",
      entries: [{ answeredAt: "2026-11-20T12:00:00.000Z", isCorrect: false, optionKey: "b", origin: "treino" }],
    });
    expect(mocked.history).toHaveBeenCalledWith(7, 42);
  });

  it("turma: esconde o percentual com poucas respostas", async () => {
    mocked.stats.mockResolvedValue({ answers: 3, correct: 3 });
    expect(await (await call({ action: "stats", questionId: QUESTION })).json()).toEqual({ action: "stats", available: false, answers: 3 });
    mocked.stats.mockResolvedValue({ answers: 50, correct: 31 });
    expect(await (await call({ action: "stats", questionId: QUESTION })).json()).toEqual({ action: "stats", available: true, answers: 50, correctPercent: 62 });
  });

  it("revisar depois: enfileira só questão revisável", async () => {
    const due = new Date("2026-11-21T10:00:00.000Z");
    mocked.review.mockResolvedValue(due);
    expect(await (await call({ action: "review", questionId: QUESTION })).json()).toEqual({ action: "review", status: "queued", nextReviewAt: due.toISOString() });
    expect(mocked.review).toHaveBeenCalledWith(7, 42, expect.any(Date));

    mocked.review.mockClear();
    mocked.reviewable.mockResolvedValue(false);
    expect(await (await call({ action: "review", questionId: QUESTION })).json()).toEqual({ action: "review", status: "not_reviewable" });
    expect(mocked.review).not.toHaveBeenCalled();
  });

  it("relato: limite diário próprio e resposta amigável para relato já aberto", async () => {
    mocked.report.mockResolvedValue("already_open");
    const response = await call({ action: "report", questionId: QUESTION, reason: "answer_key", notes: "A correta é a C." });
    expect(await response.json()).toEqual({ action: "report", status: "already_open" });
    expect(mocked.report).toHaveBeenCalledWith({ userId: 7, questionId: 42, reason: "answer_key", notes: "A correta é a C." });
    expect(mocked.limits.mock.calls[1]?.[0].map((item: { policy: string }) => item.policy)).toEqual(["questionReportUserDay"]);

    mocked.report.mockClear();
    mocked.limits.mockResolvedValueOnce(null).mockResolvedValueOnce({ allowed: false });
    expect((await call({ action: "report", questionId: QUESTION, reason: "typo" })).status).toBe(429);
    expect(mocked.report).not.toHaveBeenCalled();
  });

  it("falha do banco vira 500 sem expor detalhes", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocked.history.mockRejectedValue(Object.assign(new Error("boom"), { code: "57014" }));
    const response = await call({ action: "history", questionId: QUESTION });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "question_bar_failed" });
    expect(spy).toHaveBeenCalledWith("question_bar_failed", { action: "history", code: "57014" });
    spy.mockRestore();
  });
});

describe("barra por questão: travas no código", () => {
  const route = readFileSync("src/app/api/study/question-bar/route.ts", "utf8");
  const data = readFileSync("src/lib/study/question-bar.ts", "utf8");

  it("confere o acesso antes de buscar a questão", () => {
    expect(route.indexOf("canStudyQuestion(entitlement")).toBeLessThan(route.indexOf("findBarQuestion("));
  });

  it("prova anterior só com produto liberado, como no quiz", () => {
    expect(data).toContain("approvedReleasedProductPreviousExamQuestionExists(questions.id, coverageEndsAt)");
    expect(data).toContain('eq(questions.sourceRights, "original_authorial")');
    expect(data).toContain('eq(questions.sourceRights, "licensed")');
    expect(data).toContain('eq(questions.editorialStatus, "reviewed")');
  });

  it("revisão só para a lista elegível do treino, nunca prova anterior", () => {
    expect(data).toContain('if (question.quizMode === "previous_exam") return false;');
    expect(data).toContain("eligibleStudyQuestionIds()");
  });

  it("simulado não entregue não entra no histórico nem na turma", () => {
    expect(data.match(/qs\.experience = 'training'/g)?.length).toBe(2);
    expect(data.match(/qs\.status <> 'completed'/g)?.length).toBe(2);
  });

  it("revisar depois não altera a regra de espaçamento", () => {
    const set = data.slice(data.indexOf("onConflictDoUpdate"), data.indexOf(".returning({ nextReviewAt"));
    expect(set).toContain("least(");
    expect(set).not.toMatch(/stage|repetitions|lapses/);
  });
});
