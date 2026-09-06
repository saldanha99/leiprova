/** Cobertura verificada em 06/09/2026. Bloqueios exigem nova verificação, não contorno. */
export function discoveryPortalPolicy(bank: string, configuredUrl: string) {
  if (bank === "vunesp") return {
    urls: [configuredUrl], blocked: "portal_access_denied",
    limitation: "Portal VUNESP bloqueou o acesso automatizado. Buscar fonte do órgão contratante após validação; não contornar Akamai/CAPTCHA.",
  };
  if (bank === "fcc") return {
    urls: ["https://www.concursosfcc.com.br/concursoNovo.html", "https://www.concursosfcc.com.br/concursoInscricaoAberta.html"],
    blocked: null,
    limitation: "FCC: somente índices públicos na raiz. Robots proíbe /concursos/, /rss/ e PDFs. Não seguir esses caminhos; obter o documento em fonte oficial do órgão após validação.",
  };
  return { urls: [configuredUrl], blocked: null,
    limitation: "Respeitar robots e bloqueios. FGV: não usar /search/. Não acessar provas, cadernos ou gabaritos." };
}

export function discoveryPathBlocked(input: string) {
  const url = new URL(input);
  return (url.hostname.endsWith("concursosfcc.com.br") &&
    (/^\/(concursos|rss)(\/|$)/i.test(url.pathname) || /\.pdf$/i.test(url.pathname))) ||
    (url.hostname === "conhecimento.fgv.br" && /^\/search(\/|$)/i.test(url.pathname));
}
