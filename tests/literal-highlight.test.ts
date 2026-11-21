import { describe, expect, it } from "vitest";

import { parseLegalReferences } from "@/lib/study/legal-references";
import { EXCERPT_MIN_CHARS, highlightLiteral } from "@/lib/study/literal-highlight";

const marked = (r: ReturnType<typeof highlightLiteral>, kind: "match" | "trap") =>
  r.segments.filter((s) => s.kind === kind).map((s) => s.text.trim().toLowerCase()).join(" ");

const ART = "Art. 7º A licença será concedida pelo prazo de trinta dias, prorrogável uma vez.\n" +
  "§ 1º O pedido será dirigido à autoridade competente.\n" +
  "§ 2º Salvo motivo de força maior, o prazo não se suspende.";

describe("grifo do texto literal no gabarito", () => {
  it("Certo/Errado com gabarito Errado: grifa a palavra da lei que o item trocou", () => {
    const r = highlightLiteral({
      literalText: ART,
      prompt: "Julgue o item: a licença será concedida pelo prazo de sessenta dias, prorrogável uma vez.",
      type: "true_false",
      options: [{ key: "C", text: "Certo", isCorrect: false }, { key: "E", text: "Errado", isCorrect: true }],
    });
    expect(r.hasTrap).toBe(true);
    expect(marked(r, "trap")).toContain("trinta");
    expect(marked(r, "match")).toContain("licença");
    expect(marked(r, "trap")).not.toContain("autoridade");
  });

  it("Certo/Errado com gabarito Certo: só confirma, sem pegadinha", () => {
    const r = highlightLiteral({
      literalText: ART,
      prompt: "O pedido de licença será dirigido à autoridade competente.",
      type: "true_false",
      options: [{ key: "C", text: "Certo", isCorrect: true }, { key: "E", text: "Errado", isCorrect: false }],
    });
    expect(r.hasTrap).toBe(false);
    expect(marked(r, "match")).toContain("autoridade");
    expect(marked(r, "match")).toContain("competente");
  });

  it("múltipla escolha: a pegadinha é o que a alternativa errada escolhida trocou da correta", () => {
    const r = highlightLiteral({
      literalText: ART,
      prompt: "Segundo o art. 7º, a licença será concedida pelo prazo de",
      type: "multiple_choice",
      selectedKey: "B",
      options: [
        { key: "A", text: "trinta dias, prorrogável uma vez.", isCorrect: true },
        { key: "B", text: "trinta dias, improrrogável.", isCorrect: false },
        { key: "C", text: "noventa dias, prorrogável uma vez.", isCorrect: false },
      ],
    });
    expect(marked(r, "trap")).toContain("prorrogável");
    expect(marked(r, "trap")).not.toContain("trinta");
    expect(marked(r, "match")).toContain("trinta");
  });

  it("sem coincidência suficiente, devolve o texto sem grifo", () => {
    const r = highlightLiteral({
      literalText: ART,
      prompt: "Assunto totalmente diferente.",
      type: "true_false",
      options: [{ key: "C", text: "Certo", isCorrect: true }, { key: "E", text: "Errado", isCorrect: false }],
    });
    expect(r.segments).toEqual([{ text: ART, kind: "plain" }]);
  });

  it("preserva o texto literal exatamente (concatenação dos trechos)", () => {
    const r = highlightLiteral({
      literalText: ART,
      prompt: "Salvo motivo de força maior, o prazo se suspende.",
      type: "true_false",
      options: [{ key: "C", text: "Certo", isCorrect: false }, { key: "E", text: "Errado", isCorrect: true }],
    });
    expect(r.segments.map((s) => s.text).join("")).toBe(ART);
    expect(marked(r, "trap")).toContain("não");
  });

  it("artigo longo: o gabarito abre só no trecho em foco, com o artigo inteiro guardado", () => {
    const longo = "Art. 5º Todos são iguais perante a lei.\n" + Array.from({ length: 40 }, (_, i) => `${["I","II","III","IV","V","VI","VII","VIII","IX","X"][i % 10]} - inciso genérico número ${i} sobre matéria qualquer da lista;`).join("\n") +
      "\nLX - a lei só poderá restringir a publicidade dos atos processuais quando a defesa da intimidade ou o interesse social o exigirem;\nLXI - ninguém será preso senão em flagrante.";
    const r = highlightLiteral({
      literalText: longo,
      prompt: "A lei pode restringir a publicidade dos atos processuais por mera conveniência administrativa.",
      type: "true_false",
      options: [{ key: "C", text: "Certo", isCorrect: false }, { key: "E", text: "Errado", isCorrect: true }],
    });
    expect(r.excerpt).not.toBeNull();
    const excerpt = r.excerpt!.map((s) => s.text).join("");
    expect(excerpt).toContain("publicidade dos atos processuais");
    expect(excerpt.length).toBeLessThan(longo.length / 3);
    expect(r.segments.map((s) => s.text).join("")).toBe(longo);
  });

  const ROMANS = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX",
    "XXI","XXII","XXIII","XXIV","XXV","XXVI","XXVII","XXVIII","XXIX","XXX","XXXI","XXXII","XXXIII","XXXIV","XXXV","XXXVI","XXXVII",
    "XXXVIII","XXXIX","XL","XLI","XLII","XLIII","XLIV","XLV","XLVI","XLVII","XLVIII","XLIX","L","LI","LII","LIII","LIV","LV","LVI",
    "LVII","LVIII","LIX","LX","LXI","LXII","LXIII","LXIV","LXV","LXVI","LXVII","LXVIII","LXIX","LXX","LXXI","LXXII"];
  const ART5 = "Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza.\n" +
    ROMANS.map((r) => {
      if (r === "LXIX") return "LXIX - conceder-se-á mandado de segurança para proteger direito líquido e certo, não amparado por habeas corpus ou habeas data;";
      if (r === "LXXI") return "LXXI - conceder-se-á mandado de injunção sempre que a falta de norma regulamentadora torne inviável o exercício dos direitos;";
      return `${r} - disposição genérica número ${r} sobre matéria qualquer;`;
    }).join("\n") +
    "\n§ 1º As normas definidoras dos direitos e garantias fundamentais têm aplicação imediata.\n" +
    "§ 2º Os direitos e garantias expressos nesta Constituição não excluem outros decorrentes do regime.\n" +
    "§ 3º Os tratados e convenções internacionais sobre direitos humanos aprovados em dois turnos serão equivalentes às emendas.";
  const excerptOf = (r: ReturnType<typeof highlightLiteral>) => (r.excerpt ?? []).map((s) => s.text).join("");
  const tfOptions = [{ key: "C", text: "Certo", isCorrect: true }, { key: "E", text: "Errado", isCorrect: false }];

  it("dois incisos distantes citados pelo número entram os dois no trecho", () => {
    expect(ART5.length).toBeGreaterThan(EXCERPT_MIN_CHARS);
    const r = highlightLiteral({
      literalText: ART5,
      prompt: "Conforme o art. 5º, LXIX e LXXI, da Constituição, conceder-se-á mandado de segurança e mandado de injunção nas hipóteses previstas.",
      type: "true_false",
      options: tfOptions,
    });
    const excerpt = excerptOf(r);
    expect(excerpt).toContain("LXIX - conceder-se-á mandado de segurança");
    expect(excerpt).toContain("LXXI - conceder-se-á mandado de injunção");
    expect(excerpt).not.toContain("LXX - ");
    expect(excerpt).toContain("…");
    expect(r.segments.map((s) => s.text).join("")).toBe(ART5);
  });

  it("inciso citado entra mesmo sem coincidência de palavras", () => {
    const r = highlightLiteral({
      literalText: ART5,
      prompt: "O inciso XXXV do art. 5º trata de tema cobrado com frequência.",
      type: "true_false",
      options: tfOptions,
    });
    expect(excerptOf(r)).toContain("XXXV - disposição genérica número XXXV");
    expect(excerptOf(r)).not.toContain("XXXVI - ");
    expect(r.segments.map((s) => s.text).join("")).toBe(ART5);
  });

  it("§§ 1º e 3º entram no trecho; § 2º não", () => {
    const r = highlightLiteral({
      literalText: ART5,
      prompt: "Nos termos dos §§ 1º e 3º do art. 5º, julgue o item.",
      type: "true_false",
      options: tfOptions,
    });
    const excerpt = excerptOf(r);
    expect(excerpt).toContain("§ 1º As normas definidoras");
    expect(excerpt).toContain("§ 3º Os tratados");
    expect(excerpt).not.toContain("§ 2º");
  });

  it("referência a outro artigo e afirmativas numeradas não puxam incisos deste artigo", () => {
    const r = highlightLiteral({
      literalText: ART5,
      prompt: "Segundo o art. 7º, XXXV, analise as afirmativas. Estão corretas apenas I e III.",
      type: "true_false",
      options: tfOptions,
    });
    expect(r.excerpt).toBeNull();
    expect(r.segments).toEqual([{ text: ART5, kind: "plain" }]);
  });

  it("lê inciso, alínea, parágrafo único e caput", () => {
    expect(parseLegalReferences("art. 5º, incisos LXIX e LXXI", "5")).toEqual([
      { kind: "inciso", value: "LXIX", paragraph: null },
      { kind: "inciso", value: "LXXI", paragraph: null },
    ]);
    expect(parseLegalReferences("o § 2º, II, alínea b, do art. 5º", "5")).toEqual([
      { kind: "paragraph", value: "2" },
      { kind: "inciso", value: "II", paragraph: "2" },
      { kind: "alinea", value: "b", paragraph: "2", inciso: "II" },
    ]);
    expect(parseLegalReferences("as alíneas a e c do inciso III", null)).toEqual([
      { kind: "alinea", value: "a", paragraph: null, inciso: "III" },
      { kind: "alinea", value: "c", paragraph: null, inciso: "III" },
      { kind: "inciso", value: "III", paragraph: null },
    ]);
    expect(parseLegalReferences("Conforme o parágrafo único e o caput do art. 12", "12")).toEqual([
      { kind: "paragraph", value: "UNICO" },
      { kind: "caput" },
    ]);
    expect(parseLegalReferences("art. 109, inciso V-A e § 5º", "109")).toEqual([
      { kind: "inciso", value: "V-A", paragraph: null },
      { kind: "paragraph", value: "5" },
    ]);
    expect(parseLegalReferences("Estão corretas I, II e III.", "5")).toEqual([]);
    expect(parseLegalReferences("art. 7º, II", "5")).toEqual([]);
  });

  it("alínea citada sob o inciso certo, com o artigo exato", () => {
    const literal = "Art. 9º Compete:\nI - à União:\na) legislar sobre direito civil;\nb) manter o serviço postal;\nII - aos Estados:\na) explorar gás canalizado;\nb) instituir regiões metropolitanas;\n" +
      Array.from({ length: 30 }, (_, i) => `§ ${i + 1}º Regra acessória número ${i + 1} sem relação com o tema principal.`).join("\n");
    const r = highlightLiteral({
      literalText: literal,
      prompt: "De acordo com o art. 9º, II, alínea b, julgue.",
      type: "true_false",
      options: tfOptions,
    });
    const excerpt = excerptOf(r);
    expect(excerpt).toContain("b) instituir regiões metropolitanas");
    expect(excerpt).toContain("II - aos Estados");
    expect(excerpt).not.toContain("manter o serviço postal");
    expect(r.segments.map((s) => s.text).join("")).toBe(literal);
  });
});
