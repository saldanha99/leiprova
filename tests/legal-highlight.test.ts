import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HighlightedLegalText, normalizeLegalHighlightTheme } from "@/components/materials/highlighted-legal-text";

describe("marcações da literalidade", () => {
  it("destaca prazos, exceções e deveres sem alterar o texto", () => {
    const text = "Deverá responder em 10 dias, salvo previsão diversa, e não poderá omitir.";
    const html = renderToStaticMarkup(createElement(HighlightedLegalText, { text, theme: "colors" }));

    expect(html).toContain("10 dias");
    expect(html).toContain("salvo");
    expect(html).toContain("Deverá");
    expect(html).toContain("não");
    expect(html.replace(/<[^>]+>/g, "")).toBe(text);
  });

  it("oferece versão em preto para impressão", () => {
    expect(normalizeLegalHighlightTheme("preto")).toBe("ink");
    expect(normalizeLegalHighlightTheme("qualquer")).toBe("colors");
    expect(renderToStaticMarkup(createElement(HighlightedLegalText, { text: "prazo de 5 dias", theme: "ink" }))).toContain("bg-slate-200");
  });
});
