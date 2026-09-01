import { quizCareerTracks } from "@/lib/quiz/catalog";
import { opportunityJurisdictions } from "@/lib/opportunities/jurisdictions";

export const brazilianFederativeUnits = opportunityJurisdictions.filter(
  (jurisdiction) => jurisdiction.code !== "BR",
);

export const seoGeoEditorialIntents = [
  {
    slug: "como-estudar-edital-vigente",
    name: "Plano de estudo após edital",
    journeyStage: "decision",
  },
  {
    slug: "leis-artigos-prioritarios",
    name: "Priorização de lei seca por edição",
    journeyStage: "decision",
  },
] as const;

type FederativeUnit = (typeof brazilianFederativeUnits)[number];
type CareerTrack = (typeof quizCareerTracks)[number];
type EditorialIntent = (typeof seoGeoEditorialIntents)[number];

export type SeoGeoEditorialBrief = Readonly<{
  id: string;
  slug: string;
  title: string;
  question: string;
  intent: Readonly<{
    slug: EditorialIntent["slug"];
    name: EditorialIntent["name"];
    journeyStage: EditorialIntent["journeyStage"];
    primaryQuery: string;
  }>;
  career: Readonly<{
    slug: CareerTrack["slug"];
    name: CareerTrack["name"];
    shortName: CareerTrack["shortName"];
  }>;
  uf: Readonly<{
    code: FederativeUnit["code"];
    name: FederativeUnit["name"];
    slug: FederativeUnit["slug"];
  }>;
  officialEvidenceRequirements: readonly string[];
  responsibleByEditionRequirement: Readonly<{
    required: true;
    scope: "edition";
    rule: string;
    acceptedEvidence: readonly string[];
    rejectionRule: string;
  }>;
  analysisRequirements: readonly string[];
  status: "planned";
  indexable: false;
  publicationStatus: "unpublished";
  blockingReason: string;
}>;

type BriefCopy = Readonly<{
  slugPrefix: string;
  title: string;
  question: string;
}>;

function buildBriefCopy(
  intent: EditorialIntent,
  career: CareerTrack,
  uf: FederativeUnit,
): BriefCopy {
  if (intent.slug === "como-estudar-edital-vigente") {
    const question = `Como estudar para ${career.name} em ${uf.name} com base no edital vigente?`;

    return {
      slugPrefix: "como-estudar-para",
      title: `Como estudar para ${career.name} em ${uf.name} após a publicação do edital`,
      question,
    };
  }

  const question = `Quais leis e artigos priorizar para ${career.name} em ${uf.name} segundo o edital e o perfil da edição?`;

  return {
    slugPrefix: "leis-e-artigos-prioritarios-para",
    title: `Leis e artigos prioritários para ${career.name} em ${uf.name}`,
    question,
  };
}

function buildOfficialEvidenceRequirements(career: CareerTrack, uf: FederativeUnit) {
  return Object.freeze([
    `Fonte oficial do órgão ou diário oficial que comprove uma edição atual de ${career.name} em ${uf.name}, com situação e datas verificáveis.`,
    `Edital oficial completo da edição, seus anexos de conteúdo programático e todas as retificações aplicáveis a ${career.name} em ${uf.code}.`,
    "Ato oficial que identifique o responsável primário da mesma edição — banca externa, comissão institucional ou arranjo híbrido — sem inferência baseada em concursos anteriores.",
    "Texto legal consolidado em fonte pública oficial para cada lei e artigo citado no conteúdo.",
    "Registro da data de consulta, URL canônica, órgão emissor e revisão humana de cada evidência utilizada.",
  ]);
}

function buildResponsibleByEditionRequirement(career: CareerTrack, uf: FederativeUnit) {
  return Object.freeze({
    required: true as const,
    scope: "edition" as const,
    rule: `Vincular um único responsável primário vigente à edição confirmada de ${career.name} em ${uf.code}, usando documento oficial específico daquela edição.`,
    acceptedEvidence: Object.freeze([
      "Edital oficial que nomeie expressamente a organizadora ou comissão responsável.",
      "Contrato, extrato de contratação, dispensa, portaria de comissão ou outro ato administrativo oficial da edição.",
      "Página oficial do órgão ou da organizadora que identifique inequivocamente órgão, cargo, UF, edição e papel desempenhado.",
    ]),
    rejectionRule:
      "Não herdar banca, comissão ou responsável por carreira, UF, ano ou histórico; não aceitar anúncio, cursinho, agregador ou concorrente como prova da edição.",
  });
}

function buildAnalysisRequirements(career: CareerTrack, uf: FederativeUnit) {
  return Object.freeze([
    `Delimitar cargo, edição, UF, período e disciplinas analisadas para ${career.name} em ${uf.name}.`,
    "Usar somente provas oficiais ou corpus com licença escrita e procedência registrada; nunca copiar questões de terceiros sem autorização.",
    "Publicar amostra, janela temporal, contagens, denominadores, critérios de classificação e limitações da análise.",
    "Distinguir frequência histórica, tendência e estimativa; não apresentar probabilidade como certeza de cobrança.",
    "Submeter conteúdo jurídico, estatística e recomendações a revisão humana antes de qualquer publicação.",
  ]);
}

function buildEditorialBrief(
  intent: EditorialIntent,
  career: CareerTrack,
  uf: FederativeUnit,
): SeoGeoEditorialBrief {
  const copy = buildBriefCopy(intent, career, uf);

  return Object.freeze({
    id: `seo-geo:${intent.slug}:${career.slug}:${uf.code.toLowerCase()}`,
    slug: `${copy.slugPrefix}-${career.slug}-${uf.slug}`,
    title: copy.title,
    question: copy.question,
    intent: Object.freeze({
      slug: intent.slug,
      name: intent.name,
      journeyStage: intent.journeyStage,
      primaryQuery: copy.question,
    }),
    career: Object.freeze({
      slug: career.slug,
      name: career.name,
      shortName: career.shortName,
    }),
    uf: Object.freeze({
      code: uf.code,
      name: uf.name,
      slug: uf.slug,
    }),
    officialEvidenceRequirements: buildOfficialEvidenceRequirements(career, uf),
    responsibleByEditionRequirement: buildResponsibleByEditionRequirement(career, uf),
    analysisRequirements: buildAnalysisRequirements(career, uf),
    status: "planned",
    indexable: false,
    publicationStatus: "unpublished",
    blockingReason:
      "Bloqueada até confirmar a edição vigente, o responsável daquela edição, o programa oficial e os textos legais consolidados, com análise metodológica e revisão humana registradas.",
  });
}

/**
 * Fila interna de pautas. Estes itens não são páginas, não integram rotas ou sitemap
 * e permanecem deliberadamente não indexáveis até cumprir todas as travas editoriais.
 */
export const seoGeoEditorialBriefs: readonly SeoGeoEditorialBrief[] = Object.freeze(
  brazilianFederativeUnits.flatMap((uf) =>
    quizCareerTracks.flatMap((career) =>
      seoGeoEditorialIntents.map((intent) => buildEditorialBrief(intent, career, uf)),
    ),
  ),
);
