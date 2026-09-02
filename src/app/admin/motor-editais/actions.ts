"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  auditLogs,
  contestOpportunities,
  legalActs,
  legalArticles,
  legalVersions,
  opportunityOrganizerAssignments,
  opportunityDocumentSnapshots,
  opportunityRequirements,
  opportunitySourceDocuments,
  questionOpportunities,
  questionOptions,
  questions,
  questionStyleProfiles,
  quizBanks,
  quizSubjects,
  quizTopics,
} from "@/lib/db/schema";
import {
  buildNoticeQuestionDraft,
  deterministicNoticeQuestionUuid,
  NOTICE_QUESTION_GENERATOR_VERSION,
} from "@/lib/editorial/notice-question-generator";
import {
  findMostSimilarQuestion,
  ORIGINALITY_REJECTION_THRESHOLD_BPS,
} from "@/lib/editorial/originality";
import { parseSyllabusItems } from "@/lib/editorial/syllabus-parser";
import { extractOfficialSyllabusCandidates } from "@/lib/editorial/official-syllabus-extractor";
import type { InternalOpportunitySourceCandidate } from "@/lib/opportunities/official-candidates";
import {
  captureOfficialPdf,
  discoverOfficialDocumentCandidates,
} from "@/lib/opportunities/official-document-fetch";
import type { OfficialDocumentCandidate } from "@/lib/opportunities/official-document-policy";
import { checkOpportunitySourceMetadata } from "@/lib/opportunities/source-metadata-check";
import {
  parseOfficialOpportunitySourceUrl,
  OFFICIAL_DOCUMENT_AUTHORIZATION_SCOPE,
  type OfficialOpportunitySourceId,
} from "@/lib/opportunities/source-monitor-policy";

export type NoticeEngineActionState = {
  status: "idle" | "success" | "error";
  message: string;
  candidates?: readonly OfficialDocumentCandidate[];
};

function errorState(message: string): NoticeEngineActionState {
  return { status: "error", message };
}

function refreshNoticeEngine() {
  revalidatePath("/admin/motor-editais");
  revalidatePath("/admin/fabrica-autoral");
}

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : undefined),
  z.iso.date().optional(),
);

const registerSourceSchema = z.object({
  opportunityPublicId: z.string().uuid(),
  documentType: z.enum([
    "authorization",
    "organizer_contract",
    "official_announcement",
    "notice",
  ]),
  title: z.string().trim().min(5).max(300),
  sourceUrl: z.url().max(1_000),
  sourceExternalId: z.string().trim().max(180).optional().default(""),
  publishedAt: optionalDate,
});

export async function registerNoticeSourceAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = registerSourceSchema.safeParse({
    opportunityPublicId: formData.get("opportunityPublicId"),
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    sourceUrl: formData.get("sourceUrl"),
    sourceExternalId: formData.get("sourceExternalId"),
    publishedAt: formData.get("publishedAt"),
  });
  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Revise os dados da fonte.");
  }

  const db = getDb();
  const [opportunity] = await db
    .select({ id: contestOpportunities.id, title: contestOpportunities.title })
    .from(contestOpportunities)
    .where(eq(contestOpportunities.publicId, parsed.data.opportunityPublicId))
    .limit(1);
  if (!opportunity) return errorState("O concurso selecionado não foi encontrado.");

  try {
    const official = parseOfficialOpportunitySourceUrl(parsed.data.sourceUrl);
    const candidate: InternalOpportunitySourceCandidate = {
      sourceId: official.sourceId as OfficialOpportunitySourceId,
      publisher: official.publisher,
      url: official.url,
      documentType: parsed.data.documentType,
      status: "pending_review",
      sourcePolicy: "metadata_only",
      sourceContentStored: false,
    };
    const metadata = await checkOpportunitySourceMetadata(candidate);
    if (metadata.httpStatus < 200 || metadata.httpStatus >= 400) {
      return errorState(`A fonte oficial respondeu com HTTP ${metadata.httpStatus}.`);
    }

    const publicId = randomUUID();
    const observedAt = new Date(metadata.observedAt);
    const [saved] = await db
      .insert(opportunitySourceDocuments)
      .values({
        publicId,
        opportunityId: opportunity.id,
        documentType: parsed.data.documentType,
        sourceExternalId: parsed.data.sourceExternalId || null,
        title: parsed.data.title,
        sourceUrl: metadata.url,
        sourceHost: metadata.hostname,
        publishedAt: parsed.data.publishedAt
          ? new Date(`${parsed.data.publishedAt}T12:00:00.000Z`)
          : null,
        observedAt,
        lastSeenAt: observedAt,
        httpStatus: metadata.httpStatus,
        contentType: metadata.contentType,
        sourcePolicy: "metadata_only",
        sourceContentStored: false,
        initiatedByUserId: user.id,
      })
      .onConflictDoUpdate({
        target: [opportunitySourceDocuments.opportunityId, opportunitySourceDocuments.sourceUrl],
        set: {
          documentType: parsed.data.documentType,
          sourceExternalId: parsed.data.sourceExternalId || null,
          title: parsed.data.title,
          publishedAt: parsed.data.publishedAt
            ? new Date(`${parsed.data.publishedAt}T12:00:00.000Z`)
            : null,
          observedAt,
          lastSeenAt: observedAt,
          httpStatus: metadata.httpStatus,
          contentType: metadata.contentType,
          status: "pending_review",
          initiatedByUserId: user.id,
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNotes: null,
        },
      })
      .returning({ publicId: opportunitySourceDocuments.publicId });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: "editorial.notice_source.registered",
      entityType: "opportunity_source_document",
      entityId: saved.publicId,
      metadata: {
        opportunityPublicId: parsed.data.opportunityPublicId,
        sourceUrl: metadata.url,
        sourcePolicy: "metadata_only",
        sourceContentStored: false,
        httpStatus: metadata.httpStatus,
      },
    });
    refreshNoticeEngine();
    return {
      status: "success",
      message: `Fonte de “${opportunity.title}” registrada para revisão independente. Nenhum PDF foi armazenado.`,
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Não foi possível verificar a fonte oficial.",
    );
  }
}

