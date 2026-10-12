/** Origens de produção autorizadas pelo proprietário; recursos internos seguem leiprova. */
export const AUTHORIZED_PRODUCTION_ORIGINS = [
  "https://leiprova.2b.app.br",
  "https://editaleiseca.com.br",
] as const;

export function isAuthorizedProductionOrigin(origin: string | undefined): boolean {
  return AUTHORIZED_PRODUCTION_ORIGINS.some((authorized) => authorized === origin);
}

/** O alias www é redirecionado à origem canônica e também nunca aceita modo teste. */
export function isPublicProductionHostname(hostname: string): boolean {
  return ["leiprova.2b.app.br", "editaleiseca.com.br", "www.editaleiseca.com.br"].includes(hostname);
}
