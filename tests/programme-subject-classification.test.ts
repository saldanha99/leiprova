import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { authoringPreparationBatchQuery } from "@/lib/editorial/agent-work-preparation";
import { assertProgrammeSubjectEvidence, programmeCanonicalSubject, programmeClassificationInputSchema, programmeRequirementFingerprint,
  type ProgrammeRequirementState } from "@/lib/editorial/programme-subject-classification";

const state: ProgrammeRequirementState = { id: 1, opportunityId: 19, sourceDocumentId: 23, snapshotId: 1241, subjectId: null,
  topicId: null, actId: null, articleId: null, text: "Constituição e princípios fundamentais.", locator: "Conteúdo programático, p. 33 · DIREITO CONSTITUCIONAL",
  status: "reviewed", reviewedBy: 4, reviewedAt: "2026-10-12", reviewNotes: "Extração previamente admitida; não é mapa legal.", updatedAt: "2026-10-12" };
const item = { requirementId: 1, expectedRequirementFingerprint: programmeRequirementFingerprint(state), subjectId: 1, subjectName: "Direito Constitucional",
  heading: "DIREITO CONSTITUCIONAL", headingQuote: "DIREITO CONSTITUCIONAL", headingPage: 33, pages: [33], snapshotChecksum: "a".repeat(64) };
const source = { checksum: item.snapshotChecksum, bytesChecksum: item.snapshotChecksum, status: "approved", sourceStatus: "approved",
  pageTexts: Array.from({ length: 33 }, (_, index) => index === 32 ? "DIREITO CONSTITUCIONAL\nConstituição e princípios fundamentais." : "Outra página.") };
