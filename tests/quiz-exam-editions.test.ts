import { describe, expect, it } from "vitest";

import {
  buildQuizExamEditionCatalog,
  isQuizExamEditionAvailableForSelection,
  saoPauloDateIso,
  toQuizExamEditionOptions,
  type QuizExamEditionCatalogRow,
} from "@/lib/quiz/exam-edition-catalog";

const baseRow: QuizExamEditionCatalogRow = {
  publicId: "oab-2025-fgv",
  title: "Exame de Ordem 2025",
  examDate: "2025-06-15",
  durationMinutes: 300,
  status: "published",
  organizer: "Conselho Federal da OAB",
  jurisdiction: "Nacional",
  officialUrl: "https://conhecimento.fgv.br/concursos/oab-2025",
  careerId: 1,
  careerSlug: "oab",
  careerName: "Ordem dos Advogados do Brasil",
  careerShortName: "OAB",
  careerIsActive: true,
  specializationId: null,
  specializationCareerTrackId: null,
  specializationSlug: null,
  specializationName: null,
  specializationIsActive: null,
  bankSlug: "fgv",
  bankName: "FGV",
  bankFullName: "Fundação Getulio Vargas",
  bankIsActive: true,
};

describe("catálogo de edições oficiais do quiz", () => {
  it("permite edição agendada somente na preparação autoral com programa explicitamente revisado", () => {
    const future = { ...baseRow, status: "scheduled", examDate: "2026-12-01",
      scheduledProgramReviewed: true, sourceCheckedAt: new Date("2026-09-04") };
    expect(buildQuizExamEditionCatalog([future], "2026-09-04")).toEqual([]);
    expect(buildQuizExamEditionCatalog([future], "2026-09-04", true)).toHaveLength(1);
    expect(buildQuizExamEditionCatalog([{ ...future, scheduledProgramReviewed: false }], "2026-09-04", true)).toEqual([]);
    expect(buildQuizExamEditionCatalog([{ ...future, sourceCheckedAt: null }], "2026-09-04", true)).toEqual([]);
    expect(buildQuizExamEditionCatalog([{ ...future, status: "canceled" }], "2026-09-04", true)).toEqual([]);
    const candidate = { ...future, careerTrackId: 1, bankId: 1 };
    const selection = { careerTrackId: 1, specializationId: null, bankId: null };
    expect(isQuizExamEditionAvailableForSelection(candidate, selection, "2026-09-04", candidate.publicId)).toBe(false);
    expect(isQuizExamEditionAvailableForSelection(candidate, selection, "2026-09-04", candidate.publicId, true)).toBe(true);
  });
  it("serializa datas e entrega metadados aninhados prontos para a UI", () => {
    const [edition] = buildQuizExamEditionCatalog(
      [{ ...baseRow, examDate: new Date("2025-06-15T12:00:00.000Z"), officialUrl: ` ${baseRow.officialUrl} ` }],
      "2025-12-31",
    );

    expect(edition).toEqual({
      publicId: "oab-2025-fgv",
      title: "Exame de Ordem 2025",
      examDate: "2025-06-15",
      examYear: 2025,
      durationMinutes: 300,
      status: "published",
      organizer: "Conselho Federal da OAB",
      jurisdiction: "Nacional",
      officialUrl: "https://conhecimento.fgv.br/concursos/oab-2025",
      career: {
        slug: "oab",
        name: "Ordem dos Advogados do Brasil",
        shortName: "OAB",
      },
      specialization: null,
      bank: {
        slug: "fgv",
        name: "FGV",
        fullName: "Fundação Getulio Vargas",
      },
    });
  });

  it("mantém apenas edições realizadas, publicadas, não futuras e com URL oficial", () => {
    const rows = [
      baseRow,
      { ...baseRow, publicId: "held", status: "held" },
      { ...baseRow, publicId: "draft", status: "draft" },
      { ...baseRow, publicId: "scheduled", status: "scheduled" },
      { ...baseRow, publicId: "future", examDate: "2026-01-01" },
      { ...baseRow, publicId: "no-url", officialUrl: "   " },
      { ...baseRow, publicId: "inactive-career", careerIsActive: false },
      { ...baseRow, publicId: "inactive-bank", bankIsActive: false },
    ];

    expect(buildQuizExamEditionCatalog(rows, "2025-12-31").map((item) => item.publicId)).toEqual([
      "held",
      "oab-2025-fgv",
    ]);
  });

  it("aceita somente especialização ativa e pertencente à carreira da edição", () => {
    const specialized = {
      ...baseRow,
      publicId: "magistratura-federal-2025",
      careerId: 2,
      careerSlug: "magistratura",
      specializationId: 20,
      specializationCareerTrackId: 2,
      specializationSlug: "federal",
      specializationName: "Federal",
      specializationIsActive: true,
    } satisfies QuizExamEditionCatalogRow;

    const rows = [
      specialized,
      { ...specialized, publicId: "inactive-specialization", specializationIsActive: false },
      { ...specialized, publicId: "wrong-career", specializationCareerTrackId: 99 },
    ];

    const [edition] = buildQuizExamEditionCatalog(rows, "2025-12-31");
    expect(edition.publicId).toBe("magistratura-federal-2025");
    expect(edition.specialization).toEqual({ slug: "federal", name: "Federal" });
  });

  it("ordena por data decrescente e usa o identificador público como desempate estável", () => {
    const rows = [
      { ...baseRow, publicId: "z-edition", examDate: "2024-01-01" },
      { ...baseRow, publicId: "b-edition", examDate: "2025-01-01" },
      { ...baseRow, publicId: "a-edition", examDate: "2025-01-01" },
    ];

    expect(buildQuizExamEditionCatalog(rows, "2025-12-31").map((item) => item.publicId)).toEqual([
      "a-edition",
      "b-edition",
      "z-edition",
    ]);
  });

  it("serializa para o cliente somente os campos usados pelo construtor", () => {
    const [catalogItem] = buildQuizExamEditionCatalog([baseRow], "2025-12-31");

    expect(toQuizExamEditionOptions([catalogItem])).toEqual([
      {
        publicId: "oab-2025-fgv",
        title: "Exame de Ordem 2025",
        examDate: "2025-06-15",
        examYear: 2025,
        organizer: "Conselho Federal da OAB",
        jurisdiction: "Nacional",
        careerSlug: "oab",
        specializationSlug: null,
        bank: { slug: "fgv", name: "FGV" },
      },
    ]);
  });
});

