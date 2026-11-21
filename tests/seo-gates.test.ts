import { describe, expect, it } from "vitest";

import {
  type ArticleGateInput,
  evaluateArticleGate,
  evaluateLawGate,
  jaccard,
  maxSimilarities,
  shingles,
} from "@/lib/seo/gates";
import { type ArticleRow, type QuestionRow, buildLawSnapshot, questionOriginLabel, trapItems } from "@/lib/seo/legal-snapshot";
import { planPageState, resolveLastModified } from "@/lib/seo/page-state";
import { articleInWave, lawInWave, seoWave, selectWave } from "@/lib/seo/wave";

const passing: ArticleGateInput = {
  hasCurrentVersion: true,
  articleReviewed: true,
  directAnswerWords: 45,
  reviewedQuestions: 3,
  trapPatterns: 2,
  ownWords: 250,
  maxSimilarity: 0.1,
  inboundLinks: 1,
};

describe("gate da página de artigo (spec 3.2)", () => {
  it("3 questões e 250 palavras próprias → index", () => {
    expect(evaluateArticleGate(passing)).toEqual({ status: "index", reasons: [] });
  });

  it("2 questões → noindex", () => {
    expect(evaluateArticleGate({ ...passing, reviewedQuestions: 2 })).toEqual({ status: "noindex", reasons: ["few_questions"] });
  });

  it("sem texto reviewed → 404", () => {
    expect(evaluateArticleGate({ ...passing, articleReviewed: false }).status).toBe("not_found");
    expect(evaluateArticleGate({ ...passing, hasCurrentVersion: false }).status).toBe("not_found");
  });

  it("similaridade 0,6 → noindex", () => {
    expect(evaluateArticleGate({ ...passing, maxSimilarity: 0.6 })).toEqual({ status: "noindex", reasons: ["similar_to_sibling"] });
  });

  it("sem resposta direta autoral → noindex, salvo se o dono relaxar só esse item", () => {
    expect(evaluateArticleGate({ ...passing, directAnswerWords: null }).reasons).toEqual(["missing_direct_answer"]);
    expect(evaluateArticleGate({ ...passing, directAnswerWords: 39 }).status).toBe("noindex");
    expect(evaluateArticleGate({ ...passing, directAnswerWords: null }, { requireDirectAnswer: false }).status).toBe("index");
    expect(evaluateArticleGate({ ...passing, directAnswerWords: null, ownWords: 249 }, { requireDirectAnswer: false }).reasons).toEqual([
      "few_own_words",
    ]);
  });

  it("exige 2 itens de \"cai assim\" e 1 link de entrada", () => {
    expect(evaluateArticleGate({ ...passing, trapPatterns: 1, inboundLinks: 0 }).reasons).toEqual(["few_trap_patterns", "no_inbound_links"]);
  });
});

describe("gate da lei e similaridade", () => {
  it("lei com menos de 10 artigos indexáveis → noindex; sem versão → 404", () => {
    expect(evaluateLawGate({ hasCurrentVersion: true, indexableArticles: 10 }).status).toBe("index");
    expect(evaluateLawGate({ hasCurrentVersion: true, indexableArticles: 9 }).status).toBe("noindex");
    expect(evaluateLawGate({ hasCurrentVersion: false, indexableArticles: 50 }).status).toBe("not_found");
  });

  it("Jaccard de shingles de 5 palavras", () => {
    const a = shingles("um dois três quatro cinco seis");
    expect(a).toEqual(new Set(["um dois tres quatro cinco", "dois tres quatro cinco seis"]));
    expect(jaccard(a, shingles("um dois três quatro cinco sete"))).toBeCloseTo(1 / 3);
    expect(maxSimilarities(["a b c d e f", "a b c d e f", "x y z w v u"])).toEqual([1, 1, 0]);
  });
});

const article = (id: number, order: number, heading: string | null = "CAPÍTULO I · DOS DEVERES"): ArticleRow => ({
  id,
  articleRef: `Art. ${order}`,
  articleOrder: order,
  heading,
  path: `art-${order}`,
  literalText: `Art. ${order}. Texto ${order}.\nI - inciso;`,
  editorialStatus: "reviewed",
  updatedAt: new Date("2026-09-01T00:00:00Z"),
});

