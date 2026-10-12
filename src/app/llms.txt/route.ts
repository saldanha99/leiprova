import { BRAND_NAME } from "@/lib/brand";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Guia auxiliar para leitura; o catálogo público é a fonte da disponibilidade. */
export function GET() {
  const pages = [
    ["Início", "/"],
    ["Preparações e disponibilidade", "/concursos"],
    ["Calendário de concursos conferido em fontes oficiais", "/concursos/calendario"],
    ["Como memorizar lei seca", "/como-memorizar-lei-seca"],
    ["Fontes, questões e atualização", "/fontes-e-atualizacao"],
    ["Metodologia", "/metodologia"],
    ["Demonstração pública", "/demo"],
    ["Termos de uso", "/termos"],
    ["Privacidade", "/privacidade"],
    ["Reembolso", "/reembolso"],
  ];
  const content = [
    `# ${BRAND_NAME}`,
    "",
    `> ${BRAND_NAME} é uma plataforma educacional brasileira de treino ativo da literalidade de normas para concursos públicos, com questões originais, fontes oficiais e revisão espaçada.`,
    "",
    "## Páginas públicas",
    "",
    ...pages.map(([title, path]) => `- [${title}](${absoluteUrl(path)}).`),
    "",
    "## Como interpretar as preparações",
    "",
    "- A disponibilidade de uma preparação é informada no catálogo e na página do produto. A presença de um concurso no planejamento não comprova conteúdo pronto nem abertura de venda.",
    "- Situação do concurso, banca, cargo e edição são conferidos separadamente da disponibilidade comercial. Uma banca não determina automaticamente o perfil de todos os cargos.",
    "- Treino histórico e pré-edital devem ser identificados separadamente de uma preparação por edital vigente. Consulte o programa, a legislação e a edição indicados em cada produto.",
    "- Links de cadernos e gabaritos anteriores apontam para fontes oficiais quando disponíveis e conferidos. Reprodução comercial de questões de terceiros exige autorização ou licença documentada.",
    "",
    "## Fontes e política editorial",
    "",
    "- As normas têm fonte oficial, referência e versão. Consulte a data de verificação de cada item; a plataforma não substitui o Diário Oficial nem o edital.",
    "- As inéditas da fábrica autoral são assistidas por IA e passam pela linha de validação e liberação autorizada pelo proprietário. Essa aprovação automática não equivale a revisão humana independente de cada questão. Inconsistências podem levar à suspensão do item.",
    "- Referências externas, editais e licenças seguem seus próprios controles de conferência e aprovação. O material de outras plataformas não integra o acervo sem direito de uso.",
    "- Exemplos da demonstração têm escopo e origem próprios e não representam o inventário completo dos produtos.",
    "- O serviço é educacional, sem afiliação presumida com organizadoras ou promessa de aprovação.",
    "",
    "## Descoberta",
    "",
    `- [Sitemap](${absoluteUrl("/sitemap.xml")}) e [robots.txt](${absoluteUrl("/robots.txt")}).`,
    "- Este arquivo é um guia auxiliar experimental; não garante rastreamento, indexação, ranking ou citação em respostas de IA.",
    "",
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
