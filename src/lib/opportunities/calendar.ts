import {
  PRE_NOTICE_REFRESH_MAX_DAYS,
  shiftIsoCalendarDate,
} from "./catalog-policy";

/** Encerrados aparecem por um ano depois da prova. */
export const CALENDAR_CLOSED_WINDOW_DAYS = 365;

export type ContestCalendarPhase =
  | "registration_open"
  | "registration_soon"
  | "exam_upcoming"
  | "forecast"
  | "closed";

export const CONTEST_CALENDAR_SECTIONS: ReadonlyArray<
  Readonly<{ phase: ContestCalendarPhase; title: string; description: string }>
> = [
  {
    phase: "registration_open",
    title: "Inscrições abertas",
    description: "Editais com inscrição em andamento, do prazo mais curto ao mais longo.",
  },
  {
    phase: "registration_soon",
    title: "Inscrições em breve",
    description: "Edital publicado, com inscrições ainda por abrir.",
  },
  {
    phase: "exam_upcoming",
    title: "Provas marcadas",
    description: "Inscrições encerradas e prova confirmada no cronograma oficial.",
  },
  {
    phase: "forecast",
    title: "Previstos",
    description: "Concurso autorizado ou com pré-edital, ainda sem edital publicado.",
  },
  {
    phase: "closed",
    title: "Encerrados",
    description: "Provas já realizadas nos últimos doze meses.",
  },
];

const TERMINAL_STATUSES = new Set([
  "exam_held",
  "result_published",
  "homologated",
  "closed",
  "suspended",
  "canceled",
]);

export function isTerminalLifecycleStatus(lifecycleStatus: string) {
  return TERMINAL_STATUSES.has(lifecycleStatus);
}

const FORECAST_STATUSES = new Set([
  "authorized",
  "commission_formed",
  "organizer_selected",
  "pre_notice",
]);

export type CalendarDates = Readonly<{
  lifecycleStatus: string;
  statusAsOf: string;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  examDate: string | null;
}>;

/** Seção decidida pelas datas oficiais revisadas, não só pela fase gravada:
 * prova passada é encerrado mesmo antes de o worker avançar a fase. */
export function contestCalendarPhase(
  item: CalendarDates,
  todayIso: string,
): ContestCalendarPhase | null {
  if (
    TERMINAL_STATUSES.has(item.lifecycleStatus) ||
    (item.examDate && item.examDate < todayIso)
  ) {
    const cutoff = shiftIsoCalendarDate(todayIso, -CALENDAR_CLOSED_WINDOW_DAYS);
    return item.examDate && item.examDate < cutoff ? null : "closed";
  }
  if (FORECAST_STATUSES.has(item.lifecycleStatus)) {
    // Previsão antiga sem nova conferência sai do calendário, como no catálogo.
    return item.statusAsOf >=
      shiftIsoCalendarDate(todayIso, -PRE_NOTICE_REFRESH_MAX_DAYS)
      ? "forecast"
      : null;
  }
  if (item.registrationStartsAt && item.registrationStartsAt > todayIso) {
    return "registration_soon";
  }
  if (
    item.lifecycleStatus !== "registration_closed" &&
    item.registrationEndsAt &&
    item.registrationEndsAt >= todayIso
  ) {
    return "registration_open";
  }
  if (item.examDate) return "exam_upcoming";
  // Edital publicado ainda sem cronograma de inscrição ou prova.
  return item.lifecycleStatus === "notice_published" ? "registration_soon" : null;
}

function byDate(
  pick: (item: CalendarDates) => string | null,
  direction: 1 | -1,
) {
  return (left: CalendarDates, right: CalendarDates) => {
    const a = pick(left);
    const b = pick(right);
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -direction : direction;
  };
}

const SECTION_ORDER: Record<
  ContestCalendarPhase,
  (left: CalendarDates, right: CalendarDates) => number
> = {
  registration_open: byDate((item) => item.registrationEndsAt, 1),
  registration_soon: byDate((item) => item.registrationStartsAt, 1),
  exam_upcoming: byDate((item) => item.examDate, 1),
  forecast: byDate((item) => item.statusAsOf, -1),
  closed: byDate((item) => item.examDate, -1),
};

/** Agrupa na ordem das seções; seções vazias ficam de fora. */
export function groupContestCalendar<T extends CalendarDates>(
  items: readonly T[],
  todayIso: string,
) {
  const grouped = new Map<ContestCalendarPhase, T[]>();
  for (const item of items) {
    const phase = contestCalendarPhase(item, todayIso);
    if (!phase) continue;
    grouped.set(phase, [...(grouped.get(phase) ?? []), item]);
  }
  return CONTEST_CALENDAR_SECTIONS.flatMap((section) => {
    const sectionItems = grouped.get(section.phase);
    if (!sectionItems?.length) return [];
    return [{ ...section, items: [...sectionItems].sort(SECTION_ORDER[section.phase]) }];
  });
}

/** Dias corridos entre duas datas ISO (America/Sao_Paulo já aplicada). */
export function daysUntil(todayIso: string, targetIso: string) {
  const start = Date.parse(`${todayIso}T12:00:00.000Z`);
  const end = Date.parse(`${targetIso}T12:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}
