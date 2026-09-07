/**
 * Páginas públicas conferidas com agent-browser e robots em 07/09/2026.
 * Autoriza só pesquisa do Radar, não captura/aprovação de PDFs pelo coletor.
 * Caminhos e hosts são exatos: não liberar todo gov.br/jus.br ou subdomínios.
 */
export const COURSE_DISCOVERY_SOURCES = [
  {
    host: "www.tce.sp.gov.br",
    paths: ["/6524-tcesp-abre-concurso-publico-para-auditor-controle-externo-com-oferta-50-vagas"],
    descendants: [],
  },
  {
    host: "www.tjce.jus.br",
    paths: [
      "/institucional/concursos-selecoes/",
      "/noticias/tjce-altera-edital-do-concurso-publico-para-servidoras-e-servidores/",
      "/noticias/tribunal-de-justica-do-ceara-lanca-edital-de-concurso-com-44-vagas-para-cartorios/",
    ],
    descendants: [],
  },
  {
    host: "www.mpms.mp.br",
    paths: ["/concursos/49"],
    descendants: ["/concursos/49/andamentos/"],
  },
  {
    host: "www2.camara.leg.br",
    paths: [
      "/transparencia/recursos-humanos/concursos",
      "/transparencia/recursos-humanos/concursos/concurso-para-analista-e-tecnico",
      "/transparencia/recursos-humanos/concursos/concurso-para-policial-legislativo",
    ],
    descendants: [],
  },
] as const;

/** Sem consultas, escapes ou caminhos de autenticação/provas disfarçados. */
export function isVerifiedCourseDiscoveryUrl(input: string): boolean {
  try {
    if (input !== input.trim() || /[\\\s]/u.test(input)) return false;
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search ||
        url.pathname.includes("%")) return false;
    const source = COURSE_DISCOVERY_SOURCES.find(item => item.host === url.hostname);
    if (!source) return false;
    const path = url.pathname.replace(/\/$/u, "");
    if (source.paths.some(allowed => allowed.replace(/\/$/u, "") === path)) return true;
    // MPMS identifica cada andamento por número; não aceitar subpastas arbitrárias.
    return source.descendants.some(prefix => url.pathname.startsWith(prefix) &&
      /^\d+\/?$/u.test(url.pathname.slice(prefix.length)));
  } catch { return false; }
}