let questionId = 0;
const question = (articleId: number, words: string, type: QuestionRow["type"] = "true_false"): QuestionRow => {
  questionId += 1;
  return {
    id: questionId,
    publicId: `q-${questionId}`,
    articleId,
    type,
    prompt: `Enunciado ${words}`,
    explanation: `Comentário ${words}`,
    sourceRights: "original_authorial",
    styleBankName: "CEBRASPE",
    licensedBankName: null,
    licensedExamYear: null,
    updatedAt: new Date("2026-10-14T00:00:00Z"),
    options:
      type === "true_false"
        ? [
            { key: "A", text: "Certo", isCorrect: false, rationale: `Incorreto ${words}` },
            { key: "B", text: "Errado", isCorrect: true, rationale: `Correto ${words}` },
          ]
        : [
            { key: "A", text: "Opção errada", isCorrect: false, rationale: `Errada ${words}` },
            { key: "B", text: "Opção certa", isCorrect: true, rationale: `Certa ${words}` },
          ],
  };
};

const uniqueWords = (seed: string, count: number) => Array.from({ length: count }, (_, index) => `${seed}${index}`).join(" ");

describe("montagem da página a partir do banco", () => {
  it("rótulo de origem honesto", () => {
    expect(questionOriginLabel({ sourceRights: "original_authorial", styleBankName: "CEBRASPE", licensedBankName: null, licensedExamYear: null }).label).toBe(
      "Inédita no estilo CEBRASPE",
    );
    expect(questionOriginLabel({ sourceRights: "licensed", styleBankName: null, licensedBankName: "FGV", licensedExamYear: 2024 }).label).toBe(
      "Questão de prova anterior licenciada (FGV, 2024)",
    );
  });

  it("limita a 5 questões públicas, deriva o \"cai assim\" e calcula o gate", () => {
    const articles = [article(1, 1), article(2, 2), article(3, 3, null), { ...article(4, 4), editorialStatus: "draft" }];
    const rows = [
      ...Array.from({ length: 6 }, (_, index) => question(1, uniqueWords(`a${index}x`, 30))),
      question(2, uniqueWords("b", 10)),
      question(2, uniqueWords("c", 10), "multiple_choice"),
    ];
    const snapshot = buildLawSnapshot({
      law: {
        id: 9,
        slug: "regime-juridico-servidores-federais",
        actType: "lei",
        actNumber: "8.112",
        actYear: 1990,
        title: "Lei nº 8.112, de 11 de dezembro de 1990",
        shortTitle: "Regime dos Servidores Federais",
        officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
        versionId: 1,
        versionSourceUrl: "https://legis.senado.leg.br/norma/1",
        versionVerifiedAt: new Date("2026-09-03T00:00:00Z"),
        versionChecksum: "abc",
      },
      articles,
      questionCounts: new Map([
        [1, 6],
        [2, 2],
      ]),
      questions: rows,
      directAnswers: new Map(),
      policy: { requireDirectAnswer: false },
    });

    expect(snapshot.slug).toBe("lei-8112-1990");
    expect(snapshot.articles.map((item) => item.path)).toEqual(["/lei/lei-8112-1990/art-1", "/lei/lei-8112-1990/art-2", "/lei/lei-8112-1990/art-3"]);
    const first = snapshot.bySegment.get("art-1");
    expect(first?.publicQuestions).toHaveLength(5);
    expect(first?.traps).toHaveLength(4);
    expect(first?.gate).toEqual({ status: "index", reasons: [] });
    expect(first?.heading).toBe("Dos deveres");
    expect(first?.next?.path).toBe("/lei/lei-8112-1990/art-2");
    expect(snapshot.bySegment.get("art-2")?.gate.reasons).toContain("few_questions");
    expect(snapshot.bySegment.get("art-3")?.gate.status).toBe("noindex");
    expect(snapshot.topArticles.map((item) => item.label)).toEqual(["Art. 1", "Art. 2"]);
    expect(snapshot.gate.status).toBe("noindex");
    expect(first?.contentDate.toISOString()).toBe("2026-10-14T00:00:00.000Z");

    const strict = buildLawSnapshot({
      law: snapshot.law,
      articles,
      questionCounts: new Map([[1, 6]]),
      questions: rows,
      directAnswers: new Map(),
      policy: { requireDirectAnswer: true },
    });
    expect(strict.bySegment.get("art-1")?.gate.reasons).toEqual(["missing_direct_answer"]);
  });

  it("\"cai assim\" usa o enunciado errado do certo/errado e a alternativa errada da múltipla escolha", () => {
    const items = trapItems([
      { ...question(1, "x"), anchorId: "questao-a", origin: { kind: "original", label: "" }, correct: { key: "B", text: "Errado", isCorrect: true, rationale: null } },
      { ...question(1, "y", "multiple_choice"), anchorId: "questao-b", origin: { kind: "original", label: "" }, correct: null },
    ]);
    expect(items).toEqual([
      { statement: "Enunciado x", why: "Comentário x", questionAnchorId: "questao-a" },
      { statement: "Opção errada", why: "Errada y", questionAnchorId: "questao-b" },
    ]);
  });
});

