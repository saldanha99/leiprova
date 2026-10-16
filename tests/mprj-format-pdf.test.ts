import { expect, it } from "vitest";
import { extractFirstPageText } from "@/lib/editorial/mprj-format-evidence";

// A tiny, wholly synthetic PDF built in RAM. No downloaded PDF/question fixture.
function syntheticPdf() {
  const stream = (text: string) => { const body = `BT /F1 12 Tf 30 100 Td (${text}) Tj ET`; return `<< /Length ${body.length} >>\nstream\n${body}\nendstream`; };
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>", stream("SYNTHETIC COVER"),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>", stream("UNREAD SECOND PAGE"),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}
it("real unpdf/PDF.js accepts the copied Uint8Array and extracts page1 only", async () => {
  const downloaded = syntheticPdf();
  expect(Buffer.isBuffer(downloaded)).toBe(true);
  const text = await extractFirstPageText(downloaded);
  expect(text.trim()).toBe("SYNTHETIC COVER"); expect(text).not.toContain("UNREAD");
  expect(downloaded.subarray(0, 5).toString()).toBe("%PDF-");
});
