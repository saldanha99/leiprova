import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { assertOfficialRobotsPathAllowed } from "./planalto-text";

export const CAMARA_CP_CORRECTION = {
  url: "https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html",
  rawSha256: "57547f371c5dd6e609f453397d2098e3930876b03f7233096b0dff907832b3e4",
  canonicalSha256: "7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d",
  amendmentUrl: "https://www2.camara.leg.br/legin/fed/lei/2026/lei-15517-22-setembro-2026-800012-publicacaooriginal-181458-pl.html",
  amendmentRawSha256: "44775d6c3fc157dfd63467295a6aa025285b304f762995577c8773eadc6ce596",
  parserVersion: "camara-cp-correction-preview-v1.0.0",
  oldVersionId: 63,
  oldActId: 17,
  oldVersionChecksum: "2b51ad5b28b2b59ec56166503b388ee8f284d503ec2da705800f1e1085643838",
  oldCorpusFingerprint: "185eed2a650cdea3aed1b9c61f521426ab820f2de5fc4a8cec06385ed53282a2",
} as const;
export const CP63_EXPECTED_HELD_IDS = [3505, 3657, 3507, 3509, 3542, 3543, 3544, 3545, 3546, 3563, 3566, 3569, 3575, 3576, 3577, 3578, 3579, 3586, 3587, 3593, 3637, 3639, 3732, 3758, 3760, 3763, 3765] as const;
export const cpCorrectionSha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
const ARTICLE = /^Art\.\s*(\d{1,3})[º°o]?(?:\s*-\s*([A-Z](?:\s*-\s*[A-Z])?))?\.?\s*(.*)$/iu;
const STRUCTURE = /^(?:PARTE|LIVRO|T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O)(?:\s+[ÚU]NICO|\s+[IVXLCDM]+(?:-[A-Z])?|\s+\d+[º°o]?)?$/iu;
const NORM_START = /^(?:Art\.|Pena\b|§|Par[aá]grafo [úu]nico\b|[IVXLCDM]+\s*[-–—.]|[a-z]\))/iu;
const WITHDRAWN_MARKER = /^(?:[a-z]\)|[IVXLCDM]+\s*[-–—.]|§\s*\d+[º°o]?|Par[aá]grafo [úu]nico\.)?\s*\((?:VETAD[OA]|REVOGAD[OA])[^)]*\)\.?$/iu;
const WITHDRAWN_ARTICLE = /^Art\.\s*\d+[º°o]?(?:-[A-Z](?:-[A-Z])?)?\.?\s*\((?:VETAD|REVOGAD)/iu;
const NOTE = /(?:reda[cç][aã]o|acrescid|revogad|inclu[ií]d|transformad|nome jur[ií]dico|primitiv[oa]|renumerad|vide |promulga[cç][aã]o|vetad)/iu;
function cleanNote(text: string) {
  while (/\([^)]*\)\.?\s*$/u.test(text)) {
    const note = /\(([^)]*)\)\.?\s*$/u.exec(text)!;
    if (!NOTE.test(note[1])) break;
    text = text.slice(0, note.index).trimEnd();
  }
  return text;
}
export type CpCorrectionArticle = {
  path: string; articleRef: string; literalText: string; sourceRowStart: number; sourceRowEnd: number;
  removedBoundaryHeadings: string[]; excludedStructure: string[]; removedWithdrawnMarkers: string[];
};