const subject = { id: 1, name: "Direito Constitucional", active: true };
describe("classificação de disciplina sem aprovação legal", () => {
  it("aceita somente o cabeçalho canônico literal e texto integral nas páginas indicadas", () => {
    expect(() => assertProgrammeSubjectEvidence(state, item, source, subject)).not.toThrow();
    expect(programmeCanonicalSubject("direito  constitucional")).toBe("Direito Constitucional");
    expect(programmeCanonicalSubject("DIREITO CIVIL E EMPRESARIAL")).toBe("Direito Civil e Empresarial");
    expect(programmeCanonicalSubject("Legislação Penal Extravagante")).toBe("Legislação Penal Extravagante");
    expect(programmeCanonicalSubject("Tutela Coletiva")).toBe("Tutela Coletiva");
    const numbered = { ...source, pageTexts: source.pageTexts.map(text => text.replace("DIREITO CONSTITUCIONAL\n", "1.1– Direito Constitucional\n")) };
    expect(() => assertProgrammeSubjectEvidence(state, { ...item, headingQuote: "1.1– Direito Constitucional" }, numbered, subject)).not.toThrow();
    expect(() => assertProgrammeSubjectEvidence(state, item, numbered, subject)).toThrow(/Cabeçalho/);
  });
  it("mantém disciplina composta própria, rejeitando transferência para Civil ou Empresarial", () => {
    const row = { ...state, locator: "Conteúdo programático, p. 33 · DIREITO CIVIL E EMPRESARIAL" };
    const proof = { ...item, expectedRequirementFingerprint: programmeRequirementFingerprint(row), subjectName: "Direito Civil e Empresarial",
      heading: "DIREITO CIVIL E EMPRESARIAL", headingQuote: "DIREITO CIVIL E EMPRESARIAL" };
    const pages = { ...source, pageTexts: source.pageTexts.map(text => text.replace("DIREITO CONSTITUCIONAL", "DIREITO CIVIL E EMPRESARIAL")) };
    expect(() => assertProgrammeSubjectEvidence(row, proof, pages, { ...subject, name: "Direito Civil e Empresarial" })).not.toThrow();
    expect(() => assertProgrammeSubjectEvidence(row, proof, pages, { ...subject, name: "Direito Civil" })).toThrow(/Disciplina/);
    expect(() => assertProgrammeSubjectEvidence(row, proof, pages, { ...subject, name: "Direito Empresarial" })).toThrow(/Disciplina/);
    expect(programmeCanonicalSubject("F) DIREITO DIGITAL")).toBe("Direito Digital");
    expect(programmeCanonicalSubject("H) DIREITO DA ANTIDISCRIMINAÇÃO")).toBe("Direito da Antidiscriminação");
    expect(programmeCanonicalSubject("Especial tributária em geral")).toBeNull();
  });
  it("não aceita documento alterado, revogado ou hash de bytes divergente", () => {
    for (const patch of [{ bytesChecksum: "b".repeat(64) }, { status: "suspended" }, { sourceStatus: "rejected" }])
      expect(() => assertProgrammeSubjectEvidence(state, item, { ...source, ...patch }, subject)).toThrow(/Fonte/);
  });
  it("recusa texto parcial, cabeçalho de outra disciplina e localizador sem prova", () => {
    expect(() => assertProgrammeSubjectEvidence(state, item, { ...source, pageTexts: source.pageTexts.map(text => text.replace("fundamentais", "divergentes")) }, subject)).toThrow(/substring/);
    const other = { ...state, locator: "Conteúdo programático, p. 33 · DIREITO PENAL" };
    expect(() => assertProgrammeSubjectEvidence(other, { ...item, expectedRequirementFingerprint: programmeRequirementFingerprint(other) }, source, subject)).toThrow(/localizador/);
    expect(() => assertProgrammeSubjectEvidence(state, { ...item, headingPage: 34 }, source, subject)).toThrow(/Cabeçalho/);
    const crossed = { ...source, pageTexts: source.pageTexts.map(text => text.replace("\nConstituição", "\nDIREITO CIVIL\nConstituição")) };
    expect(() => assertProgrammeSubjectEvidence(state, item, crossed, subject)).toThrow(/outra seção/);
  });
  it("revalida classificação ativa, vínculo de tópico/ato e a fotografia inteira do requisito", () => {
    expect(() => assertProgrammeSubjectEvidence(state, item, source, { ...subject, active: false })).toThrow(/Disciplina/);
    expect(() => assertProgrammeSubjectEvidence({ ...state, reviewNotes: "alterado" }, item, source, subject)).toThrow(/mudou/);
    for (const patch of [{ subjectId: 2 }, { topicId: 1 }, { actId: 1 }, { articleId: 1 }, { status: "suspended" }]) {
      const altered = { ...state, ...patch };
      expect(() => assertProgrammeSubjectEvidence(altered, { ...item, expectedRequirementFingerprint: programmeRequirementFingerprint(altered) }, source, subject)).toThrow(/sem mapa/);
    }
  });
  it("limita lote, proíbe duplicatas/cargo implícito e impede outros produtos", () => {
    const input = { opportunityId: 19, opportunitySlug: "mpmt-promotor-substituto-2026-historico-objetiva", roleName: "Promotor de Justiça Substituto", cycleYear: 2026, examEditionId: 39, requirements: [item] };
    expect(programmeClassificationInputSchema.safeParse(input).success).toBe(true);
    for (const patch of [{ requirements: [item, item] }, { requirements: Array.from({ length: 101 }, (_, index) => ({ ...item, requirementId: index + 1 })) },
      { opportunitySlug: "enam-2026" }, { roleName: "Analista" }]) expect(programmeClassificationInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("preparo de autoria exclui a disciplina ausente antes da reserva", () => {
    const query = new PgDialect().sqlToQuery(authoringPreparationBatchQuery(10));
    expect(query.sql).toContain("r.subject_id is not null");
  });
  it("prova label MPRJ e alínea por fragmentos exatos sem dizer substring contígua", () => {
    const text = "1.1– Direito Constitucional\nPonto nº 1\na) Outro conteúdo.\nb) Constituição e princípios fundamentais.\nPonto nº 2\nb) Texto do outro ponto.";
    const row = { ...state, text: "Ponto nº 1 b) Constituição e princípios fundamentais.", locator: "mprj-programme · Direito Constitucional · p. 1" };
    const fragment = (quote: string) => ({ page: 1, startOffset: text.indexOf(quote), endOffset: text.indexOf(quote) + quote.length, quote });
    const fragments = [fragment("Ponto nº 1"), fragment("b) Constituição e princípios fundamentais.")];
    const proof = { ...item, expectedRequirementFingerprint: programmeRequirementFingerprint(row), headingQuote: "1.1– Direito Constitucional", headingPage: 1, pages: [1], fragments };
    const official = { ...source, pageTexts: [text] };
    expect(() => assertProgrammeSubjectEvidence(row, proof, official, subject)).not.toThrow();
    expect(() => assertProgrammeSubjectEvidence(row, { ...proof, fragments: [fragments[1], fragments[0]] }, official, subject)).toThrow();
    expect(() => assertProgrammeSubjectEvidence(row, { ...proof, fragments: [fragments[0]] }, official, subject)).toThrow(/todo requisito/);
    const otherText = text.replace("a) Outro conteúdo.", "DIREITO CIVIL");
    expect(() => assertProgrammeSubjectEvidence(row, proof, { ...official, pageTexts: [otherText] }, subject)).toThrow();
    const otherRow = { ...row, text: "Ponto nº 1 b) Texto do outro ponto." };
    expect(() => assertProgrammeSubjectEvidence(otherRow, { ...proof, expectedRequirementFingerprint: programmeRequirementFingerprint(otherRow), fragments: [fragments[0], fragment("b) Texto do outro ponto.")] }, official, subject)).toThrow(/outro ponto/);
  });
  it("prova cabeçalho PGE na mesma linha apenas com delimitação literal Ponto1", () => {
    const headingQuote = "DIREITO CONSTITUCIONAL - Ponto 1. Constituição e princípios fundamentais.";
    const row = { ...state, text: "Ponto 1. Constituição e princípios fundamentais.", locator: "pgeac-notice · DIREITO CONSTITUCIONAL · p. 1" };
    const proof = { ...item, expectedRequirementFingerprint: programmeRequirementFingerprint(row), headingQuote, headingPage: 1, pages: [1] };
    expect(() => assertProgrammeSubjectEvidence(row, proof, { ...source, pageTexts: [headingQuote] }, subject)).not.toThrow();
    expect(() => assertProgrammeSubjectEvidence(row, { ...proof, headingQuote: "DIREITO CONSTITUCIONAL" }, { ...source, pageTexts: [headingQuote] }, subject)).toThrow();
    const ambiguous = headingQuote.replace("Ponto 1.", "Ponto 2.");
    expect(() => assertProgrammeSubjectEvidence(row, { ...proof, headingQuote: ambiguous }, { ...source, pageTexts: [ambiguous] }, subject)).toThrow(/Cabeçalho/);
  });
  it("operador preserva recibo anterior, volta a draft e nunca modifica a aprovação legal", () => {
    const text = readFileSync("src/lib/editorial/programme-subject-classification.ts", "utf8");
    expect(text).toContain("before, sourceProof: item");
    expect(text).toContain("editorial_status='draft'");
    expect(text).toContain("legalMappingsApproved: 0");
    expect(text).not.toContain("delete from audit_logs");
    expect(text).not.toContain("update legal_articles");
  });
});
