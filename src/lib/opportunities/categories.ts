export type ContestCategory = Readonly<{
  slug: string;
  name: string;
  description: string;
  careerSlugs: readonly string[];
}>;

/**
 * Categorias comerciais e editoriais. Elas agrupam carreiras, mas nunca definem
 * uma banca: o responsável pertence à edição oficial da oportunidade.
 */
export const contestCategories = [
  {
    slug: "cartorios",
    name: "Cartórios",
    description: "ENAC e concursos estaduais de serventias extrajudiciais.",
    careerSlugs: ["cartorios"],
  },
  {
    slug: "carreiras-juridicas",
    name: "Carreiras Jurídicas",
    description: "Magistratura, Ministério Público, Defensorias e Exame de Ordem.",
    careerSlugs: ["magistratura", "promotor-justica", "defensor-publico", "oab"],
  },
  {
    slug: "carreiras-policiais",
    name: "Carreiras Policiais",
    description: "Polícias civis, federal, rodoviária federal e penal.",
    careerSlugs: [
      "delegado",
      "policia-civil",
      "policia-federal",
      "policia-penal",
      "policia-rodoviaria-federal",
      "escrivao-policia-civil",
    ],
  },
  {
    slug: "tribunais",
    name: "Tribunais",
    description: "Analistas, técnicos e oficiais de Justiça dos diversos ramos.",
    careerSlugs: ["analista", "analista-juridico", "tecnico-judiciario", "oficial-justica"],
  },
  {
    slug: "procuradorias",
    name: "Procuradorias",
    description: "Advocacia pública federal, estadual e municipal.",
    careerSlugs: ["procurador"],
  },
  {
    slug: "fiscal-e-controle",
    name: "Fiscal e Controle",
    description: "Administrações tributárias, Tribunais de Contas e controladorias.",
    careerSlugs: ["auditor-fiscal", "controle-externo"],
  },
  {
    slug: "area-legislativa",
    name: "Área Legislativa",
    description: "Carreiras jurídicas e técnicas de casas legislativas.",
    careerSlugs: ["area-legislativa"],
  },
  {
    slug: "trabalhistas",
    name: "Trabalhistas",
    description: "Magistratura do Trabalho, MPT e Tribunais Regionais do Trabalho.",
    careerSlugs: ["magistratura", "analista", "tecnico-judiciario", "oficial-justica"],
  },
] as const satisfies readonly ContestCategory[];

export function getContestCategory(slug: string) {
  return contestCategories.find((category) => category.slug === slug);
}