/** Boundary inspection only. Arbitrary fragments cannot become verified captures. */
export function inspectCamaraCpHtmlBoundaries(html: string) {
  if (html.includes("\ufffd") || /Gateway Time-out|Access Denied|Forbidden/iu.test(html)) throw new Error("Resposta inválida para inspeção do CP.");
  const $ = cheerio.load(html);
  $("script,noscript,img,svg,iframe,strike,s,del").remove();
  $("style").each((_, element) => {
    for (const rule of $(element).text().matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      if (/text-decoration(?:-line)?\s*:[^;]*line-through/iu.test(rule[2])) {
        try { $(rule[1].trim()).remove(); } catch { throw new Error("Marcação retirada não interpretável."); }
      }
    }
  });
  $("style").remove();
  $("[style]").each((_, element) => { if (/text-decoration(?:-line)?\s*:[^;]*line-through/iu.test($(element).attr("style") ?? "")) $(element).remove(); });
  const rows = $("body p,body h1,body h2,body h3,body h4").toArray().map((element, index) => {
    const text = normalize($(element).text()); const bold = normalize($(element).find("b,strong").text());
    return { index, text, clean: cleanNote(text), boldEntire: Boolean(bold) && cleanNote(bold) === cleanNote(text) };
  }).filter(row => row.text);
  const articles: CpCorrectionArticle[] = []; const withdrawn: { path: string; raw: string[] }[] = [];
  const seen = new Set<string>();
  let current: { ref: string; path: string; rows: typeof rows; start: number } | null = null;
  function flush(end: number) {
    if (!current) return;
    const removedBoundaryHeadings: string[] = []; const excludedStructure: string[] = [];
    const withheld = current.rows.filter(row => WITHDRAWN_MARKER.test(row.text));
    let body = current.rows.filter(row => !withheld.includes(row));
    const structure = body.findIndex((row, index) => index > 0 && STRUCTURE.test(row.clean));
    if (structure >= 0) { excludedStructure.push(...body.slice(structure).map(row => row.clean)); body = body.slice(0, structure); }
    while (body.length > 1) {
      const last = body.at(-1)!;
      if (!last.boldEntire || NORM_START.test(last.clean)) break;
      removedBoundaryHeadings.unshift(last.clean); body.pop();
    }
    const literalText = body.map(row => row.clean).filter(Boolean).join("\n");
    if (WITHDRAWN_ARTICLE.test(current.rows[0].text) || !literalText.replace(/^Art\.\s*\S+/iu, "").trim()) {
      withdrawn.push({ path: current.path, raw: current.rows.map(row => row.text) });
    } else articles.push({ path: current.path, articleRef: `Art. ${current.ref}`, literalText, sourceRowStart: current.start, sourceRowEnd: end,
      removedBoundaryHeadings, excludedStructure, removedWithdrawnMarkers: withheld.map(row => row.text) });
    current = null;
  }
  for (const row of rows) {
    const match = ARTICLE.exec(row.text);
    if (match) {
      flush(row.index); const ref = Number(match[1]) + (match[2] ? `-${match[2].toUpperCase().replace(/\s/gu, "")}` : ""); const path = `art-${ref.toLowerCase()}`;
      if (Number(match[1]) > 361 || seen.has(path)) throw new Error("Artigo estrangeiro ou referência duplicada do CP.");
      seen.add(path); current = { ref, path, rows: [row], start: row.index }; continue;
    }
    if (current && /^(?:Bras[ií]lia,|Rio de Janeiro,|Este texto n[aã]o substitui)/iu.test(row.text)) { flush(row.index); break; }
    if (current) current.rows.push(row);
  }
  flush(rows.at(-1)?.index ?? 0);
  return { articles, withdrawn, captureVerified: false as const, publicationAllowed: false as const };
}

export function parseCamaraCpCorrectionCapture(bytes: Uint8Array, sourceUrl: string, contentType: string) {
  if (sourceUrl !== CAMARA_CP_CORRECTION.url) throw new Error("CP fora da URL primária exata.");
  if (bytes.length > 4 * 1024 * 1024 || !/^text\/html(?:;|$)/iu.test(contentType)) throw new Error("Tamanho/MIME inválido; PDF/erro não são CP.");
  if (cpCorrectionSha256(bytes) !== CAMARA_CP_CORRECTION.rawSha256) throw new Error("Perfil/hash bruto desconhecido; exige reconciliação nova.");
  const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const identity = normalize(cheerio.load(html)("body").text());
  if (!/C[ÓO]DIGO PENAL/iu.test(identity) || !/2\.848/iu.test(identity) || !/C[ÂA]MARA DOS DEPUTADOS/iu.test(identity)) throw new Error("Identidade oficial do CP incompleta.");
  const result = inspectCamaraCpHtmlBoundaries(html);
  const canonical = result.articles.map(article => [article.path, "", article.literalText].join("\n")).join("\n\n");
  if (result.articles.length !== 402 || result.withdrawn.length !== 31 || result.articles[0]?.path !== "art-1" || result.articles.at(-1)?.path !== "art-361" || cpCorrectionSha256(canonical) !== CAMARA_CP_CORRECTION.canonicalSha256) throw new Error("Corpus/fronteiras do CP não correspondem ao perfil 402 conferido.");
  return { ...result, captureVerified: true as const, sourceUrl, rawSha256: cpCorrectionSha256(bytes), canonicalSha256: cpCorrectionSha256(canonical), parserVersion: CAMARA_CP_CORRECTION.parserVersion, humanReview: false as const };
}

