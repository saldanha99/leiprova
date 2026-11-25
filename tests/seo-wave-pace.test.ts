import { describe, expect, it } from "vitest";

import {
  type ScopeLaw,
  type WavePace,
  clampDaily,
  pacedOrder,
  pacedRelease,
  resolveWaveScope,
  saoPauloDate,
  seoWave,
  shiftDate,
  wavePace,
} from "@/lib/seo/wave";
import { WAVE_0_ARTICLE_PATHS } from "@/lib/seo/waves/onda-0";

const pace = (over: Partial<WavePace> = {}): WavePace => ({
  start: "2026-12-01",
  daily: 50,
  gscDate: null,
  gscIndexedPct: null,
  ...over,
});

/** Law with `count` indexable articles; article i has `base - i` questions. */
const law = (slug: string, count: number, base: number): ScopeLaw => ({
  path: `/lei/${slug}`,
  articles: Array.from({ length: count }, (_, index) => ({
    path: `/lei/${slug}/art-${index + 1}`,
    indexable: true,
    questions: base - index,
    order: index + 1,
  })),
});

describe("onda paced: configuração", () => {
  it("aceita SEO_WAVE=paced", () => {
    expect(seoWave(" Paced ")).toBe("paced");
  });

  it("ritmo diário sempre entre 50 e 100 (padrão 50)", () => {
    expect(clampDaily(undefined)).toBe(50);
    expect(clampDaily("abc")).toBe(50);
    expect(clampDaily("10")).toBe(50);
    expect(clampDaily("75")).toBe(75);
    expect(clampDaily("500")).toBe(100);
  });

  it("datas inválidas e leitura do GSC incompleta são ignoradas", () => {
    expect(wavePace({ SEO_WAVE_START: "2026-02-30" }).start).toBeNull();
    expect(wavePace({ SEO_WAVE_START: " 2026-12-01 " }).start).toBe("2026-12-01");
    expect(wavePace({ SEO_WAVE_GSC_DATE: "2027-01-15" })).toMatchObject({ gscDate: null, gscIndexedPct: null });
    expect(wavePace({ SEO_WAVE_GSC_DATE: "2027-01-15", SEO_WAVE_GSC_INDEXED_PCT: "140" }).gscIndexedPct).toBeNull();
    expect(wavePace({ SEO_WAVE_GSC_DATE: "2027-01-15", SEO_WAVE_GSC_INDEXED_PCT: "62.5" })).toMatchObject({
      gscDate: "2027-01-15",
      gscIndexedPct: 62.5,
    });
  });

  it("o dia vira à meia-noite de São Paulo", () => {
    expect(saoPauloDate(new Date("2026-12-01T02:59:00Z"))).toBe("2026-11-30");
    expect(saoPauloDate(new Date("2026-12-01T03:00:00Z"))).toBe("2026-12-01");
    expect(shiftDate("2026-12-01", -1)).toBe("2026-11-30");
  });
});

describe("onda paced: ritmo e freio (seção 5)", () => {
  it("sem início, nada; antes do início, nada; dia 1 libera o ritmo; teto no total", () => {
    expect(pacedRelease(pace({ start: null }), "2026-12-10", 1000).count).toBe(0);
    expect(pacedRelease(pace(), "2026-11-30", 1000).count).toBe(0);
    expect(pacedRelease(pace(), "2026-12-01", 1000)).toEqual({ count: 50, day: 1, brake: "none" });
    expect(pacedRelease(pace({ daily: 100 }), "2026-12-03", 1000).count).toBe(300);
    expect(pacedRelease(pace(), "2027-12-01", 1067).count).toBe(1067);
  });

  it("leitura antes de 4 semanas não freia", () => {
    const early = pace({ daily: 100, gscDate: "2026-12-20", gscIndexedPct: 10 });
    expect(pacedRelease(early, "2026-12-25", 5000)).toMatchObject({ count: 2500, brake: "none" });
  });

  it("leitura futura só vale a partir da data dela", () => {
    const future = pace({ daily: 100, gscDate: "2027-01-20", gscIndexedPct: 10 });
    expect(pacedRelease(future, "2027-01-10", 9000)).toMatchObject({ count: 4100, brake: "none" });
  });

  it("indexação abaixo de 70% reduz para 50/dia depois da leitura", () => {
    // Leitura no dia 30 (2026-12-30) com 60%: 30 × 100 até ali, depois +50 por dia.
    const slow = pace({ daily: 100, gscDate: "2026-12-30", gscIndexedPct: 60 });
    expect(pacedRelease(slow, "2026-12-30", 9000)).toMatchObject({ count: 3000, brake: "slow" });
    expect(pacedRelease(slow, "2027-01-02", 9000)).toMatchObject({ count: 3150, brake: "slow" });
  });

  it("abaixo de 50% depois de 6 semanas para de crescer", () => {
    // Dia 42 = 2027-01-11.
    const stop = pace({ daily: 80, gscDate: "2027-01-11", gscIndexedPct: 45 });
    expect(pacedRelease(stop, "2027-01-11", 9000)).toMatchObject({ count: 3360, brake: "stop" });
    expect(pacedRelease(stop, "2027-02-11", 9000)).toMatchObject({ count: 3360, brake: "stop" });
  });

  it("abaixo de 50% antes de 6 semanas só reduz", () => {
    const slow = pace({ daily: 80, gscDate: "2027-01-01", gscIndexedPct: 45 });
    expect(pacedRelease(slow, "2027-01-01", 9000).brake).toBe("slow");
  });

  it("70% ou mais mantém o ritmo", () => {
    const ok = pace({ daily: 100, gscDate: "2027-01-11", gscIndexedPct: 70 });
    expect(pacedRelease(ok, "2027-01-12", 9000)).toMatchObject({ count: 4300, brake: "none" });
  });
});

