import planning from "./planning-catalog.json";
import { getOpportunityJurisdictionByCode } from "@/lib/opportunities/jurisdictions";

export type CatalogContest = (typeof planning)[number];
// Pesquisa de mercado, não confirmação de edital nem liberação editorial.
export const CONTEST_CATALOG: readonly CatalogContest[] = planning;
export const CONTEST_ACCESS_OPTIONS = [
  {
    key: "monthly",
    months: 1,
    interval: "month",
    amountCents: 6700,
    label: "Mensal",
    billingLabel: "/mês",
  },
  {
    key: "annual",
    months: 12,
    interval: "year",
    amountCents: 34700,
    label: "Anual",
    billingLabel: "/ano",
  },
] as const;
export type ContestAccessKey = (typeof CONTEST_ACCESS_OPTIONS)[number]["key"];

export const CONTEST_ANNUAL_COMPARISON = (() => {
  const monthlyYearCents = CONTEST_ACCESS_OPTIONS[0].amountCents * 12;
  const annualCents = CONTEST_ACCESS_OPTIONS[1].amountCents;
  return {
    monthlyYearCents,
    savingsCents: monthlyYearCents - annualCents,
    approximateDiscountPercent: Math.round(
      (1 - annualCents / monthlyYearCents) * 100,
    ),
    monthlyEquivalentCents: Math.round(annualCents / 12),
  };
})();

export function getCatalogContest(slug: string) {
  return CONTEST_CATALOG.find((contest) => contest.slug === slug) ?? null;
}

export function catalogContestPath(contest: CatalogContest) {
  // Regionais têm uma URL canônica única, mesmo aparecendo em vários estados.
  const jurisdiction = getOpportunityJurisdictionByCode(
    contest.jurisdictionCodes.length > 1 ? "BR" : contest.jurisdictionCodes[0],
  );
  return `/concursos/${contest.categorySlug}/${jurisdiction?.slug ?? "brasil"}/${contest.slug}`;
}

export function contestTitle(contest: CatalogContest) {
  return `${contest.acronym} — ${contest.role}`;
}

export function getContestAccessOption(key: string) {
  return CONTEST_ACCESS_OPTIONS.find((option) => option.key === key) ?? null;
}

export function contestPriceLookupKey(slug: string, key: ContestAccessKey) {
  const option = getContestAccessOption(key)!;
  return `leiprova_contest_${slug}_${key}_${option.amountCents}_recurring_v2`;
}

export function accessEndsAt(start: Date, months: number) {
  // Ajusta finais de mês (31/08 + 6 meses não pode avançar para março).
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}
