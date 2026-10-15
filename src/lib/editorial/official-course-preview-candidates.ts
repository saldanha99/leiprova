import { createHash } from "node:crypto";

import type { CapturedOfficialDocument } from "@/lib/opportunities/official-document-fetch";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import {
  requiredAnswerKeyDocumentTypes,
  type AnswerKeyDocumentType,
  type AnswerKeyFinality,
} from "@/lib/exams/answer-key-finality";

const FGV_FILES = "https://conhecimento.fgv.br/sites/default/files/concursos/";
export type PreviewDocumentRecipe = Readonly<{ key: string; url: string; title: string; pages: number; programmePages: readonly [number, number] | null }>;
export type NextOfficialCourseRecipe = Readonly<{
  productSlug: string; institution: string; role: string; jurisdiction: string; cycle: string; bankScope: string;
  portalUrl: string; examDate: string; examDateEvidence: Readonly<{ documentKey: string; page: number; item: string; quote: string; actualDayIndependentlyVerified: boolean; corroboratingUrl: string | null; limitation: string | null }>; stage: string; stageObservedOn: string; proposedMode: "historical_training";
  documents: readonly PreviewDocumentRecipe[];
  expectedSubjects: number;
  overlays: readonly Readonly<{ key: string; subjects: readonly string[] }>[];
  identityClaims: readonly Readonly<{ document: string; page: number; contains: readonly string[] }>[];
  previousExam: Readonly<{ cycle: string; role: string; portalUrl: string; examDate: string; answerKeyFinality: AnswerKeyFinality; documents: readonly Readonly<{ type: AnswerKeyDocumentType; title: string; url: string }>[] }>;
  limitations: readonly string[];
}>;

/** A evidência final do gabarito precisa estar completa: um documento definitivo
 * autônomo, ou o par preliminar + ato de manutenção. Faltando um papel, a admissão
 * fica bloqueada e o motivo é declarado. */
export function previousExamAdmissionBlocker(
  previousExam: NextOfficialCourseRecipe["previousExam"],
) {
  const required = requiredAnswerKeyDocumentTypes(previousExam.answerKeyFinality);
  const present = new Set(previousExam.documents.map((document) => document.type));
  const missing = required.filter((type) => !present.has(type));
  if (missing.length) {
    return `Answer key evidence incomplete for ${previousExam.answerKeyFinality}: missing ${missing.join(", ")}`;
  }
  if (previousExam.documents.length !== required.length) {
    return `Answer key evidence has unexpected documents for ${previousExam.answerKeyFinality}`;
  }
  return null;
}