const sourceReviewSchema = z.object({
  publicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2_000),
});

export async function reviewNoticeSourceAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = sourceReviewSchema.safeParse({
    publicId: formData.get("publicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return errorState("Revise os dados da decisão.");
  if (parsed.data.decision === "reject" && parsed.data.notes.length < 10) {
    return errorState("Explique a rejeição em pelo menos 10 caracteres.");
  }

  const db = getDb();
  const [source] = await db
    .select({
      id: opportunitySourceDocuments.id,
      opportunityId: opportunitySourceDocuments.opportunityId,
      status: opportunitySourceDocuments.status,
      initiatedByUserId: opportunitySourceDocuments.initiatedByUserId,
      httpStatus: opportunitySourceDocuments.httpStatus,
      observedAt: opportunitySourceDocuments.observedAt,
    })
    .from(opportunitySourceDocuments)
    .where(eq(opportunitySourceDocuments.publicId, parsed.data.publicId))
    .limit(1);
  if (!source || source.status !== "pending_review") {
    return errorState("A fonte não está mais pendente de revisão.");
  }
  if (source.initiatedByUserId === user.id) {
    return errorState("Quem registrou a fonte não pode aprovar a própria conferência.");
  }
  const approved = parsed.data.decision === "approve";
  if (approved && (source.httpStatus < 200 || source.httpStatus >= 400)) {
    return errorState("A fonte não pode ser aprovada porque a resposta HTTP não está saudável.");
  }

  const now = new Date();
  try {
    await db.transaction(async (transaction) => {
      const updated = await transaction
        .update(opportunitySourceDocuments)
        .set({
          status: approved ? "approved" : "rejected",
          reviewedByUserId: user.id,
          reviewedAt: now,
          reviewNotes: parsed.data.notes || null,
        })
        .where(
          and(
            eq(opportunitySourceDocuments.id, source.id),
            eq(opportunitySourceDocuments.status, "pending_review"),
          ),
        )
        .returning({ id: opportunitySourceDocuments.id });
      if (!updated[0]) throw new Error("A fonte já foi decidida por outro editor.");

      if (approved) {
        await transaction
          .update(contestOpportunities)
          .set({ sourceCheckedAt: source.observedAt, updatedByUserId: user.id, updatedAt: now })
          .where(eq(contestOpportunities.id, source.opportunityId));
      }
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: approved
          ? "editorial.notice_source.approved"
          : "editorial.notice_source.rejected",
        entityType: "opportunity_source_document",
        entityId: parsed.data.publicId,
        metadata: { notes: parsed.data.notes || null },
      });
    });
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
    );
  }

  refreshNoticeEngine();
  return {
    status: "success",
    message: approved ? "Fonte oficial aprovada." : "Fonte rejeitada e preservada no histórico.",
  };
}

const discoverDocumentsSchema = z.object({ sourceDocumentPublicId: z.string().uuid() });

export async function discoverNoticeDocumentsAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  await requireAdmin("/admin/motor-editais");
  const parsed = discoverDocumentsSchema.safeParse({
    sourceDocumentPublicId: formData.get("sourceDocumentPublicId"),
  });
  if (!parsed.success) return errorState("Selecione uma fonte oficial válida.");

  const db = getDb();
  const [source] = await db
    .select({
      sourceUrl: opportunitySourceDocuments.sourceUrl,
      title: opportunitySourceDocuments.title,
      status: opportunitySourceDocuments.status,
    })
    .from(opportunitySourceDocuments)
    .where(eq(opportunitySourceDocuments.publicId, parsed.data.sourceDocumentPublicId))
    .limit(1);
  if (!source || source.status !== "approved") {
    return errorState("A fonte precisa estar aprovada antes de procurar anexos.");
  }

  try {
    const official = parseOfficialOpportunitySourceUrl(source.sourceUrl);
    const candidates = await discoverOfficialDocumentCandidates(
      official.url,
      official.sourceId,
      source.title,
    );
    if (!candidates.length) {
      return {
        status: "error",
        message: "Nenhum PDF de edital ou conteúdo programático foi encontrado nesta página oficial.",
      };
    }
    return {
      status: "success",
      message: `${candidates.length} documento(s) oficial(is) elegível(is) encontrado(s). Escolha qual capturar.`,
      candidates,
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Não foi possível procurar anexos oficiais.",
    );
  }
}

