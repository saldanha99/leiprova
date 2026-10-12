import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAMARA_LGPD_SOURCE } from "@/lib/official-sources/camara-text";
import { getOfficialLegalSource } from "@/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "@/lib/official-sources/legal-text";
import { OFFICIAL_LAW_STANDING_REFERENCE, parseStandingLawReviewArgs, standingLawFingerprint, validateFreshStandingLawCapture, validateStandingLawCorpus, type StandingLawContext } from "@/lib/official-sources/standing-law-review";

const snapshotId = "49cabf2a-f309-4f37-9df4-6ed584759920";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const now = new Date("2026-10-12T04:00:00.000Z");
function context(): StandingLawContext {
  const source = getOfficialLegalSource("lei-geral-protecao-dados-2018")!;
  const refs = [...Array.from({ length: 65 }, (_, index) => String(index + 1)).filter((number) => !["28", "55", "56", "57", "58", "59", "60"].includes(number)), ..."ACDEFGHIJKLM".split("").map((suffix) => `55-${suffix}`), "58-A", "58-B"];
  const normalizedContent = refs.map((reference) => `Art. ${reference}. Texto sintético para testar a revisão permanente delimitada, com conteúdo suficiente e origem auditada.\nI - primeiro inciso sintético.\n§ 1º Parágrafo sintético vigente.`).join("\n\n");
  const articles = parseConsolidatedLegalArticles(normalizedContent);
  const canonical = articles.map((article) => [article.path, "", article.literalText].join("\n")).join("\n\n");
  const monitorContent = "Referência oficial de teste Art. 1. ".repeat(40);
  return {
    act: { id: 98, slug: source.slug, officialUrl: source.officialUrl, urn: source.lexmlUrn, isActive: true, actNumber: "13.709", actYear: 2018, actType: "lei", jurisdiction: "federal" },
    monitor: { id: 201, publicId: "b663c4b3-aaf2-402b-b047-8b9868176780", legalActId: 98, sourceUrl: source.monitorUrl, checksumSha256: hash(monitorContent), normalizedContent: monitorContent, fetchedAt: now, status: "pending_review" },
    text: { id: 501, publicId: snapshotId, legalActId: 98, monitorSnapshotId: 201, sourceUrl: CAMARA_LGPD_SOURCE.url, parserVersion: CAMARA_LGPD_SOURCE.parserVersion, checksumSha256: hash([CAMARA_LGPD_SOURCE.url, CAMARA_LGPD_SOURCE.parserVersion, canonical].join("\n")), normalizedContent, articleCount: articles.length, contentLength: normalizedContent.length, fetchedAt: now, status: "pending_review" },
  };
}

function fresh(c: StandingLawContext) { return { monitor: { ...c.monitor, fetchedAt: now }, text: { ...c.text, fetchedAt: now } }; }

describe("revisão permanente delimitada da LGPD", () => {
  it("exige UUID/checksum/fingerprint/standing exatos e isola inspect sem apply", () => {
    const c = context();
    expect(parseStandingLawReviewArgs(["--standing", `snapshot=${snapshotId}`, `checksum=${c.text.checksumSha256}`, `fingerprint=${standingLawFingerprint(c)}`]).apply).toBe(false);
    expect(parseStandingLawReviewArgs(["--inspect", `snapshot=${snapshotId}`])).toEqual({ inspect: true, apply: false, snapshot: snapshotId });
    for (const args of [["--inspect", "--apply", `snapshot=${snapshotId}`], [`snapshot=${snapshotId}`], ["--standing", `snapshot=${snapshotId}`, "checksum=no", "fingerprint=no"], ["--inspect", "snapshot=1"], ["--inspect", `snapshot=${snapshotId}`, "foo=bar"]]) expect(() => parseStandingLawReviewArgs(args)).toThrow();
  });

  it("valida 72 artigos substantivos, proveniência e confronto oficial fresco", () => {
    const c = context();
    const expected = { checksum: c.text.checksumSha256, fingerprint: standingLawFingerprint(c) };
    expect(validateStandingLawCorpus(c)).toHaveLength(72);
    expect(validateFreshStandingLawCapture(c, expected, fresh(c), now)).toHaveLength(72);
    c.text.status = "approved"; c.monitor.status = "approved";
    expect(standingLawFingerprint(c)).toBe(expected.fingerprint);
  });

  it("bloqueia parser defeituoso antigo, qualquer outra lei, rejeição e monitor errado", () => {
    for (const mutate of [(c: StandingLawContext) => { c.text.parserVersion = "camara-lgpd-consolidated-v1.0.0"; }, (c: StandingLawContext) => { c.act.slug = "lei-licitacoes-contratos-2021"; }, (c: StandingLawContext) => { c.text.status = "rejected"; }, (c: StandingLawContext) => { c.text.monitorSnapshotId = 999; }, (c: StandingLawContext) => { c.text.sourceUrl += "?download=1"; }]) {
      const c = context(); mutate(c); expect(() => validateStandingLawCorpus(c)).toThrow();
    }
  });

  it("bloqueia títulos anexados, integridade alterada e quantidade divergente antes de ativar", () => {
    const c = context(); c.text.normalizedContent += "\nDas Regras"; c.text.contentLength = c.text.normalizedContent.length;
    expect(() => validateStandingLawCorpus(c)).toThrow(/título/u);
    const wrong = context(); wrong.text.articleCount = 71;
    expect(() => validateStandingLawCorpus(wrong)).toThrow(/72/u);
    const badMonitor = context(); badMonitor.monitor.normalizedContent += "alteração";
    expect(() => validateStandingLawCorpus(badMonitor)).toThrow(/Integridade/u);
  });

  it("bloqueia TOCTOU, fontes divergentes e conferência antiga", () => {
    const c = context(); const expected = { checksum: c.text.checksumSha256, fingerprint: standingLawFingerprint(c) };
    expect(() => validateFreshStandingLawCapture(c, { ...expected, fingerprint: "f".repeat(64) }, fresh(c), now)).toThrow(/fingerprint/u);
    const changed = fresh(c); changed.text.normalizedContent += "mudou";
    expect(() => validateFreshStandingLawCapture(c, expected, changed, now)).toThrow(/diverge/u);
    const old = fresh(c); old.monitor.fetchedAt = new Date(now.getTime() - 301_000);
    expect(() => validateFreshStandingLawCapture(c, expected, old, now)).toThrow(/fresca/u);
  });

  it("operador deixa default sem escrita, exige referência exata e não abre grants/questões/produtos", () => {
    const script = readFileSync(new URL("../scripts/review-standing-official-law.ts", import.meta.url), "utf8");
    expect(script).toContain("process.env.LEGAL_STANDING_REVIEW_REFERENCE !== OFFICIAL_LAW_STANDING_REFERENCE");
    expect(script).toContain("if (!command.apply)");
    expect(script).toContain('isolationLevel: "serializable"');
    expect(script).toContain('approvalMode: "owner_standing_authorization"');
    expect(script).toContain("humanReview: false");
    expect(script).toContain("validateFreshStandingLawCapture(locked, command, fresh)");
    expect(script).toContain("não restaurar silenciosamente");
    expect(script).not.toMatch(/\.(?:update|insert|delete)\((?:questions|contestStoreProducts|contestProductQuestionBindings)\)/u);
    expect(script).not.toMatch(/(?:grant|revoke|create role)\s/iu);
    expect(OFFICIAL_LAW_STANDING_REFERENCE).toBe("owner-standing-2026-10-12:official-sources-programs");
  });
});
