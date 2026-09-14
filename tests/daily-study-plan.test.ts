import { describe, expect, it } from "vitest";

import { dailyPlanLinks, selectDailyStudyTarget } from "@/lib/study/daily-plan";

const candidates = [
  {
    id: 2,
    slug: "codigo-civil",
    title: "Código Civil",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
    articles: [
      { id: 21, articleOrder: 3, articleRef: "Art. 3º", questionCount: 2 },
      { id: 20, articleOrder: 2, articleRef: "Art. 2º", questionCount: 0 },
      { id: 19, articleOrder: 1, articleRef: "Art. 1º", questionCount: 1 },
    ],
  },
  {
    id: 1,
    slug: "constituicao-federal",
    title: "Constituição Federal",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    articles: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      articleOrder: index + 1,
      articleRef: `Art. ${index + 1}º`,
      questionCount: 1,
    })),
  },
] as const;

describe("plano diário de estudo", () => {
  it("gera o mesmo alvo para a mesma pessoa e data e limita o recorte a cinco artigos", () => {
    const first = selectDailyStudyTarget(42, "2026-09-13", candidates);
    const second = selectDailyStudyTarget(42, "2026-09-13", candidates);

    expect(second).toEqual(first);
    expect(first).not.toBeNull();
    expect(first!.articles.length).toBeLessThanOrEqual(5);
    expect(first!.articles.every((article) => article.questionCount > 0)).toBe(true);
  });

  it("ignora leis sem questões acessíveis", () => {
    expect(selectDailyStudyTarget(1, "2026-09-13", [{ ...candidates[0], articles: [] }])).toBeNull();
  });

  it("rejeita datas inválidas e cria links para o mesmo intervalo", () => {
    expect(() => selectDailyStudyTarget(1, "2026-02-30", candidates)).toThrow("Data inválida");
    expect(dailyPlanLinks({ slug: "lei 1", articleStartOrder: 10, articleEndOrder: 14 })).toEqual({
      reading: "/app/leis/lei%201?de=10&ate=14",
      practice: "/app/treinar?lei=lei%201&de=10&ate=14&ordem=sequencial",
      review: "/app/mapas?lei=lei%201&de=10&ate=14",
    });
  });
});
