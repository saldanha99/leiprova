export const BRAND_NAME = "Edital Lei Seca";
export const BRAND_TAGLINE = "Lei seca guiada pelo edital";

// Atualiza só o nome de exibição legado; domínio e endereço de envio não mudam.
export function normalizeBrandEmailSender(from: string): string {
  const addressStart = from.indexOf("<");
  if (addressStart === -1) return from;

  const displayName = from.slice(0, addressStart).replace(
    /^(\s*"?)(?:Lei\s*Prova|Editalume)(?=\s|"|$)/i,
    `$1${BRAND_NAME}`,
  );

  return `${displayName}${from.slice(addressStart)}`;
}
