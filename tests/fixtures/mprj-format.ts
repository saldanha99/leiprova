import { MPRJ_MC5_FORMAT_EVIDENCE as target, type MprjMc5FormatObservation } from "@/lib/editorial/mprj-format-evidence";
import type { MprjFormatDocument } from "@/lib/editorial/mprj-format-admission";
import { MPRJ_PROMOTOR_MULTIPLE_CHOICE_PROFILE } from "@/lib/editorial/official-question-contract";
import { syntheticQuestionContract } from "./question-contract";

export const contract = () => syntheticQuestionContract({ opportunityId: 20, examEditionId: 41, roleName: target.roleName, noticeNumber: target.noticeNumber, profile:MPRJ_PROMOTOR_MULTIPLE_CHOICE_PROFILE,
  sourceQuote: "A prova conterá 100 (cem) questões objetivas de múltipla escolha.", sourceDocumentUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2026",
  sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/edital-xxxix-concurso.pdf" });
export const document: MprjFormatDocument = { id: 20, publicId: "11111111-1111-4111-8111-111111111111", editionId: 41, editionPublicId: "mprj-promotor-substituto-xxxix-2026-preambular", bankId: 1, bankSlug: "fgv", bankActive: true,
  roleName: target.roleName, institution: "MPRJ", jurisdiction: "RJ", notice: "XXXIX/2026", cycleYear: 2026, specializationId: null,
  opportunityPublicId: "31739f51-3b4b-4984-a272-54fb549c034d", editionInstitution: "MPRJ", editionJurisdiction: "RJ", editionSourcePolicy:"metadata_only",editionSourceContentStored:false, documentType: "question_booklet",
  title: "MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1", sourceUrl: target.sourceUrl, sourceHost: "conhecimento.fgv.br", status: "approved",
  sourcePolicy: "metadata_only", distributionMode: "external_link", storageKey: null, byteLength: null, httpStatus: 200, contentType: "application/pdf",
  expectedQuestionCount: 100, publishedOn: "2026-06-01", checksum: null, documentUpdatedAt: "2026-10-15 12:00:00.123456+00",
  editionUpdatedAt: "2026-10-15 12:00:00.123456+00", opportunityUpdatedAt: "2026-10-15 12:00:00.123456+00" };
export const observation: MprjMc5FormatObservation = { sourceUrl: target.sourceUrl, sourceSha256: "a".repeat(64), robotsSha256: "b".repeat(64),
  pageTextSha256: "c".repeat(64), pageNumber: 1, parserVersion: target.parserVersion, format: "multiple_choice", optionCount: 5, singleCorrect: true, questionCount: 100 };
