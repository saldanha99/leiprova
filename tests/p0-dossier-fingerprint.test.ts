import { describe, expect, it } from "vitest";

import {
  buildDossierFingerprint,
  type QuestionDossier,
} from "@/lib/editorial/dossier-fingerprint";

const base: QuestionDossier = {
  publicId: "q-1",
  type: "multiple_choice",
  prompt: "Assinale a alternativa correta sobre o dispositivo.",
  explanation: "A resposta decorre do artigo indicado.",
  learningObjective: "Reconhecer a regra do artigo.",
  difficulty: 3,
  articleRef: "Art. 5º, IV",
  literalText: "é livre a manifestação do pensamento, sendo vedado o anonimato;",
  sourceUrl: "https://www.planalto.gov.br/exemplo",
  sourceVerifiedAt: new Date("2026-08-16T00:00:00Z"),
  options: [
    { optionKey: "A", text: "alternativa a", isCorrect: false, rationale: "erra o sujeito" },
    { optionKey: "B", text: "alternativa b", isCorrect: true, rationale: "reproduz a norma" },
  ],
};

function fingerprintOf(patch: Partial<QuestionDossier>) {
  return buildDossierFingerprint({ ...base, ...patch });
}

describe("impressão digital do dossiê", () => {
  it("é estável para o mesmo conteúdo", () => {
    expect(buildDossierFingerprint(base)).toBe(buildDossierFingerprint({ ...base }));
  });

  it("independe da ordem das alternativas", () => {
    const invertida = fingerprintOf({ options: [base.options[1], base.options[0]] });
    expect(invertida).toBe(buildDossierFingerprint(base));
  });

  it("muda quando o enunciado muda", () => {
    expect(fingerprintOf({ prompt: "Outro enunciado." })).not.toBe(buildDossierFingerprint(base));
  });

  it("muda quando o texto de uma alternativa muda", () => {
    const options = [base.options[0], { ...base.options[1], text: "alternativa b alterada" }];
    expect(fingerprintOf({ options })).not.toBe(buildDossierFingerprint(base));
  });

  it("muda quando o gabarito muda de alternativa", () => {
    const options = [
      { ...base.options[0], isCorrect: true },
      { ...base.options[1], isCorrect: false },
    ];
    expect(fingerprintOf({ options })).not.toBe(buildDossierFingerprint(base));
  });

  it("muda quando uma justificativa muda", () => {
    const options = [base.options[0], { ...base.options[1], rationale: "outra justificativa" }];
    expect(fingerprintOf({ options })).not.toBe(buildDossierFingerprint(base));
  });

  it("muda quando uma alternativa é removida", () => {
    expect(fingerprintOf({ options: [base.options[0]] })).not.toBe(buildDossierFingerprint(base));
  });

  it("muda quando o texto legal de controle muda", () => {
    expect(fingerprintOf({ literalText: "redação diferente" })).not.toBe(
      buildDossierFingerprint(base),
    );
  });

  it("muda quando a URL da fonte muda", () => {
    expect(fingerprintOf({ sourceUrl: "https://exemplo.gov.br/outro" })).not.toBe(
      buildDossierFingerprint(base),
    );
  });

  it("muda quando a data de verificação da fonte muda", () => {
    expect(fingerprintOf({ sourceVerifiedAt: new Date("2026-09-01T00:00:00Z") })).not.toBe(
      buildDossierFingerprint(base),
    );
  });

  it("muda quando a explicação muda", () => {
    expect(fingerprintOf({ explanation: "outra explicação" })).not.toBe(
      buildDossierFingerprint(base),
    );
  });

  it("trata data como Date ou string ISO de forma equivalente", () => {
    expect(fingerprintOf({ sourceVerifiedAt: "2026-08-16T00:00:00.000Z" })).toBe(
      buildDossierFingerprint(base),
    );
  });
});
