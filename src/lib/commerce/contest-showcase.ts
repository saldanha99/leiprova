import { preparationModeLabels, type PreparationMode } from "./preparation-mode";
import { CONTEST_CATALOG, catalogContestPath } from "./catalog";
import { contestCalendarPhase, daysUntil, isTerminalLifecycleStatus, type CalendarDates } from "../opportunities/calendar";
import { saoPauloCalendarDate } from "../opportunities/catalog-policy";
import { getOpportunityJurisdictionByCode } from "../opportunities/jurisdictions";

export type ShowcaseOpportunity = CalendarDates & {
  publicId: string;
  slug: string;
  productSlug: string | null;
  categorySlug: string;
  institutionAcronym: string;
  roleName: string;
  cycleYear: number;
  jurisdictionCode: string;
  bankSlug: string | null;
  bankName: string | null;
  publishedAt: Date | string | null;
};

export type ShowcasePhase = "open" | "upcoming" | "forecast" | "closed" | "planning";
export type ShowcaseCard = {
  slug: string;
  acronym: string;
  role: string;
  edition: string;
  categorySlug: string;
  jurisdictionCodes: string[];
  bankSlug: string | null;
  bankName: string | null;
  phase: ShowcasePhase;
  phaseLabel: string;
  isNew: boolean;
  available: boolean;
  href: string;
  examDate: string | null;
  preparationMode?: PreparationMode;
  preparationLabel?: string;
};

const labels: Record<ShowcasePhase, string> = {
  open: "Inscrições abertas",
  upcoming: "Edital publicado",
  forecast: "Pré-edital confirmado",
  closed: "Encerrado",
  planning: "Em planejamento",
};

export function buildContestShowcase(
  opportunities: readonly ShowcaseOpportunity[],
  releasedSlugs: readonly string[],
  todayIso: string,
  releasedModes: Readonly<Record<string, PreparationMode>> = {},
): ShowcaseCard[] {
  const released = new Set(releasedSlugs);
  const eligible = opportunities.filter((item) => contestCalendarPhase(item, todayIso));
  const byProduct = new Map(eligible.filter((item) => item.productSlug).map((item) => [item.productSlug, item]));

  function evidence(item: ShowcaseOpportunity | undefined) {
    const calendarPhase = item ? contestCalendarPhase(item, todayIso) : null;
    const phase: ShowcasePhase = calendarPhase === "registration_open" ? "open"
      : calendarPhase === "forecast" ? "forecast"
      : calendarPhase === "closed" ? "closed"
      : calendarPhase ? "upcoming" : "planning";
    const publication = item?.publishedAt ? saoPauloCalendarDate(new Date(item.publishedAt)) : null;
    const age = publication ? daysUntil(publication, todayIso) : null;
    // Novo significa publicação oficial revisada nos últimos 30 dias, nunca
    // uma hipótese de mercado, atualização do registro ou material disponível.
    const isNew = phase !== "closed" && age !== null && age >= 0 && age <= 30;
    const held = item && (["exam_held", "result_published", "homologated"].includes(item.lifecycleStatus)
      || (!isTerminalLifecycleStatus(item.lifecycleStatus) && item.examDate && item.examDate < todayIso));
    return {
      phase, phaseLabel: phase === "closed" && held ? "Prova realizada" : labels[phase],
      isNew, bankSlug: item?.bankSlug ?? null, bankName: item?.bankName ?? null,
      examDate: item?.examDate ?? null,
    };
  }

  const cards: ShowcaseCard[] = CONTEST_CATALOG.map((contest) => {
    const item = byProduct.get(contest.slug);
    const facts = evidence(item);
    const preparationMode = releasedModes[contest.slug] ?? "current_notice";
    const referenceBased = preparationMode !== "current_notice" && released.has(contest.slug);
    return {
      slug: contest.slug, acronym: contest.acronym, role: contest.role,
      edition: contest.editionLabel, categorySlug: contest.categorySlug,
      jurisdictionCodes: [...contest.jurisdictionCodes], ...facts,
      preparationMode, preparationLabel: preparationModeLabels[preparationMode],
      ...(referenceBased ? {
        phase: preparationMode === "historical_training" ? "closed" as const : "planning" as const,
        phaseLabel: preparationMode === "historical_training" ? "Prova realizada" : "Pré-edital · programa de referência",
        isNew: false,
      } : {}),
      available: referenceBased || (facts.phase !== "closed" && released.has(contest.slug)),
      href: !referenceBased && facts.phase === "closed" ? "/concursos/calendario#calendario-closed" : catalogContestPath(contest),
    };
  });
  for (const item of eligible) {
    if (item.productSlug && CONTEST_CATALOG.some((contest) => contest.slug === item.productSlug)) continue;
    const jurisdiction = getOpportunityJurisdictionByCode(item.jurisdictionCode);
    if (!jurisdiction) continue;
    const facts = evidence(item);
    cards.push({
      slug: item.publicId, acronym: item.institutionAcronym, role: item.roleName,
      edition: String(item.cycleYear), categorySlug: item.categorySlug,
      jurisdictionCodes: [item.jurisdictionCode], ...facts, available: false,
      href: facts.phase === "closed" ? "/concursos/calendario#calendario-closed"
        : `/concursos/${item.categorySlug}/${jurisdiction.slug}/${item.slug}`,
    });
  }
  return cards.sort((a, b) => Number(b.available) - Number(a.available)
    || Number(b.isNew) - Number(a.isNew)
    || Number(a.phase === "closed") - Number(b.phase === "closed")
    || a.acronym.localeCompare(b.acronym, "pt-BR"));
}