const captureDocumentSchema = z.object({
  sourceDocumentPublicId: z.string().uuid(),
  documentUrl: z.url().max(2_000),
});

export async function captureNoticeDocumentAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = captureDocumentSchema.safeParse({
    sourceDocumentPublicId: formData.get("sourceDocumentPublicId"),
    documentUrl: formData.get("documentUrl"),
  });
  if (!parsed.success) return errorState("O documento selecionado é inválido.");

  const db = getDb();
  const [source] = await db
    .select({
      id: opportunitySourceDocuments.id,
      title: opportunitySourceDocuments.title,
      sourceUrl: opportunitySourceDocuments.sourceUrl,
      status: opportunitySourceDocuments.status,
    })
    .from(opportunitySourceDocuments)
    .where(eq(opportunitySourceDocuments.publicId, parsed.data.sourceDocumentPublicId))
    .limit(1);
  if (!source || source.status !== "approved") {
    return errorState("A fonte precisa continuar aprovada para permitir a captura.");
  }

  try {
    const official = parseOfficialOpportunitySourceUrl(source.sourceUrl);
    const candidates = await discoverOfficialDocumentCandidates(
      official.url,
      official.sourceId,
      source.title,
    );
    const candidate = candidates.find((item) => item.url === parsed.data.documentUrl);
    if (!candidate) {
      return errorState("O PDF não pertence mais à lista elegível descoberta na fonte oficial.");
    }
    const captured = await captureOfficialPdf(candidate, official.sourceId);
    const publicId = randomUUID();
    const [saved] = await db
      .insert(opportunityDocumentSnapshots)
      .values({
        publicId,
        sourceDocumentId: source.id,
        documentUrl: captured.documentUrl,
        sourceHost: captured.sourceHost,
        fileName: captured.fileName,
        mimeType: captured.mimeType,
        documentBytes: captured.documentBytes,
        checksumSha256: captured.checksumSha256,
        byteLength: captured.byteLength,
        pageCount: captured.pageCount,
        extractedText: captured.extractedText,
        pageTexts: [...captured.pageTexts],
        textLength: captured.textLength,
        parserVersion: captured.parserVersion,
        sourcePolicy: "official_document",
        authorizationScope: OFFICIAL_DOCUMENT_AUTHORIZATION_SCOPE,
        authorizedAt: new Date("2026-09-01T12:00:00.000-03:00"),
        initiatedByUserId: user.id,
      })
      .onConflictDoNothing({
        target: [
          opportunityDocumentSnapshots.sourceDocumentId,
          opportunityDocumentSnapshots.checksumSha256,
        ],
      })
      .returning({ publicId: opportunityDocumentSnapshots.publicId });
    if (!saved) return errorState("Esta versão do PDF já está armazenada para a fonte.");

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: "editorial.notice_document.captured",
      entityType: "opportunity_document_snapshot",
      entityId: saved.publicId,
      metadata: {
        sourceDocumentPublicId: parsed.data.sourceDocumentPublicId,
        documentUrl: captured.documentUrl,
        checksumSha256: captured.checksumSha256,
        byteLength: captured.byteLength,
        pageCount: captured.pageCount,
        textLength: captured.textLength,
        authorizationScope: OFFICIAL_DOCUMENT_AUTHORIZATION_SCOPE,
      },
    });
    refreshNoticeEngine();
    return {
      status: "success",
      message: `PDF oficial capturado (${captured.pageCount} páginas) e enviado para revisão independente.`,
    };
  } catch (error) {
    console.error("Falha ao capturar PDF oficial.", error);
    return errorState(
      error instanceof Error ? error.message : "Não foi possível capturar o PDF oficial.",
    );
  }
}

const snapshotReviewSchema = z.object({
  snapshotPublicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2_000),
});

