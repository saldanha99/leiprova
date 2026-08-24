import { describe, expect, it } from "vitest";

import { parseOfficialExamUrl } from "@/lib/official-sources/exam-registry";
import { extractOfficialDocumentText, normalizeOfficialText } from "@/lib/official-sources/fetch";

describe("fontes oficiais", () => {
  it("aceita apenas HTTPS no domínio oficial da banca", () => {
    expect(parseOfficialExamUrl("fgv", "https://conhecimento.fgv.br/concursos/teste").hostname).toBe("conhecimento.fgv.br");
    expect(() => parseOfficialExamUrl("fgv", "https://fgv-concursos.example/prova")).toThrow(/domínio oficial/);
    expect(() => parseOfficialExamUrl("fgv", "http://conhecimento.fgv.br/concursos")).toThrow(/HTTPS/);
  });

  it("remove elementos executáveis e normaliza o texto legal", () => {
    const text = extractOfficialDocumentText("<html><body><h1>Lei</h1><script>segredo()</script><p>Art. 1º  Texto&nbsp; oficial.</p></body></html>");
    expect(text).toBe("Lei\nArt. 1º Texto oficial.");
    expect(normalizeOfficialText("a   b\n\n\n c")).toBe("a b\n\nc");
  });
});
