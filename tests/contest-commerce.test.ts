import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CONTEST_CATALOG,
  CONTEST_ACCESS_OPTIONS,
  accessEndsAt,
  catalogContestPath,
  contestPriceLookupKey,
} from "@/lib/commerce/catalog";
import {
  contestCartSchema,
  contestCartTotal,
  orderPaymentMatches,
} from "@/lib/commerce/order-policy";
import { opportunityJurisdictions } from "@/lib/opportunities/jurisdictions";
import { contestCategories } from "@/lib/opportunities/categories";
import {
  accessibleQuestionIds,
  canStudyQuestion,
} from "@/lib/study/access-policy";
import { ContestCart } from "@/components/checkout/contest-cart";
import { PlannedContestLanding } from "@/components/contests/planned-contest-landing";

const police = CONTEST_CATALOG.filter(
  (item) => item.categorySlug === "carreiras-policiais",
);
const cart = () => ({
  attemptId: randomUUID(),
  items: [{ productSlug: police[0].slug, accessKey: "6m" }],
});
describe("catálogo comercial por edição", () => {
  it("preserva as 75 ofertas e oito categorias sem duplicar produtos regionais", () => {
    expect(CONTEST_CATALOG).toHaveLength(75);
    expect(new Set(CONTEST_CATALOG.map((item) => item.slug)).size).toBe(75);
    expect(new Set(CONTEST_CATALOG.map(catalogContestPath)).size).toBe(75);
    expect(new Set(CONTEST_CATALOG.map((item) => item.categorySlug)).size).toBe(
      8,
    );
  });
  it("mantém apenas estados válidos e categorias conhecidas", () => {
    for (const item of CONTEST_CATALOG) {
      expect(
        contestCategories.some(
          (category) => category.slug === item.categorySlug,
        ),
      ).toBe(true);
      for (const code of item.jurisdictionCodes)
        expect(
          opportunityJurisdictions.some((state) => state.code === code),
        ).toBe(true);
      expect(item.status).toBe("research");
      expect(new URL(item.sourceUrl).hostname).toBe(
        "www.decorandoaleiseca.com.br",
      );
    }
  });
  it("não confunde nacional, DF/TO e duas edições do mesmo órgão", () => {
    expect(
      CONTEST_CATALOG.find((item) => item.acronym === "TRT-10")
        ?.jurisdictionCodes,
    ).toEqual(["DF", "TO"]);
    expect(
      CONTEST_CATALOG.find((item) => item.acronym === "PRF")?.jurisdictionCodes,
    ).toEqual(["BR"]);
    const ba = police.filter((item) => item.acronym === "PC-BA");
    expect(ba).toHaveLength(2);
    expect(ba[0].slug).not.toBe(ba[1].slug);
  });
  it("atribui 150 preços de Stripe distintos a partir da fonte central", () => {
    const keys = CONTEST_CATALOG.flatMap((contest) =>
      CONTEST_ACCESS_OPTIONS.map((option) =>
        contestPriceLookupKey(contest.slug, option.key),
      ),
    );
    expect(new Set(keys).size).toBe(150);
  });
  it("renderiza páginas planejadas sem promessa de venda ou banca", () => {
    for (const category of contestCategories) {
      const contest = CONTEST_CATALOG.find(
        (item) => item.categorySlug === category.slug,
      )!;
      const html = renderToStaticMarkup(
        createElement(PlannedContestLanding, {
          contest,
          commerceOpen: false,
          contactOpen: true,
        }),
      );
      expect(html.match(/<h1/g)).toHaveLength(1);
      expect(html).toContain("Em preparação");
      expect(html).not.toContain("/checkout/concurso/");
    }
  });
});
describe("carrinho explícito e sem manipulação de preço", () => {
  it("aceita um concurso e soma 67 ou 87 reais", () => {
    expect(contestCartSchema.safeParse(cart()).success).toBe(true);
    expect(contestCartTotal([{ accessKey: "6m" }])).toBe(6700);
    expect(contestCartTotal([{ accessKey: "12m" }])).toBe(8700);
  });
  it("soma adicionais sem descontos ou taxas escondidas", () => {
    expect(
      contestCartTotal([
        { accessKey: "12m" },
        { accessKey: "6m" },
        { accessKey: "6m" },
      ]),
    ).toBe(22100);
  });
  it("rejeita preço e Stripe ID enviados pelo navegador", () => {
    expect(
      contestCartSchema.safeParse({ ...cart(), amountCents: 1 }).success,
    ).toBe(false);
    expect(
      contestCartSchema.safeParse({
        ...cart(),
        items: [{ ...cart().items[0], stripePriceId: "price_fake" }],
      }).success,
    ).toBe(false);
  });
  it("rejeita duplicata de concurso, mesmo com prazo diferente", () => {
    expect(
      contestCartSchema.safeParse({
        ...cart(),
        items: [cart().items[0], { ...cart().items[0], accessKey: "12m" }],
      }).success,
    ).toBe(false);
  });
  it("rejeita carrinho vazio, mais de três itens e SKU desconhecido", () => {
    for (const items of [
      [],
      Array.from({ length: 4 }, (_, i) => ({
        productSlug: police[i].slug,
        accessKey: "6m",
      })),
      [{ productSlug: "nao-existe", accessKey: "6m" }],
    ])
      expect(contestCartSchema.safeParse({ ...cart(), items }).success).toBe(
        false,
      );
  });
  it("rejeita adicional de outra carreira", () => {
    expect(
      contestCartSchema.safeParse({
        ...cart(),
        items: [
          cart().items[0],
          { productSlug: CONTEST_CATALOG[0].slug, accessKey: "6m" },
        ],
      }).success,
    ).toBe(false);
  });
  it("mantém adicionais desmarcados e checkout desativado na prévia", () => {
    const html = renderToStaticMarkup(
      createElement(ContestCart, {
        contest: police[0],
        related: [police[1], police[2]],
        initialAccess: "6m",
        available: false,
      }),
    );
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1); // Só o rádio do prazo base.
    expect(html).toContain("disabled=");
    expect(html).toContain("R$ 67,00");
  });
});
describe("acesso e confirmação de pagamento", () => {
  it("limita a compra avulsa às questões dos concursos adquiridos", () => {
    const entitlement = {
      hasFullAccess: false,
      questionPublicIds: ["edicao-a-q1"],
    };
    expect(canStudyQuestion(entitlement, "edicao-a-q1")).toBe(true);
    expect(canStudyQuestion(entitlement, "edicao-b-q1")).toBe(false);
    expect(accessibleQuestionIds(entitlement)).toContain("edicao-a-q1");
  });
  it("nega confirmação com valor, moeda, modo, status ou ambiente divergentes", () => {
    const valid = {
      expectedCents: 6700,
      actualCents: 6700,
      currency: "brl",
      mode: "payment",
      paymentStatus: "paid",
      expectedLive: false,
      actualLive: false,
    };
    expect(orderPaymentMatches(valid)).toBe(true);
    for (const change of [
      { actualCents: 1 },
      { currency: "usd" },
      { mode: "subscription" },
      { paymentStatus: "unpaid" },
      { actualLive: true },
    ])
      expect(orderPaymentMatches({ ...valid, ...change })).toBe(false);
  });
  it("calcula vencimento em final de mês sem avançar além do contratado", () => {
    expect(
      accessEndsAt(new Date("2026-08-31T15:20:00Z"), 6).toISOString(),
    ).toBe("2027-02-28T15:20:00.000Z");
    expect(
      accessEndsAt(new Date("2023-08-31T15:20:00Z"), 6).toISOString(),
    ).toBe("2024-02-29T15:20:00.000Z");
  });
});
