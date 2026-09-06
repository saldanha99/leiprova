import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "8.8.8.8", family: 4 }]) }));
import { captureOfficialPdf } from "@/lib/opportunities/official-document-fetch";

// PDF original mínimo, com xref e texto sintético. Sem documento editorial ou rede real.
function syntheticPdf() {
  const text = "Texto sintetico para verificar extracao de edital sem conteudo juridico. ".repeat(3);
  const stream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let file = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(file));
    file += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(file);
  file += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  file += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(file);
}

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

it("extrai um PDF sintético com unpdf real e preserva bytes/hash", async () => {
  const bytes = syntheticPdf();
  vi.mocked(fetch).mockResolvedValue(new Response(bytes, { headers: { "content-type": "application/pdf" } }));
  const result = await captureOfficialPdf({ url: "https://conhecimento.fgv.br/edital.pdf", hostname: "conhecimento.fgv.br", label: "Edital", score: 90 }, "fgv-conhecimento");
  expect(result.documentBytes.equals(bytes)).toBe(true);
  expect(result.checksumSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(result.pageCount).toBe(1);
  expect(result.extractedText).toContain("Texto sintetico para verificar extracao de edital");
  expect(result.textLength).toBeGreaterThanOrEqual(100);
  expect(result.pageTexts).toHaveLength(1);
});

it("tipa um PDF corrompido com unpdf real sem preservar seu erro interno", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("%PDF-1.7\nnao e um PDF completo"));
  await expect(captureOfficialPdf({ url: "https://conhecimento.fgv.br/edital.pdf", hostname: "conhecimento.fgv.br", label: "Edital", score: 90 }, "fgv-conhecimento")).rejects.toMatchObject({ code: "pdf_parse_failed", stage: "pdf_parse" });
});
