import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContestLanding } from "@/components/contests/contest-landing";
import { PublicGuideShell } from "@/components/content/public-guide-shell";
import type { PublicContestOpportunity } from "@/lib/db/contest-opportunities";
import type { PublicContestExamReference } from "@/lib/exams/public-exam-reference-policy";
import { contestCategories } from "@/lib/opportunities/categories";
import {
  contestPlanCta,
  getCareerDirection,
} from "@/lib/opportunities/landing-presentation";
import { PLANS, formatBRL } from "@/lib/plans";

const opportunity: PublicContestOpportunity = {
  publicId: "9e73cb5f-94b8-4d32-9559-28f342321693",
  slug: "concurso-visual-qa",
  title: "Concurso ilustrativo — somente teste",
  summary: "Resumo de teste, sem validade oficial.",
  institutionAcronym: "QA",
  institutionName: "Instituição de teste",
  roleName: "Cargo ilustrativo",
  cycleYear: 2026,
  jurisdictionCode: "BR",
  lifecycleStatus: "pre_notice",
  statusAsOf: "2026-09-05",
  officialUrl: "https://example.invalid/concurso",
  registrationStartsAt: null,
  registrationEndsAt: null,
  examDate: null,
  sourceCheckedAt: new Date("2026-09-05T12:00:00Z"),
  publishedAt: new Date("2026-09-05T12:00:00Z"),
  updatedAt: new Date("2026-09-05T12:00:00Z"),
  categorySlug: "carreiras-policiais",
  categoryName: "Carreiras Policiais",
  careerSlug: "policia-civil",
  careerName: "Polícia Civil",
  responsibleName: null,
  responsibleType: null,
  examinationProviderName: null,
  bankSlug: null,
  bankName: null,
};

const lastExam: PublicContestExamReference = {
  edition: {
    publicId: "pc-ba-delegado-2022",
    title: "PC-BA 2022 — Delegado",
    examDate: "2022-07-24",
    bank: { slug: "cebraspe", name: "Cebraspe" },
  },
  questionBooklet: {
    publicId: "pc-ba-2022-caderno",
    documentType: "question_booklet",
    title: "Caderno de questões — Delegado",
    officialUrl: "https://cdn.cebraspe.org.br/pc-ba-2022/prova.pdf",
    accessType: "external_link",
    licenseLabel: "Consulta na fonte oficial",
    sourceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
    questionCount: 100,
  },
  answerKeys: [
    {
      publicId: "pc-ba-2022-gabarito",
      documentType: "answer_key",
      title: "Gabarito definitivo",
      officialUrl: "https://cdn.cebraspe.org.br/pc-ba-2022/gabarito.pdf",
      accessType: "external_link",
      licenseLabel: "Licença de uso registrada",
      sourceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
      questionCount: null,
    },
  ],
};

function render(
  overrides: Partial<PublicContestOpportunity> = {},
  commerceOpen = false,
  contactOpen = true,
  examReference: PublicContestExamReference | null = null,
) {
  return renderToStaticMarkup(
    createElement(ContestLanding, {
      opportunity: { ...opportunity, ...overrides },
      jurisdictionName: "Brasil",
      commerceOpen,
      contactOpen,
      lastExam: examReference,
    }),
  );
}