export type StoredCpCorrectionArticle = { id: number; versionId: number; path: string; articleOrder: number; heading: string | null; literalText: string; sourceRights: string; editorialStatus: string; questionCount: number; bindingCount: number; primaryRequirementCount: number; additionalRequirementCount: number };
export function storedCpCorrectionFingerprint(rows: readonly StoredCpCorrectionArticle[]) {
  return cpCorrectionSha256([...rows].sort((a, b) => a.articleOrder - b.articleOrder).map(row => JSON.stringify([row.id, row.versionId, row.path, row.articleOrder, row.heading, row.literalText, row.sourceRights])).join("\n\n"));
}

export function compareCamaraCpCorrection(old: readonly StoredCpCorrectionArticle[], fresh: ReturnType<typeof parseCamaraCpCorrectionCapture>, amendmentBytes: Uint8Array) {
  const held = new Set<number>(CP63_EXPECTED_HELD_IDS);
  const currentCanonical = cpCorrectionSha256(fresh.articles.map(article => [article.path, "", article.literalText].join("\n")).join("\n\n"));
  if (fresh.sourceUrl !== CAMARA_CP_CORRECTION.url || fresh.rawSha256 !== CAMARA_CP_CORRECTION.rawSha256 || fresh.parserVersion !== CAMARA_CP_CORRECTION.parserVersion || fresh.canonicalSha256 !== CAMARA_CP_CORRECTION.canonicalSha256 || currentCanonical !== CAMARA_CP_CORRECTION.canonicalSha256 || fresh.articles.length !== 402 || fresh.withdrawn.length !== 31) throw new Error("Captura CP63/candidato não corresponde ao fingerprint conferido.");
  if (!fresh.captureVerified || !fresh.articles.length || old.length !== 423 || storedCpCorrectionFingerprint(old) !== CAMARA_CP_CORRECTION.oldCorpusFingerprint || old.some(row => row.versionId !== 63 || row.sourceRights !== "official_text" || row.editorialStatus !== (held.has(row.id) ? "suspended" : "reviewed"))) throw new Error("Corpus CP63/identidade/fingerprint/27 suspensões desconhecido.");
  if (cpCorrectionSha256(amendmentBytes) !== CAMARA_CP_CORRECTION.amendmentRawSha256) throw new Error("Lei 15.517 mudou; prova normativa desconhecida.");
  const $ = cheerio.load(new TextDecoder("utf-8", { fatal: true }).decode(amendmentBytes)); $("script,style,noscript").remove(); const amendmentText = normalize($("body").text());
  if (!/LEI Nº 15\.517/iu.test(amendmentText) || !amendmentText.includes("23/09/2026")) throw new Error("Identidade/publicação da Lei 15.517 inválida.");
  const previous = new Map(old.map(row => [row.path, row]));
  const comparisons = fresh.articles.map(article => {
    const stored = previous.get(article.path); let category = "valid_article_previously_omitted_parser_defect";
    if (!stored && article.path !== "art-88") throw new Error("Artigo novo inesperado.");
    if (stored) {
      const headings = article.removedBoundaryHeadings;
      let adjusted = stored.literalText; for (const heading of headings) { if (adjusted.endsWith(`\n${heading}`)) adjusted = adjusted.slice(0, -heading.length - 1); }
      if (stored.literalText === article.literalText) category = "exact";
      else if (normalize(stored.literalText) === normalize(article.literalText)) category = "formatting_only";
      else if (adjusted === article.literalText) category = "heading_only";
      else {
        const withdrawnSet = new Set(article.removedWithdrawnMarkers.map(cleanNote));
        let editorial = stored.literalText.split("\n").map(cleanNote).filter(line => line && !withdrawnSet.has(line));
        const structure = editorial.findIndex(line => STRUCTURE.test(line)); if (structure >= 0 && article.excludedStructure.length) editorial = editorial.slice(0, structure);
        for (const heading of headings) { if (editorial.at(-1) === heading) editorial.pop(); }
        if (editorial.join("\n") === article.literalText) category = "editorial_marker_note_structure_heading_only";
        else if (article.path === "art-361" && stored.literalText.startsWith(`${article.literalText}\nRio de Janeiro,`)) category = "signature_footer_only";
        else if (["art-155", "art-157"].includes(article.path)) {
          const withdrawnPrefixes = article.removedWithdrawnMarkers.map(line => line.slice(0, line.indexOf("(")).trim());
          const oldLines = stored.literalText.split("\n").filter(line => !headings.includes(line) && !withdrawnPrefixes.includes(line));
          const newLines = article.literalText.split("\n"); const added = newLines.filter(line => !oldLines.includes(line));
          if (!added.length || oldLines.some(line => !newLines.includes(line)) || added.some(line => !amendmentText.includes(normalize(line)))) throw new Error("Diferença normativa não comprovada pela Lei 15.517.");
          category = "normative_change_confirmed_by_law_15517";
        } else throw new Error(`Diferença normativa/parser desconhecida em ${article.path}.`);
      }
    }
    return { ...article, category, oldId: stored?.id ?? null, oldHash: stored ? cpCorrectionSha256(stored.literalText) : null, freshHash: cpCorrectionSha256(article.literalText), oldEditorialStatus: stored?.editorialStatus ?? null,
      impact: stored ? { questions: stored.questionCount, bindings: stored.bindingCount, primaryRequirements: stored.primaryRequirementCount, additionalRequirements: stored.additionalRequirementCount } : null };
  });
  const missing = old.filter(row => !fresh.articles.some(article => article.path === row.path)).map(row => {
    const proof = fresh.withdrawn.find(article => article.path === row.path);
    if (!proof || !WITHDRAWN_ARTICLE.test(proof.raw[0])) throw new Error("Artigo ausente sem prova oficial de retirada.");
    return { ...row, oldHash: cpCorrectionSha256(row.literalText), currentOfficialWithdrawal: proof.raw[0], category: "whole_withdrawn_article_not_normative" };
  });
  if (missing.length !== 22) throw new Error("Conjunto retirado do CP63 desconhecido.");
  const counts: Record<string, number> = {}; for (const row of comparisons) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return { comparisons, missing, counts, databaseWrites: 0 as const, publicationAllowed: false as const };
}

