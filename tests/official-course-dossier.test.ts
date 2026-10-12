import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildOfficialCourseDossierPreview, extractLetteredProgrammeCandidates, OFFICIAL_COURSE_DOSSIER_RECIPES, OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { assertStandingCourseAdmission, assertStandingCourseProductUpdate, requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import type { CapturedOfficialDocument } from "../src/lib/opportunities/official-document-fetch";
import { parseOfficialCourseDossierArgs, safeOfficialCourseDossierError } from "../scripts/prepare-official-course-dossiers";

function fixture(): CapturedOfficialDocument {
  const recipe = OFFICIAL_COURSE_DOSSIER_RECIPES[0];
  const bytes = Buffer.from("%PDF-test");
  const pageTexts = Array.from({ length: recipe.pageCount }, () => "");
  for (const claim of recipe.claims) pageTexts[claim.page - 1] += claim.contains.join(" ");
  pageTexts[48] += `\n${recipe.programme.anchor}\nDIREITO PENAL\n1. Código Penal.`;
  return {
    documentUrl: recipe.noticeUrl,
    sourceHost: "conhecimento.fgv.br",
    fileName: "edital.pdf",
    mimeType: "application/pdf",
    documentBytes: bytes,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    pageCount: pageTexts.length,
    pageTexts,
    extractedText: pageTexts.join("\n\n"),
    textLength: 100,
    parserVersion: "unpdf-1.8.1",
  };
}

describe("bounded official course dossier preview", () => {
  it("keeps standing authorization honest and no commercial admission applied", () => {
    const result = buildOfficialCourseDossierPreview(OFFICIAL_COURSE_DOSSIER_RECIPES[0], fixture(), "2026-10-12T03:40:00Z");
    expect(result.review).toMatchObject({ humanReview: false, applied: false, approvalBasis: "owner_standing_authorization" });
    expect(result.databaseMutations).toBe(0);
    expect(result.publicationAllowed).toBe(false);
    expect(result.proposedPreparationMode).toBe("historical_training");
    expect(result.programme.pages).toHaveLength(15);
    expect(result.identity.bankScope).toContain("fases subsequentes");
  });

  it.each(["checksum", "url", "pages", "role"])("blocks capture drift in %s", (field) => {
    const doc = fixture();
    const changed = field === "checksum" ? { ...doc, checksumSha256: "0".repeat(64) }
      : field === "url" ? { ...doc, documentUrl: "https://conhecimento.fgv.br/other.pdf" }
        : field === "pages" ? { ...doc, pageCount: 68 }
          : { ...doc, pageTexts: doc.pageTexts.map((text, index) => index === 0 ? text.replace("Justiça Substituto", "outro cargo") : text) };
    expect(() => buildOfficialCourseDossierPreview(OFFICIAL_COURSE_DOSSIER_RECIPES[0], changed, "2026-10-12T03:40:00Z")).toThrow();
  });

  it("only permits configured targets and private outputs; rejects apply", () => {
    expect(parseOfficialCourseDossierArgs([]).recipes).toHaveLength(2);
    expect(() => parseOfficialCourseDossierArgs(["--product=unknown"])).toThrow();
    expect(() => parseOfficialCourseDossierArgs(["--output=public/pdf"])).toThrow();
    expect(() => parseOfficialCourseDossierArgs(["--apply"])).toThrow();
  });
  it("keeps lettered MPMT subitems and continuation pages without adding legal mappings", () => {
    const items = extractLetteredProgrammeCandidates(["DIREITO CONSTITUCIONAL\n1 a) Constituição da República.\nContinuação do tema. b) Direitos fundamentais.", "MINISTÉRIO PÚBLICO DO ESTADO DE MATO GROSSO | CONCURSO PÚBLICO 34\nGarantias e direitos.\n2 a) Organização política."], 33);
    expect(items.map((item) => item.requirementText)).toEqual(["1 a) Constituição da República. Continuação do tema.", "b) Direitos fundamentais. Garantias e direitos.", "2 a) Organização política."]);
    expect(items[2].pageNumber).toBe(34);
  });
  it("requires the reviewed fingerprint, exact standing decision, and bounded MPMT identity", () => {
    const hash = "a".repeat(64);
    expect(() => assertStandingCourseAdmission("mpe-mt-promotor-de-justica-2026", hash, hash, OFFICIAL_COURSE_STANDING_REFERENCE)).not.toThrow();
    expect(() => assertStandingCourseAdmission("mpe-go-promotor-de-justica-2025", hash, hash, OFFICIAL_COURSE_STANDING_REFERENCE)).toThrow();
    expect(() => assertStandingCourseAdmission("mpe-mt-promotor-de-justica-2026", hash, "b".repeat(64), OFFICIAL_COURSE_STANDING_REFERENCE)).toThrow();
    expect(() => assertStandingCourseAdmission("mpe-mt-promotor-de-justica-2026", hash, hash, "other")).toThrow();
  });
  it("refuses another database or role even with a valid PostgreSQL URL", () => {
    const url = "postgres://leiprova_owner:synthetic@localhost/leiprova";
    expect(requireStandingCourseMaintenanceDatabaseUrl(url)).toBe(url);
    expect(() => requireStandingCourseMaintenanceDatabaseUrl(url.replace("/leiprova", "/everglades"))).toThrow();
    expect(() => requireStandingCourseMaintenanceDatabaseUrl(url.replace("leiprova_owner", "leiprova_app"))).toThrow();
  });
  it("requires exactly one returned product with the expected slug before commit", () => {
    expect(() => assertStandingCourseProductUpdate([{ slug: "expected" }], "expected")).not.toThrow();
    expect(() => assertStandingCourseProductUpdate([], "expected")).toThrow();
    expect(() => assertStandingCourseProductUpdate([{ slug: "other" }], "expected")).toThrow();
    expect(() => assertStandingCourseProductUpdate([{ slug: "expected" }, { slug: "expected" }], "expected")).toThrow();
  });
  it("never prints PostgreSQL details, URLs or credential-like values", () => {
    const dbError = new Error("postgres://owner:private@host/db detail sk_live_synthetic");
    dbError.name = "PostgresError";
    expect(safeOfficialCourseDossierError(dbError)).not.toContain("private");
    const message = safeOfficialCourseDossierError(new Error("https://host/private?token=secret postgres://owner:private@host/db sk_live_synthetic password=private token=private Bearer private"));
    expect(message).not.toMatch(/private|secret|sk_live|postgres:|https:/u);
  });
});
