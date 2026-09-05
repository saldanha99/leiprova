import { describe, expect, it } from "vitest";

import { resolveOriginalStyleEligibility } from "@/lib/quiz/original-style-eligibility";

describe("elegibilidade da trilha autoral", () => {
  it("falha fechada quando a seleção não resolve uma banca", () => {
    const result = resolveOriginalStyleEligibility({ bankId: null, examEditionId: null });
    expect(result.eligible).toBe(false);
    expect(result.eligible === false && result.reason).toBe("missing_bank");
  });

  it("preserva o treino geral por banca quando não há edição escolhida", () => {
    const result = resolveOriginalStyleEligibility({ bankId: 3, examEditionId: null });
    expect(result).toEqual({ eligible: true, scope: "general_bank", bankId: 3 });
  });

  it("não exige programa no treino geral, mas também não alega concurso", () => {
    const result = resolveOriginalStyleEligibility({ bankId: 3, examEditionId: null });
    expect(result.eligible && result.scope).toBe("general_bank");
    expect(JSON.stringify(result)).not.toContain("examEditionId");
  });

  it("exige o programa da edição exata quando o aluno escolhe uma edição", () => {
    const result = resolveOriginalStyleEligibility({ bankId: 3, examEditionId: 4021 });
    expect(result).toEqual({
      eligible: true,
      scope: "edition_program",
      bankId: 3,
      examEditionId: 4021,
    });
  });
});

describe("adversarial: duas edições na mesma carreira, banca e ano", () => {
  // Cenário que derrubava a versão heurística anterior: ENAM 2026.1 e ENAM
  // 2026.2 compartilham carreira, banca e ciclo. Só o identificador distingue.
  const primeiraEdicao = { bankId: 3, examEditionId: 4021 };
  const segundaEdicao = { bankId: 3, examEditionId: 4022 };

  it("produz recortes distintos para edições distintas", () => {
    const primeira = resolveOriginalStyleEligibility(primeiraEdicao);
    const segunda = resolveOriginalStyleEligibility(segundaEdicao);

    expect(primeira.eligible && primeira.scope === "edition_program" && primeira.examEditionId).toBe(4021);
    expect(segunda.eligible && segunda.scope === "edition_program" && segunda.examEditionId).toBe(4022);
    expect(primeira).not.toEqual(segunda);
  });

  it("não usa carreira, especialização nem ano para identificar a edição", () => {
    const resolved = resolveOriginalStyleEligibility(primeiraEdicao);
    const serialized = JSON.stringify(resolved);
    for (const heuristica of ["careerTrackId", "specializationId", "cycleYear"]) {
      expect(serialized).not.toContain(heuristica);
    }
  });

  it("banca igual não basta: o recorte carrega a edição escolhida", () => {
    const primeira = resolveOriginalStyleEligibility(primeiraEdicao);
    const segunda = resolveOriginalStyleEligibility(segundaEdicao);
    expect(primeira.eligible && primeira.bankId).toBe(segunda.eligible && segunda.bankId);
    expect(
      primeira.eligible && primeira.scope === "edition_program" && primeira.examEditionId,
    ).not.toBe(segunda.eligible && segunda.scope === "edition_program" && segunda.examEditionId);
  });

  it("edição ausente nunca herda o recorte de uma edição anterior", () => {
    const semEdicao = resolveOriginalStyleEligibility({ bankId: 3, examEditionId: null });
    expect(semEdicao.eligible && semEdicao.scope).toBe("general_bank");
  });
});
