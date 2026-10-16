import { createHash } from "node:crypto";

import { getDocumentProxy } from "unpdf";

import { assertOfficialRobotsPathAllowed } from "@/lib/official-sources/planalto-text";
import { officialFormatEvidenceMatches } from "./official-question-contract";

export const MPRJ_MC5_FORMAT_EVIDENCE = {
  opportunityId: 20,
  examEditionId: 41,
  institution: "MPRJ",
  jurisdiction: "RJ",
  roleName: "Promotor de Justiça Substituto",
  noticeNumber: "XXXIX/2026",
  sourceUrl:
    "https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns001-tipo-1.pdf",
  parserVersion: "mprj-type1-cover-mc5-v1",
  pageNumber: 1,
  format: "multiple_choice" as const,
  optionCount: 5 as const,
  singleCorrect: true as const,
} as const;

const ROBOTS_URL = "https://conhecimento.fgv.br/robots.txt";
const MAX_ROBOTS_BYTES = 64 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MIN_PDF_BYTES = 1024;
const SOURCE_TIMEOUT_MS = 15_000;

const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/gu, " ").trim().toLowerCase();

export type MprjMc5FormatObservation = {
  sourceUrl: string;
  sourceSha256: string;
  robotsSha256: string;
  pageNumber: 1;
  pageTextSha256: string;
  parserVersion: typeof MPRJ_MC5_FORMAT_EVIDENCE.parserVersion;
  format: "multiple_choice";
  optionCount: 5;
  singleCorrect: true;
  questionCount: 100;
};

export function parseMprjType1Cover(pageText: string) {
  const text = normalize(pageText);
  // The official cover uses letter-spaced headings; discard spacing/punctuation only for identity.
  const heading = text.replace(/[^a-z0-9]/gu, "");
  if (pageText.length > 80_000 || /\bnao (?:tem|contem|esta|e|sao)|\b(?:4|6)\s*\((?:quatro|seis)\)\s*opcoes|(?:duas|mais de uma) (?:delas |respostas? )?(?:esta|estao|corret)/u.test(text)) {
    throw new Error("Instruções de capa negadas ou ambíguas.");
  }
  const identityValid =
    text.includes("xxxix concurso") &&
    heading.includes("promotordejusticasubstituto") &&
    /\bt\s*i\s*p\s*o\s*[-–—:]?\s*1\b/u.test(text) &&
    /100\s*\(cem\)\s*questoes objetivas/u.test(text);
  const formatValid =
    /questoes objetivas tem 5\s*\(cinco\)\s*opcoes de resposta\s*\(a, b, c, d e e\) e somente uma delas esta correta/u.test(
      text,
    );
  if (!identityValid || !formatValid || !officialFormatEvidenceMatches("multiple_choice", pageText)) {
    throw new Error("Capa oficial não comprova identidade MPRJ XXXIX/2026 e formato MC5 único.");
  }
  return {
    pageNumber: 1 as const,
    pageTextSha256: createHash("sha256").update(text).digest("hex"),
    parserVersion: MPRJ_MC5_FORMAT_EVIDENCE.parserVersion,
    format: "multiple_choice" as const,
    optionCount: 5 as const,
    singleCorrect: true as const,
    questionCount: 100 as const,
  };
}

async function readOfficialText(
  url: string,
  maxBytes: number,
  fetcher: typeof fetch,
  mime: "text/plain" | "application/pdf",
) {
  const response = await fetcher(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    cache: "no-store",
    headers: { Accept: mime, "User-Agent": "EditalLeiSeca-OfficialFormatEvidence/1.0" },
  });
  if (response.status !== 200 || (response.url && response.url !== url)) {
    throw new Error("Fonte oficial indisponível ou redirecionada; evidência MC5 recusada.");
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== mime) throw new Error("MIME oficial inesperado; evidência MC5 recusada.");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Fonte oficial excede o limite transitório de bytes.");
  }
  if (!response.body) throw new Error("Fonte oficial sem corpo; evidência MC5 recusada.");
  const bytes = Buffer.alloc(maxBytes);
  const digest = createHash("sha256");
  let length = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > maxBytes) {
        throw new Error("Fonte oficial excede o limite transitório de bytes.");
      }
      bytes.set(value, length);
      digest.update(value);
      length += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    bytes.fill(0);
    throw error;
  }
  if (length < (mime === "application/pdf" ? MIN_PDF_BYTES : 1)) {
    bytes.fill(0);
    throw new Error("Fonte oficial vazia ou curta demais.");
  }
  return {
    bytes: bytes.subarray(0, length),
    clear: () => bytes.fill(0),
    sha256: digest.digest("hex"),
  };
}

export async function extractFirstPageText(bytes: Uint8Array) {
  if (!Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).includes(Buffer.from("%PDF-"))) {
    throw new Error("Assinatura PDF ausente; evidência MC5 recusada.");
  }
  // PDF.js transfers its input buffer. Keep a real Uint8Array copy separate from the wiped download.
  const parserBytes = new Uint8Array(bytes);
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(parserBytes, {
      disableAutoFetch: true, disableStream: true, disableRange: true,
      useSystemFonts: false, disableFontFace: true,
    });
    if (pdf.numPages < 1 || pdf.numPages > 250) throw new Error("Quantidade de páginas inesperada.");
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    return content.items
      .filter((item) => "str" in item && typeof item.str === "string")
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
  } finally {
    try { await pdf?.loadingTask.destroy(); }
    finally { if (parserBytes.byteLength) parserBytes.fill(0); }
  }
}

export async function observeMprjMc5Cover(options: {
  fetcher?: typeof fetch;
  extractPageOne?: (bytes: Uint8Array) => Promise<string>;
} = {}): Promise<MprjMc5FormatObservation> {
  const fetcher = options.fetcher ?? fetch;
  const robots = await readOfficialText(ROBOTS_URL, MAX_ROBOTS_BYTES, fetcher, "text/plain");
  let robotsText: string;
  try { robotsText = new TextDecoder("utf-8", { fatal: true }).decode(robots.bytes); } finally { robots.clear(); }
  assertOfficialRobotsPathAllowed(robotsText, new URL(MPRJ_MC5_FORMAT_EVIDENCE.sourceUrl).pathname);

  const pdf = await readOfficialText(
    MPRJ_MC5_FORMAT_EVIDENCE.sourceUrl,
    MAX_PDF_BYTES,
    fetcher,
    "application/pdf",
  );
  try {
    const pageText = await (options.extractPageOne ?? extractFirstPageText)(pdf.bytes);
    const pageFacts = parseMprjType1Cover(pageText);
    return {
      sourceUrl: MPRJ_MC5_FORMAT_EVIDENCE.sourceUrl,
      sourceSha256: pdf.sha256,
      robotsSha256: robots.sha256,
      ...pageFacts,
    };
  } finally {
    pdf.clear();
  }
}
