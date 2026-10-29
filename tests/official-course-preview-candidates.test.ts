import { describe, expect, it } from "vitest";

import { composeDossierProgramme, extractDossierSubjectSections, NEXT_OFFICIAL_COURSE_RECIPES, previousExamAdmissionBlocker, type ProgrammeSection } from "../src/lib/editorial/official-course-preview-candidates";
import { parseNextOfficialDossierArgs } from "../scripts/prepare-next-official-course-dossiers";

const section = (subject: string, documentKey: string): ProgrammeSection => ({ subject, documentKey, checksumSha256: "a".repeat(64), sourceUrl: "https://conhecimento.fgv.br/programme.pdf", fragments: [{ page: 1, text: "Ponto1. Tema preservado." }] });

describe("bounded next official dossier composition", () => {
  it("records actual notice application dates and the latest MPRJ edition without inventing a definitive key", () => {
    const [mprj,pgeac]=NEXT_OFFICIAL_COURSE_RECIPES;
    expect(mprj.examDate).toBe("2026-05-31");
    expect(mprj.identityClaims).toContainEqual({document:"mprj-notice",page:21,contains:["11.1","31 de maio de 2026","prova preambular"]});
    expect(pgeac.examDate).toBe("2026-05-24");
    expect(pgeac.identityClaims).toContainEqual({document:"pgeac-notice",page:14,contains:["9.1","24 de maio de 2026","Procurador do Estado","Classe I"]});
    expect(mprj.previousExam.examDate).toBe(mprj.examDate);
    // Sem gabarito definitivo autônomo: finalidade composta, três documentos.
    expect(mprj.previousExam.answerKeyFinality).toBe("preliminary_plus_maintenance_act");
    expect(mprj.previousExam.documents).toHaveLength(3);
    expect(mprj.previousExam.documents.map((doc) => doc.type)).toEqual(["question_booklet", "answer_key", "answer_key_decision"]);
    expect(mprj.previousExam.documents[0].url).toContain("promotor-de-justica-substituto-cns001-tipo-1.pdf");
    expect(mprj.previousExam.documents[2].url).toContain("22.06-recursos-gabarito-preambular.pdf");
    expect(JSON.stringify(mprj.previousExam)).not.toMatch(/definitiv/iu);
    // Evidência completa nos dois caminhos: nenhum bloqueador restante.
    expect(previousExamAdmissionBlocker(mprj.previousExam)).toBeNull();
    expect(previousExamAdmissionBlocker(pgeac.previousExam)).toBeNull();
    // Faltando o ato, a admissão volta a ficar bloqueada com o motivo explícito.
    expect(previousExamAdmissionBlocker({ ...mprj.previousExam, documents: mprj.previousExam.documents.slice(0, 2) }))
      .toBe("Answer key evidence incomplete for preliminary_plus_maintenance_act: missing answer_key_decision");
    expect(pgeac.previousExam.answerKeyFinality).toBe("definitive_document");
    expect(pgeac.previousExam.documents.find(doc=>doc.type==="answer_key")?.url).toContain("gabarito-definitivo-pge-ac.pdf");
  });
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
    expect(parseNextOfficialDossierArgs([]).recipes).toHaveLength(6);
    expect(() => parseNextOfficialDossierArgs(["--apply"])).toThrow();
    expect(() => parseNextOfficialDossierArgs(["--product=unknown"])).toThrow();
    expect(() => parseNextOfficialDossierArgs(["--output=public"])).toThrow();
  });
});
