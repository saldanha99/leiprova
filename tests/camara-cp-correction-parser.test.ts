import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAMARA_CP_CORRECTION, CP63_EXPECTED_HELD_IDS, compareCamaraCpCorrection, fetchCamaraCpCorrectionEvidence, inspectCamaraCpHtmlBoundaries, parseCamaraCpCorrectionCapture, storedCpCorrectionFingerprint, type StoredCpCorrectionArticle } from "@/lib/official-sources/camara-cp-correction-parser";
import { parseCpCorrectionPreviewArgs, requireCpCorrectionPreviewDatabase } from "../scripts/preview-camara-cp-correction";

const fixture = (content: string) => `<html><body>${content}</body></html>`;
const inspect = (content: string) => inspectCamaraCpHtmlBoundaries(fixture(content));
afterEach(() => vi.unstubAllGlobals());

describe("fronteiras da prévia de correção CP, sem publicação", () => {
  it("separa154-A/154-B e remove nota do nome jurídico, preservando a ação normativa", () => {
    const parsed = inspect('<p>Art. 154-A. Texto sintético da regra.</p><p>Pena - regra sintética.</p><p><b>Ação penal</b> (Nome jurídico acrescido pela Lei nº1)</p><p>Art. 154-B. Texto sintético da representação.</p>');
    expect(parsed.articles[0].literalText).toBe("Art. 154-A. Texto sintético da regra.\nPena - regra sintética.");
    expect(parsed.articles[0].removedBoundaryHeadings).toEqual(["Ação penal"]);
    expect(parsed.captureVerified).toBe(false); expect(parsed.publicationAllowed).toBe(false);
  });
  it("mantém subtítulo interno298 e exclui nome do artigo299", () => {
    const parsed = inspect('<p>Art. 298. Regra sintética.</p><p><b>Falsificação de cartão</b></p><p>Parágrafo único. Exemplo sintético.</p><p><b>Falsidade ideológica</b></p><p>Art. 299. Outra regra.</p>');
    expect(parsed.articles[0].literalText).toContain("Falsificação de cartão\nParágrafo único.");
    expect(parsed.articles[0].literalText).not.toContain("Falsidade ideológica");
  });
  it("não confunde verbo Revogado do88 com retirada e mantém sufixos duplos", () => {
    const parsed = inspect('<p>Art. 88. Revogado o livramento, regra sintética.</p><p>Art. 359-M. Texto sintético.</p><p>Art. 359-M-A. Texto específico A.</p><p>Art. 359-M-B. Texto específico B.</p>');
    expect(parsed.articles.map(row => row.path)).toEqual(["art-88", "art-359-m", "art-359-m-a", "art-359-m-b"]);
    expect(parsed.withdrawn).toEqual([]);
  });
  it("exclui exatamente22 referências inteiramente retiradas e não transporta títulos", () => {
    const refs = ["187", "188", "189", "192", "193", "214", "216", "217", "219", "220", "221", "223", "224", "231", "232", "234-C", "279", "281", "350", "359-O", "359-Q", "359-U"];
    const parsed = inspect(refs.map((ref, index) => `<p>Art. ${ref}. (${index % 2 ? "VETADO" : "Revogado"} pela Lei nº1)</p><p><b>Nome seguinte</b></p>`).join("") + '<p>Art. 361. Regra sintética vigente.</p>');
    expect(parsed.withdrawn.map(row => row.path)).toEqual(refs.map(ref => `art-${ref.toLowerCase()}`));
    expect(parsed.articles).toHaveLength(1);
  });
  it("remove marcadores vazios mas preserva corpo promulgado com nota de veto", () => {
    const parsed = inspect('<p>Art. 141. Regra.</p><p>§ 2º Regra efetiva. (Parágrafo vetado, mantido pelo Congresso e publicado no DOU)</p><p>§ 3º (VETADO na Lei nº1)</p><p>Art. 157. Outra regra.</p><p>e) (VETADA na Lei nº1)</p><p>§ 3º Regra válida.</p>');
    expect(parsed.articles[0].literalText).toContain("§ 2º Regra efetiva.");
    expect(parsed.articles[0].literalText).not.toContain("§ 3º");
    expect(parsed.articles[1].literalText).not.toContain("e)");
    expect(parsed.articles[1].literalText).toContain("§ 3º Regra válida.");
  });
  it("limpa notas primitivas/renumeradas e separa capítulo com sufixo I-A", () => {
    const parsed = inspect('<p>Art. 43. Regra.</p><p>V - item vigente. (Primitivo inciso II renumerado pela Lei nº1)</p><p>CAPÍTULO I-A</p><p>OUTRO TÍTULO</p><p><b>Próximo crime</b></p><p>Art. 44. Nova regra.</p>');
    expect(parsed.articles[0].literalText).toBe("Art. 43. Regra.\nV - item vigente.");
    expect(parsed.articles[0].excludedStructure).toContain("CAPÍTULO I-A");
  });
  it("separa título352 de351 e encerra361 antes da assinatura/footer", () => {
    const parsed = inspect('<p>Art. 351. Regra sintética da fuga.</p><p><b>Evasão mediante violência contra a pessoa</b></p><p>Art. 352. Outra regra.</p><p>Art. 361. Data sintética.</p><p>Rio de Janeiro, 7 de dezembro de 1940.</p><p>ASSINATURA</p><p>Intranet</p>');
    expect(parsed.articles[0].literalText).not.toContain("Evasão mediante");
    expect(parsed.articles.at(-1)?.literalText).toBe("Art. 361. Data sintética.");
  });
  it("falha com referência duplicada/estrangeira, Unicode inválido ou erro HTTP200", () => {
    for (const content of ['<p>Art. 88. Regra.</p><p>Art. 88. Duplicada.</p>', '<p>Art. 999. Estrangeira.</p>', '<p>Art. 1. \ufffd</p>', '<p>504 Gateway Time-out</p>']) expect(() => inspect(content)).toThrow();
  });
  it("respeita strike e estilos de retirada sem deixar artigo histórico duplicado", () => {
    const parsed = inspect('<style>.old {text-decoration:line-through}</style><p class="old">Art. 88. Texto retirado.</p><p>Art. 88. Regra vigente sintética.</p>');
    expect(parsed.articles).toHaveLength(1); expect(parsed.articles[0].literalText).not.toContain("retirado");
  });
});