describe("página premium compartilhada de concursos", () => {
  it("reserva espaço no rodapé apenas nas páginas com ação fixa no celular", () => {
    const withDock = renderToStaticMarkup(
      PublicGuideShell({
        children: "Conteúdo de teste",
        mobileActionBar: true,
      }),
    );
    const withoutDock = renderToStaticMarkup(
      PublicGuideShell({ children: "Conteúdo de teste" }),
    );
    expect(withDock).toContain("safe-area-inset-bottom");
    expect(withoutDock).not.toContain("safe-area-inset-bottom");
  });
  it.each(contestCategories)(
    "renderiza as seções para $name sem inventar cobertura",
    (category) => {
      const html = render({
        categorySlug: category.slug,
        categoryName: category.name,
      });
      expect(html).toContain(category.name);
      for (const anchor of [
        "beneficios",
        "por-dentro",
        "edicao",
        "planos",
        "duvidas",
      ])
        expect(html).toContain(`id="${anchor}"`);
      expect(html).toContain("Em preparação editorial");
      expect(html).toContain("não representa um curso completo liberado");
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html.match(/<details>/g)).toHaveLength(7);
    },
  );

  it("não herda banca nem datas quando a edição ainda não confirma esses dados", () => {
    const html = render();
    expect(html).toContain("Aguardando confirmação");
    expect(html).toContain("Ainda não informadas");
    expect(html).toContain("Ainda não informada");
    expect(html).not.toContain("FGV");
    expect(html).not.toContain("Cebraspe");
    expect(html).not.toContain("100% do edital");
  });

  it("preserva responsável, prestador da prova e perfil como campos distintos", () => {
    const html = render({
      responsibleName: "Comissão de teste",
      responsibleType: "hybrid",
      examinationProviderName: "Prestador de teste",
      bankName: "Perfil de teste",
    });
    for (const value of [
      "Comissão de teste",
      "Arranjo híbrido",
      "Prestador de teste",
      "Perfil de teste",
    ])
      expect(html).toContain(value);
    expect(html).toContain("Sem vínculo ou endosso");
  });

  it("preserva o fim da inscrição mesmo quando não há data inicial", () => {
    expect(render({ registrationEndsAt: "2026-10-12" })).toContain(
      "Até 12 de outubro de 2026 · início ainda não informado",
    );
  });

  it("mostra a última prova somente quando a referência pública foi aprovada", () => {
    expect(render()).not.toContain("ultima-prova");

    const html = render({}, false, true, lastExam);
    expect(html).toContain('id="ultima-prova"');
    expect(html).toContain("Última prova oficial");
    expect(html).toContain("PC-BA 2022 — Delegado");
    expect(html).toContain("24 de julho de 2022");
    expect(html).toContain("Caderno de questões — Delegado");
    expect(html).toContain("Gabarito definitivo");
    expect(html).toContain("LINK EXTERNO");
    expect(html).toContain("acesso público ao PDF, por si só, não autoriza");
    expect(html).toContain(lastExam.questionBooklet.officialUrl);
    expect(html).toContain(lastExam.answerKeys[0].officialUrl);
  });

  it("lê os preços do catálogo único e não transforma equivalência em parcelas", () => {
    const html = render();
    for (const plan of PLANS)
      expect(html).toContain(formatBRL(plan.priceCents));
    expect(html).toContain("74,75");
    expect(html).toContain("não é parcelamento");
    expect(html).not.toContain("12x");
  });

  it.each([true, false])(
    "não encaminha para compra com comércio fechado; contato=%s",
    (contactOpen) => {
      const html = render({}, false, contactOpen);
      expect(html).not.toContain("/cadastro?");
      expect(html).not.toContain("/checkout");
      expect(html).toContain("Nenhuma cobrança");
      expect(html.includes('href="/contato"')).toBe(contactOpen);
      expect(html).not.toContain('href="/demo"');
    },
  );

  it("só oferece a assinatura geral quando o comércio está aberto, sem liberar o curso", () => {
    const html = render({}, true);
    for (const plan of PLANS)
      expect(html).toContain(`/cadastro?plano=${plan.slug}`);
    expect(html).toContain("Escolher assinatura da plataforma");
    expect(html).toContain("Em preparação editorial");
  });

  it("rotula a imagem e os dados ilustrativos sem depoimentos ou métricas reais falsas", () => {
    const html = render();
    expect(html).toContain("Imagem ilustrativa criada com IA");
    expect(html).toContain("dados fictícios");
    expect(html).toContain("não uma promessa de aprovação");
    expect(html).toContain("aria-controls=");
    expect(html).not.toContain("AggregateRating");
  });

  it("inclui imagem local leve, com dimensões reservadas e carga prioritária", () => {
    const asset = path.resolve(
      "public/assets/contests/editorial-study-v2.webp",
    );
    expect(existsSync(asset)).toBe(true);
    expect(statSync(asset).size).toBeLessThan(200_000);
    const html = render();
    expect(html).toContain("editorial-study-v2.webp");
    expect(html).not.toContain("study-ritual.webp");
    expect(html).toContain('fetchPriority="high"');
  });

  it("mantém fallback visual para novas categorias e CTA útil sem contato", () => {
    expect(getCareerDirection("nova-categoria").theme).toBe("emerald");
    expect(contestPlanCta(PLANS[0], false, false)).toEqual({
      href: "#por-dentro",
      label: "Conhecer a plataforma",
    });
  });
});
