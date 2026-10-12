import { describe, expect, it } from "vitest";

import { composeDossierProgramme, extractDossierSubjectSections, type ProgrammeSection } from "../src/lib/editorial/official-course-preview-candidates";
import { parseNextOfficialDossierArgs } from "../scripts/prepare-next-official-course-dossiers";

const section = (subject: string, documentKey: string): ProgrammeSection => ({ subject, documentKey, checksumSha256: "a".repeat(64), sourceUrl: "https://conhecimento.fgv.br/programme.pdf", fragments: [{ page: 1, text: "Ponto1. Tema preservado." }] });

describe("bounded next official dossier composition", () => {
  it("replaces superseded disciplines rather than accumulating obsolete versions", () => {
    const result = composeDossierProgramme([section("Direito Penal", "base"), section("Direito Civil", "base")], [{ sections: [section("Direito Penal", "corrected")], expectedSubjects: ["Direito Penal"] }]);
    expect(result.sections.map((item) => item.documentKey)).toEqual(["corrected", "base"]);
    expect(result.superseded).toEqual([{ subject: "Direito Penal", from: "base", to: "corrected" }]);
  });
  it("fails incomplete overlays, unknown disciplines and duplicate bases", () => {
    expect(() => composeDossierProgramme([section("A", "base")], [{ sections: [], expectedSubjects: ["A"] }])).toThrow();
    expect(() => composeDossierProgramme([section("A", "base")], [{ sections: [section("B", "new")], expectedSubjects: ["B"] }])).toThrow();
    expect(() => composeDossierProgramme([section("A", "base"), section("A", "base")], [])).toThrow();
  });
  it("retains continuation pages and separates headers from PGEAC body text", () => {
    const document = { documentUrl: "https://conhecimento.fgv.br/programme.pdf", checksumSha256: "a".repeat(64), pageTexts: ["DIREITO CIVIL - Ponto1. Primeiro tema.", "PROCURADORIA GERAL DO ESTADO DO ACRE 2\nContinuação literal.\nDIREITO AMBIENTAL\nPonto1. Segundo tema."] };
    const sections = extractDossierSubjectSections({ key: "base", url: document.documentUrl, title: "Conteúdo Programático", pages: 2, programmePages: [1, 2] }, document);
    expect(sections).toHaveLength(2);
    expect(sections[0].fragments).toEqual([{ page: 1, text: "Ponto1. Primeiro tema." }, { page: 2, text: "Continuação literal." }]);
  });
  it("has no apply path and only permits private outputs and confirmed targets", () => {
    expect(parseNextOfficialDossierArgs([]).recipes).toHaveLength(2);
    expect(() => parseNextOfficialDossierArgs(["--apply"])).toThrow();
    expect(() => parseNextOfficialDossierArgs(["--product=unknown"])).toThrow();
    expect(() => parseNextOfficialDossierArgs(["--output=public"])).toThrow();
  });
});