describe("captura, identidade e comando CP fail closed", () => {
  it("recusa URL parecida, original, query/fragmento e bytes com perfil desconhecido", () => {
    const bytes = new TextEncoder().encode(fixture('<p>Art. 1. Fonte sintética.</p>'));
    for (const url of [CAMARA_CP_CORRECTION.url + "?x=1", CAMARA_CP_CORRECTION.url + "#art1", CAMARA_CP_CORRECTION.url.replace("normaatualizada", "publicacaooriginal"), CAMARA_CP_CORRECTION.url.replace("www2.camara.leg.br", "camara.leg.br.evil")]) expect(() => parseCamaraCpCorrectionCapture(bytes, url, "text/html")).toThrow(/URL/u);
    expect(() => parseCamaraCpCorrectionCapture(bytes, CAMARA_CP_CORRECTION.url, "text/html")).toThrow(/desconhecido/u);
    expect(() => parseCamaraCpCorrectionCapture(bytes, CAMARA_CP_CORRECTION.url, "application/pdf")).toThrow(/MIME/u);
  });
  it("rejeita robots403 e robots proibitivo antes de buscar corpo", async () => {
    function response(body: string, status: number) { const r = new Response(body, { status, headers: { "content-type": "text/plain" } }); Object.defineProperty(r, "url", { value: "https://www2.camara.leg.br/robots.txt" }); return r; }
    for (const robots of [response("bloqueado", 403), response("User-agent: *\nDisallow: /legin/", 200)]) {
      const fetcher = vi.fn().mockResolvedValue(robots); vi.stubGlobal("fetch", fetcher);
      await expect(fetchCamaraCpCorrectionEvidence()).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("permite apenas nome de saída privado, sem apply, e owner leiprova exatos", () => {
    expect(parseCpCorrectionPreviewArgs(["output=cp-20261012-a"])).toEqual({ outputName: "cp-20261012-a" });
    for (const args of [[], ["--apply"], ["output=../outside"], ["output=/tmp/x"], ["output=a", "--apply"]]) expect(() => parseCpCorrectionPreviewArgs(args)).toThrow();
    expect(requireCpCorrectionPreviewDatabase("postgres://leiprova_owner:fictional@leiprova-db:5432/leiprova")).toContain("leiprova_owner");
    for (const url of [undefined, "postgres://leiprova_app:fictional@db/leiprova", "postgres://leiprova_owner:fictional@db/other"]) expect(() => requireCpCorrectionPreviewDatabase(url)).toThrow();
  });
  it("não permite perfil CP63 desconhecido nem trata mudança de estado como mudança de literal", () => {
    const row: StoredCpCorrectionArticle = { id: 1, versionId: 63, path: "art-1", articleOrder: 1, heading: null, literalText: "Art. 1. Sintético.", sourceRights: "official_text", editorialStatus: "reviewed", questionCount: 0, bindingCount: 0, primaryRequirementCount: 0, additionalRequirementCount: 0 };
    expect(storedCpCorrectionFingerprint([row])).toBe(storedCpCorrectionFingerprint([{ ...row, editorialStatus: "suspended" }]));
    expect(CP63_EXPECTED_HELD_IDS).toHaveLength(27);
    expect(() => compareCamaraCpCorrection([row], { ...inspect("<p>Art. 1. Sintético.</p>"), captureVerified: true, sourceUrl: CAMARA_CP_CORRECTION.url, rawSha256: CAMARA_CP_CORRECTION.rawSha256, canonicalSha256: CAMARA_CP_CORRECTION.canonicalSha256, parserVersion: CAMARA_CP_CORRECTION.parserVersion, humanReview: false }, new Uint8Array())).toThrow(/CP63/u);
  });
  it("preserva CLI somente leitura e não integra criação/ativação de fonte", () => {
    const command = readFileSync(new URL("../scripts/preview-camara-cp-correction.ts", import.meta.url), "utf8");
    expect(command).toContain('client.begin("read only"'); expect(command).toContain("transaction_read_only");
    expect(command).not.toMatch(/\b(?:insert into|update legal_|delete from|set status=|LEGAL_STANDING_REVIEW_REFERENCE)\b/iu);
  });
  const privatePath = ".local/editorial/lei12737-reconciliacao-20261012/cp-current-camara.html";
  it.skipIf(!existsSync(privatePath))("confronta captura privada existente sem versionar corpo integral", () => {
    const parsed = parseCamaraCpCorrectionCapture(readFileSync(privatePath), CAMARA_CP_CORRECTION.url, "text/html; charset=UTF-8");
    expect(parsed.articles).toHaveLength(402); expect(parsed.withdrawn).toHaveLength(31);
    expect(parsed.canonicalSha256).toBe(CAMARA_CP_CORRECTION.canonicalSha256); expect(parsed.publicationAllowed).toBe(false);
  });
});