export async function reviewNoticeDocumentAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = snapshotReviewSchema.safeParse({
    snapshotPublicId: formData.get("snapshotPublicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return errorState("Revise os dados da decisão do PDF.");
  if (parsed.data.decision === "reject" && parsed.data.notes.length < 10) {
    return errorState("Explique a rejeição em pelo menos 10 caracteres.");
  }

  const db = getDb();
  const [snapshot] = await db
    .select({
      id: opportunityDocumentSnapshots.id,
      status: opportunityDocumentSnapshots.status,
      initiatedByUserId: opportunityDocumentSnapshots.initiatedByUserId,
      sourceStatus: opportunitySourceDocuments.status,
    })
    .from(opportunityDocumentSnapshots)
    .innerJoin(
      opportunitySourceDocuments,
      eq(opportunityDocumentSnapshots.sourceDocumentId, opportunitySourceDocuments.id),
    )
    .where(eq(opportunityDocumentSnapshots.publicId, parsed.data.snapshotPublicId))
    .limit(1);
  if (!snapshot || snapshot.status !== "pending_review") {
    return errorState("Esta captura não está mais pendente.");
  }
  if (snapshot.initiatedByUserId === user.id) {
    return errorState("Quem capturou o PDF não pode aprovar a própria captura.");
  }
  if (parsed.data.decision === "approve" && snapshot.sourceStatus !== "approved") {
    return errorState("A fonte oficial vinculada precisa continuar aprovada.");
  }

  const approved = parsed.data.decision === "approve";
  const now = new Date();
  try {
    await db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(opportunityDocumentSnapshots)
        .set({
          status: approved ? "approved" : "rejected",
          reviewedByUserId: user.id,
          reviewedAt: now,
          reviewNotes: parsed.data.notes || null,
          updatedAt: now,
        })
        .where(
          and(
            eq(opportunityDocumentSnapshots.id, snapshot.id),
            eq(opportunityDocumentSnapshots.status, "pending_review"),
          ),
        )
        .returning({ id: opportunityDocumentSnapshots.id });
      if (!updated) throw new Error("A captura já foi decidida por outro editor.");
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: approved
          ? "editorial.notice_document.approved"
          : "editorial.notice_document.rejected",
        entityType: "opportunity_document_snapshot",
        entityId: parsed.data.snapshotPublicId,
        metadata: { notes: parsed.data.notes || null },
      });
    });
    refreshNoticeEngine();
    return {
      status: "success",
      message: approved
        ? "PDF oficial aprovado para extração do programa."
        : "PDF rejeitado e preservado no histórico.",
    };
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Não foi possível revisar o PDF.");
  }
}

const extractSnapshotSchema = z.object({ snapshotPublicId: z.string().uuid() });

export async function extractSnapshotSyllabusAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = extractSnapshotSchema.safeParse({
    snapshotPublicId: formData.get("snapshotPublicId"),
  });
  if (!parsed.success) return errorState("Selecione uma captura aprovada.");

  const db = getDb();
  const [snapshotRows, subjects] = await Promise.all([
    db
      .select({
        id: opportunityDocumentSnapshots.id,
        status: opportunityDocumentSnapshots.status,
        pageTexts: opportunityDocumentSnapshots.pageTexts,
        sourceDocumentId: opportunityDocumentSnapshots.sourceDocumentId,
        sourceStatus: opportunitySourceDocuments.status,
        opportunityId: opportunitySourceDocuments.opportunityId,
      })
      .from(opportunityDocumentSnapshots)
      .innerJoin(
        opportunitySourceDocuments,
        eq(opportunityDocumentSnapshots.sourceDocumentId, opportunitySourceDocuments.id),
      )
      .where(eq(opportunityDocumentSnapshots.publicId, parsed.data.snapshotPublicId))
      .limit(1),
    db
      .select({ id: quizSubjects.id, name: quizSubjects.name })
      .from(quizSubjects)
      .where(eq(quizSubjects.isActive, true)),
  ]);
  const snapshot = snapshotRows[0];
  if (!snapshot || snapshot.status !== "approved" || snapshot.sourceStatus !== "approved") {
    return errorState("O PDF e sua fonte precisam estar aprovados antes da extração.");
  }

  const candidates = extractOfficialSyllabusCandidates(snapshot.pageTexts, subjects);
  if (!candidates.length) {
    return errorState(
      "Não foi possível reconhecer matérias no conteúdo programático. Use a importação manual preservando o texto oficial.",
    );
  }

  try {
    const inserted = await db.transaction(async (transaction) => {
      const rows = await transaction
        .insert(opportunityRequirements)
        .values(
          candidates.map((candidate) => ({
            opportunityId: snapshot.opportunityId,
            sourceDocumentId: snapshot.sourceDocumentId,
            sourceSnapshotId: snapshot.id,
            subjectId: candidate.suggestedSubjectId,
            requirementText: candidate.requirementText,
            sourceLocator: candidate.sourceLocator,
            editorialStatus: "draft",
            createdByUserId: user.id,
          })),
        )
        .onConflictDoNothing({
          target: [opportunityRequirements.sourceDocumentId, opportunityRequirements.requirementText],
        })
        .returning({ id: opportunityRequirements.id });
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "editorial.notice_syllabus.extracted",
        entityType: "opportunity_document_snapshot",
        entityId: parsed.data.snapshotPublicId,
        metadata: {
          identified: candidates.length,
          inserted: rows.length,
          extractionPolicy: "deterministic_verbatim_lines",
        },
      });
      return rows;
    });
    refreshNoticeEngine();
    return {
      status: "success",
      message: `${inserted.length} item(ns) extraído(s) para mapeamento humano; ${candidates.length - inserted.length} duplicado(s) ignorado(s).`,
    };
  } catch (error) {
    console.error("Falha ao extrair conteúdo programático.", error);
    return errorState("Não foi possível criar a fila de mapeamento do edital.");
  }
}

