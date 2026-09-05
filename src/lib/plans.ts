export type PlanSlug = "ritmo" | "foco";

export const RETIRED_PLAN_SLUGS = ["fundador"] as const;

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  eyebrow: string;
  priceCents: number;
  billingLabel: string;
  billingMonths: 1 | 12;
  stripePriceEnv: string;
  featured?: boolean;
  features: string[];
};

export const PLANS: readonly PlanDefinition[] = [
  {
    slug: "ritmo",
    name: "Master Mensal",
    eyebrow: "Comece sem compromisso longo",
    priceCents: 29700,
    billingLabel: "/mês",
    billingMonths: 1,
    stripePriceEnv: "STRIPE_PRICE_RITMO",
    features: [
      "Concursos liberados durante a assinatura",
      "Treinos ilimitados de literalidade",
      "Fila de revisão espaçada",
      "Biblioteca de leis e progresso",
      "Ranking e metas semanais",
    ],
  },
  {
    slug: "foco",
    name: "Master Anual",
    eyebrow: "O melhor equilíbrio para o ciclo de estudos",
    priceCents: 89700,
    billingLabel: "/ano",
    billingMonths: 12,
    stripePriceEnv: "STRIPE_PRICE_FOCO",
    featured: true,
    features: [
      "Tudo do Master Mensal",
      "Raio-X por banca e carreira",
      "Cronogramas e desafios guiados",
      "Cadernos, flashcards e simulados",
      "12 meses de atualizações",
    ],
  },
] as const;

export function getPlan(slug: string | null | undefined) {
  return PLANS.find((plan) => plan.slug === slug) ?? null;
}

export function getMonthlyEquivalentCents(plan: PlanDefinition) {
  return Math.round(plan.priceCents / plan.billingMonths);
}

export function getPlanDiscountPercentage(
  plan: PlanDefinition,
  comparisonPlan: PlanDefinition,
) {
  const planMonthlyEquivalent = getMonthlyEquivalentCents(plan);
  const comparisonMonthlyEquivalent = getMonthlyEquivalentCents(comparisonPlan);

  return Math.max(
    0,
    Math.round((1 - planMonthlyEquivalent / comparisonMonthlyEquivalent) * 100),
  );
}

export function getAnnualDiscountPercentage() {
  const annualPlan = getPlan("foco");
  const monthlyPlan = getPlan("ritmo");

  if (!annualPlan || !monthlyPlan) return 0;

  return getPlanDiscountPercentage(annualPlan, monthlyPlan);
}

export function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