export const NEXT_OFFICIAL_COURSE_RECIPES: readonly NextOfficialCourseRecipe[] = [
  {
    productSlug: "mpe-rj-promotor-de-justica-2026", institution: "Ministério Público do Estado do Rio de Janeiro", role: "Promotor de Justiça Substituto",
    jurisdiction: "RJ", cycle: "XXXIX — 2026", bankScope: "FGV: inscrições provisórias/elaboração/aplicação da preambular; MPRJ: discursivas em diante, com apoio logístico FGV",
    portalUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2026", examDate: "2026-05-31", examDateEvidence: { documentKey: "mprj-notice", page: 21, item: "11.1", quote: "com aplicação prevista para o dia 31 de maio de 2026 (domingo)", actualDayIndependentlyVerified: true, corroboratingUrl: "https://www.mprj.mp.br/visualizar?noticiaId=224001", limitation: null }, stage: "Discursivas com resultado em02/10/2026; inscrição definitiva, exame de higidez e fases posteriores em andamento",
    stageObservedOn: "2026-10-12", proposedMode: "historical_training", expectedSubjects: 13,
    documents: [
      { key: "mprj-notice", url: `${FGV_FILES}edital-xxxix-concurso.pdf`, title: "Edital do XXXIX Concurso MPRJ", pages: 47, programmePages: null },
      { key: "mprj-programme", url: `${FGV_FILES}aviso-conteudo-programatico-concurso-xxxix.pdf`, title: "Aviso Conteúdo Programático MPRJ XXXIX", pages: 51, programmePages: [1, 51] },
      { key: "mprj-inclusion", url: `${FGV_FILES}aviso_conteudo_programatico-concurso_xxxix_republicacao_parcial_inclusao.pdf`, title: "Aviso Conteúdo Programático MPRJ XXXIX republicação parcial inclusão", pages: 13, programmePages: [1, 13] },
      { key: "mprj-civil-correction", url: `${FGV_FILES}aviso_conteudo_programatico-concurso_xxxix_republicacao_direito_proc_civil_incorrecao.pdf`, title: "Aviso Conteúdo Programático MPRJ XXXIX republicação Direito Processual Civil", pages: 5, programmePages: [1, 5] },
    ],
    overlays: [
      { key: "mprj-inclusion", subjects: ["Direito Penal", "Direito Processual Penal", "Legislação Penal Extravagante"] },
      { key: "mprj-civil-correction", subjects: ["Direito Processual Civil"] },
    ],
    identityClaims: [
      { document: "mprj-notice", page: 1, contains: ["XXXIX", "ESTADO DO RIO DE JANEIRO", "Promotor de Justiça Substituto", "2026"] },
      { document: "mprj-notice", page: 21, contains: ["11.1", "31 de maio de 2026", "prova preambular"] },
      { document: "mprj-notice", page: 2, contains: ["responsabilidade da Fundação Getulio Vargas", "executado pelo próprio Ministério Público"] },
      { document: "mprj-inclusion", page: 1, contains: ["15.358", "XXXIX", "Direito Penal"] },
      { document: "mprj-civil-correction", page: 1, contains: ["por incorreção", "Direito Processual Civil", "17.03.26"] },
    ],
    // Sem gabarito definitivo autônomo: o Edital XXXIX não tem o subitem 11.7.3 do
    // XXXVIII. A finalidade é composta (preliminar + ato de 22/06 que mantém todos
    // os gabaritos); ver docs/ADMISSAO-COMPOSTA-MPRJ-PGEAC-2026-10-12.md.
    previousExam: { cycle: "XXXIX — 2026, preambular já realizada", role: "Promotor de Justiça Substituto — prova preambular", portalUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2026", examDate: "2026-05-31", answerKeyFinality: "preliminary_plus_maintenance_act", documents: [
      { type: "question_booklet", title: "MPRJ XXXIX — caderno Tipo1", url: `${FGV_FILES}promotor-de-justica-substituto-cns001-tipo-1.pdf` },
      { type: "answer_key", title: "MPRJ XXXIX — gabarito oficial preliminar da prova preambular", url: `${FGV_FILES}mprj-promotor-2026-gabaritos-para-publicacao.pdf` },
      { type: "answer_key_decision", title: "MPRJ XXXIX — aviso de 22/06/2026: julgados os recursos, mantidos os gabaritos", url: `${FGV_FILES}22.06-recursos-gabarito-preambular.pdf` },
    ] },
    limitations: ["O programa não está no edital47p: AnexoI é aviso de privacidade.", "Última preambular é XXXIX2026; portal publicou apenas gabarito preliminar, definitivo público não localizado. Não usar XXXVIII2025 como última prova nem aprovar referência incompleta.", "Quatro disciplinas do aviso17/03 foram substituídas em09/04; não usar versão original isolada.", "Treino histórico preambular com legislação atual; não simulado oral, discursivo ou edição futura.", "Não inferir número de alternativas a partir do edital; perfil específico precisa análise própria.", "Lei15.358/2026 e demais normas citadas exigem comparação com texto oficial atual antes de vínculos/questões."],
  },
  {
    productSlug: "pge-ac-procurador-do-estado-reta-final", institution: "Procuradoria-Geral do Estado do Acre", role: "Procurador do Estado — Classe I",
    jurisdiction: "AC", cycle: "VIII — 2026", bankScope: "Fundação Getulio Vargas, sob comissão do VIII Concurso PGE-AC",
    portalUrl: "https://conhecimento.fgv.br/concursos/pgeac", examDate: "2026-05-24", examDateEvidence: { documentKey: "pgeac-notice", page: 14, item: "9.1", quote: "de 24 de maio de 2026, das 8h às 13h", actualDayIndependentlyVerified: false, corroboratingUrl: null, limitation: "Data constante do edital; fase objetiva realizada confirmada por resultado posterior. Dia efetivo não confirmado por anúncio independente nesta conferência." }, stage: "Objetiva com resultado definitivo15/07/2026; resultado preliminar prova escrita subjetiva05/10/2026",
    stageObservedOn: "2026-10-12", proposedMode: "historical_training", expectedSubjects: 10,
    documents: [
      { key: "pgeac-notice", url: `${FGV_FILES}pge-ac-edital-26.02.v.final_.pdf`, title: "Edital PGE-AC publicado26/02/2026", pages: 40, programmePages: [31, 38] },
      { key: "pgeac-correction-1", url: `${FGV_FILES}retificacao-02.03.versao-enviada-15-40.docx_.pdf`, title: "1ª Retificação do Edital PGE-AC", pages: 10, programmePages: [1, 10] },
      { key: "pgeac-correction-2", url: `${FGV_FILES}retificacao-23.03.pdf`, title: "2ª Retificação do Edital PGE-AC", pages: 4, programmePages: [1, 4] },
    ],
    overlays: [
      { key: "pgeac-correction-1", subjects: ["Direito Administrativo", "Direito Ambiental", "Direito Constitucional", "Direito Tributário e Processo Tributário", "Direito Financeiro", "Direito do Trabalho", "Direito Processual do Trabalho", "Direito de Pessoal e Direito Previdenciário Público"] },
      { key: "pgeac-correction-2", subjects: ["Direito Ambiental", "Direito Constitucional", "Direito do Trabalho"] },
    ],
    identityClaims: [
      { document: "pgeac-notice", page: 1, contains: ["VIII", "ESTADO DO ACRE", "10 vagas", "Fundação Getulio Vargas"] },
      { document: "pgeac-notice", page: 2, contains: ["Classe I"] },
      { document: "pgeac-notice", page: 14, contains: ["9.1", "24 de maio de 2026", "Procurador do Estado", "Classe I"] },
      { document: "pgeac-notice", page: 31, contains: ["ANEXO I", "CONTEÚDO PROGRAMÁTICO"] },
      { document: "pgeac-correction-1", page: 1, contains: ["1ª RETIFICAÇÃO", "Conteúdo Programático", "DIREITO ADMINISTRATIVO"] },
      { document: "pgeac-correction-2", page: 1, contains: ["2ª RETIFICAÇÃO", "Conteúdo Programático", "15.190/2025"] },
    ],
    previousExam: { cycle: "VIII — 2026, objetiva já realizada", role: "Procurador do Estado do Acre — Classe I", portalUrl: "https://conhecimento.fgv.br/concursos/pgeac", examDate: "2026-05-24", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PGE-AC VIII — caderno Tipo1", url: `${FGV_FILES}procurador-do-estado-do-acre-cns001-tipo-1.pdf` },
      { type: "answer_key", title: "PGE-AC VIII — gabarito oficial definitivo", url: `${FGV_FILES}gabarito-definitivo-pge-ac.pdf` },
    ] },
    limitations: ["Reta Final é rótulo comercial, não edição oficial.", "Embora portal rotule edital retificado23/03, texto do AnexoI conserva versões anteriores em várias disciplinas; aplicar retificações por disciplina.", "Preambular histórica e legislação atual; não transformar exercícios objetivos em peça processual/parecer.", "Legislação estadual e normas novas ambientais/tributárias precisam fontes atuais próprias; menção em programa não comprova redação vigente."],
  },
];

