import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  execute: vi.fn(),
  txExecute: vi.fn(),
  selectRows: vi.fn(),
  insertValues: vi.fn(),
}));

function selectChain() {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => mocked.selectRows(),
  };
  return chain;
}

const fakeDb = {
  execute: mocked.execute,
  transaction: async <T>(run: (tx: unknown) => Promise<T>) =>
    run({
      execute: mocked.txExecute,
      select: () => selectChain(),
      insert: () => ({ values: mocked.insertValues }),
    }),
};

vi.mock("@/lib/db/client", () => ({ getDb: () => fakeDb }));

import {
  cachedClassStats,
  clearClassStatsCache,
  createQuestionReport,
  loadQuestionHistory,
} from "@/lib/study/question-bar";

describe("barra por questão: dados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearClassStatsCache();
  });

  it("guarda a estatística da turma por alguns minutos", async () => {
    mocked.execute.mockResolvedValue([{ answers: "25", correct: "20" }]);
    const now = Date.parse("2026-11-21T12:00:00Z");
    expect(await cachedClassStats(42, now)).toEqual({ answers: 25, correct: 20 });
    expect(await cachedClassStats(42, now + 60_000)).toEqual({ answers: 25, correct: 20 });
    expect(mocked.execute).toHaveBeenCalledTimes(1);
    await cachedClassStats(42, now + 11 * 60_000);
    expect(mocked.execute).toHaveBeenCalledTimes(2);
    await cachedClassStats(43, now);
    expect(mocked.execute).toHaveBeenCalledTimes(3);
  });

  it("histórico normaliza datas e rótulos", async () => {
    mocked.execute.mockResolvedValue([
      { answered_at: new Date("2026-11-21T10:00:00Z"), is_correct: true, option_key: "c", origin: "quiz" },
      { answered_at: "2026-11-20 09:00:00+00", is_correct: false, option_key: null, origin: "treino" },
    ]);
    expect(await loadQuestionHistory(7, 42)).toEqual([
      { answeredAt: "2026-11-21T10:00:00.000Z", isCorrect: true, optionKey: "c", origin: "quiz" },
      { answeredAt: "2026-11-20T09:00:00.000Z", isCorrect: false, optionKey: null, origin: "treino" },
    ]);
  });

  it("relato: um aberto por aluno e questão, sob lock", async () => {
    mocked.selectRows.mockResolvedValueOnce([{ id: 1 }]);
    expect(await createQuestionReport({ userId: 7, questionId: 42, reason: "typo" })).toBe("already_open");
    expect(mocked.txExecute).toHaveBeenCalledTimes(1);
    expect(mocked.insertValues).not.toHaveBeenCalled();

    mocked.selectRows.mockResolvedValueOnce([]);
    expect(await createQuestionReport({ userId: 7, questionId: 42, reason: "answer_key", notes: "A correta é a C." })).toBe("created");
    expect(mocked.insertValues).toHaveBeenCalledWith({
      userId: 7,
      questionId: 42,
      reason: "answer_key",
      notes: "A correta é a C.",
      status: "open",
    });
  });
});
