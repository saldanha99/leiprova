import { describe, expect, it } from "vitest";

import { MAX_SYLLABUS_ITEMS, parseSyllabusItems } from "@/lib/editorial/syllabus-parser";

describe("separação segura do conteúdo programático", () => {
  it("remove marcadores, conserva o texto e elimina duplicatas normalizadas", () => {
    const result = parseSyllabusItems(`
      1. Direitos e garantias fundamentais
      2) Controle de constitucionalidade
      • direitos e garantias fundamentais
      - Organização do Estado
    `);

    expect(result.items).toEqual([
      "Direitos e garantias fundamentais",
      "Controle de constitucionalidade",
      "Organização do Estado",
    ]);
  });

  it("informa itens curtos ignorados sem inventar conteúdo", () => {
    const result = parseSyllabusItems("Lei\n1. Administração Pública direta e indireta");
    expect(result.items).toEqual(["Administração Pública direta e indireta"]);
    expect(result.ignored).toEqual(["Lei"]);
  });

  it("bloqueia lotes maiores que o limite operacional", () => {
    const input = Array.from(
      { length: MAX_SYLLABUS_ITEMS + 1 },
      (_, index) => `${index + 1}. Conteúdo programático número ${index + 1}`,
    ).join("\n");
    expect(() => parseSyllabusItems(input)).toThrow(/no máximo 50/i);
  });

  it("bloqueia item longo em vez de truncar a fonte", () => {
    expect(() => parseSyllabusItems(`1. ${"a".repeat(601)}`)).toThrow(/excede 600 caracteres/i);
  });
});
