import { describe, expect, it } from "vitest";

import {
  assertSpecializationSelection,
  buildSynchronizedExamEditionPublicId,
  ExamEditionSyncConflictError,
  normalizeDiscoveredExamEdition,
  planExamEditionMetadataSync,
  type ExistingExamEditionSyncState,
  type ResolvedDiscoveredExamEdition,
} from "@/lib/official-sources/exam-edition-sync";

const discovery = normalizeDiscoveredExamEdition({
  bankSlug: " FGV ",
  careerSlug: " OAB ",
  sourceExternalId: "OAB-2025-01",
  title: "  Exame   de Ordem\n2025  ",
  organizer: "Conselho Federal da OAB",
  jurisdiction: " Nacional ",
  officialUrl: "https://conhecimento.fgv.br/concursos/oab-2025#provas",
  examDate: "2025-06-15",
  durationMinutes: 300,
  sourceObservedAt: "2025-06-16T12:00:00-03:00",
});

const resolved: ResolvedDiscoveredExamEdition = {
  ...discovery,
  bankId: 1,
  careerTrackId: 2,
  specializationId: null,
};

const existing: ExistingExamEditionSyncState = {
  publicId: "exam-fgv-oab-2025-example",
  bankId: 1,
  careerTrackId: 2,
  specializationId: null,
  sourceExternalId: "OAB-2025-01",
  title: discovery.title,
  organizer: discovery.organizer,
  jurisdiction: discovery.jurisdiction,
  officialUrl: discovery.officialUrl,
  examDate: discovery.examDate,
  durationMinutes: discovery.durationMinutes,
  status: "draft",
  sourcePolicy: "metadata_only",
  sourceContentStored: false,
  sourceCheckedAt: new Date("2025-06-16T14:00:00.000Z"),
};

describe("normalização de edições descobertas", () => {
  it("normaliza campos, remove fragmento e conserva apenas metadados", () => {
    expect(discovery).toEqual({
      bankSlug: "fgv",
      careerSlug: "oab",
      specializationSlug: null,
      sourceExternalId: "OAB-2025-01",
      title: "Exame de Ordem 2025",
      organizer: "Conselho Federal da OAB",
      jurisdiction: "Nacional",
      officialUrl: "https://conhecimento.fgv.br/concursos/oab-2025",
      examDate: "2025-06-15",
      durationMinutes: 300,
      sourceObservedAt: "2025-06-16T15:00:00.000Z",
    });
  });

  it("rejeita campo desconhecido, data impossível e URL fora do portal oficial", () => {
    const base = {
      bankSlug: "fgv",
      careerSlug: "oab",
      sourceExternalId: "OAB-2025-01",
      title: "Exame de Ordem",
      organizer: "OAB",
      jurisdiction: "Nacional",
      officialUrl: "https://conhecimento.fgv.br/concursos/oab",
      examDate: "2025-06-15",
      sourceObservedAt: "2025-06-16T12:00:00-03:00",
    };

    expect(() => normalizeDiscoveredExamEdition({ ...base, arbitrary: true })).toThrow();
    expect(() => normalizeDiscoveredExamEdition({ ...base, examDate: "2025-02-30" })).toThrow();
    expect(() =>
      normalizeDiscoveredExamEdition({ ...base, sourceObservedAt: "2100-01-01T00:00:00Z" }),
    ).toThrow(/não pode estar no futuro/);
    expect(() =>
      normalizeDiscoveredExamEdition({ ...base, officialUrl: "https://example.com/prova.pdf" }),
    ).toThrow(/domínio oficial/);
  });

  it("gera o mesmo identificador público para a mesma identidade externa", () => {
    const first = buildSynchronizedExamEditionPublicId(discovery);
    const renamed = buildSynchronizedExamEditionPublicId({ ...discovery, title: "Título novo" });

    expect(first).toBe(renamed);
    expect(first).toMatch(/^exam-fgv-oab-2025-[0-9a-f]{16}$/);
  });
});

describe("plano idempotente de sincronização", () => {
  it("não reescreve metadados quando eles são idênticos", () => {
    expect(planExamEditionMetadataSync(existing, resolved)).toEqual({
      outcome: "unchanged",
      changedFields: [],
    });
  });

  it("limita a atualização aos metadados seguros e não inclui status", () => {
    const plan = planExamEditionMetadataSync(existing, {
      ...resolved,
      title: "Exame de Ordem 2025 — retificado",
      durationMinutes: 330,
    });

    expect(plan.outcome).toBe("update");
    if (plan.outcome !== "update") throw new Error("Plano inesperado.");
    expect(plan.changedFields).toEqual(["title", "durationMinutes"]);
    expect(plan.values).not.toHaveProperty("status");
  });

  it("exige nova revisão antes de alterar uma edição já publicada", () => {
    expect(() =>
      planExamEditionMetadataSync(
        { ...existing, status: "published" },
        { ...resolved, title: "Exame de Ordem 2025 — retificado" },
      ),
    ).toThrow(/revisão humana/);

    try {
      planExamEditionMetadataSync(
        { ...existing, status: "published" },
        { ...resolved, title: "Exame de Ordem 2025 — retificado" },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ExamEditionSyncConflictError);
      expect((error as ExamEditionSyncConflictError).code).toBe("review_required");
    }
  });

  it("impede uma observação antiga de sobrescrever o rascunho mais recente", () => {
    expect(() =>
      planExamEditionMetadataSync(
        { ...existing, sourceCheckedAt: new Date("2025-06-17T00:00:00.000Z") },
        { ...resolved, title: "Título de evento atrasado" },
      ),
    ).toThrow(/anterior ou igual/);

    try {
      planExamEditionMetadataSync(
        { ...existing, sourceCheckedAt: new Date("2025-06-17T00:00:00.000Z") },
        { ...resolved, title: "Título de evento atrasado" },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ExamEditionSyncConflictError);
      expect((error as ExamEditionSyncConflictError).code).toBe("stale_observation");
    }
  });

  it("bloqueia a movimentação da identidade para outra carreira ou especialização", () => {
    expect(() =>
      planExamEditionMetadataSync(existing, { ...resolved, careerTrackId: 99 }),
    ).toThrowError(ExamEditionSyncConflictError);
    expect(() =>
      planExamEditionMetadataSync(existing, { ...resolved, specializationId: 10 }),
    ).toThrow(/outra carreira ou especialização/);
  });

  it("não sobrescreve conteúdo licenciado nem uma URL legada de host incompatível", () => {
    expect(() =>
      planExamEditionMetadataSync(
        { ...existing, sourcePolicy: "licensed_content", sourceContentStored: true },
        resolved,
      ),
    ).toThrow(/política protegida/);

    expect(() =>
      planExamEditionMetadataSync(
        { ...existing, officialUrl: "https://example.com/prova.pdf" },
        resolved,
      ),
    ).toThrow(/host incompatível/);
  });
});

describe("especialização da edição descoberta", () => {
  it("exige seleção explícita quando a carreira tem especializações ativas", () => {
    expect(() => assertSpecializationSelection(null, true)).toThrow(
      /possui especializações ativas/,
    );
  });

  it("aceita ausência quando a carreira não tem especializações ativas", () => {
    expect(() => assertSpecializationSelection(null, false)).not.toThrow();
    expect(() => assertSpecializationSelection("federal", true)).not.toThrow();
  });
});