describe("fronteira autoritativa da edição selecionada", () => {
  const candidate = {
    publicId: "magistratura-estadual-2025-tjsp",
    careerTrackId: 10,
    specializationId: 11,
    bankId: 12,
    bankSlug: "vunesp",
    bankIsActive: true,
    status: "published",
    officialUrl: "https://www.vunesp.com.br/TJSP2501",
    examDate: "2025-08-31",
  };
  const selection = {
    careerTrackId: 10,
    specializationId: 11,
    bankId: null,
  };

  it("aceita somente a identidade elegível ligada à carreira e especialização", () => {
    expect(
      isQuizExamEditionAvailableForSelection(
        candidate,
        selection,
        "2025-08-31",
        candidate.publicId,
      ),
    ).toBe(true);

    const adulterated = [
      { ...candidate, careerTrackId: 99 },
      { ...candidate, specializationId: 99 },
      { ...candidate, bankIsActive: false },
      { ...candidate, status: "draft" },
      { ...candidate, status: "canceled" },
      { ...candidate, officialUrl: " " },
      { ...candidate, officialUrl: "https://example.com/prova" },
      { ...candidate, examDate: "2025-09-01" },
      { ...candidate, publicId: "outra-edicao" },
    ];

    expect(
      adulterated.every(
        (item) =>
          !isQuizExamEditionAvailableForSelection(
            item,
            selection,
            "2025-08-31",
            candidate.publicId,
          ),
      ),
    ).toBe(true);
  });

  it("respeita também a banca quando o recorte já a determina", () => {
    expect(
      isQuizExamEditionAvailableForSelection(
        candidate,
        { ...selection, bankId: 999 },
        "2025-08-31",
        candidate.publicId,
      ),
    ).toBe(false);
  });

  it("usa a virada do dia de São Paulo também na fronteira do servidor", () => {
    expect(saoPauloDateIso(new Date("2025-09-01T02:59:59.000Z"))).toBe("2025-08-31");
    expect(saoPauloDateIso(new Date("2025-09-01T03:00:00.000Z"))).toBe("2025-09-01");
  });
});
