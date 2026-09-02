import { describe, expect, it } from "vitest";

import { extractOfficialSyllabusCandidates } from "@/lib/editorial/official-syllabus-extractor";

const subjects = [
  { id: 10, name: "Direito Constitucional" },
  { id: 20, name: "Direito Administrativo" },
];

describe("extração determinística do conteúdo programático", () => {
  it("preserva as linhas oficiais e sugere a matéria sem criar texto", () => {
    const candidates = extractOfficialSyllabusCandidates(
      [
        "EDITAL Nº 2\n1. DISPOSIÇÕES GERAIS",
        "CONTEÚDO PROGRAMÁTICO\nDIREITO CONSTITUCIONAL\n1. Direitos e garantias fundamentais\n2. Controle de constitucionalidade",
        "DIREITO ADMINISTRATIVO\n• Atos administrativos e poderes da Administração\nCRONOGRAMA\nInscrições entre 2 e 9 de setembro\nPágina 3 de 40",
      ],
      subjects,
    );

    expect(candidates).toEqual([
      {
        requirementText: "Direitos e garantias fundamentais",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2",
        suggestedSubjectId: 10,
        suggestedSubjectName: "Direito Constitucional",
      },
      {
        requirementText: "Controle de constitucionalidade",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2",
        suggestedSubjectId: 10,
        suggestedSubjectName: "Direito Constitucional",
      },
      {
        requirementText: "Atos administrativos e poderes da Administração",
        pageNumber: 3,
        sourceLocator: "Conteúdo programático, p. 3",
        suggestedSubjectId: 20,
        suggestedSubjectName: "Direito Administrativo",
      },
    ]);
  });

  it("não extrai texto fora do bloco programático quando há âncora", () => {
    const candidates = extractOfficialSyllabusCandidates(
      [
        "DIREITO CONSTITUCIONAL\nEsta frase está fora do programa",
        "CONTEÚDO PROGRAMÁTICO\nDIREITO CONSTITUCIONAL\nOrganização do Estado brasileiro",
      ],
      subjects,
    );
    expect(candidates.map((item) => item.requirementText)).toEqual([
      "Organização do Estado brasileiro",
    ]);
  });
});
