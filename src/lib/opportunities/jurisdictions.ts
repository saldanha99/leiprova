export const opportunityJurisdictions = [
  { code: "BR", name: "Brasil", slug: "brasil" },
  { code: "AC", name: "Acre", slug: "acre" },
  { code: "AL", name: "Alagoas", slug: "alagoas" },
  { code: "AP", name: "Amapá", slug: "amapa" },
  { code: "AM", name: "Amazonas", slug: "amazonas" },
  { code: "BA", name: "Bahia", slug: "bahia" },
  { code: "CE", name: "Ceará", slug: "ceara" },
  { code: "DF", name: "Distrito Federal", slug: "distrito-federal" },
  { code: "ES", name: "Espírito Santo", slug: "espirito-santo" },
  { code: "GO", name: "Goiás", slug: "goias" },
  { code: "MA", name: "Maranhão", slug: "maranhao" },
  { code: "MT", name: "Mato Grosso", slug: "mato-grosso" },
  { code: "MS", name: "Mato Grosso do Sul", slug: "mato-grosso-do-sul" },
  { code: "MG", name: "Minas Gerais", slug: "minas-gerais" },
  { code: "PA", name: "Pará", slug: "para" },
  { code: "PB", name: "Paraíba", slug: "paraiba" },
  { code: "PR", name: "Paraná", slug: "parana" },
  { code: "PE", name: "Pernambuco", slug: "pernambuco" },
  { code: "PI", name: "Piauí", slug: "piaui" },
  { code: "RJ", name: "Rio de Janeiro", slug: "rio-de-janeiro" },
  { code: "RN", name: "Rio Grande do Norte", slug: "rio-grande-do-norte" },
  { code: "RS", name: "Rio Grande do Sul", slug: "rio-grande-do-sul" },
  { code: "RO", name: "Rondônia", slug: "rondonia" },
  { code: "RR", name: "Roraima", slug: "roraima" },
  { code: "SC", name: "Santa Catarina", slug: "santa-catarina" },
  { code: "SP", name: "São Paulo", slug: "sao-paulo" },
  { code: "SE", name: "Sergipe", slug: "sergipe" },
  { code: "TO", name: "Tocantins", slug: "tocantins" },
] as const;

export type OpportunityJurisdiction = (typeof opportunityJurisdictions)[number];

export function getOpportunityJurisdictionBySlug(slug: string) {
  return opportunityJurisdictions.find((jurisdiction) => jurisdiction.slug === slug);
}

export function getOpportunityJurisdictionByCode(code: string) {
  return opportunityJurisdictions.find((jurisdiction) => jurisdiction.code === code);
}
