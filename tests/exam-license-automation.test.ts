import { describe, expect, it } from "vitest";

import { buildLicenseRequestDraft } from "@/lib/licensing/exam-license-automation";

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