const importRequirementsSchema = z.object({
  sourceDocumentPublicId: z.string().uuid(),
  subjectId: z.coerce.number().int().positive(),
  topicId: z.coerce.number().int().positive(),
  legalArticleId: z.coerce.number().int().positive(),
  sourceLocator: z.string().trim().min(3).max(300),
  syllabusText: z.string().trim().min(8).max(20_000),
});

export async function importSyllabusRequirementsAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = importRequirementsSchema.safeParse({
    sourceDocumentPublicId: formData.get("sourceDocumentPublicId"),
    subjectId: formData.get("subjectId"),
    topicId: formData.get("topicId"),
    legalArticleId: formData.get("legalArticleId"),
    sourceLocator: formData.get("sourceLocator"),
    syllabusText: formData.get("syllabusText"),
  });
  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Revise o bloco do edital.");
  }

  let syllabus: ReturnType<typeof parseSyllabusItems>;
  try {
    syllabus = parseSyllabusItems(parsed.data.syllabusText);
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Não foi possível separar os itens.");
  }

  const db = getDb();
  const [sourceRows, topicRows, articleRows] = await Promise.all([
    db
      .select({
        id: opportunitySourceDocuments.id,
        opportunityId: opportunitySourceDocuments.opportunityId,
        status: opportunitySourceDocuments.status,
      })
      .from(opportunitySourceDocuments)
      .where(eq(opportunitySourceDocuments.publicId, parsed.data.sourceDocumentPublicId))
      .limit(1),
    db
      .select({ id: quizTopics.id })
      .from(quizTopics)
      .innerJoin(quizSubjects, eq(quizTopics.subjectId, quizSubjects.id))
      .where(
        and(
          eq(quizTopics.id, parsed.data.topicId),
          eq(quizTopics.subjectId, parsed.data.subjectId),
          eq(quizTopics.isActive, true),
          eq(quizSubjects.isActive, true),
        ),
      )
      .limit(1),
    db
      .select({ id: legalArticles.id, legalActId: legalVersions.legalActId })
      .from(legalArticles)
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(
        and(
          eq(legalArticles.id, parsed.data.legalArticleId),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalArticles.sourceRights, "official_text"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
        ),
      )
      .limit(1),
  ]);
  const source = sourceRows[0];
  const article = articleRows[0];
  if (!source || source.status !== "approved") {
    return errorState("A fonte do edital precisa estar aprovada antes da importação.");
  }
  if (!topicRows[0]) return errorState("O assunto não pertence à matéria selecionada.");
  if (!article) return errorState("O dispositivo legal precisa estar vigente e revisado.");

  try {
    const inserted = await db.transaction(async (transaction) => {
      const rows = await transaction
        .insert(opportunityRequirements)
        .values(
          syllabus.items.map((requirementText, index) => ({
            opportunityId: source.opportunityId,
            sourceDocumentId: source.id,
            subjectId: parsed.data.subjectId,
            topicId: parsed.data.topicId,
            legalActId: article.legalActId,
            legalArticleId: article.id,
            requirementText,
            sourceLocator: `${parsed.data.sourceLocator} · item ${index + 1}`,
            createdByUserId: user.id,
          })),
        )
        .onConflictDoNothing({
          target: [opportunityRequirements.sourceDocumentId, opportunityRequirements.requirementText],
        })
        .returning({ id: opportunityRequirements.id });

      if (rows.length) {
        await transaction
          .update(opportunityRequirements)
          .set({ editorialStatus: "pending_review", updatedAt: new Date() })
          .where(inArray(opportunityRequirements.id, rows.map((row) => row.id)));
      }
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "editorial.notice_requirements.imported",
        entityType: "opportunity_source_document",
        entityId: parsed.data.sourceDocumentPublicId,
        metadata: {
          identified: syllabus.items.length,
          inserted: rows.length,
          ignoredShortItems: syllabus.ignored.length,
          legalArticleId: article.id,
        },
      });
      return rows;
    });
    refreshNoticeEngine();
    return {
      status: "success",
      message: `${inserted.length} item(ns) novo(s) importado(s) para revisão; ${syllabus.items.length - inserted.length} duplicado(s) ignorado(s).`,
    };
  } catch (error) {
    console.error("Falha ao importar requisitos do edital.", error);
    return errorState("Não foi possível importar os itens do conteúdo programático.");
  }
}