describe("lastmod por hash (seo_page_state)", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const page = { path: "/lei/x/art-1", type: "article" as const, indexable: true, reason: null, contentHash: "h1", contentDate: new Date("2026-10-01T00:00:00Z"), inboundLinks: 2 };
  const stored = { path: page.path, type: "article" as const, indexable: true, inboundLinks: 2, contentHash: "h1", contentChangedAt: new Date("2026-10-05T00:00:00Z") };

  it("reverificar a fonte sem mudar o texto não altera o lastmod", () => {
    const plan = planPageState([{ ...page, contentDate: new Date("2026-11-20T00:00:00Z") }], new Map([[page.path, stored]]), now);
    expect(plan.rows[0].contentChangedAt).toEqual(stored.contentChangedAt);
    expect(plan.changedPaths).toEqual([]);
    expect(resolveLastModified(stored, page)).toEqual(stored.contentChangedAt);
  });

  it("hash novo move a data e entra na fila do IndexNow; página que sumiu sai do índice", () => {
    const plan = planPageState([{ ...page, contentHash: "h2" }], new Map([[page.path, stored], ["/lei/x/art-9", { ...stored, path: "/lei/x/art-9" }]]), now);
    expect(plan.rows[0].contentChangedAt).toEqual(now);
    expect(plan.changedPaths).toEqual([page.path, "/lei/x/art-9"]);
    expect(plan.rows[1]).toMatchObject({ path: "/lei/x/art-9", indexable: false, reason: "not_found" });
    expect(resolveLastModified(stored, { contentHash: "h2", contentDate: page.contentDate })).toEqual(page.contentDate);
  });

  it("primeira observação usa a data do dado", () => {
    expect(planPageState([page], new Map(), now).rows[0].contentChangedAt).toEqual(page.contentDate);
  });
});

describe("ondas", () => {
  it("SEO_WAVE desligada por padrão", () => {
    expect(seoWave(undefined)).toBe("off");
    expect(seoWave("1")).toBe("off");
    expect(seoWave(" 0 ")).toBe("0");
    expect(seoWave("all")).toBe("all");
    expect(articleInWave("/lei/x/art-1", "off")).toBe(false);
    expect(lawInWave("/lei/x", "all")).toBe(true);
  });

  it("seleção em rodízio pelas leis mais exigidas, por questões dentro de cada lei", () => {
    const law = (path: string, productCount: number, sizes: number[]) => ({
      path,
      productCount,
      candidates: sizes.map((questions, index) => ({ path: `${path}/art-${index + 1}`, questions, order: index + 1 })),
    });
    const selected = selectWave([law("/lei/b", 5, [3, 9]), law("/lei/a", 9, [4, 8, 6]), law("/lei/c", 1, [50])], 4, 2);
    expect(selected).toEqual(["/lei/a/art-2", "/lei/b/art-2", "/lei/a/art-3", "/lei/b/art-1"]);
  });
});
