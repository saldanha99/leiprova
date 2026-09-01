import { describe, expect, it } from "vitest";

import { parseOfficialExamUrl } from "@/lib/official-sources/exam-registry";
import { extractOfficialDocumentText, normalizeOfficialText } from "@/lib/official-sources/fetch";
import { OFFICIAL_LEGAL_SOURCES } from "@/lib/official-sources/legal-registry";

describe("fontes oficiais", () => {
  it("aceita apenas HTTPS no domínio oficial da banca", () => {
    expect(parseOfficialExamUrl("fgv", "https://conhecimento.fgv.br/concursos/teste").hostname).toBe("conhecimento.fgv.br");
    expect(() => parseOfficialExamUrl("fgv", "https://fgv-concursos.example/prova")).toThrow(/domínio oficial/);
    expect(() => parseOfficialExamUrl("fgv", "http://conhecimento.fgv.br/concursos")).toThrow(/HTTPS/);
    expect(() => parseOfficialExamUrl("fgv", "https://conhecimento.fgv.br:8443/concursos")).toThrow(/porta padrão/);
  });

  it("remove elementos executáveis e normaliza o texto legal", () => {
    const text = extractOfficialDocumentText("<html><body><h1>Lei</h1><script>segredo()</script><p>Art. 1º  Texto&nbsp; oficial.</p></body></html>");
    expect(text).toBe("Lei\nArt. 1º Texto oficial.");
    expect(normalizeOfficialText("a   b\n\n\n c")).toBe("a b\n\nc");
  });

  it("mantém uma URN LexML federal única para cada lei monitorada", () => {
    const urns = OFFICIAL_LEGAL_SOURCES.map((source) => source.lexmlUrn);

    expect(new Set(urns).size).toBe(urns.length);
    expect(urns.every((urn) => /^urn:lex:br:federal:[^\s]+$/.test(urn))).toBe(true);
  });
});
