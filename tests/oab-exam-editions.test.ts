import { describe, expect, it } from "vitest";

import { assertOabExamEditions, OAB_EXAM_EDITIONS } from "@/lib/exams/oab-exam-editions";
import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";

describe("edições do Exame de Ordem (FGV)", () => {
  it("aceita o portal oficial oab.fgv.br como fonte da FGV e recusa hosts parecidos", () => {
    expect(isOfficialExamUrl("fgv", "https://oab.fgv.br/home.aspx?key=650")).toBe(true);
    expect(isOfficialExamUrl("fgv", "https://oab.fgv.br.example.com/home.aspx")).toBe(false);
    expect(isOfficialExamUrl("vunesp", "https://oab.fgv.br/home.aspx?key=650")).toBe(false);
  });

  it("cadastra só edições já aplicadas, com identidade única e URL oficial", () => {
    expect(() => assertOabExamEditions(OAB_EXAM_EDITIONS, "2026-11-26")).not.toThrow();
    expect(OAB_EXAM_EDITIONS.map((item) => item.number)).toEqual([47, 46, 45, 44, 43]);
    expect(() => assertOabExamEditions(OAB_EXAM_EDITIONS, "2026-09-05")).toThrow(/ainda não aplicada/);
    expect(() => assertOabExamEditions([OAB_EXAM_EDITIONS[0], OAB_EXAM_EDITIONS[0]], "2026-11-26")).toThrow(/repetida/);
    expect(() => assertOabExamEditions([{ ...OAB_EXAM_EDITIONS[0], officialUrl: "https://oab.example.com/x" }], "2026-11-26"))
      .toThrow(/portal oficial/);
  });
});