describe("onda paced: seleção", () => {
  it("ordena por questões, desempata pela ordem do artigo e pelo caminho; ignora onda 0 e não indexáveis", () => {
    const wave0 = WAVE_0_ARTICLE_PATHS[0];
    const laws: ScopeLaw[] = [
      {
        path: "/lei/b",
        articles: [
          { path: "/lei/b/art-1", indexable: true, questions: 5, order: 1 },
          { path: "/lei/b/art-2", indexable: false, questions: 99, order: 2 },
          { path: "/lei/b/art-3", indexable: true, questions: 9, order: 3 },
        ],
      },
      {
        path: "/lei/a",
        articles: [
          { path: "/lei/a/art-2", indexable: true, questions: 5, order: 2 },
          { path: "/lei/a/art-1", indexable: true, questions: 5, order: 1 },
          { path: wave0, indexable: true, questions: 500, order: 9 },
        ],
      },
    ];
    expect(pacedOrder(laws)).toEqual(["/lei/b/art-3", "/lei/a/art-1", "/lei/b/art-1", "/lei/a/art-2"]);
  });

  it("soma os N primeiros à onda 0; lei entra com ≥ 10 artigos liberados", () => {
    const laws = [law("grande", 40, 200), law("pequena", 12, 100)];
    // Dia 1 (50): os 40 da "grande" (200..161) + 10 da "pequena" (100..91).
    const day1 = resolveWaveScope(laws, "paced", pace(), "2026-12-01");
    expect(day1.release).toEqual({ count: 50, day: 1, brake: "none" });
    expect(day1.hasArticle("/lei/grande/art-40")).toBe(true);
    expect(day1.hasArticle("/lei/pequena/art-10")).toBe(true);
    expect(day1.hasArticle("/lei/pequena/art-11")).toBe(false);
    expect(day1.hasArticle(WAVE_0_ARTICLE_PATHS[299])).toBe(true);
    expect(day1.hasLaw("/lei/pequena")).toBe(true);
    expect(day1.hasLaw("/lei/constituicao-federal")).toBe(true);

    const fewer = resolveWaveScope([law("grande", 45, 200), law("pequena", 12, 100)], "paced", pace(), "2026-12-01");
    expect(fewer.hasLaw("/lei/pequena")).toBe(false);

    const before = resolveWaveScope(laws, "paced", pace(), "2026-11-30");
    expect(before.hasArticle("/lei/grande/art-1")).toBe(false);
    expect(before.hasLaw("/lei/grande")).toBe(false);
  });

  it("as outras ondas não mudam", () => {
    const laws = [law("grande", 40, 200)];
    expect(resolveWaveScope(laws, "0", pace(), "2026-12-01").hasArticle("/lei/grande/art-1")).toBe(false);
    expect(resolveWaveScope(laws, "all", pace(), "2026-12-01").hasArticle("/lei/grande/art-1")).toBe(true);
    expect(resolveWaveScope(laws, "off", pace(), "2026-12-01").hasLaw("/lei/constituicao-federal")).toBe(false);
  });
});
