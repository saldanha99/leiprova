import { describe, expect, it } from "vitest";

import { resolveExamMetadataSpecialization } from "@/lib/official-sources/exam-metadata-selection";

describe("especialização dos metadados de prova", () => {
  it("mantém a especialização vazia quando a carreira não possui opções ativas", () => {
    expect(resolveExamMetadataSpecialization([], undefined)).toEqual({
      success: true,
      specializationId: null,
    });
  });

  it("exige uma especialização quando a carreira possui opções ativas", () => {
    expect(resolveExamMetadataSpecialization([{ id: 11 }, { id: 12 }], undefined)).toEqual({
      success: false,
      message: "Selecione a especialização desta carreira.",
    });
  });

  it("aceita somente uma especialização ativa pertencente ao recorte consultado", () => {
    expect(resolveExamMetadataSpecialization([{ id: 11 }, { id: 12 }], 12)).toEqual({
      success: true,
      specializationId: 12,
    });
    expect(resolveExamMetadataSpecialization([{ id: 11 }, { id: 12 }], 99)).toEqual({
      success: false,
      message: "A especialização está inativa ou não pertence à carreira selecionada.",
    });
  });
});
