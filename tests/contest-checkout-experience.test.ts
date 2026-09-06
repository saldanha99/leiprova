import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { ContestCart } from "@/components/checkout/contest-cart";
import {
  CONTEST_CATALOG,
  contestTitle,
  type ContestAccessKey,
} from "@/lib/commerce/catalog";
import { PLANS } from "@/lib/plans";

function render(
  index = 0,
  access: ContestAccessKey = "monthly",
  available = false,
) {
  const contest = CONTEST_CATALOG[index];
  const related = CONTEST_CATALOG.filter(
    (item) =>
      item.categorySlug === contest.categorySlug && item.slug !== contest.slug,
  );
  return load(
    renderToStaticMarkup(
      createElement(ContestCart, {
        contest,
        related,
        initialAccess: access,
        available,
        supplierIdentity: createElement(
          "div",
          { "data-supplier-identity": true },
          "Fornecedor informado pelo servidor",
        ),
      }),
    ),
  );
}

describe("checkout editorial, explícito e personalizável", () => {
  it.each(
    CONTEST_CATALOG.map((contest, index) => ({ slug: contest.slug, index })),
  )(
    "oferece as duas assinaturas sem adicionais pré-selecionados em $slug",
    ({ index }) => {
      const $ = render(index);
      expect($("h1")).toHaveLength(1);
      expect($("#checkout-course-title").text()).toBe(
        contestTitle(CONTEST_CATALOG[index]),
      );
      expect($("input[type=radio]")).toHaveLength(2);
      expect($("input[type=radio][checked]").attr("value")).toBe("monthly");
      expect($("input[type=checkbox][checked]")).toHaveLength(0);
      expect($("input[type=checkbox]").length).toBeLessThanOrEqual(2);
      expect($("[data-checkout-total]").text()).toBe("R$ 67,00/mês");
      const monthly = $("[data-checkout-plan=monthly]");
      const annual = $("[data-checkout-plan=annual]");
      expect(monthly.attr("class")).not.toBe(annual.attr("class"));
      expect(annual.text()).toContain("R$ 347,00/ano");
      expect(annual.text()).toContain("R$ 457,00");
      expect(annual.text()).toContain("≈57%");
      expect(annual.text()).toContain("R$ 28,92/mês");
      expect(annual.text()).toContain("não parcelada");
      expect(
        $("button:contains('Compra ainda não disponível')[disabled]"),
      ).toHaveLength(1);
      expect($.text()).toContain("Nenhuma cobrança pode ser iniciada aqui");
      expect($.text()).toContain("sem sua escolha");
    },
  );

  it("respeita escolha anual inicial e oferece alternativa mensal sem desmarcar à força", () => {
    const $ = render(0, "annual");
    expect($("input[type=radio][checked]").attr("value")).toBe("annual");
    expect($("[data-checkout-total]").text()).toBe("R$ 347,00/ano");
    expect($("button:contains('Trocar para mensal')")).toHaveLength(1);
    expect($.text()).toContain(
      "Cobrança integral a cada ano. Não é parcelamento.",
    );
    expect($.text()).toContain("Renovação automática anual");
  });

  it("upgrade anual é uma escolha explícita e Master segue para contratação separada", () => {
    const $ = render();
    expect($("button:contains('Preferir o anual e economizar')")).toHaveLength(
      1,
    );
    for (const plan of PLANS) {
      const link = $(`a[href='/checkout/${plan.slug}']`);
      expect(link).toHaveLength(1);
      expect(link.text()).toContain(plan.name);
      expect(link.attr("aria-label")).toContain("Comparar");
    }
    expect($.text()).toContain("não é cobrado nem convertido automaticamente");
    expect($.text()).toContain(
      "Edições em preparação só entram quando forem liberadas",
    );
    expect($.text()).toContain("R$ 297,00/mês");
    expect($.text()).toContain("R$ 897,00/ano");
  });

  it("mostra fornecedor, atendimento, termos e limites reais da compra", () => {
    const $ = render();
    expect($("[data-supplier-identity]")).toHaveLength(1);
    for (const href of ["/termos", "/privacidade", "/contato"])
      expect($(`a[href='${href}']`).length).toBeGreaterThan(0);
    expect($("details")).toHaveLength(3);
    expect($.text()).toContain(
      "A Editalume não recebe os dados completos do seu cartão",
    );
    expect($.text()).toContain(
      "Não há promessa de aprovação ou cobertura integral do edital",
    );
    expect(
      $("input[name*=card], input[autocomplete*=cc-], iframe"),
    ).toHaveLength(0);
    expect($.text()).not.toMatch(
      /últimas vagas|oferta termina|garantia de aprovação|100% seguro/i,
    );
  });

  it("somente disponibilidade passada pelo servidor habilita o botão para a Stripe", () => {
    const $ = render(0, "monthly", true);
    expect(
      $("button:contains('Continuar para pagamento seguro')"),
    ).toHaveLength(1);
    expect(
      $("button:contains('Continuar para pagamento seguro')").attr("disabled"),
    ).toBeUndefined();
    expect($.text()).not.toContain("Prévia da oferta");
    expect($.text()).toContain("Na próxima etapa, confirme o valor");
  });

  it.each(["monthly", "annual"] as const)(
    "associa preço, periodicidade e renovação aos controles no plano %s",
    (access) => {
      const $ = render(0, access);
      for (const control of $(
        "input[type=radio], input[type=checkbox]",
      ).toArray()) {
        const descriptionIds = $(control).attr("aria-describedby")?.split(" ");
        expect(descriptionIds?.length).toBeGreaterThanOrEqual(2);
        const description = descriptionIds!
          .map((id) => {
            const element = $(`[id='${id}']`);
            expect(element).toHaveLength(1);
            return element.text();
          })
          .join(" ");
        const key =
          $(control).attr("type") === "radio"
            ? $(control).attr("value")
            : access;
        expect(description).toContain(
          key === "annual" ? "R$ 347,00/ano" : "R$ 67,00/mês",
        );
        expect(description.toLowerCase()).toContain("automática");
        expect(description.toLowerCase()).toContain(
          key === "annual" ? "anual" : "mensal",
        );
        if (key === "annual" && $(control).attr("type") === "radio")
          expect(description).toContain("não parcelada");
      }
    },
  );
});
