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

  it("prioriza o Anexo I, ignora a tabela da prova e recompõe itens quebrados em linhas", () => {
    const candidates = extractOfficialSyllabusCandidates(
      [
        "CONTEÚDO PROGRAMÁTICO\nDIREITO CONSTITUCIONAL 12\nA prova será corrigida por processamento eletrônico.",
        "ANEXO I – CONTEÚDO PROGRAMÁTICO\nI. DIREITO CONSTITUCIONAL\n1. Teoria da Constituição e do Direito Constitucional. A Constituição\nem perspectiva histórico-evolutiva.\n2. Direitos e garantias fundamentais. Leis ns.",
        "Página 3 de 4\n7.716/89 e 13.869/2019.\nII.DIREITO ADMINISTRATIVO\n1. Administração Pública e Constituição.\nDireitos fundamentais.\nVI. Bens de titularidade dos povos originários.\nIII.NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA\n1. Sociologia do Direito.\nANEXO II – FORMULÁRIO",
      ],
      subjects,
    );

    expect(candidates).toEqual([
      {
        requirementText:
          "Teoria da Constituição e do Direito Constitucional. A Constituição em perspectiva histórico-evolutiva.",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2",
        suggestedSubjectId: 10,
        suggestedSubjectName: "Direito Constitucional",
      },
      {
        requirementText:
          "Direitos e garantias fundamentais. Leis ns. 7.716/89 e 13.869/2019.",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2",
        suggestedSubjectId: 10,
        suggestedSubjectName: "Direito Constitucional",
      },
      {
        requirementText:
          "Administração Pública e Constituição. Direitos fundamentais. Bens de titularidade dos povos originários.",
        pageNumber: 3,
        sourceLocator: "Conteúdo programático, p. 3",
        suggestedSubjectId: 20,
        suggestedSubjectName: "Direito Administrativo",
      },
      // "Sociologia do Direito", da formação humanística, não é lei seca e não vira requisito.
    ]);
  });

  it("lê o formato da Cebraspe por tema numerado e deixa de fora matéria sem lei", () => {
    const candidates = extractOfficialSyllabusCandidates(
      [
        "20 DOS OBJETOS DE AVALIAÇÃO (HABILIDADES E CONHECIMENTOS)\n20.2.3 CONHECIMENTOS BÁSICOS\nLÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos. 2 Reconhecimento\nde tipos e gêneros textuais.",
        "20.2.4 CONHECIMENTOS ESPECÍFICOS\nNOÇÕES DE DIREITO PENAL: 1 Aplicação da lei penal. 1.1 Princípios. 1.2 A lei penal no\ntempo e no espaço. 2 Do crime, conforme o art. 5 Dos Direitos. 3 Da imputabilidade penal.\nNOÇÕES DE DIREITO CONSTITUCIONAL: 1 Constituição Federal de 1988. 1.1 Direitos e\ngarantias fundamentais. 1.2 Organização do Estado. 1.3 Poder Judiciário.\nANEXO I\nCRONOGRAMA",
      ],
      [
        { id: 10, name: "Direito Constitucional" },
        { id: 30, name: "Direito Penal" },
      ],
    );

    expect(candidates).toEqual([
      {
        requirementText: "Aplicação da lei penal. 1.1 Princípios. 1.2 A lei penal no tempo e no espaço.",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2 · NOÇÕES DE DIREITO PENAL · item 1",
        suggestedSubjectId: 30,
        suggestedSubjectName: "Direito Penal",
      },
      {
        // "art. 5 Dos Direitos" não abre o item 5: a numeração esperada é 3.
        requirementText: "Do crime, conforme o art. 5 Dos Direitos.",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2 · NOÇÕES DE DIREITO PENAL · item 2",
        suggestedSubjectId: 30,
        suggestedSubjectName: "Direito Penal",
      },
      {
        requirementText: "Da imputabilidade penal.",
        pageNumber: 2,
        sourceLocator: "Conteúdo programático, p. 2 · NOÇÕES DE DIREITO PENAL · item 3",
        suggestedSubjectId: 30,
        suggestedSubjectName: "Direito Penal",
      },
      // Matéria com um item só desce aos subitens, em vez de virar um requisito único.
      ...["Direitos e garantias fundamentais.", "Organização do Estado.", "Poder Judiciário."].map((text, index) => ({
        requirementText: text,
        pageNumber: 2,
        sourceLocator: `Conteúdo programático, p. 2 · NOÇÕES DE DIREITO CONSTITUCIONAL · item 1.${index + 1}`,
        suggestedSubjectId: 10,
        suggestedSubjectName: "Direito Constitucional",
      })),
    ]);
  });

  it("lê matéria numerada com temas no segundo nível (PC-PR) e ignora o sumário", () => {
    const candidates = extractOfficialSyllabusCandidates(
      [
        "SUMÁRIO\nAnexo I – Conteúdo Programático.\nAnexo II – Modelo de declaração.",
        "ANEXO I\nCONTEÚDO PROGRAMÁTICO\nDELEGADO DE POLÍCIA\n1. DIREITO PENAL: 1.1 Princípios Fundamentais. 1.1.1 Legalidade. 1.2 Aplicação da\nLei Penal. 1.3 Teoria Geral do Crime.\n2. DIREITO PROCESSUAL PENAL: 2.1 Inquérito Policial. 2.2 Ação Penal. 2.3 Prisões.\n3. INFORMÁTICA: 3.1 Redes. 3.2 Segurança.\nANEXO II\nDECLARAÇÃO",
      ],
      [
        { id: 30, name: "Direito Penal" },
        { id: 40, name: "Direito Processual Penal" },
      ],
    );

    expect(candidates.map((item) => [item.suggestedSubjectId, item.requirementText])).toEqual([
      [30, "Princípios Fundamentais. 1.1.1 Legalidade."],
      [30, "Aplicação da Lei Penal."],
      [30, "Teoria Geral do Crime."],
      [40, "Inquérito Policial."],
      [40, "Ação Penal."],
      [40, "Prisões."],
      // INFORMÁTICA não é lei seca e fica de fora.
    ]);
    expect(candidates[0].sourceLocator).toBe("Conteúdo programático, p. 2 · DIREITO PENAL · item 1.1");
  });

  it("aceita outro anexo, cabeçalho repetido e tema que lembra título do edital (TJ-RS, TRF-5)", () => {
    const header = "TRIBUNAL DE JUSTIÇA | CONCURSO PÚBLICO 2026";
    const candidates = extractOfficialSyllabusCandidates(
      [
        `${header} 1\nANEXO II – CONTEÚDO PROGRAMÁTICO\nBLOCO UM\nLÍNGUA PORTUGUESA\n1. Ortografia.\nDIREITO CIVIL\n1. Das Provas.\n2. Dos bens. Dos bens`,
        `${header} 2\npúblicos.\nDIREITO AMBIENTAL\n1.Princípios do Direito Ambiental.\nA) SOCIOLOGIA DO DIREITO\n1. Sociologia jurídica.`,
        `${header} 3\nANEXO III - CRONOGRAMA PREVISTO\n1. Inscrições.`,
      ],
      [{ id: 50, name: "Direito Civil" }],
    );

    expect(candidates.map((item) => [item.suggestedSubjectName, item.requirementText])).toEqual([
      ["Direito Civil", "Das Provas."],
      ["Direito Civil", "Dos bens. Dos bens públicos."],
      ["DIREITO AMBIENTAL", "Princípios do Direito Ambiental."],
    ]);
  });
});
