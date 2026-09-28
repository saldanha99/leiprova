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

  it("preserva texto e impressão digital dos pedidos individuais já enviados", () => {
    // Valor anterior à consolidação por banca (28/09/2026); mudar exigiria novo contato.
    expect(buildLicenseRequestDraft(source)?.fingerprint).toBe(
      "25b1e8a69e0c2875b0fabffe3736eeac0c7d5790212793c55017c45f13bb6da7",
    );
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
    bankId: 2,
    recipients: ["enac@fgv.br", "demanda.conhecimento@fgv.br"],
    subject: "Pedido de autorização comercial — ENAC 2026.1 — Editalume",
    body: "Pedido original sintético.",
    fingerprint: "a".repeat(64),
    followUpCount: 0,
    editionTitle: "ENAC 2026.1",
    bookletTitle: "Caderno ENAC",
    bookletUrl: "https://conhecimento.fgv.br/sites/default/files/enac.pdf",
    answerKeyTitle: "Gabarito ENAC",
    answerKeyUrl: "https://conhecimento.fgv.br/sites/default/files/gabarito-enac.pdf",
  };
  const enamRequest = {
    ...dueRequest,
    publicId: "f0c70edc-989c-47ee-8257-73a5853a8670",
    recipients: ["examemagistratura@fgv.br", "demanda.conhecimento@fgv.br"],
    subject: "Pedido de autorização comercial — ENAM 2026.1 — Editalume",
    fingerprint: "b".repeat(64),
    editionTitle: "ENAM 2026.1",
    bookletUrl: "https://conhecimento.fgv.br/sites/default/files/enam.pdf",
  };
  const cebraspeRequest = (publicId: string, editionTitle: string) => ({
    ...dueRequest,
    publicId,
    status: "prepared",
    bankId: 3,
    recipients: ["sac@cebraspe.org.br"],
    subject: `Pedido de autorização comercial — ${editionTitle} — Editalume`,
    fingerprint: publicId.slice(0, 1).repeat(64),
    editionTitle,
    bookletUrl: `https://cdn.cebraspe.org.br/concursos/${publicId}/caderno.pdf`,
  });

  async function dispatch(requests: readonly (typeof dueRequest)[], failFor?: string) {
    const execute = vi.fn().mockResolvedValueOnce(requests).mockResolvedValue([]);
    const sender = vi.fn<LicenseEmailSender>(async (message) => {
      if (message.to === failFor) throw new Error("recusado");
      return { messageId: `msg-${message.to}` };
    });
    const result = await dispatchDueExamLicenseRequests(
      { execute } as unknown as Parameters<typeof dispatchDueExamLicenseRequests>[0],
      sender,
      now,
    );
    const queries = execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query));
    const updates = queries.filter((query) => /^\s*update /u.test(query.sql));
    return { result, sender, queries, updates };
  }

  it("envia o 1º acompanhamento vencido a cada destinatário e agenda o próximo", async () => {
    const { result, sender, updates } = await dispatch([dueRequest]);

    expect(result).toEqual({ due: 1, sent: 1, deferred: 0, manualReview: 0, emails: 2 });
    expect(sender.mock.calls.map(([message]) => message.to)).toEqual(dueRequest.recipients);
    expect(sender.mock.calls[0][0].subject).toBe(`Acompanhamento 1/3 — ${dueRequest.subject}`);
    expect(updates[0].params).toContain("2026-10-04T15:00:00.000Z");
  });

  it("encerra em revisão manual após o terceiro acompanhamento sem novo envio", async () => {
    const { result, sender } = await dispatch([{ ...dueRequest, followUpCount: 3 }]);

    expect(result).toEqual({ due: 1, sent: 0, deferred: 0, manualReview: 1, emails: 0 });
    expect(sender).not.toHaveBeenCalled();
  });

  it("consolida as provas da mesma banca em um único e-mail", async () => {
    const { result, sender, updates } = await dispatch([
      cebraspeRequest("pc-ma-delegado-2018", "PC-MA 2017 — Delegado"),
      cebraspeRequest("pgm-manaus-procurador-2018", "PGM Manaus 2018 — Procurador"),
    ]);

    expect(result).toEqual({ due: 2, sent: 2, deferred: 0, manualReview: 0, emails: 1 });
    const [message] = sender.mock.calls[0];
    expect(message.to).toBe("sac@cebraspe.org.br");
    expect(message.subject).toBe("Pedido de autorização comercial — 2 provas anteriores — Editalume");
    expect(message.text).toContain("1. PC-MA 2017 — Delegado");
    expect(message.text).toContain("2. PGM Manaus 2018 — Procurador");
    expect(message.text).toContain("https://cdn.cebraspe.org.br/concursos/pgm-manaus-procurador-2018/caderno.pdf");
    expect(updates).toHaveLength(2);
  });

  it("junta o canal comum e mantém os canais exclusivos de cada exame", async () => {
    const { result, sender } = await dispatch([dueRequest, enamRequest]);

    expect(result).toEqual({ due: 2, sent: 2, deferred: 0, manualReview: 0, emails: 3 });
    const shared = sender.mock.calls.find(([message]) => message.to === "demanda.conhecimento@fgv.br");
    expect(shared?.[0].subject).toBe("Acompanhamento 1/3 — Pedido de autorização comercial — 2 provas anteriores — Editalume");
    expect(shared?.[0].text).toContain("ENAC 2026.1");
    expect(shared?.[0].text).toContain("ENAM 2026.1");
    expect(sender.mock.calls.filter(([message]) => message.to === "enac@fgv.br")).toHaveLength(1);
  });

  it("adia somente a prova cujo destinatário recusou o envio", async () => {
    const { result, updates } = await dispatch([dueRequest, enamRequest], "enac@fgv.br");

    expect(result).toEqual({ due: 2, sent: 1, deferred: 1, manualReview: 0, emails: 2 });
    expect(updates).toHaveLength(1);
    expect(updates[0].params).toContain(enamRequest.publicId);
  });

  it.each([
    ["no envio inicial", { ...dueRequest, status: "prepared" }],
    ["no acompanhamento", dueRequest],
    ["na revisão manual", { ...dueRequest, followUpCount: 3 }],
  ])("não passa Date cru ao driver %s", async (_, request) => {
    // Date em SQL bruto derrubou o worker editorial com ERR_INVALID_ARG_TYPE.
    const { queries } = await dispatch([request]);

    expect(queries.length).toBeGreaterThan(1);
    expect(queries.flatMap((query) => query.params).filter((param) => param instanceof Date)).toEqual([]);
  });
});