export async function fetchCamaraCpCorrectionEvidence() {
  const headers = { "User-Agent": "EditalLeiSeca-OfficialSourceMonitor/1.0 (+https://editaleiseca.com.br/fontes-e-atualizacao)", Accept: "text/html,text/plain;q=0.9" };
  async function read(url: string, limit: number, robots = false) {
    const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if ((!response.ok && !(robots && response.status === 404)) || response.redirected || response.url !== url) throw new Error(`Fonte CP HTTP ${response.status}/URL divergente; sem contorno.`);
    if (!response.body || Number(response.headers.get("content-length")) > limit) throw new Error("Corpo ausente ou tamanho excedido.");
    const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error("Corpo excedeu limite."); chunks.push(value); } } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { bytes, mime: response.headers.get("content-type") ?? "", status: response.status, fetchedAt: new Date() };
  }
  const robots = await read("https://www2.camara.leg.br/robots.txt", 65_536, true);
  if (robots.status !== 404 && !/^text\/plain(?:;|$)/iu.test(robots.mime)) throw new Error("robots não respondeu como política textual; captura bloqueada.");
  if (robots.status !== 404) for (const url of [CAMARA_CP_CORRECTION.url, CAMARA_CP_CORRECTION.amendmentUrl]) assertOfficialRobotsPathAllowed(new TextDecoder("utf-8", { fatal: true }).decode(robots.bytes), new URL(url).pathname);
  const body = await read(CAMARA_CP_CORRECTION.url, 4 * 1024 * 1024); const amendment = await read(CAMARA_CP_CORRECTION.amendmentUrl, 131_072);
  const parsed = parseCamaraCpCorrectionCapture(body.bytes, CAMARA_CP_CORRECTION.url, body.mime);
  if (!/^text\/html(?:;|$)/iu.test(amendment.mime) || cpCorrectionSha256(amendment.bytes) !== CAMARA_CP_CORRECTION.amendmentRawSha256) throw new Error("MIME/hash da Lei 15.517 desconhecido.");
  return { parsed, body, amendment, robots, publicationAllowed: false as const };
}
