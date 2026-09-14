"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth";
import { CONTEST_CATALOG } from "@/lib/commerce/catalog";
import { isTrustedBindingReviewOrigin } from "@/lib/commerce/product-binding-admin";
import { getDb } from "@/lib/db/client";
import {
  auditLogs,
  contestOpportunities,
  contestProductExamReferences,
  contestStoreProducts,
  examEditionDocuments,
  examEditions,
  opportunityOrganizerAssignments,
  questions,
  quizBanks,
} from "@/lib/db/schema";
import {
  importLicensedPreviousExamBooklet,
  LicensedPreviousExamImportError,
  MAX_LICENSED_PREVIOUS_EXAM_JSON_BYTES,
  parseLicensedPreviousExamPayload,
  reviewLicensedPreviousExamBooklet,
} from "@/lib/editorial/licensed-previous-exam-import";
import { validateExamReferenceScope } from "@/lib/exams/admin-exam-reference-policy";
import { buildExamDocumentReviewFingerprint } from "@/lib/exams/exam-document-review";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";
import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";

const answerKeyDocuments = alias(
  examEditionDocuments,
  "answer_key_exam_document",
);

export type PreviousExamActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialError = (message: string): PreviousExamActionState => ({
  status: "error",
  message,
});

function safeActionError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (
    !message ||
    message.length > 400 ||
    /(?:failed query|params:|permission denied|sqlstate|constraint|relation|column)/iu.test(
      message,
    )
  ) {
    return fallback;
  }
  return message;
}

async function requireTrustedSuperAdmin() {
  const actor = await requireSuperAdmin("/admin/provas-anteriores");
  const requestHeaders = await headers();
  const trusted = isTrustedBindingReviewOrigin(
    requestHeaders.get("origin"),
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === "production",
  );
  return trusted ? actor : null;
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : undefined),
    z.string().trim().max(max).optional(),
  );

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : undefined),
  z.iso.date().optional(),
);

const optionalPositiveInteger = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? Number(value) : undefined,
  z.number().int().min(1).max(300).optional(),
);

const createDocumentSchema = z
  .object({
    examPublicId: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    documentType: z.enum(["question_booklet", "answer_key"]),
    title: z.string().trim().min(3).max(500),
    sourceUrl: z.url().max(2_000),
    sourcePolicy: z.enum(["metadata_only", "licensed_content"]),
    expectedQuestionCount: optionalPositiveInteger,
    rightsHolder: optionalText(500),
    licenseBasis: optionalText(2_000),
    licenseReference: optionalText(1_000),
    licenseEvidenceChecksumSha256: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim()
          ? value.trim().toLowerCase()
          : undefined,
      z.string().regex(/^[a-f0-9]{64}$/u).optional(),
    ),
    licenseEvidenceCheckedAt: optionalDate,
    licensedAt: optionalDate,
    licenseExpiresAt: optionalDate,
  })
  .superRefine((value, context) => {
    if (
      (value.documentType === "question_booklet") !==
      (value.expectedQuestionCount !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          value.documentType === "question_booklet"
            ? "Informe a quantidade total de questões do caderno."
            : "A quantidade de questões pertence somente ao caderno.",
      });
    }
    if (
      value.sourcePolicy === "licensed_content" &&
      (!value.rightsHolder ||
        !value.licenseBasis ||
        !value.licenseReference ||
        !value.licenseEvidenceChecksumSha256 ||
        !value.licenseEvidenceCheckedAt ||
        !value.licensedAt)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Conteúdo licenciado exige titular, base, referência, versão conferida da evidência e data da licença.",
      });
    }
    if (value.sourcePolicy === "licensed_content" && value.licenseReference) {
      try {
        const evidenceUrl = new URL(value.licenseReference);
        if (
          evidenceUrl.protocol !== "https:" ||
          evidenceUrl.username ||
          evidenceUrl.password ||
          !evidenceUrl.hostname
        ) {
          throw new Error("invalid evidence URL");
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["licenseReference"],
          message: "A evidência da licença precisa ser uma URL HTTPS.",
        });
      }
    }
    if (
      value.licensedAt &&
      value.licenseExpiresAt &&
      value.licenseExpiresAt <= value.licensedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "A validade da licença deve terminar depois da concessão.",
      });
    }
  });

