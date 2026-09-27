import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import {
  buildLicenseRequestDraft,
  dispatchDueExamLicenseRequests,
  type LicenseEmailSender,
} from "@/lib/licensing/exam-license-automation";

const source = {
  editionId: 1,
  editionPublicId: "enam-2026-1",
  editionTitle: "ENAM 2026.1",
  institutionAcronym: "ENFAM",
  bankId: 2,
  bankSlug: "fgv",
  bookletTitle: "Caderno oficial",
  bookletUrl: "https://conhecimento.fgv.br/sites/default/files/caderno.pdf",
  answerKeyTitle: "Gabarito oficial",
  answerKeyUrl: "https://conhecimento.fgv.br/sites/default/files/gabarito.pdf",
} as const;

describe("automação de pedidos de licença de provas", () => {
  it("endereça o ENAM à equipe oficial e descreve o escopo exato", () => {
    const draft = buildLicenseRequestDraft(source);

    expect(draft?.recipients).toEqual([
      "examemagistratura@fgv.br",
      "demanda.conhecimento@fgv.br",
    ]);
    expect(draft?.body).toContain(source.bookletUrl);
    expect(draft?.body).toContain(source.answerKeyUrl);
    expect(draft?.body).toContain("produto digital pago");
    expect(draft?.body).toContain("somente se autorizado, hospedagem");
    expect(draft?.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("usa o canal específico do ENAC", () => {
    const draft = buildLicenseRequestDraft({
      ...source,
      editionPublicId: "enac-2026-1",
      editionTitle: "ENAC 2026.1",
      institutionAcronym: "CNJ",
    });

    expect(draft?.recipients).toEqual([
      "enac@fgv.br",
      "demanda.conhecimento@fgv.br",
    ]);
  });

  it("não prepara envio quando a banca não tem contato revisado", () => {
    expect(
      buildLicenseRequestDraft({ ...source, bankSlug: "banca-sem-canal" }),
    ).toBeNull();
  });

  it("muda a impressão digital quando muda qualquer documento solicitado", () => {
    const first = buildLicenseRequestDraft(source);
    const second = buildLicenseRequestDraft({
      ...source,
      answerKeyUrl:
        "https://conhecimento.fgv.br/sites/default/files/gabarito-retificado.pdf",
    });

    expect(second?.fingerprint).not.toBe(first?.fingerprint);
  });
});

describe("envio dos acompanhamentos de licença", () => {
  const now = new Date("2026-09-27T12:00:00.000-03:00");
  const dueRequest = {
    publicId: "7e253a2f-92f1-4961-a40d-145c6fd593e9",
    status: "awaiting_response",
    recipients: ["enac@fgv.br", "demanda.conhecimento@fgv.br"],
    subject: "Pedido de autorização comercial — ENAC 2026.1 — Editalume",
    body: "Pedido original sintético.",
    fingerprint: "a".repeat(64),
    followUpCount: 0,
  };

  async function dispatch(request: typeof dueRequest) {
    const execute = vi.fn().mockResolvedValueOnce([request]).mockResolvedValue([]);
    const sender = vi.fn<LicenseEmailSender>().mockResolvedValue({ messageId: "msg-sintetica" });
    const result = await dispatchDueExamLicenseRequests(
      { execute } as unknown as Parameters<typeof dispatchDueExamLicenseRequests>[0],
      sender,
      now,
    );
    const queries = execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query));
    return { result, sender, queries };
  }

  it("envia o 1º acompanhamento vencido a cada destinatário e agenda o próximo", async () => {
    const { result, sender, queries } = await dispatch(dueRequest);

    expect(result).toEqual({ due: 1, sent: 1, deferred: 0, manualReview: 0 });
    expect(sender.mock.calls.map(([message]) => message.to)).toEqual(dueRequest.recipients);
    expect(sender.mock.calls[0][0].subject).toBe(`Acompanhamento 1/3 — ${dueRequest.subject}`);
    expect(queries[1].params).toContain("2026-10-04T15:00:00.000Z");
  });

  it("encerra em revisão manual após o terceiro acompanhamento sem novo envio", async () => {
    const { result, sender } = await dispatch({ ...dueRequest, followUpCount: 3 });

    expect(result).toEqual({ due: 1, sent: 0, deferred: 0, manualReview: 1 });
    expect(sender).not.toHaveBeenCalled();
  });

  it.each([
    ["no envio inicial", { ...dueRequest, status: "prepared" }],
    ["no acompanhamento", dueRequest],
    ["na revisão manual", { ...dueRequest, followUpCount: 3 }],
  ])("não passa Date cru ao driver %s", async (_, request) => {
    // Date em SQL bruto derrubou o worker editorial com ERR_INVALID_ARG_TYPE.
    const { queries } = await dispatch(request);

    expect(queries.length).toBeGreaterThan(1);
    expect(queries.flatMap((query) => query.params).filter((param) => param instanceof Date)).toEqual([]);
  });
});
