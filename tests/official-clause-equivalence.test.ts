import { describe, expect, it } from "vitest";
import articleFixture from "./fixtures/cf88-art5-senado.json";
import { CF88_PLANALTO_URL, clauseEquivalenceSchema, extractOfficialClause, officialTextHash, verifyOfficialClause } from "@/lib/editorial/official-clause-equivalence";
import { requireEditorialOperationTarget } from "@/lib/editorial/operation-target";

function fixture(inciso = "II") {
  return {
    equivalence: clauseEquivalenceSchema.parse({ strategy: "cf88-art5-inciso-v1", parentArticleRef: "Art. 5º", inciso,
      targetSourceUrl: articleFixture.sourceUrl, parentTextSha256: articleFixture.parentTextSha256 }),
    source: { articleRef: `Art. 5º, ${inciso}`, text: extractOfficialClause(articleFixture.literalText, inciso) },
    bundle: { officialUrl: CF88_PLANALTO_URL, articleContext: articleFixture.literalText.split("\nI - ")[0] },
    article: { articleRef: "Art. 5º", literalText: articleFixture.literalText, sourceUrl: articleFixture.sourceUrl, officialUrl: CF88_PLANALTO_URL },
  };
}

describe("equivalência explícita CF/88 — inciso integral e caput", () => {
  it("preserva as duas fontes, hash do artigo, inciso completo e alíneas", () => {
    const f = fixture("XXVIII");
    const evidence = verifyOfficialClause(f);
    expect(evidence.targetClauseText).toContain("a)");
    expect(evidence.targetClauseText).toContain("b)");
    expect(evidence.targetClauseText).not.toContain("XXIX -");
    expect(evidence.packageClauseSha256).toBe(evidence.targetClauseSha256);
    expect(evidence.typographicVariant).toBe(false);
  });

  it.each([
    ["XXXI", "de cujus", '"de cujus"'], ["XXXIV", "poderes públicos", "Poderes Públicos"], ["XLIII", "tortura,", "tortura ,"],
  ])("registra somente a variante tipográfica conhecida no inciso %s", (inciso, from, to) => {
    const f = fixture(inciso);
    f.source.text = f.source.text.replace(from, to);
    expect(verifyOfficialClause(f).typographicVariant).toBe(true);
    expect(f.source.text).toContain(to);
  });

  it("recusa negação, troca de palavras, pontuação semântica e recorte parcial", () => {
    for (const mutate of [
      (text: string) => text.replace("ninguém", "todos"),
      (text: string) => text.replace("em virtude de lei", "por qualquer motivo"),
      (text: string) => text.replace(";", ":"),
      (text: string) => text.slice(0, -25),
    ]) {
      const f = fixture(); f.source.text = mutate(f.source.text);
      expect(() => verifyOfficialClause(f)).toThrow("texto completo");
    }
    const alinea = fixture("XXVIII"); alinea.source.text = alinea.source.text.split("\nb)")[0];
    expect(() => verifyOfficialClause(alinea)).toThrow("texto completo");
  });

  it("não permite normalização tipográfica em inciso diferente", () => {
    const f = fixture("XIV"); f.source.text = f.source.text.replace("todos", "Todos");
    expect(() => verifyOfficialClause(f)).toThrow("texto completo");
  });

  it("recusa contexto, hash, referência ou URL divergentes", () => {
    const mutations: ((f: ReturnType<typeof fixture>) => void)[] = [
      (f) => { f.bundle.articleContext += " Contexto alterado."; },
      (f) => { f.equivalence.parentTextSha256 = "0".repeat(64); },
      (f) => { f.source.articleRef = "Art. 5º, III"; },
      (f) => { f.article.articleRef = "Art. 6º"; },
      (f) => { f.article.sourceUrl += "?redirect=outro"; },
      (f) => { f.article.officialUrl += "?origem=outra"; },
      (f) => { f.bundle.officialUrl += "?origem=outra"; },
      (f) => { f.article.literalText += "\nConteúdo novo."; },
    ];
    for (const mutate of mutations) { const f = fixture(); mutate(f); expect(() => verifyOfficialClause(f)).toThrow("vínculo"); }
  });

  it("recusa inciso duplicado mesmo com hash atualizado e inciso inexistente", () => {
    const f = fixture(); f.article.literalText += "\nII - outra regra";
    f.equivalence.parentTextSha256 = officialTextHash(f.article.literalText);
    expect(() => verifyOfficialClause(f)).toThrow("ambíguo");
    expect(() => extractOfficialClause(articleFixture.literalText, "C")).toThrow("ausente");
    expect(() => extractOfficialClause(articleFixture.literalText, "II|IV")).toThrow("inválido");
  });

  it("recusa estratégias extras e hosts/normas diferentes", () => {
    const e = fixture().equivalence;
    for (const targetSourceUrl of [e.targetSourceUrl + "?x=1", "https://legis.senado.leg.br/norma/111/publicacao/16434817", "https://legis.senado.leg.br.evil.invalid/norma/579494/publicacao/16434817"]) {
      expect(clauseEquivalenceSchema.safeParse({ ...e, targetSourceUrl }).success).toBe(false);
    }
    expect(clauseEquivalenceSchema.safeParse({ ...e, bypass: true }).success).toBe(false);
  });
});

describe("alvo explícito da operação editorial", () => {
  const environment = { nodeEnv: "production", appUrl: "https://leiprova.2b.app.br", approval: "leiprova-160-2026-09-05" };
  it("só aceita banco/usuário/pooler internos e autorização do lote", () => {
    const url = "postgres://leiprova_app:senha-ficticia@leiprova-pooler:5432/leiprova";
    expect(requireEditorialOperationTarget(url, environment).database).toBe("leiprova");
    for (const candidate of [undefined, url.replace("leiprova_app", "leiprova_owner"), url.replace("leiprova-pooler", "remote.example"), url + "?host=outro", url.replace("/leiprova", "/outro")]) {
      expect(() => requireEditorialOperationTarget(candidate, environment)).toThrow();
    }
    expect(() => requireEditorialOperationTarget(url, { ...environment, approval: undefined })).toThrow();
    expect(() => requireEditorialOperationTarget(url, { ...environment, appUrl: "https://outro.example" })).toThrow();
    expect(() => requireEditorialOperationTarget(url, {})).toThrow();
  });
});