function saoPauloCivilDateStart(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000-03:00`) : null;
}

function saoPauloCivilDateEnd(value: string | undefined) {
  return value ? new Date(`${value}T23:59:59.999-03:00`) : null;
}

type PreviousExamDatabase = ReturnType<typeof getDb>;
type PreviousExamTransaction = Parameters<
  Parameters<PreviousExamDatabase["transaction"]>[0]
>[0];
type PreviousExamReader = PreviousExamDatabase | PreviousExamTransaction;

export async function createExamDocumentAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");

  const parsed = createDocumentSchema.safeParse({
    examPublicId: formData.get("examPublicId"),
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    sourceUrl: formData.get("sourceUrl"),
    sourcePolicy: formData.get("sourcePolicy"),
    expectedQuestionCount: formData.get("expectedQuestionCount"),
    rightsHolder: formData.get("rightsHolder"),
    licenseBasis: formData.get("licenseBasis"),
    licenseReference: formData.get("licenseReference"),
    licenseEvidenceChecksumSha256: formData.get(
      "licenseEvidenceChecksumSha256",
    ),
    licenseEvidenceCheckedAt: formData.get("licenseEvidenceCheckedAt"),
    licensedAt: formData.get("licensedAt"),
    licenseExpiresAt: formData.get("licenseExpiresAt"),
  });
  if (!parsed.success) {
    return initialError(
      parsed.error.issues[0]?.message ?? "Revise os dados do documento.",
    );
  }

  const db = getDb();
  const now = new Date();
  const [edition] = await db
    .select({
      id: examEditions.id,
      status: examEditions.status,
      examDate: examEditions.examDate,
      bankSlug: quizBanks.slug,
    })
    .from(examEditions)
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .where(eq(examEditions.publicId, parsed.data.examPublicId))
    .limit(1);
  if (!edition) return initialError("Edição de prova não encontrada.");
  if (
    !["draft", "held", "published"].includes(edition.status) ||
    edition.examDate >= saoPauloCalendarDate(now)
  ) {
    return initialError(
      "A prova anterior deve ter data passada e não pode estar agendada, cancelada ou arquivada.",
    );
  }
  const licensedAt = saoPauloCivilDateStart(parsed.data.licensedAt);
  const licenseExpiresAt = saoPauloCivilDateEnd(
    parsed.data.licenseExpiresAt,
  );
  const licenseEvidenceCheckedAt = saoPauloCivilDateStart(
    parsed.data.licenseEvidenceCheckedAt,
  );
  if (
    parsed.data.sourcePolicy === "licensed_content" &&
    (!licensedAt ||
      licensedAt > now ||
      !licenseEvidenceCheckedAt ||
      licenseEvidenceCheckedAt > now ||
      (licenseExpiresAt && licenseExpiresAt <= now))
  ) {
    return initialError(
      "A licença precisa estar vigente hoje e não pode ter data futura.",
    );
  }

  try {
    const checked = await verifyOfficialExamUrl(
      edition.bankSlug,
      parsed.data.sourceUrl,
    );
    if (checked.httpStatus < 200 || checked.httpStatus > 399) {
      return initialError(
        `A fonte oficial respondeu com HTTP ${checked.httpStatus}.`,
      );
    }
    if (!checked.isPdf) {
      return initialError(
        "O endereço oficial precisa responder com um arquivo PDF válido.",
      );
    }
    const finalUrl = new URL(checked.finalUrl);
    const publicId = randomUUID();
    const licensed = parsed.data.sourcePolicy === "licensed_content";

    await db.transaction(async (transaction) => {
      await transaction.insert(examEditionDocuments).values({
        publicId,
        examEditionId: edition.id,
        documentType: parsed.data.documentType,
        title: parsed.data.title,
        sourceUrl: finalUrl.toString(),
        sourceHost: finalUrl.hostname.toLowerCase(),
        sourceCheckedAt: checked.checkedAt,
        httpStatus: checked.httpStatus,
        contentType: "application/pdf",
        expectedQuestionCount: parsed.data.expectedQuestionCount ?? null,
        distributionMode: "external_link",
        sourcePolicy: parsed.data.sourcePolicy,
        rightsHolder: licensed ? parsed.data.rightsHolder : null,
        licenseBasis: licensed ? parsed.data.licenseBasis : null,
        licenseReference: licensed ? parsed.data.licenseReference : null,
        licenseEvidenceChecksumSha256: licensed
          ? parsed.data.licenseEvidenceChecksumSha256
          : null,
        licenseEvidenceCheckedAt: licensed
          ? licenseEvidenceCheckedAt
          : null,
        licensedAt: licensed ? licensedAt : null,
        licenseExpiresAt: licensed ? licenseExpiresAt : null,
        status: "pending_review",
        initiatedByUserId: actor.id,
      });
      await transaction.insert(auditLogs).values({
        actorUserId: actor.id,
        action: "editorial.exam_document.proposed",
        entityType: "exam_edition_document",
        entityId: publicId,
        metadata: {
          examPublicId: parsed.data.examPublicId,
          documentType: parsed.data.documentType,
          distributionMode: "external_link",
          sourcePolicy: parsed.data.sourcePolicy,
          licenseEvidenceChecksumSha256: licensed
            ? parsed.data.licenseEvidenceChecksumSha256
            : null,
          licenseEvidenceCheckedAt: licensed
            ? licenseEvidenceCheckedAt?.toISOString()
            : null,
          expectedQuestionCount: parsed.data.expectedQuestionCount ?? null,
          sourceUrl: finalUrl.toString(),
        },
      });
    });
    revalidatePath("/admin/provas-anteriores");
    return {
      status: "success",
      message:
        "Link oficial registrado para revisão. Nenhum PDF ou texto de questão foi copiado.",
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível registrar o documento oficial."),
    );
  }
}

const reviewSchema = z.object({
  publicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().min(20).max(2_000),
});

const documentReviewSchema = reviewSchema.extend({
  dossierFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  licenseReviewAttestation: z.literal("on").optional(),
});

async function loadDocumentReviewCandidate(
  database: PreviousExamReader,
  publicId: string,
) {
  const [document] = await database
    .select({
      id: examEditionDocuments.id,
      publicId: examEditionDocuments.publicId,
      examEditionId: examEditionDocuments.examEditionId,
      documentType: examEditionDocuments.documentType,
      title: examEditionDocuments.title,
      sourceUrl: examEditionDocuments.sourceUrl,
      sourceHost: examEditionDocuments.sourceHost,
      sourcePolicy: examEditionDocuments.sourcePolicy,
      expectedQuestionCount: examEditionDocuments.expectedQuestionCount,
      rightsHolder: examEditionDocuments.rightsHolder,
      licenseBasis: examEditionDocuments.licenseBasis,
      licenseReference: examEditionDocuments.licenseReference,
      licenseEvidenceChecksumSha256:
        examEditionDocuments.licenseEvidenceChecksumSha256,
      licenseEvidenceCheckedAt:
        examEditionDocuments.licenseEvidenceCheckedAt,
      licensedAt: examEditionDocuments.licensedAt,
      sourceCheckedAt: examEditionDocuments.sourceCheckedAt,
      httpStatus: examEditionDocuments.httpStatus,
      contentType: examEditionDocuments.contentType,
      status: examEditionDocuments.status,
      initiatedByUserId: examEditionDocuments.initiatedByUserId,
      licenseExpiresAt: examEditionDocuments.licenseExpiresAt,
      bankSlug: quizBanks.slug,
      editionStatus: examEditions.status,
      editionExamDate: examEditions.examDate,
      editionOfficialUrl: examEditions.officialUrl,
      editionSourceCheckedAt: examEditions.sourceCheckedAt,
    })
    .from(examEditionDocuments)
    .innerJoin(
      examEditions,
      eq(examEditionDocuments.examEditionId, examEditions.id),
    )
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .where(eq(examEditionDocuments.publicId, publicId))
    .limit(1);
  return document ?? null;
}

export async function reviewExamDocumentAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = documentReviewSchema.safeParse({
    publicId: formData.get("publicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
    dossierFingerprint: formData.get("dossierFingerprint"),
    licenseReviewAttestation: formData.get("licenseReviewAttestation"),
  });
  if (!parsed.success) {
    return initialError("Registre uma decisão e uma nota com 20 caracteres.");
  }

  const db = getDb();
  const candidate = await loadDocumentReviewCandidate(
    db,
    parsed.data.publicId,
  );
  if (!candidate || candidate.status !== "pending_review") {
    return initialError("O documento não está mais pendente.");
  }
  const approved = parsed.data.decision === "approve";
  if (approved && parsed.data.licenseReviewAttestation !== "on") {
    return initialError(
      "Confirme explicitamente a conferência jurídica do dossiê antes de aprovar.",
    );
  }
  if (approved && candidate.initiatedByUserId === actor.id) {
    return initialError(
      "A aprovação de fonte e licença precisa ser feita por outro administrador.",
    );
  }

  try {
    let checked: Awaited<ReturnType<typeof verifyOfficialExamUrl>> | null =
      null;
    if (approved) {
      checked = await verifyOfficialExamUrl(
        candidate.bankSlug,
        candidate.sourceUrl,
      );
      if (
        checked.finalUrl !== candidate.sourceUrl ||
        checked.httpStatus < 200 ||
        checked.httpStatus > 399 ||
        !checked.isPdf
      ) {
        return initialError(
          "A URL mudou, deixou de responder ou não entrega mais um PDF válido. Registre uma nova proposta com a fonte atual.",
        );
      }
    }
    const reviewedAt = new Date();

    await db.transaction(
      async (transaction) => {
        await transaction.execute(
          sql`select public.lock_exam_document_review_edition(${candidate.examEditionId})`,
        );
        const document = await loadDocumentReviewCandidate(
          transaction,
          parsed.data.publicId,
        );
        if (!document || document.status !== "pending_review") {
          throw new Error("O documento não está mais pendente.");
        }
        if (
          buildExamDocumentReviewFingerprint(document) !==
          parsed.data.dossierFingerprint
        ) {
          throw new Error(
            "O dossiê jurídico mudou depois de ser exibido. Recarregue e revise novamente.",
          );
        }

        if (approved) {
          if (
            !checked ||
            document.examEditionId !== candidate.examEditionId ||
            document.sourceUrl !== candidate.sourceUrl ||
            document.bankSlug !== candidate.bankSlug
          ) {
            throw new Error(
              "A fonte ou a edição mudou durante a revisão. Recarregue o painel.",
            );
          }
          if (document.initiatedByUserId === actor.id) {
            throw new Error(
              "A aprovação de fonte e licença precisa ser feita por outro administrador.",
            );
          }
          if (
            document.sourcePolicy === "licensed_content" &&
            (!document.licenseEvidenceCheckedAt ||
              document.licenseEvidenceCheckedAt > reviewedAt)
          ) {
            throw new Error(
              "A evidência jurídica precisa ter sido conferida antes da revisão.",
            );
          }
          if (
            document.licenseExpiresAt &&
            document.licenseExpiresAt <= reviewedAt
          ) {
            throw new Error("A licença registrada já venceu.");
          }
          if (
            document.documentType === "question_booklet" &&
            (!["draft", "held", "published"].includes(
              document.editionStatus,
            ) ||
              document.editionExamDate >= saoPauloCalendarDate(reviewedAt))
          ) {
            throw new Error(
              "A edição não pode ser publicada: confirme que a prova já ocorreu e não foi cancelada ou arquivada.",
            );
          }

          await transaction
            .update(examEditionDocuments)
            .set({ status: "superseded", updatedAt: reviewedAt })
            .where(
              and(
                eq(
                  examEditionDocuments.examEditionId,
                  document.examEditionId,
                ),
                eq(
                  examEditionDocuments.documentType,
                  document.documentType,
                ),
                eq(examEditionDocuments.sourceUrl, document.sourceUrl),
                eq(examEditionDocuments.status, "approved"),
                ne(examEditionDocuments.id, document.id),
              ),
            );
        }

        const updated = await transaction
          .update(examEditionDocuments)
          .set({
            httpStatus: approved ? checked?.httpStatus : undefined,
            sourceCheckedAt: approved ? checked?.checkedAt : undefined,
            status: approved ? "approved" : "rejected",
            reviewedByUserId: actor.id,
            reviewedAt,
            reviewNotes: parsed.data.notes,
            updatedAt: reviewedAt,
          })
          .where(
            and(
              eq(examEditionDocuments.id, document.id),
              eq(examEditionDocuments.status, "pending_review"),
            ),
          )
          .returning({ id: examEditionDocuments.id });
        if (!updated[0]) throw new Error("O documento já foi decidido.");

        if (approved && document.documentType === "question_booklet") {
          const editionUpdated = await transaction
            .update(examEditions)
            .set({
              status: "published",
              publishedAt: sql`coalesce(${examEditions.publishedAt}, ${reviewedAt})`,
              sourcePolicy:
                document.sourcePolicy === "licensed_content"
                  ? "licensed_content"
                  : undefined,
              updatedByUserId: actor.id,
              updatedAt: reviewedAt,
            })
            .where(
              and(
                eq(examEditions.id, document.examEditionId),
                inArray(examEditions.status, ["draft", "held", "published"]),
              ),
            )
            .returning({ id: examEditions.id });
          if (!editionUpdated[0]) {
            throw new Error("A situação atual da edição impede sua publicação.");
          }
        }

        await transaction.insert(auditLogs).values({
          actorUserId: actor.id,
          action: approved
            ? "editorial.exam_document.approved"
            : "editorial.exam_document.rejected",
          entityType: "exam_edition_document",
          entityId: parsed.data.publicId,
          metadata: {
            notes: parsed.data.notes,
            sourcePolicy: document.sourcePolicy,
            sourceUrl: document.sourceUrl,
            documentType: document.documentType,
            dossierFingerprint: parsed.data.dossierFingerprint,
            licenseEvidenceChecksumSha256:
              document.licenseEvidenceChecksumSha256,
            licenseEvidenceCheckedAt:
              document.licenseEvidenceCheckedAt?.toISOString() ?? null,
            legalReviewAttested: approved,
          },
        });
      },
      { isolationLevel: "serializable" },
    );
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/fontes-oficiais");
    return {
      status: "success",
      message: approved
        ? "Documento aprovado como referência externa. A licença das questões continua sendo conferida separadamente."
        : "Documento rejeitado e preservado no histórico.",
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível registrar a revisão."),
    );
  }
}

const referenceSchema = z.object({
  productSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  examPublicId: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  documentPublicId: z.string().uuid(),
  answerKeyDocumentPublicId: z.string().uuid(),
});

async function loadReferenceScope(
  database: PreviousExamReader,
  input: z.infer<typeof referenceSchema>,
  todayIso: string,
) {
  const [scope] = await database
    .select({
      productStatus: contestStoreProducts.status,
      opportunityId: contestOpportunities.id,
      opportunityEditorialStatus: contestOpportunities.editorialStatus,
      opportunityExamDate: contestOpportunities.examDate,
      opportunityInstitutionAcronym: contestOpportunities.institutionAcronym,
      opportunityJurisdictionCode: contestOpportunities.jurisdictionCode,
      opportunityCareerTrackId: contestOpportunities.careerTrackId,
      opportunitySpecializationId: contestOpportunities.specializationId,
      editionId: examEditions.id,
      editionStatus: examEditions.status,
      editionExamDate: examEditions.examDate,
      editionOfficialUrl: examEditions.officialUrl,
      editionSourceCheckedAt: examEditions.sourceCheckedAt,
      editionInstitutionAcronym: examEditions.institutionAcronym,
      editionJurisdictionCode: examEditions.jurisdictionCode,
      editionCareerTrackId: examEditions.careerTrackId,
      editionSpecializationId: examEditions.specializationId,
      editionBankId: examEditions.bankId,
      bankSlug: quizBanks.slug,
      documentId: examEditionDocuments.id,
      documentStatus: examEditionDocuments.status,
      documentType: examEditionDocuments.documentType,
      documentExamEditionId: examEditionDocuments.examEditionId,
      documentHttpStatus: examEditionDocuments.httpStatus,
      documentContentType: examEditionDocuments.contentType,
      documentExpectedQuestionCount:
        examEditionDocuments.expectedQuestionCount,
      documentSourceUrl: examEditionDocuments.sourceUrl,
      documentSourceCheckedAt: examEditionDocuments.sourceCheckedAt,
      documentSourcePolicy: examEditionDocuments.sourcePolicy,
      documentRightsHolder: examEditionDocuments.rightsHolder,
      documentLicenseBasis: examEditionDocuments.licenseBasis,
      documentLicenseReference: examEditionDocuments.licenseReference,
      documentLicenseEvidenceChecksumSha256:
        examEditionDocuments.licenseEvidenceChecksumSha256,
      documentLicenseEvidenceCheckedAt:
        examEditionDocuments.licenseEvidenceCheckedAt,
      documentLicensedAt: examEditionDocuments.licensedAt,
      documentLicenseExpiresAt: examEditionDocuments.licenseExpiresAt,
      answerKeyDocumentId: answerKeyDocuments.id,
      answerKeyDocumentStatus: answerKeyDocuments.status,
      answerKeyDocumentType: answerKeyDocuments.documentType,
      answerKeyDocumentExamEditionId: answerKeyDocuments.examEditionId,
      answerKeyDocumentHttpStatus: answerKeyDocuments.httpStatus,
      answerKeyDocumentContentType: answerKeyDocuments.contentType,
      answerKeyDocumentSourceUrl: answerKeyDocuments.sourceUrl,
      answerKeyDocumentSourceCheckedAt: answerKeyDocuments.sourceCheckedAt,
      answerKeyDocumentSourcePolicy: answerKeyDocuments.sourcePolicy,
      answerKeyDocumentRightsHolder: answerKeyDocuments.rightsHolder,
      answerKeyDocumentLicenseBasis: answerKeyDocuments.licenseBasis,
      answerKeyDocumentLicenseReference: answerKeyDocuments.licenseReference,
      answerKeyDocumentLicenseEvidenceChecksumSha256:
        answerKeyDocuments.licenseEvidenceChecksumSha256,
      answerKeyDocumentLicenseEvidenceCheckedAt:
        answerKeyDocuments.licenseEvidenceCheckedAt,
      answerKeyDocumentLicensedAt: answerKeyDocuments.licensedAt,
      answerKeyDocumentLicenseExpiresAt: answerKeyDocuments.licenseExpiresAt,
      newerEligibleEditionExists: sql<boolean>`exists (
        select 1
        from exam_editions newer_edition
        where newer_edition.id <> ${examEditions.id}
          and newer_edition.bank_id = ${examEditions.bankId}
          and newer_edition.career_track_id = ${examEditions.careerTrackId}
          and newer_edition.specialization_id is not distinct from ${examEditions.specializationId}
          and newer_edition.institution_acronym = ${examEditions.institutionAcronym}
          and newer_edition.jurisdiction_code = ${examEditions.jurisdictionCode}
          and newer_edition.status in ('held', 'published')
          and (
            newer_edition.exam_date > ${examEditions.examDate}
            or (
              newer_edition.exam_date = ${examEditions.examDate}
              and newer_edition.id > ${examEditions.id}
            )
          )
          and newer_edition.exam_date < coalesce(${contestOpportunities.examDate}, ${todayIso}::date)
          and newer_edition.exam_date < ${todayIso}::date
      )`.mapWith(Boolean),
    })
    .from(contestStoreProducts)
    .innerJoin(
      contestOpportunities,
      eq(contestStoreProducts.opportunityId, contestOpportunities.id),
    )
    .innerJoin(examEditions, eq(examEditions.publicId, input.examPublicId))
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .innerJoin(
      examEditionDocuments,
      and(
        eq(examEditionDocuments.publicId, input.documentPublicId),
        eq(examEditionDocuments.examEditionId, examEditions.id),
      ),
    )
    .innerJoin(
      answerKeyDocuments,
      and(
        eq(
          answerKeyDocuments.publicId,
          input.answerKeyDocumentPublicId,
        ),
        eq(answerKeyDocuments.examEditionId, examEditions.id),
      ),
    )
    .where(eq(contestStoreProducts.slug, input.productSlug))
    .limit(1);
  if (!scope) return null;

  const assignments = await database
    .select({
      role: opportunityOrganizerAssignments.role,
      bankId: opportunityOrganizerAssignments.quizBankId,
    })
    .from(opportunityOrganizerAssignments)
    .where(
      and(
        eq(opportunityOrganizerAssignments.opportunityId, scope.opportunityId),
        eq(opportunityOrganizerAssignments.status, "reviewed"),
        isNull(opportunityOrganizerAssignments.validUntil),
        inArray(opportunityOrganizerAssignments.role, [
          "examination_provider",
          "primary_responsible",
        ]),
      ),
    );
  const responsibleBankId =
    assignments.find((item) => item.role === "examination_provider")?.bankId ??
    assignments.find((item) => item.role === "primary_responsible")?.bankId ??
    null;

  return {
    ...scope,
    responsibleBankId,
    documentIsOfficialSource: isOfficialExamUrl(
      scope.bankSlug,
      scope.documentSourceUrl,
    ),
    editionIsOfficialSource: isOfficialExamUrl(
      scope.bankSlug,
      scope.editionOfficialUrl ?? "",
    ),
    answerKeyDocumentIsOfficialSource: isOfficialExamUrl(
      scope.bankSlug,
      scope.answerKeyDocumentSourceUrl,
    ),
  };
}

export async function createProductExamReferenceAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = referenceSchema.safeParse({
    productSlug: formData.get("productSlug"),
    examPublicId: formData.get("examPublicId"),
    documentPublicId: formData.get("documentPublicId"),
    answerKeyDocumentPublicId: formData.get("answerKeyDocumentPublicId"),
  });
  if (
    !parsed.success ||
    !CONTEST_CATALOG.some((item) => item.slug === parsed.data.productSlug)
  ) {
    return initialError("Produto, edição ou caderno inválido.");
  }

  const todayIso = saoPauloCalendarDate(new Date());
  const scope = await loadReferenceScope(getDb(), parsed.data, todayIso);
  if (!scope) return initialError("Não foi possível cruzar produto e prova.");
  const decision = validateExamReferenceScope(scope, todayIso, {
    requireLicense: false,
  });
  if (!decision.valid) return initialError(decision.reason);

  const publicId = randomUUID();
  const now = new Date();
  try {
    await getDb().transaction(async (transaction) => {
      await transaction.insert(contestProductExamReferences).values({
        publicId,
        productSlug: parsed.data.productSlug,
        examEditionId: scope.editionId,
        primaryDocumentId: scope.documentId,
        primaryDocumentType: "question_booklet",
        answerKeyDocumentId: scope.answerKeyDocumentId,
        answerKeyDocumentType: "answer_key",
        relationship: "latest_previous_exam",
        selectionVerifiedAt: now,
        status: "pending_review",
        initiatedByUserId: actor.id,
      });
      await transaction.insert(auditLogs).values({
        actorUserId: actor.id,
        action: "editorial.product_exam_reference.proposed",
        entityType: "contest_product_exam_reference",
        entityId: publicId,
        metadata: {
          productSlug: parsed.data.productSlug,
          examPublicId: parsed.data.examPublicId,
          documentPublicId: parsed.data.documentPublicId,
          answerKeyDocumentPublicId:
            parsed.data.answerKeyDocumentPublicId,
          relationship: "latest_previous_exam",
        },
      });
    });
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    return {
      status: "success",
      message:
        "Vínculo proposto. Outra conta administrativa precisa confirmar que esta é a última prova exata do cargo e da banca.",
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível propor o vínculo."),
    );
  }
}

export async function reviewProductExamReferenceAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = reviewSchema.safeParse({
    publicId: formData.get("publicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return initialError("Registre uma decisão e uma nota com 20 caracteres.");
  }

  const approved = parsed.data.decision === "approve";
  const now = new Date();
  const todayIso = saoPauloCalendarDate(now);
  const db = getDb();

  try {
    await db.transaction(
      async (transaction) => {
        const [reference] = await transaction
          .select({
            id: contestProductExamReferences.id,
            publicId: contestProductExamReferences.publicId,
            initiatedByUserId:
              contestProductExamReferences.initiatedByUserId,
            productSlug: contestProductExamReferences.productSlug,
            examPublicId: examEditions.publicId,
            documentPublicId: examEditionDocuments.publicId,
            answerKeyDocumentPublicId: answerKeyDocuments.publicId,
          })
          .from(contestProductExamReferences)
          .innerJoin(
            examEditions,
            eq(contestProductExamReferences.examEditionId, examEditions.id),
          )
          .innerJoin(
            examEditionDocuments,
            and(
              eq(
                contestProductExamReferences.primaryDocumentId,
                examEditionDocuments.id,
              ),
              eq(
                contestProductExamReferences.examEditionId,
                examEditionDocuments.examEditionId,
              ),
            ),
          )
          .innerJoin(
            answerKeyDocuments,
            and(
              eq(
                contestProductExamReferences.answerKeyDocumentId,
                answerKeyDocuments.id,
              ),
              eq(
                contestProductExamReferences.examEditionId,
                answerKeyDocuments.examEditionId,
              ),
            ),
          )
          .where(
            and(
              eq(
                contestProductExamReferences.publicId,
                parsed.data.publicId,
              ),
              eq(contestProductExamReferences.status, "pending_review"),
            ),
          )
          .limit(1);
        if (!reference) throw new Error("O vínculo não está mais pendente.");
        if (approved && reference.initiatedByUserId === actor.id) {
          throw new Error(
            "A confirmação da última prova precisa ser feita por outro administrador.",
          );
        }

        await transaction.execute(
          sql`select public.lock_product_binding_review_product(${reference.productSlug})`,
        );

        if (approved) {
          const scope = await loadReferenceScope(
            transaction,
            {
              productSlug: reference.productSlug,
              examPublicId: reference.examPublicId,
              documentPublicId: reference.documentPublicId,
              answerKeyDocumentPublicId:
                reference.answerKeyDocumentPublicId,
            },
            todayIso,
          );
          if (!scope) throw new Error("O escopo do vínculo deixou de existir.");
          const decision = validateExamReferenceScope(scope, todayIso, {
            requireLicense: false,
          });
          if (!decision.valid) throw new Error(decision.reason);

          await transaction
            .update(contestProductExamReferences)
            .set({ status: "superseded", updatedAt: now })
            .where(
              and(
                eq(
                  contestProductExamReferences.productSlug,
                  reference.productSlug,
                ),
                eq(
                  contestProductExamReferences.relationship,
                  "latest_previous_exam",
                ),
                eq(contestProductExamReferences.status, "approved"),
                ne(contestProductExamReferences.id, reference.id),
              ),
            );
        }

        const updated = await transaction
          .update(contestProductExamReferences)
          .set({
            selectionVerifiedAt: approved ? now : undefined,
            status: approved ? "approved" : "rejected",
            reviewedByUserId: actor.id,
            reviewedAt: now,
            reviewNotes: parsed.data.notes,
            updatedAt: now,
          })
          .where(
            and(
              eq(contestProductExamReferences.id, reference.id),
              eq(contestProductExamReferences.status, "pending_review"),
            ),
          )
          .returning({ id: contestProductExamReferences.id });
        if (!updated[0]) throw new Error("O vínculo já foi decidido.");

        await transaction.insert(auditLogs).values({
          actorUserId: actor.id,
          action: approved
            ? "editorial.product_exam_reference.approved"
            : "editorial.product_exam_reference.rejected",
          entityType: "contest_product_exam_reference",
          entityId: reference.publicId,
          metadata: {
            productSlug: reference.productSlug,
            examPublicId: reference.examPublicId,
            documentPublicId: reference.documentPublicId,
            answerKeyDocumentPublicId: reference.answerKeyDocumentPublicId,
            notes: parsed.data.notes,
          },
        });
      },
      { isolationLevel: "serializable" },
    );
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    revalidatePath("/concursos", "layout");
    return {
      status: "success",
      message: approved
        ? "Última prova aprovada para este produto. Isso não aprova questões nem abre vendas."
        : "Vínculo rejeitado e preservado no histórico.",
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível registrar a revisão do vínculo."),
    );
  }
}

const revocationSchema = z.object({
  publicId: z.string().trim().min(1).max(200),
  notes: z.string().trim().min(20).max(2_000),
});

/**
 * Revogação é uma trava de segurança, não uma nova aprovação editorial. Qualquer
 * superadministrador pode interromper a exposição imediatamente; o motivo fica
 * em audit_logs e o registro aprovado permanece imutável no histórico.
 */
export async function revokeExamDocumentAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = revocationSchema.safeParse({
    publicId: formData.get("publicId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return initialError("Informe um motivo de revogação com 20 caracteres.");
  }

  const db = getDb();
  const candidate = await loadDocumentReviewCandidate(db, parsed.data.publicId);
  if (!candidate || candidate.status !== "approved") {
    return initialError("O documento não está aprovado ou já foi retirado.");
  }
  const now = new Date();

  try {
    const result = await db.transaction(
      async (transaction) => {
        await transaction.execute(
          sql`select public.lock_exam_document_review_edition(${candidate.examEditionId})`,
        );
        const document = await loadDocumentReviewCandidate(
          transaction,
          parsed.data.publicId,
        );
        if (!document || document.status !== "approved") {
          throw new Error("O documento já foi retirado.");
        }

        const revoked = await transaction
          .update(examEditionDocuments)
          .set({ status: "superseded", updatedAt: now })
          .where(
            and(
              eq(examEditionDocuments.id, document.id),
              eq(examEditionDocuments.status, "approved"),
            ),
          )
          .returning({ id: examEditionDocuments.id });
        if (!revoked[0]) throw new Error("O documento já foi retirado.");

        const approvedReferences = await transaction
          .update(contestProductExamReferences)
          .set({ status: "superseded", updatedAt: now })
          .where(
            and(
              or(
                eq(
                  contestProductExamReferences.primaryDocumentId,
                  document.id,
                ),
                eq(
                  contestProductExamReferences.answerKeyDocumentId,
                  document.id,
                ),
              ),
              eq(contestProductExamReferences.status, "approved"),
            ),
          )
          .returning({ id: contestProductExamReferences.id });
        const pendingReferences = await transaction
          .update(contestProductExamReferences)
          .set({
            status: "rejected",
            reviewedByUserId: actor.id,
            reviewedAt: now,
            reviewNotes: parsed.data.notes,
            updatedAt: now,
          })
          .where(
            and(
              or(
                eq(
                  contestProductExamReferences.primaryDocumentId,
                  document.id,
                ),
                eq(
                  contestProductExamReferences.answerKeyDocumentId,
                  document.id,
                ),
              ),
              eq(contestProductExamReferences.status, "pending_review"),
            ),
          )
          .returning({ id: contestProductExamReferences.id });
        const suspendedQuestions = await transaction
          .update(questions)
          .set({ editorialStatus: "suspended", updatedAt: now })
          .where(
            and(
              eq(questions.quizMode, "previous_exam"),
              or(
                eq(questions.examEditionDocumentId, document.id),
                eq(
                  questions.examEditionAnswerKeyDocumentId,
                  document.id,
                ),
              ),
              inArray(questions.editorialStatus, [
                "draft",
                "pending_review",
                "reviewed",
              ]),
            ),
          )
          .returning({ id: questions.id });

        await transaction.insert(auditLogs).values({
          actorUserId: actor.id,
          action: "editorial.exam_document.revoked",
          entityType: "exam_edition_document",
          entityId: parsed.data.publicId,
          metadata: {
            notes: parsed.data.notes,
            sourceUrl: document.sourceUrl,
            approvedReferencesRevoked: approvedReferences.length,
            pendingReferencesRejected: pendingReferences.length,
            questionsSuspended: suspendedQuestions.length,
          },
        });

        return {
          references:
            approvedReferences.length + pendingReferences.length,
          questions: suspendedQuestions.length,
        };
      },
      { isolationLevel: "serializable" },
    );

    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    revalidatePath("/concursos", "layout");
    return {
      status: "success",
      message: `Documento retirado imediatamente; ${result.references} vínculo(s) e ${result.questions} questão(ões) também foram bloqueados.`,
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível retirar o documento."),
    );
  }
}

export async function revokeProductExamReferenceAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = revocationSchema.safeParse({
    publicId: formData.get("publicId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return initialError("Informe um motivo de revogação com 20 caracteres.");
  }

  const db = getDb();
  const [candidate] = await db
    .select({
      id: contestProductExamReferences.id,
      productSlug: contestProductExamReferences.productSlug,
      examEditionId: contestProductExamReferences.examEditionId,
    })
    .from(contestProductExamReferences)
    .where(
      and(
        eq(contestProductExamReferences.publicId, parsed.data.publicId),
        eq(contestProductExamReferences.status, "approved"),
      ),
    )
    .limit(1);
  if (!candidate) {
    return initialError("O vínculo não está aprovado ou já foi retirado.");
  }
  const now = new Date();

  try {
    await db.transaction(
      async (transaction) => {
        await transaction.execute(
          sql`select public.lock_exam_document_review_edition(${candidate.examEditionId})`,
        );
        await transaction.execute(
          sql`select public.lock_product_binding_review_product(${candidate.productSlug})`,
        );
        const updated = await transaction
          .update(contestProductExamReferences)
          .set({ status: "superseded", updatedAt: now })
          .where(
            and(
              eq(contestProductExamReferences.id, candidate.id),
              eq(contestProductExamReferences.status, "approved"),
            ),
          )
          .returning({ id: contestProductExamReferences.id });
        if (!updated[0]) throw new Error("O vínculo já foi retirado.");
        await transaction.insert(auditLogs).values({
          actorUserId: actor.id,
          action: "editorial.product_exam_reference.revoked",
          entityType: "contest_product_exam_reference",
          entityId: parsed.data.publicId,
          metadata: {
            productSlug: candidate.productSlug,
            notes: parsed.data.notes,
          },
        });
      },
      { isolationLevel: "serializable" },
    );
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    revalidatePath("/concursos", "layout");
    return {
      status: "success",
      message: "Vínculo retirado; o produto deixou de atender ao gate comercial.",
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível retirar o vínculo."),
    );
  }
}

export async function suspendPreviousExamQuestionAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = revocationSchema.safeParse({
    publicId: formData.get("publicId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return initialError(
      "Informe a identificação da questão e um motivo com 20 caracteres.",
    );
  }
  const now = new Date();
  try {
    const updated = await getDb().transaction(async (transaction) => {
      const [pointer] = await transaction
        .select({
          id: questions.id,
          examEditionId: questions.examEditionId,
          documentId: questions.examEditionDocumentId,
          answerKeyDocumentId:
            questions.examEditionAnswerKeyDocumentId,
        })
        .from(questions)
        .where(
          and(
            eq(questions.publicId, parsed.data.publicId),
            eq(questions.quizMode, "previous_exam"),
            inArray(questions.editorialStatus, [
              "draft",
              "pending_review",
              "reviewed",
            ]),
          ),
        )
        .limit(1);
      if (
        !pointer?.examEditionId ||
        !pointer.documentId ||
        !pointer.answerKeyDocumentId
      ) {
        throw new Error("A questão real não existe ou já está suspensa.");
      }
      await transaction.execute(
        sql`select public.lock_exam_document_review_edition(${pointer.examEditionId})`,
      );
      const documentIds = [pointer.documentId, pointer.answerKeyDocumentId].sort(
        (left, right) => left - right,
      );
      const lockedDocuments = await transaction
        .select({ id: examEditionDocuments.id })
        .from(examEditionDocuments)
        .where(inArray(examEditionDocuments.id, documentIds))
        .orderBy(examEditionDocuments.id)
        .for("share");
      if (lockedDocuments.length !== 2) {
        throw new Error("O caderno ou o gabarito da questão deixou de existir.");
      }
      const rows = await transaction
        .update(questions)
        .set({ editorialStatus: "suspended", updatedAt: now })
        .where(
          and(
            eq(questions.publicId, parsed.data.publicId),
            eq(questions.id, pointer.id),
            eq(questions.examEditionId, pointer.examEditionId),
            eq(questions.examEditionDocumentId, pointer.documentId),
            eq(
              questions.examEditionAnswerKeyDocumentId,
              pointer.answerKeyDocumentId,
            ),
            eq(questions.quizMode, "previous_exam"),
            inArray(questions.editorialStatus, [
              "draft",
              "pending_review",
              "reviewed",
            ]),
          ),
        )
        .returning({ id: questions.id });
      if (!rows[0]) {
        throw new Error("A questão real não existe ou já está suspensa.");
      }
      await transaction.insert(auditLogs).values({
        actorUserId: actor.id,
        action: "editorial.previous_exam_question.suspended",
        entityType: "question",
        entityId: parsed.data.publicId,
        metadata: { notes: parsed.data.notes },
      });
      return rows[0];
    });
    if (!updated) throw new Error("A questão não foi suspensa.");
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    revalidatePath("/concursos", "layout");
    return {
      status: "success",
      message:
        "Questão real suspensa. Uma nova versão licenciada poderá ocupar a mesma ordem.",
    };
  } catch (error) {
    return initialError(
      safeActionError(error, "Não foi possível suspender a questão real."),
    );
  }
}

const licensedBookletImportSchema = z.object({
  documentPublicId: z.string().uuid(),
  answerKeyDocumentPublicId: z.string().uuid(),
  payload: z.string().min(1).max(MAX_LICENSED_PREVIOUS_EXAM_JSON_BYTES),
  attestation: z.literal("on"),
});

/** Entrada manual e deliberada de conteúdo já licenciado. O servidor deriva
 * edição, carreira, fonte e licença do documento aprovado; nenhum desses dados
 * jurídicos é aceito do JSON enviado pelo navegador. */
export async function importLicensedPreviousExamBookletAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = licensedBookletImportSchema.safeParse({
    documentPublicId: formData.get("documentPublicId"),
    answerKeyDocumentPublicId: formData.get(
      "answerKeyDocumentPublicId",
    ),
    payload: formData.get("payload"),
    attestation: formData.get("attestation"),
  });
  if (!parsed.success) {
    return initialError(
      formData.get("attestation") === "on"
        ? "Selecione caderno e gabarito e informe um JSON dentro do limite seguro."
        : "Confirme a integridade do caderno e o escopo da licença antes de importar.",
    );
  }

  try {
    const payload = parseLicensedPreviousExamPayload(parsed.data.payload);
    const result = await importLicensedPreviousExamBooklet(getDb(), {
      documentPublicId: parsed.data.documentPublicId,
      answerKeyDocumentPublicId:
        parsed.data.answerKeyDocumentPublicId,
      payload,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    return {
      status: "success",
      message: `${result.importedQuestions} questões reais foram importadas como pendentes. Nenhuma foi aprovada ou publicada.`,
    };
  } catch (error) {
    if (!(error instanceof LicensedPreviousExamImportError)) {
      // O erro bruto pode carregar parâmetros SQL com o conteúdo licenciado.
      console.error("Falha inesperada ao importar caderno licenciado.");
    }
    return initialError(
      error instanceof LicensedPreviousExamImportError
        ? error.message
        : "Não foi possível importar o caderno licenciado.",
    );
  }
}

const licensedBookletReviewSchema = z
  .object({
    batchPublicId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    notes: z.string().trim().min(20).max(1_500),
    dossierFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    reviewAttestation: z.literal("on").optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "approve" && value.reviewAttestation !== "on") {
      context.addIssue({
        code: "custom",
        path: ["reviewAttestation"],
        message: "A declaração integral é obrigatória para aprovar.",
      });
    }
  });

export async function reviewLicensedPreviousExamBookletAction(
  _state: PreviousExamActionState,
  formData: FormData,
): Promise<PreviousExamActionState> {
  const actor = await requireTrustedSuperAdmin();
  if (!actor) return initialError("Origem administrativa inválida.");
  const parsed = licensedBookletReviewSchema.safeParse({
    batchPublicId: formData.get("batchPublicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
    dossierFingerprint: formData.get("dossierFingerprint"),
    reviewAttestation:
      formData.get("reviewAttestation") === "on" ? "on" : undefined,
  });
  if (!parsed.success) {
    return initialError(
      "Confira o lote integral e registre uma nota de pelo menos 20 caracteres. Para aprovar, marque também a declaração.",
    );
  }

  try {
    const result = await reviewLicensedPreviousExamBooklet(getDb(), {
      batchPublicId: parsed.data.batchPublicId,
      reviewerUserId: actor.id,
      decision: parsed.data.decision,
      notes: parsed.data.notes,
      fingerprint: parsed.data.dossierFingerprint,
    });
    revalidatePath("/admin/provas-anteriores");
    revalidatePath("/admin/catalogo-produtos");
    revalidatePath("/app/questoes");
    return {
      status: "success",
      message:
        result.decision === "approve"
          ? `${result.reviewedQuestions} questões foram revisadas no lote completo. Isso não publica produto nem abre vendas.`
          : `${result.reviewedQuestions} questões foram suspensas em conjunto e preservadas no histórico.`,
    };
  } catch (error) {
    if (!(error instanceof LicensedPreviousExamImportError)) {
      console.error("Falha inesperada ao revisar caderno licenciado.");
    }
    return initialError(
      error instanceof LicensedPreviousExamImportError
        ? error.message
        : "Não foi possível decidir o lote licenciado.",
    );
  }
}
