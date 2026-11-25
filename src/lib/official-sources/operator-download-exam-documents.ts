import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { parseOfficialExamUrl } from "@/lib/official-sources/exam-registry";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";

/**
 * Prova anterior cuja banca recusa o servidor (WAF/Akamai da Vunesp, 403 em qualquer caminho).
 * Exceção nominal do proprietário: cada link entra só com URL e SHA-256 fixados aqui, e a
 * conferência usa o PDF que o operador baixou no navegador da mesma URL, recente. Não contorna
 * o bloqueio: sem arquivo recente com o mesmo hash, a conferência falha como um link fora do ar.
 */
export const OPERATOR_DOWNLOAD_EXAM_DOCUMENTS = [
  {
    bankSlug: "vunesp",
    url: "https://documento.vunesp.com.br/documento/stream/NzkxNzc3Mw%3d%3d",
    sha256: "f59bb4da17c647be0e220c9cc5c3b87edfa29d9c308eb43d3c00f3ef2ee76d46",
    title: "TCE-SP 001/2026 — caderno da prova objetiva 004 — Auditor de Controle Externo DIPE — Direito (versão de divulgação)",
    decidedOn: "2026-11-25",
    approvalReference: "owner-decision-2026-11-25:tcesp-vunesp-prova-gabarito",
    reason: "Vinícius (25/11/2026): exceção à fonte Vunesp só para a prova e o gabarito oficiais do TCE-SP (Edital 001/2026, prova de 11/10/2026). O caderno só é publicado pela Vunesp, cujo WAF recusa o servidor.",
  },
] as const;

export const OPERATOR_EXAM_DOWNLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function operatorDownloadExamDocument(bankSlug: string, url: string) {
  return OPERATOR_DOWNLOAD_EXAM_DOCUMENTS.find((item) => item.bankSlug === bankSlug && item.url === url) ?? null;
}

type Options = Readonly<{ directory?: string; now?: Date; verify?: typeof verifyOfficialExamUrl }>;

/** Mesmo retorno de `verifyOfficialExamUrl`; para link da exceção, exige `<sha256>.pdf` em
 * OPERATOR_EXAM_DOWNLOAD_DIR, baixado há no máximo 24 h, com o hash fixado e assinatura PDF. */
export async function verifyOfficialExamUrlWithOperatorDownload(bankSlug: string, url: string, options: Options = {}) {
  const pinned = operatorDownloadExamDocument(bankSlug, url);
  if (!pinned) return (options.verify ?? verifyOfficialExamUrl)(bankSlug, url);
  parseOfficialExamUrl(bankSlug, url);
  const directory = options.directory ?? process.env.OPERATOR_EXAM_DOWNLOAD_DIR;
  if (!directory) throw new Error("Link da exceção de download do operador: informe OPERATOR_EXAM_DOWNLOAD_DIR com o PDF baixado no navegador.");
  const file = join(directory, `${pinned.sha256}.pdf`);
  const info = await stat(file);
  const age = (options.now ?? new Date()).getTime() - info.mtime.getTime();
  if (!info.isFile() || age < -60_000 || age > OPERATOR_EXAM_DOWNLOAD_MAX_AGE_MS) throw new Error("Download do operador ausente, futuro ou com mais de 24 h; baixe de novo no navegador.");
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== pinned.sha256) throw new Error("PDF baixado difere do SHA-256 fixado na exceção; o documento oficial mudou.");
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("Arquivo baixado não é PDF.");
  return { httpStatus: 200, pageTitle: null, contentType: "application/pdf", isPdf: true, finalUrl: url, checkedAt: info.mtime, operatorDownloadSha256: pinned.sha256 };
}
