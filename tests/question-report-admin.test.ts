import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.db }));

import { changeQuestionReportStatusAction } from "../src/app/admin/relatos/actions";
import { anonymizedReporterId } from "../src/lib/db/question-reports-admin";
import {
  canTransitionQuestionReport,
  parseQuestionReportFilters,
  QUESTION_REPORT_STATUSES,
  questionReportFiltersHref,
  questionReportReasonLabel,
  resolvedAtForStatus,
  truncatePreview,
} from "../src/lib/study/question-report-admin";

describe("regras da tela de relatos", () => {
  it("usa exatamente os status do check da tabela", () => {
    const schema = readFileSync(new URL("../src/lib/db/schema.ts", import.meta.url), "utf8");
    const check = schema.match(/question_reports_status_check",\s*sql`\$\{table\.status\} in \(([^)]*)\)`/u)?.[1] ?? "";
    expect(check.split(",").map((value) => value.trim().replaceAll("'", ""))).toEqual([...QUESTION_REPORT_STATUSES]);
  });

  it("segue aberto → em análise → resolvido/descartado e trata os finais como finais", () => {
    expect(canTransitionQuestionReport("open", "reviewing")).toBe(true);
    expect(canTransitionQuestionReport("reviewing", "resolved")).toBe(true);
    expect(canTransitionQuestionReport("reviewing", "dismissed")).toBe(true);
    expect(canTransitionQuestionReport("reviewing", "open")).toBe(true);
    expect(canTransitionQuestionReport("open", "open")).toBe(false);
    expect(canTransitionQuestionReport("resolved", "open")).toBe(false);
    expect(canTransitionQuestionReport("dismissed", "reviewing")).toBe(false);
  });

  it("preenche resolved_at só ao fechar", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    expect(resolvedAtForStatus("resolved", now)).toBe(now);
    expect(resolvedAtForStatus("dismissed", now)).toBe(now);
    expect(resolvedAtForStatus("reviewing", now)).toBeNull();
    expect(resolvedAtForStatus("open", now)).toBeNull();
  });

  it("filtros estranhos voltam ao padrão e o link preserva os válidos", () => {
    expect(parseQuestionReportFilters({})).toEqual({ status: "open", reason: null, page: 1 });
    expect(parseQuestionReportFilters({ status: "x' or 1=1", motivo: "nada", pagina: "-3" })).toEqual({
      status: "open",
      reason: null,
      page: 1,
    });
    const filters = parseQuestionReportFilters({ status: ["resolved", "open"], motivo: "typo", pagina: "2" });
    expect(filters).toEqual({ status: "resolved", reason: "typo", page: 2 });
    expect(questionReportFiltersHref(filters)).toBe("/admin/relatos?status=resolved&motivo=typo&pagina=2");
    expect(questionReportFiltersHref({ status: "open", reason: null, page: 1 })).toBe("/admin/relatos");
  });

  it("rótulos, prévia e identificador anônimo", () => {
    expect(questionReportReasonLabel("answer_key")).toBe("Gabarito errado");
    expect(questionReportReasonLabel("inexistente")).toBe("Motivo desconhecido");
    expect(truncatePreview("a  b\n c", 10)).toBe("a b c");
    expect(truncatePreview("x".repeat(30), 10)).toHaveLength(10);
    const id = anonymizedReporterId("10000000-0000-4000-8000-000000000001");
    expect(id).toMatch(/^aluno-[0-9a-f]{8}$/u);
    expect(id).toBe(anonymizedReporterId("10000000-0000-4000-8000-000000000001"));
    expect(id).not.toBe(anonymizedReporterId("10000000-0000-4000-8000-000000000002"));
  });

  it("o papel do app só pode atualizar status e resolved_at", () => {
    const grants = readFileSync(new URL("../deploy/grant-app-role.sql", import.meta.url), "utf8");
    expect(grants).toContain("grant update (status, resolved_at) on question_reports to :app_user;");
    expect(grants).not.toMatch(/grant[^;]*delete[^;]*question_reports/u);
  });
});

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function fakeDb(updated: { id: number; questionId: number } | undefined) {
  const calls = { set: vi.fn(), audit: vi.fn() };
  const tx = {
    update: () => ({
      set: (values: unknown) => {
        calls.set(values);
        return { where: () => ({ returning: async () => (updated ? [updated] : []) }) };
      },
    }),
    insert: () => ({ values: async (values: unknown) => calls.audit(values) }),
  };
  return { db: { transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) }, calls };
}

describe("ação de mudança de status", () => {
  const idle = { status: "idle" as const, message: "" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ id: 7, role: "editor" });
  });

  it("exige a guarda do admin antes do banco", async () => {
    mocks.auth.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(changeQuestionReportStatusAction(idle, form({ reportId: "1", from: "open", to: "reviewing" }))).rejects.toThrow();
    expect(mocks.auth).toHaveBeenCalledWith("/admin/relatos");
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("recusa dados inválidos e transição proibida sem tocar no banco", async () => {
    for (const values of [
      { reportId: "abc", from: "open", to: "reviewing" },
      { reportId: "1", from: "open", to: "deleted" },
      { reportId: "1", from: "resolved", to: "open" },
    ]) {
      expect((await changeQuestionReportStatusAction(idle, form(values))).status).toBe("error");
    }
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("grava status, resolved_at e auditoria com de/para", async () => {
    const { db, calls } = fakeDb({ id: 42, questionId: 9 });
    mocks.db.mockReturnValue(db);
    const result = await changeQuestionReportStatusAction(idle, form({ reportId: "42", from: "reviewing", to: "resolved" }));
    expect(result).toEqual({ status: "success", message: "Relato marcado como resolvido." });
    const set = calls.set.mock.calls[0]?.[0] as { status: string; resolvedAt: Date | null };
    expect(set.status).toBe("resolved");
    expect(set.resolvedAt).toBeInstanceOf(Date);
    expect(calls.audit).toHaveBeenCalledWith({
      actorUserId: 7,
      action: "question_report.status_changed",
      entityType: "question_report",
      entityId: "42",
      metadata: { from: "reviewing", to: "resolved", questionId: 9 },
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/relatos");
  });

  it("status alterado por outra pessoa não grava auditoria", async () => {
    const { db, calls } = fakeDb(undefined);
    mocks.db.mockReturnValue(db);
    const result = await changeQuestionReportStatusAction(idle, form({ reportId: "42", from: "open", to: "reviewing" }));
    expect(result.status).toBe("error");
    expect(calls.audit).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("falha do banco não vaza detalhe", async () => {
    mocks.db.mockReturnValue({ transaction: async () => Promise.reject(new Error("permission denied for table question_reports")) });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await changeQuestionReportStatusAction(idle, form({ reportId: "42", from: "open", to: "dismissed" }));
    expect(result).toEqual({ status: "error", message: "Não foi possível salvar o novo status." });
    spy.mockRestore();
  });
});