function normalized(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim(); }
export type ProgrammeSection = Readonly<{ subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: readonly Readonly<{ page: number; text: string }>[] }>;

export function extractDossierSubjectSections(recipe: PreviewDocumentRecipe, capture: Pick<CapturedOfficialDocument, "documentUrl" | "checksumSha256" | "pageTexts">): readonly ProgrammeSection[] {
  if (!recipe.programmePages) return [];
  const sections: { subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: { page: number; text: string }[] }[] = [];
  let current: (typeof sections)[number] | null = null;
  const [start, end] = recipe.programmePages;
  for (let index = start - 1; index < end; index += 1) {
    for (const raw of capture.pageTexts[index].split(/\n+/u)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line || /^(?:MINISTÉRIO PÚBLICO|PROCURADORIA GERAL DO ESTADO DO ACRE \d+$)/u.test(line)) continue;
      if (/^Rio Branco, \d+ de .+ de \d{4}\.$/u.test(line)) { current = null; continue; }
      if (/^\d\s*[–-]\s*Banca /u.test(line)) { current = null; continue; }
      const mprj = /^\d\.\d\s*[–-]\s*(.+)$/u.exec(line);
      const pge = /^(DIREITO [A-ZÀ-ÖØ-Þ ]+)(?:\s+-\s+(.*))?$/u.exec(line);
      if (mprj || pge) {
        const subject = (mprj?.[1] ?? pge![1]).trim();
        current = { subject, documentKey: recipe.key, checksumSha256: capture.checksumSha256, sourceUrl: capture.documentUrl, fragments: [] };
        sections.push(current);
        if (pge?.[2]) current.fragments.push({ page: index + 1, text: pge[2] });
        continue;
      }
      if (current) current.fragments.push({ page: index + 1, text: line });
    }
  }
  if (sections.some((section) => !section.fragments.length)) throw new Error("Disciplina sem conteúdo; composição bloqueada.");
  return sections;
}