const mapRequirementSchema = z.object({
  requirementId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  topicId: z.coerce.number().int().positive(),
  legalArticleId: z.coerce.number().int().positive(),
});

export async function mapExtractedRequirementAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = mapRequirementSchema.safeParse({
    requirementId: formData.get("requirementId"),
    subjectId: formData.get("subjectId"),
    topicId: formData.get("topicId"),
    legalArticleId: formData.get("legalArticleId"),
  });
  if (!parsed.success) return errorState("Selecione matéria, assunto e dispositivo legal.");

  const db = getDb();
  const [requirementRows, topicRows, articleRows] = await Promise.all([
    db
      .select({
        id: opportunityRequirements.id,
        status: opportunityRequirements.editorialStatus,
        sourceSnapshotId: opportunityRequirements.sourceSnapshotId,
      })
      .from(opportunityRequirements)
      .where(eq(opportunityRequirements.id, parsed.data.requirementId))
      .limit(1),
    db
      .select({ id: quizTopics.id })
      .from(quizTopics)
      .innerJoin(quizSubjects, eq(quizTopics.subjectId, quizSubjects.id))
      .where(
        and(
          eq(quizTopics.id, parsed.data.topicId),
          eq(quizTopics.subjectId, parsed.data.subjectId),
          eq(quizTopics.isActive, true),
          eq(quizSubjects.isActive, true),
        ),
      )
      .limit(1),
    db
      .select({ id: legalArticles.id, legalActId: legalVersions.legalActId })
      .from(legalArticles)
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(
        and(
          eq(legalArticles.id, parsed.data.legalArticleId),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalArticles.sourceRights, "official_text"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
        ),
      )
      .limit(1),
  ]);
  const requirement = requirementRows[0];
  const article = articleRows[0];
  if (!requirement || requirement.status !== "draft" || !requirement.sourceSnapshotId) {
    return errorState("Este item não está mais aguardando mapeamento automático.");
  }
  if (!topicRows[0]) return errorState("O assunto não pertence à matéria selecionada.");
  if (!article) return errorState("O dispositivo legal precisa estar vigente e revisado.");

  const now = new Date();
  const [updated] = await db
    .update(opportunityRequirements)
    .set({
      subjectId: parsed.data.subjectId,
      topicId: parsed.data.topicId,
      legalActId: article.legalActId,
      legalArticleId: article.id,
      editorialStatus: "pending_review",
      createdByUserId: user.id,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNotes: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(opportunityRequirements.id, requirement.id),
        eq(opportunityRequirements.editorialStatus, "draft"),
      ),
    )
    .returning({ id: opportunityRequirements.id });
  if (!updated) return errorState("O item já foi mapeado por outro editor.");

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: "editorial.notice_requirement.mapped",
    entityType: "opportunity_requirement",
    entityId: String(requirement.id),
    metadata: {
      subjectId: parsed.data.subjectId,
      topicId: parsed.data.topicId,
      legalArticleId: parsed.data.legalArticleId,
    },
  });
  refreshNoticeEngine();
  return { status: "success", message: "Item mapeado e enviado para revisão independente." };
}

