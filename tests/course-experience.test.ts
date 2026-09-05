import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { PlannedContestLanding } from "@/components/contests/planned-contest-landing";
import { CONTEST_CATALOG } from "@/lib/commerce/catalog";

describe("experiência editorial de cada curso", () => {
  it.each(CONTEST_CATALOG)(
    "mantém identidade, navegação e disponibilidade de $slug",
    (contest) => {
      const html = renderToStaticMarkup(
        createElement(PlannedContestLanding, {
          contest,
          commerceOpen: false,
          contactOpen: true,
        }),
      );
      const $ = load(html);
      expect($("h1")).toHaveLength(1);
      expect($("h1").text()).toContain(contest.acronym);
      expect($("h1").text()).toContain(contest.role);
      for (const id of [
        "beneficios",
        "por-dentro",
        "edicao",
        "planos",
        "duvidas",
      ])
        expect($(`[id="${id}"]`)).toHaveLength(1);
      for (const anchor of $("a[href^='#']").toArray()) {
        const id = $(anchor).attr("href")!.slice(1);
        expect($(`[id="${id}"]`)).toHaveLength(1);
      }
      expect($("article").first().attr("data-theme")).toMatch(
        /gold|blue|emerald/,
      );
      expect($("button[aria-label='Prévia em tablet']")).toHaveLength(1);
      expect($("[data-device='desktop']")).toHaveLength(1);
      expect($("details")).toHaveLength(7);
      const monthly = $("[data-contest-plan='monthly']");
      const annual = $("[data-contest-plan='annual']");
      expect(monthly).toHaveLength(1);
      expect(annual).toHaveLength(1);
      expect(monthly.text()).toContain("R$ 67,00/mês");
      expect(annual.text()).toContain("R$ 347,00/ano");
      expect(annual.text()).toContain("R$ 457,00");
      expect(annual.text()).toContain("≈57%");
      expect(annual.text()).toContain("R$ 28,92/mês");
      expect(annual.attr("class")).not.toBe(monthly.attr("class"));
      expect(monthly.text()).toContain("renovação mensal automática");
      expect(annual.text()).toContain("renovação anual automática");
      expect($("#planos").text()).not.toContain("6 meses");
      expect($("#planos").text()).not.toContain("R$ 87,00");
      expect($("a[href^='/checkout/']")).toHaveLength(0);
      expect(html).toContain("Em preparação editorial");
      expect(html).toContain("dados fictícios");
      expect(html).toContain("editorial-study-v2.webp");
      expect(html).not.toContain("study-ritual.webp");
      expect(html).not.toContain("310.000");
      expect(html).not.toContain("Fábio Roque");
    },
  );
});
