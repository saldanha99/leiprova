import { describe, expect, it } from "vitest";
import { captureOfficialPdfFromBytes } from "@/lib/opportunities/official-document-fetch";

const DOM = "https://dom.manaus.am.gov.br/pdf/2026/julho/DOM%206343%2002.07.2026%20Edicao%20Extra.pdf";
describe("PDF oficial baixado pelo operador (WAF recusa o servidor)", () => {
  it("recusa bytes que não batem com o SHA-256 fixado, antes de abrir o PDF", async () => {
    await expect(captureOfficialPdfFromBytes(new TextEncoder().encode("%PDF-1.6 x"), DOM, "Edital", "dom-manaus", "0".repeat(64)))
      .rejects.toMatchObject({ code: "document_checksum_mismatch" });
  });
  it("recusa URL fora da origem oficial do DOM", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.6 x");
    const sha = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    await expect(captureOfficialPdfFromBytes(bytes, "https://exemplo.invalid/edital.pdf", "Edital", "dom-manaus", sha)).rejects.toThrow();
  });
});
