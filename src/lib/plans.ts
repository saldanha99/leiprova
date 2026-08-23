export type PlanSlug = "ritmo" | "foco" | "fundador";

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  eyebrow: string;
  priceCents: number;
  billingLabel: string;
  equivalentMonthly?: string;
  stripePriceEnv: string;
  mode: "subscription" | "payment";
  featured?: boolean;
  features: string[];
};

export const PLANS: readonly PlanDefinition[] = [
  {
    slug: "ritmo",
    name: "Ritmo Mensal",
    eyebrow: "Comece sem compromisso longo",
    priceCents: 4990,
    billingLabel: "/mês",
    stripePriceEnv: "STRIPE_PRICE_RITMO",
    mode: "subscription",
    features: [
      "Treinos ilimitados de literalidade",
      "Fila de revisão espaçada",
      "Biblioteca de leis e progresso",
      "Ranking e metas semanais",
    ],
  },
  {
    slug: "foco",
    name: "Foco Anual",
    eyebrow: "O melhor equilíbrio para o ciclo de estudos",
    priceCents: 49700,
    billingLabel: "/ano",
    equivalentMonthly: "equivale a R$ 41,42/mês",
    stripePriceEnv: "STRIPE_PRICE_FOCO",
    mode: "subscription",
    featured: true,
    features: [
      "Tudo do plano Ritmo",
      "Raio-X por banca e carreira",
      "Cronogramas e desafios guiados",
      "Cadernos, flashcards e simulados",
      "12 meses de atualizações",
    ],
  },
  {
    slug: "fundador",
    name: "Fundador Vitalício",
    eyebrow: "Uma compra, acesso contínuo ao produto",
    priceCents: 89700,
    billingLabel: "pagamento único",
    stripePriceEnv: "STRIPE_PRICE_FUNDADOR",
    mode: "payment",
    features: [
      "Tudo do plano Foco",
      "Acesso vitalício ao acervo contratado",
      "Novos módulos essenciais incluídos",
      "Selo e canal de feedback de fundador",
      "Sem renovação automática",
    ],
  },
] as const;

export function getPlan(slug: string | null | undefined) {
  return PLANS.find((plan) => plan.slug === slug) ?? null;
}

export function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
