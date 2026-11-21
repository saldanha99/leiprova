import { describe, expect, it } from "vitest";

import { highlightLiteral } from "@/lib/study/literal-highlight";

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
});