export function composeDossierProgramme(base: readonly ProgrammeSection[], overlays: readonly Readonly<{ sections: readonly ProgrammeSection[]; expectedSubjects: readonly string[] }>[]) {
  const selected = new Map(base.map((section) => [normalized(section.subject), section]));
  if (selected.size !== base.length) throw new Error("Disciplinas duplicadas no programa base.");
  const superseded: { subject: string; from: string; to: string }[] = [];
  for (const overlay of overlays) {
    const expected = new Set(overlay.expectedSubjects.map(normalized));
    if (overlay.sections.length !== expected.size || overlay.sections.some((section) => !expected.has(normalized(section.subject)))) throw new Error("Retificação contém disciplinas inesperadas ou ausentes.");
    for (const section of overlay.sections) {
      const key = normalized(section.subject);
      const prior = selected.get(key);
      if (!prior) throw new Error("Retificação sem disciplina correspondente no programa base.");
      superseded.push({ subject: section.subject, from: prior.documentKey, to: section.documentKey });
      selected.set(key, section);
    }
  }
  return { sections: [...selected.values()], superseded };
}

export function buildNextOfficialCoursePreview(recipe: NextOfficialCourseRecipe, captures: ReadonlyMap<string, CapturedOfficialDocument>, observedAt: string, previousMetadata: readonly Record<string, unknown>[]) {
  for (const doc of recipe.documents) {
    const capture = captures.get(doc.key);
    if (!capture || capture.documentUrl !== doc.url || capture.pageCount !== doc.pages || capture.pageTexts.length !== doc.pages || createHash("sha256").update(capture.documentBytes).digest("hex") !== capture.checksumSha256) throw new Error(`Captura alterada ou ausente: ${doc.key}.`);
  }
  for (const claim of recipe.identityClaims) {
    const page = normalized(captures.get(claim.document)!.pageTexts[claim.page - 1]);
    if (!claim.contains.every((token) => page.includes(normalized(token)))) throw new Error(`Identidade diverge: ${claim.document}, p.${claim.page}.`);
  }
  const programDocs = recipe.documents.filter((doc) => doc.programmePages);
  const base = extractDossierSubjectSections(programDocs[0], captures.get(programDocs[0].key)!);
  const programme = composeDossierProgramme(base, recipe.overlays.map((overlay) => ({ sections: extractDossierSubjectSections(recipe.documents.find((doc) => doc.key === overlay.key)!, captures.get(overlay.key)!), expectedSubjects: overlay.subjects })));
  if (programme.sections.length !== recipe.expectedSubjects) throw new Error("Programa incompleto; número de disciplinas diverge.");
  return {
    schemaVersion: 1, mode: "preview", productSlug: recipe.productSlug, observedAt,
    identity: { institution: recipe.institution, role: recipe.role, jurisdiction: recipe.jurisdiction, cycle: recipe.cycle, examDate: recipe.examDate, examDateEvidence: recipe.examDateEvidence, bankScope: recipe.bankScope },
    officialPortal: recipe.portalUrl, status: { description: recipe.stage, observedOn: recipe.stageObservedOn, officialPortalLabel: "Em Andamento", objectiveStageAlreadyHeld: true },
    proposedPreparationMode: recipe.proposedMode, proposedScope: "objective_training_current_legislation", legislationUpdatedAndMapped: false,
    captures: recipe.documents.map((doc) => { const capture = captures.get(doc.key)!; return { key: doc.key, sourceUrl: capture.documentUrl, checksumSha256: capture.checksumSha256, pageCount: capture.pageCount, byteLength: capture.byteLength, programmePages: doc.programmePages }; }),
    programme: { ...programme, checksumSha256: createHash("sha256").update(JSON.stringify(programme.sections)).digest("hex"), extraction: "verbatim_source_fragments_per_subject_with_exact_overlay" },
    previousExam: { ...recipe.previousExam, distributionMode: "external_link", sourceContentStored: false, metadata: previousMetadata, approvedForProduct: false, admissionBlocker: previousExamAdmissionBlocker(recipe.previousExam), thirdPartyQuestionsImported: 0 },
    review: { proposedApprovalBasis: "owner_standing_authorization", approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE, humanReview: false, applied: false },
    limitations: recipe.limitations, databaseWrites: 0, admissionApplied: false, applySupported: false, questionsGenerated: 0, productsReleased: 0, publicationAllowed: false,
  };
}
