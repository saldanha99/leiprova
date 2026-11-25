import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { OPERATOR_DOWNLOAD_EXAM_DOCUMENTS, verifyOfficialExamUrlWithOperatorDownload } from "@/lib/official-sources/operator-download-exam-documents";

const pinned = OPERATOR_DOWNLOAD_EXAM_DOCUMENTS[0];

describe("exceção de download do operador (Vunesp/TCE-SP)", () => {
  it("delega à verificação de rede quando o link não está na exceção", async () => {
    const verify = async () => ({ httpStatus: 200, pageTitle: null, contentType: "application/pdf", isPdf: true, finalUrl: "x", checkedAt: new Date() });
    await expect(verifyOfficialExamUrlWithOperatorDownload("fgv", "https://conhecimento.fgv.br/a.pdf", { verify })).resolves.toMatchObject({ finalUrl: "x" });
  });

  it("recusa sem diretório, com arquivo de hash diferente ou antigo", async () => {
    await expect(verifyOfficialExamUrlWithOperatorDownload(pinned.bankSlug, pinned.url, { directory: "" })).rejects.toThrow(/OPERATOR_EXAM_DOWNLOAD_DIR/u);
    const directory = await mkdtemp(join(tmpdir(), "opdl-"));
    const file = join(directory, `${pinned.sha256}.pdf`);
    await writeFile(file, "%PDF-1.7 outro conteúdo");
    await expect(verifyOfficialExamUrlWithOperatorDownload(pinned.bankSlug, pinned.url, { directory })).rejects.toThrow(/SHA-256/u);
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(file, old, old);
    await expect(verifyOfficialExamUrlWithOperatorDownload(pinned.bankSlug, pinned.url, { directory })).rejects.toThrow(/24 h/u);
  });
});
