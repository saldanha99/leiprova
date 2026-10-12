import { randomUUID } from "node:crypto";

import { and, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import {
  auditLogs,
  contestProductExamReferences,
  examEditionDocuments,
  examEditions,
  users,
} from "../src/lib/db/schema";
import { validateExamReferenceScope } from "../src/lib/exams/admin-exam-reference-policy";
import { buildExamDocumentReviewFingerprint } from "../src/lib/exams/exam-document-review";
import {
  loadDocumentReviewCandidate,
  loadReferenceScope,
} from "../src/lib/exams/previous-exam-review";
import { verifyOfficialExamUrl } from "../src/lib/official-sources/fetch";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";
import { saoPauloCalendarDate } from "../src/lib/opportunities/catalog-policy";

import { MPMT_OFFICIAL_PREVIOUS_EXAM } from "../src/lib/exams/mpmt-previous-exam-admission";
import { parsePreviousExamLinkCommand, previousExamApprovalBasis } from "../src/lib/exams/previous-exam-link-command";
import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { safeOfficialCourseDossierError } from "./prepare-official-course-dossiers";

// Aprova o link oficial da última prova (caderno + gabarito) e o vínculo com o
// produto, com as mesmas consultas e a mesma política de /admin/provas-anteriores.
// Uso: tsx scripts/approve-previous-exam-links.ts [--apply] produto=edição ...
// Sem --apply, tudo roda numa transação desfeita ao final (prévia).

class PreviewRollback extends Error {}

async function main() {
  const { apply, standing, pairs } = parsePreviousExamLinkCommand(process.argv.slice(2));
  const reference = process.env.PREVIOUS_EXAM_APPROVAL_REFERENCE?.trim();
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: reference,
  });
  const approvalBasis = previousExamApprovalBasis(standing, reviewer.approvalReference);
  const client = postgres(
    standing ? requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL)
      : requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  const results: Record<string, unknown>[] = [];
  try {
    for (const pair of pairs) {
      const [edition] = await db
        .select({ id: examEditions.id, bankId: examEditions.bankId, examDate: examEditions.examDate, institution: examEditions.institutionAcronym, jurisdiction: examEditions.jurisdictionCode, sourcePolicy: examEditions.sourcePolicy, officialUrl: examEditions.officialUrl })
        .from(examEditions)
        .where(eq(examEditions.publicId, pair.editionPublicId))
        .limit(1);
      if (!edition) throw new Error(`Edição inexistente: ${pair.editionPublicId}.`);
      if (standing && (edition.examDate !== MPMT_OFFICIAL_PREVIOUS_EXAM.examDate || edition.institution !== "MPMT" || edition.jurisdiction !== "MT"
        || edition.sourcePolicy !== "metadata_only" || edition.officialUrl !== MPMT_OFFICIAL_PREVIOUS_EXAM.portalUrl)) throw new Error("Standing exige a prova MPMT 01/2026 exata, aplicada em 14/06/2026.");
      const pending = await db
        .select({ publicId: examEditionDocuments.publicId, documentType: examEditionDocuments.documentType })
        .from(examEditionDocuments)
        .where(and(eq(examEditionDocuments.examEditionId, edition.id), eq(examEditionDocuments.status, "pending_review")));
      const booklet = pending.find((document) => document.documentType === "question_booklet");
      const answerKey = pending.find((document) => document.documentType === "answer_key");
      if (!booklet || !answerKey || pending.length !== 2) {
        throw new Error(`A edição ${pair.editionPublicId} precisa de exatamente um caderno e um gabarito pendentes.`);
      }

      // A URL é consultada de novo antes da decisão, como no painel.
      const checks = new Map<string, Awaited<ReturnType<typeof verifyOfficialExamUrl>>>();
      for (const document of [booklet, answerKey]) {
        const candidate = await loadDocumentReviewCandidate(db, document.publicId);
        if (!candidate) throw new Error(`Documento ausente: ${document.publicId}.`);
        if (standing && (candidate.sourcePolicy !== "metadata_only" || candidate.sourceUrl !== MPMT_OFFICIAL_PREVIOUS_EXAM.documents.find(item=>item.documentType===candidate.documentType)?.url)) throw new Error("Standing exige caderno Tipo1 e gabarito definitivo oficiais exatos, como links externos.");
        const checked = await verifyOfficialExamUrl(candidate.bankSlug, candidate.sourceUrl);
        if (checked.finalUrl !== candidate.sourceUrl || checked.httpStatus < 200 || checked.httpStatus > 399 || !checked.isPdf) {
          throw new Error(`A URL oficial mudou ou deixou de entregar PDF: ${candidate.sourceUrl}.`);
        }
        checks.set(document.publicId, checked);
      }

      try {
        const result = await db.transaction(async (transaction) => {
          const now = new Date();
          const todayIso = saoPauloCalendarDate(now);
          const operators = await transaction
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin"))
            .limit(2);
          if (operators.length !== 1 || operators[0].role !== "admin") {
            throw new Error("A aprovação exige exatamente um administrador identificado.");
          }
          const operatorId = operators[0].id;
          const notes = standing
            ? `Revisão automatizada sob owner_standing_authorization (${reviewer.approvalReference}); humanReview:false. Link oficial conferido, sem cópia do PDF ou aprovação de conteúdo/questões.`
            : `Aprovado sob autorização do proprietário (${reviewer.approvalReference}); link oficial conferido na origem, sem cópia do PDF.`;

          await transaction.execute(sql`select public.lock_exam_document_review_edition(${edition.id})`);
          for (const document of [booklet, answerKey]) {
            const candidate = await loadDocumentReviewCandidate(transaction, document.publicId);
            const checked = checks.get(document.publicId);
            if (!candidate || candidate.status !== "pending_review" || !checked) {
              throw new Error(`O documento ${document.publicId} não está mais pendente.`);
            }
            if (
              candidate.documentType === "question_booklet" &&
              (!["draft", "held", "published"].includes(candidate.editionStatus) || candidate.editionExamDate >= todayIso)
            ) {
              throw new Error("A edição não pode ser publicada: a prova precisa já ter ocorrido.");
            }
            await transaction
              .update(examEditionDocuments)
              .set({ status: "superseded", updatedAt: now })
              .where(and(
                eq(examEditionDocuments.examEditionId, candidate.examEditionId),
                eq(examEditionDocuments.documentType, candidate.documentType),
                eq(examEditionDocuments.sourceUrl, candidate.sourceUrl),
                eq(examEditionDocuments.status, "approved"),
                ne(examEditionDocuments.id, candidate.id),
              ));
            const updated = await transaction
              .update(examEditionDocuments)
              .set({
                httpStatus: checked.httpStatus,
                sourceCheckedAt: checked.checkedAt,
                status: "approved",
                reviewedByUserId: operatorId,
                reviewedAt: now,
                reviewNotes: notes,
                updatedAt: now,
              })
              .where(and(eq(examEditionDocuments.id, candidate.id), eq(examEditionDocuments.status, "pending_review")))
              .returning({ id: examEditionDocuments.id });
            if (!updated[0]) throw new Error("O documento já foi decidido.");
            if (candidate.documentType === "question_booklet") {
              await transaction
                .update(examEditions)
                .set({
                  status: "published",
                  publishedAt: sql`coalesce(${examEditions.publishedAt}, ${now.toISOString()}::timestamptz)`,
                  updatedByUserId: operatorId,
                  updatedAt: now,
                })
                .where(eq(examEditions.id, candidate.examEditionId));
            }
            await transaction.insert(auditLogs).values({
              actorUserId: operatorId,
              action: "editorial.exam_document.approved",
              entityType: "exam_edition_document",
              entityId: candidate.publicId,
              metadata: {
                sourceUrl: candidate.sourceUrl,
                dossierFingerprint: buildExamDocumentReviewFingerprint(candidate),
                ...approvalBasis,
                executionSource: "server_cli",
                notes,
              },
            });
          }

          await transaction.execute(sql`select public.lock_product_binding_review_product(${pair.productSlug})`);
          const input = {
            productSlug: pair.productSlug,
            examPublicId: pair.editionPublicId,
            documentPublicId: booklet.publicId,
            answerKeyDocumentPublicId: answerKey.publicId,
          };
          const scope = await loadReferenceScope(transaction, input, todayIso);
          if (!scope) throw new Error("Não foi possível cruzar produto e prova.");
          if (standing) {
            const registrations = await transaction.select({ metadata:auditLogs.metadata }).from(auditLogs)
              .where(and(eq(auditLogs.action,"editorial.previous_exam.mpmt_metadata_registered"),eq(auditLogs.entityId,pair.editionPublicId))).limit(2);
            if (registrations.length!==1 || registrations[0].metadata?.opportunityPublicId!==scope.opportunityPublicId
              || registrations[0].metadata?.approvalReference!==reviewer.approvalReference || registrations[0].metadata?.humanReview!==false
              || scope.preparationMode!=="historical_training") throw new Error("Cadastro MPMT não corresponde à oportunidade histórica real; vínculo bloqueado.");
          }
          const decision = validateExamReferenceScope(scope, todayIso, { requireLicense: false });
          if (!decision.valid) throw new Error(decision.reason);

          const referencePublicId = randomUUID();
          const [inserted] = await transaction
            .insert(contestProductExamReferences)
            .values({
              publicId: referencePublicId,
              productSlug: pair.productSlug,
              examEditionId: scope.editionId,
              primaryDocumentId: scope.documentId,
              primaryDocumentType: "question_booklet",
              answerKeyDocumentId: scope.answerKeyDocumentId,
              answerKeyDocumentType: "answer_key",
              relationship: "latest_previous_exam",
              selectionVerifiedAt: now,
              status: "pending_review",
              initiatedByUserId: operatorId,
            })
            .returning({ id: contestProductExamReferences.id });
          await transaction
            .update(contestProductExamReferences)
            .set({ status: "superseded", updatedAt: now })
            .where(and(
              eq(contestProductExamReferences.productSlug, pair.productSlug),
              eq(contestProductExamReferences.relationship, "latest_previous_exam"),
              eq(contestProductExamReferences.status, "approved"),
              ne(contestProductExamReferences.id, inserted.id),
            ));
          await transaction
            .update(contestProductExamReferences)
            .set({ status: "approved", reviewedByUserId: operatorId, reviewedAt: now, reviewNotes: notes, updatedAt: now })
            .where(eq(contestProductExamReferences.id, inserted.id));
          for (const action of ["editorial.product_exam_reference.proposed", "editorial.product_exam_reference.approved"]) {
            await transaction.insert(auditLogs).values({
              actorUserId: operatorId,
              action,
              entityType: "contest_product_exam_reference",
              entityId: referencePublicId,
              metadata: { ...input, relationship: "latest_previous_exam", accessMode: "official_external_link",
                ...approvalBasis, executionSource: "server_cli", notes },
            });
          }
          const summary = { ...pair, documentsApproved: 2, editionPublished: true, referencePublicId };
          if (!apply) throw new PreviewRollback(JSON.stringify(summary));
          return summary;
        }, { isolationLevel: "serializable" });
        results.push({ mode: "applied", ...result });
      } catch (error) {
        if (!(error instanceof PreviewRollback)) throw error;
        results.push({ mode: "preview", ...JSON.parse(error.message) });
      }
    }
    console.log(JSON.stringify({ ...approvalBasis, sourcePolicy: "metadata_only",
      sourceContentStored: false, productsReleased: 0, results }, null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("approve-previous-exam-links.ts")) void main().catch((error: unknown) => {
  console.error("Falha na aprovação dos links oficiais.", safeOfficialCourseDossierError(error));
  process.exitCode = 1;
});
