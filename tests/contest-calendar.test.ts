import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  contestCalendarPhase,
  daysUntil,
  groupContestCalendar,
} from "@/lib/opportunities/calendar";

const page = readFileSync(
  new URL("../src/app/concursos/calendario/page.tsx", import.meta.url),
  "utf8",
);

const today = "2026-09-28";
const base = {
  lifecycleStatus: "registration_open",
  statusAsOf: "2026-09-28",
  registrationStartsAt: "2026-09-01",
  registrationEndsAt: "2026-10-14",
  examDate: "2026-12-13",
};

describe("seções do calendário de concursos", () => {
  it("separa inscrições abertas, em breve e provas marcadas pelas datas", () => {
    expect(contestCalendarPhase(base, today)).toBe("registration_open");
    expect(contestCalendarPhase({ ...base, lifecycleStatus: "notice_published", registrationStartsAt: "2026-10-05" }, today)).toBe("registration_soon");
    // Inscrição vencida ainda gravada como aberta já aparece como prova marcada.
    expect(contestCalendarPhase({ ...base, registrationEndsAt: "2026-09-24" }, today)).toBe("exam_upcoming");
    expect(contestCalendarPhase({ ...base, lifecycleStatus: "registration_closed" }, today)).toBe("exam_upcoming");
  });

  it("marca como encerrado pela data da prova, antes mesmo do avanço de fase", () => {
    // PGM Manaus 2026: prova em 20/09, fase gravada ainda "inscrições encerradas".
    expect(contestCalendarPhase({ ...base, lifecycleStatus: "registration_closed", examDate: "2026-09-20" }, today)).toBe("closed");
    expect(contestCalendarPhase({ ...base, lifecycleStatus: "exam_held", examDate: null }, today)).toBe("closed");
    expect(contestCalendarPhase({ ...base, lifecycleStatus: "exam_held", examDate: "2025-09-27" }, today)).toBeNull();
  });

  it("mostra previsões recentes e esconde as antigas", () => {
    const forecast = { ...base, lifecycleStatus: "pre_notice", registrationStartsAt: null, registrationEndsAt: null, examDate: null };
    expect(contestCalendarPhase({ ...forecast, statusAsOf: "2026-08-31" }, today)).toBe("forecast");
    expect(contestCalendarPhase({ ...forecast, statusAsOf: "2026-03-01" }, today)).toBeNull();
  });

  it("ordena cada seção pela data que importa ao aluno", () => {
    const sections = groupContestCalendar(
      [
        { ...base, id: "tj-rs", registrationEndsAt: "2026-10-14" },
        { ...base, id: "sefaz-al", registrationEndsAt: "2026-10-21" },
        { ...base, id: "trf-5", registrationEndsAt: today },
        { ...base, id: "pc-pr", lifecycleStatus: "registration_closed", examDate: "2026-10-11" },
        { ...base, id: "pc-ma", lifecycleStatus: "registration_closed", examDate: "2026-11-01" },
        { ...base, id: "pgm", lifecycleStatus: "registration_closed", examDate: "2026-09-20" },
      ],
      today,
    );

    expect(sections.map((section) => [section.phase, section.items.map((item) => item.id)])).toEqual([
      ["registration_open", ["trf-5", "tj-rs", "sefaz-al"]],
      ["exam_upcoming", ["pc-pr", "pc-ma"]],
      ["closed", ["pgm"]],
    ]);
    expect(daysUntil(today, "2026-10-11")).toBe(13);
  });

  it("aponta a fonte oficial em nova aba e só oferece o concurso quando ativo", () => {
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain("contest && !closed");
    expect(page).toContain('export const dynamic = "force-dynamic"');
  });
});
