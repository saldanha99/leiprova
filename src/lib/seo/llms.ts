import { BRAND_NAME } from "@/lib/brand";
import { absoluteUrl } from "@/lib/seo";

/**
 * /llms.txt and /llms-full.txt (spec 4.2). Pure builders: facts about the
 * service, hubs, main laws and guides. Never the literal law text, never
 * question text and never links to competitors (planning-catalog sourceUrl).
 */

export const LLMS_MAX_BYTES = 30 * 1024;
export const LLMS_FULL_MAX_BYTES = 500 * 1024;
export const LLMS_MAIN_LAWS = 30;
export const FORBIDDEN_LINK_PATTERNS = [/decorandoaleiseca/i];

export type LlmsArticle = Readonly<{ label: string; heading: string | null; path: string; questions: number; directAnswer: string | null }>;

export type LlmsLaw = Readonly<{
  label: string;
  title: string;
  shortTitle: string;
  path: string;
  officialUrl: string;
  verifiedAt: Date;
  reviewedQuestions: number;
  topArticles: readonly LlmsArticle[];
}>;

const lawName = (law: LlmsLaw) => (law.label === law.shortTitle ? law.label : `${law.label} — ${law.shortTitle}`);

const brDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

const FACTS = [
  `- O ${BRAND_NAME} é uma plataforma educacional brasileira de treino ativo da literalidade de normas (lei seca) para concursos públicos e OAB.`,
  "- Público: candidatos que estudam a legislação cobrada nos editais; cada preparação parte do programa oficial do concurso.",
  "- Questões: inéditas autorais, produzidas com auxílio de IA a partir do texto oficial da norma e de perfis abstratos de estilo de banca. São liberadas por uma linha automática de validação autorizada pelo proprietário; essa aprovação não equivale a revisão humana independente de cada questão. Itens com erro são suspensos.",
  "- O rótulo \"no estilo\" de uma banca não indica afiliação nem autoria da banca. Questões de provas anteriores só entram com licença documentada.",
  "- Normas: texto oficial (Planalto, Senado ou Câmara), com versão e data de verificação registradas. O serviço não substitui o Diário Oficial nem o edital.",
  "- Sem afiliação com bancas organizadoras ou órgãos públicos e sem promessa de aprovação.",
  `- Preços e condições: somente na página oficial de cada preparação em ${absoluteUrl("/concursos")}.`,
  "- Autoria: Equipe editorial Edital Lei Seca. Não há pessoa física apresentada como autora das questões.",
];

const LAW_HUB = ["Leis e artigos com questões resolvidas", "/leis"] as const;
const HUBS: readonly (readonly [string, string])[] = [
  ["Preparações por concurso", "/concursos"],
  ["Calendário de concursos conferido em fontes oficiais", "/concursos/calendario"],
];

const GUIDES: readonly (readonly [string, string])[] = [
  ["Como memorizar lei seca", "/como-memorizar-lei-seca"],
  ["Fontes, questões e atualização", "/fontes-e-atualizacao"],
  ["Metodologia", "/metodologia"],
  ["Demonstração pública", "/demo"],
];

function assertSafe(text: string, maxBytes: number): string {
  if (FORBIDDEN_LINK_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error("llms: conteúdo com link de concorrente bloqueado.");
  }
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error(`llms: acima de ${maxBytes} bytes.`);
  return text;
}

function header(generatedAt: Date): string[] {
  return [
    `# ${BRAND_NAME}`,
    "",
    `> ${BRAND_NAME} é uma plataforma educacional de treino ativo da literalidade de normas para concursos públicos, com questões inéditas, fontes oficiais e revisão espaçada.`,
    "",
    `Gerado em ${brDate(generatedAt)} a partir do banco do ${BRAND_NAME}.`,
    "",
    `## Fatos sobre o ${BRAND_NAME}`,
    "",
    ...FACTS,
    "",
    "## Como interpretar as preparações",
    "",
    "- A disponibilidade de uma preparação é informada no catálogo e na página do produto. A presença de um concurso no planejamento não comprova conteúdo pronto nem abertura de venda.",
    "- Situação do concurso, banca, cargo e edição são conferidos separadamente da disponibilidade comercial. Uma banca não determina automaticamente o perfil de todos os cargos.",
    "- Treino histórico e pré-edital são identificados separadamente de uma preparação por edital vigente. Consulte o programa, a legislação e a edição indicados em cada produto.",
    "",
  ];
}

const footer = () => [
  "## Descoberta",
  "",
  `- [Sitemap](${absoluteUrl("/sitemap.xml")}) e [robots.txt](${absoluteUrl("/robots.txt")}).`,
  `- Versão estendida: [llms-full.txt](${absoluteUrl("/llms-full.txt")}).`,
  "- Este arquivo é um guia auxiliar experimental; não garante rastreamento, indexação, ranking ou citação em respostas de IA.",
  "",
];

/** `laws` empty (wave off or no gate-passing law) also hides the law hub. */
export function buildLlmsTxt(laws: readonly LlmsLaw[], generatedAt: Date): string {
  const hubs = laws.length ? [LAW_HUB, ...HUBS] : HUBS;
  const lines = [
    ...header(generatedAt),
    "## Hubs",
    "",
    ...hubs.map(([title, path]) => `- [${title}](${absoluteUrl(path)})`),
    "",
    ...(laws.length
      ? [
          "## Leis principais",
          "",
          ...laws.slice(0, LLMS_MAIN_LAWS).map((law) => `- [${lawName(law)}](${absoluteUrl(law.path)}): ${law.reviewedQuestions} questões revisadas na base.`),
          "",
        ]
      : []),
    "## Guias",
    "",
    ...GUIDES.map(([title, path]) => `- [${title}](${absoluteUrl(path)})`),
    "",
    ...footer(),
  ];
  return assertSafe(lines.join("\n"), LLMS_MAX_BYTES);
}

export function buildLlmsFullTxt(laws: readonly LlmsLaw[], generatedAt: Date): string {
  const sections = laws.map((law) =>
    [
      `### ${lawName(law)}`,
      "",
      `- Norma: ${law.title}`,
      `- Situação: vigente na versão conferida em ${brDate(law.verifiedAt)}`,
      `- Página: ${absoluteUrl(law.path)}`,
      `- Texto oficial: ${law.officialUrl}`,
      `- Questões revisadas na base do ${BRAND_NAME}: ${law.reviewedQuestions}`,
      ...(law.topArticles.length
        ? [
            "- Artigos com mais questões na base:",
            ...law.topArticles.map(
              (article) =>
                `  - [${article.label}${article.heading ? ` — ${article.heading}` : ""}](${absoluteUrl(article.path)}): ${article.questions} questões.${article.directAnswer ? ` ${article.directAnswer}` : ""}`,
            ),
          ]
        : []),
      "",
    ].join("\n"),
  );
  const lines = [...header(generatedAt), "## Leis", "", ...sections, ...footer()];
  return assertSafe(lines.join("\n"), LLMS_FULL_MAX_BYTES);
}

export function textResponse(text: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