const requirementReviewSchema = z.object({
  requirementId: z.coerce.number().int().positive(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(1_500),
});

export async function reviewRequirementAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = requirementReviewSchema.safeParse({
    requirementId: formData.get("requirementId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return errorState("Revise os dados da decisão.");
  if (parsed.data.decision === "reject" && parsed.data.notes.length < 10) {
    return errorState("Explique a rejeição em pelo menos 10 caracteres.");
  }

  const db = getDb();
  const [requirement] = await db
    .select({
      id: opportunityRequirements.id,
      status: opportunityRequirements.editorialStatus,
      createdByUserId: opportunityRequirements.createdByUserId,
      sourceSnapshotId: opportunityRequirements.sourceSnapshotId,
      subjectId: opportunityRequirements.subjectId,
      topicId: opportunityRequirements.topicId,
      legalArticleId: opportunityRequirements.legalArticleId,
      sourceStatus: opportunitySourceDocuments.status,
    })
    .from(opportunityRequirements)
    .innerJoin(
      opportunitySourceDocuments,
      eq(opportunityRequirements.sourceDocumentId, opportunitySourceDocuments.id),
    )
    .where(eq(opportunityRequirements.id, parsed.data.requirementId))
    .limit(1);
  if (!requirement || requirement.status !== "pending_review") {
    return errorState("O requisito não está mais pendente.");
  }
  if (requirement.createdByUserId === user.id) {
    return errorState("Quem importou o requisito não pode aprovar o próprio item.");
  }
  if (parsed.data.decision === "approve" && requirement.sourceStatus !== "approved") {
    return errorState("A fonte oficial precisa continuar aprovada.");
  }
  if (
    parsed.data.decision === "approve" &&
    (!requirement.subjectId || !requirement.topicId || !requirement.legalArticleId)
  ) {
    return errorState("Mapeie matéria, assunto e dispositivo legal antes de aprovar.");
  }
  if (parsed.data.decision === "approve" && requirement.sourceSnapshotId) {
    const [snapshot] = await db
      .select({ status: opportunityDocumentSnapshots.status })
      .from(opportunityDocumentSnapshots)
      .where(eq(opportunityDocumentSnapshots.id, requirement.sourceSnapshotId))
      .limit(1);
    if (!snapshot || snapshot.status !== "approved") {
      return errorState("A versão capturada do PDF precisa continuar aprovada.");
    }
  }

  const approved = parsed.data.decision === "approve";
  const now = new Date();
  const updated = await db
    .update(opportunityRequirements)
    .set({
      editorialStatus: approved ? "reviewed" : "suspended",
      reviewedByUserId: user.id,
      reviewedAt: now,
      reviewNotes: parsed.data.notes || null,
      updatedAt: now,
    })
    .where(
      and(
        eq(opportunityRequirements.id, requirement.id),
        eq(opportunityRequirements.editorialStatus, "pending_review"),
      ),
    )
    .returning({ id: opportunityRequirements.id });
  if (!updated[0]) return errorState("O requisito já foi decidido por outro editor.");

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: approved
      ? "editorial.notice_requirement.approved"
      : "editorial.notice_requirement.rejected",
    entityType: "opportunity_requirement",
    entityId: String(requirement.id),
    metadata: { notes: parsed.data.notes || null },
  });
  refreshNoticeEngine();
  return {
    status: "success",
    message: approved ? "Requisito aprovado para geração." : "Requisito suspenso.",
  };
}

const generateSchema = z.object({ requirementId: z.coerce.number().int().positive() });

export async function generateRequirementDraftAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = generateSchema.safeParse({ requirementId: formData.get("requirementId") });
  if (!parsed.success) return errorState("Requisito inválido.");

  const db = getDb();
  const [requirementRows, assignmentRows, existingQuestions] = await Promise.all([
    db
      .select({
        id: opportunityRequirements.id,
        status: opportunityRequirements.editorialStatus,
        requirementText: opportunityRequirements.requirementText,
        sourceLocator: opportunityRequirements.sourceLocator,
        opportunityId: opportunityRequirements.opportunityId,
        opportunityPublicId: contestOpportunities.publicId,
        opportunityStatus: contestOpportunities.editorialStatus,
        sourceStatus: opportunitySourceDocuments.status,
        subjectId: opportunityRequirements.subjectId,
        topicId: opportunityRequirements.topicId,
        topicName: quizTopics.name,
        legalArticleId: opportunityRequirements.legalArticleId,
        articleRef: legalArticles.articleRef,
        literalText: legalArticles.literalText,
        articleStatus: legalArticles.editorialStatus,
        articleRights: legalArticles.sourceRights,
        actTitle: legalActs.shortTitle,
        actIsActive: legalActs.isActive,
        versionStatus: legalVersions.status,
        sourceUrl: legalVersions.sourceUrl,
        verifiedAt: legalVersions.verifiedAt,
      })
      .from(opportunityRequirements)
      .innerJoin(contestOpportunities, eq(opportunityRequirements.opportunityId, contestOpportunities.id))
      .innerJoin(
        opportunitySourceDocuments,
        eq(opportunityRequirements.sourceDocumentId, opportunitySourceDocuments.id),
      )
      .innerJoin(quizSubjects, eq(opportunityRequirements.subjectId, quizSubjects.id))
      .innerJoin(quizTopics, eq(opportunityRequirements.topicId, quizTopics.id))
      .innerJoin(legalArticles, eq(opportunityRequirements.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(eq(opportunityRequirements.id, parsed.data.requirementId))
      .limit(1),
    db
      .select({
        opportunityId: opportunityOrganizerAssignments.opportunityId,
        role: opportunityOrganizerAssignments.role,
        bankId: quizBanks.id,
        bankSlug: quizBanks.slug,
        format: questionStyleProfiles.format,
      })
      .from(opportunityOrganizerAssignments)
      .innerJoin(quizBanks, eq(opportunityOrganizerAssignments.quizBankId, quizBanks.id))
      .innerJoin(
        questionStyleProfiles,
        eq(opportunityOrganizerAssignments.quizBankId, questionStyleProfiles.quizBankId),
      )
      .where(
        and(
          eq(opportunityOrganizerAssignments.status, "reviewed"),
          isNull(opportunityOrganizerAssignments.validUntil),
          eq(quizBanks.isActive, true),
          eq(questionStyleProfiles.isActive, true),
        ),
      ),
    db
      .select({ publicId: questions.publicId, prompt: questions.prompt })
      .from(questions)
      .where(eq(questions.sourceRights, "original_authorial")),
  ]);

  const requirement = requirementRows[0];
  if (!requirement || requirement.status !== "reviewed") {
    return errorState("O requisito precisa estar revisado antes da geração.");
  }
  if (requirement.sourceStatus !== "approved" || requirement.opportunityStatus !== "reviewed") {
    return errorState("O concurso e sua fonte oficial precisam estar aprovados.");
  }
  if (
    !requirement.subjectId ||
    !requirement.topicId ||
    !requirement.legalArticleId ||
    requirement.articleStatus !== "reviewed" ||
    requirement.articleRights !== "official_text" ||
    requirement.versionStatus !== "current" ||
    !requirement.actIsActive
  ) {
    return errorState("O requisito perdeu o vínculo com uma norma oficial vigente e revisada.");
  }

  const candidates = assignmentRows.filter(
    (assignment) => assignment.opportunityId === requirement.opportunityId,
  );
  const assignment =
    candidates.find((candidate) => candidate.role === "examination_provider") ?? candidates[0];
  if (!assignment) {
    return errorState("Vincule e revise a banca organizadora antes de gerar a questão.");
  }
  if (assignment.format !== "multiple_choice" && assignment.format !== "true_false") {
    return errorState("O perfil editorial da banca possui um formato incompatível.");
  }

  let generated: ReturnType<typeof buildNoticeQuestionDraft>;
  try {
    generated = buildNoticeQuestionDraft({
      bankSlug: assignment.bankSlug,
      format: assignment.format,
      requirementText: requirement.requirementText,
      sourceLocator: requirement.sourceLocator,
      topicName: requirement.topicName,
      actTitle: requirement.actTitle,
      articleRef: requirement.articleRef,
      literalText: requirement.literalText,
    });
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "A geração segura falhou.");
  }

  const similarity = findMostSimilarQuestion(generated.prompt, existingQuestions);
  if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
    return errorState(
      `O enunciado ficou muito próximo de outro item interno (${Math.round(similarity.scoreBps / 100)}%).`,
    );
  }

  const publicId = deterministicNoticeQuestionUuid(
    [
      NOTICE_QUESTION_GENERATOR_VERSION,
      requirement.id,
      requirement.requirementText,
      requirement.literalText,
      assignment.bankId,
    ].join("|"),
  );
  const now = new Date();
  try {
    const created = await db.transaction(async (transaction) => {
      const [question] = await transaction
        .insert(questions)
        .values({
          publicId,
          legalArticleId: requirement.legalArticleId,
          subjectId: requirement.subjectId,
          topicId: requirement.topicId,
          quizMode: "original_style",
          styleBankId: assignment.bankId,
          type: generated.type,
          prompt: generated.prompt,
          explanation: generated.explanation,
          learningObjective: generated.learningObjective,
          topic: requirement.topicName,
          difficulty: generated.difficulty,
          mutationKind: generated.mutationKind,
          examBoardStyle: assignment.bankSlug,
          editorialStatus: "draft",
          sourceRights: "original_authorial",
          sourceTitle: `${requirement.actTitle} — ${requirement.articleRef}`,
          sourceUrl: requirement.sourceUrl,
          authorshipMethod: "rule_based",
          generatorModel: "leiprova-rule-engine",
          promptVersion: NOTICE_QUESTION_GENERATOR_VERSION,
          createdByUserId: null,
          cleanRoomAttestedAt: null,
          submittedAt: null,
          similarityMaxBps: similarity.scoreBps,
          similarityReferencePublicId: similarity.referencePublicId,
          originalityCheckedAt: now,
          verifiedAt: requirement.verifiedAt,
        })
        .onConflictDoNothing({ target: questions.publicId })
        .returning({ id: questions.id });
      if (!question) return false;

      await transaction.insert(questionOptions).values(
        generated.options.map((option, sortOrder) => ({
          questionId: question.id,
          optionKey: option.key,
          text: option.text,
          isCorrect: option.isCorrect,
          mutationKind: option.mutationKind,
          rationale: option.rationale,
          sortOrder,
        })),
      );
      await transaction.insert(questionOpportunities).values({
        questionId: question.id,
        opportunityId: requirement.opportunityId,
        relationship: "direct_requirement",
      });
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "editorial.notice_question.generated",
        entityType: "question",
        entityId: publicId,
        metadata: {
          requirementId: requirement.id,
          opportunityPublicId: requirement.opportunityPublicId,
          generator: NOTICE_QUESTION_GENERATOR_VERSION,
          bankSlug: assignment.bankSlug,
          sourceUrl: requirement.sourceUrl,
          similarityMaxBps: similarity.scoreBps,
        },
      });
      return true;
    });

    refreshNoticeEngine();
    return {
      status: "success",
      message: created
        ? "Rascunho inédito gerado. Ele ainda precisa de autoria assumida e revisão humana na Fábrica Autoral."
        : "Este requisito já possui o mesmo rascunho gerado; nenhuma duplicação foi criada.",
    };
  } catch (error) {
    console.error("Falha ao gerar rascunho por requisito.", error);
    return errorState("Não foi possível registrar o rascunho.");
  }
}
