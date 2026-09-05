"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
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
  quizBanks,
  examEditions,
  editorialAutomationJobs,
  quizSubjects,
  quizTopics,
} from "@/lib/db/schema";
import {
  generateNoticeQuestionDraftForRequirement,
  NoticeDraftGenerationError,
} from "@/lib/editorial/notice-draft-service";
import {
  canReviewEditorialSubmission,
  isEditorialOwnerApprover,
} from "@/lib/editorial/owner-approval";
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
  if (
    !canReviewEditorialSubmission({
      initiatorUserId: source.initiatedByUserId,
      reviewerUserId: user.id,
      reviewerEmail: user.email,
    })
  ) {
    return errorState("Somente a conta proprietária pode revisar a própria fonte.");
  }
  if (parsed.data.notes.length < 10) {
    return errorState("Registre uma nota de revisão com pelo menos 10 caracteres.");
  }
  const approved = parsed.data.decision === "approve";
  const approvalMode =
    source.initiatedByUserId === user.id ? "owner_self_review" : "independent_review";
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
        metadata: { notes: parsed.data.notes, approvalMode },
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

  let captured: Awaited<ReturnType<typeof captureOfficialPdf>>;
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
    captured = await captureOfficialPdf(candidate, official.sourceId);
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Não foi possível ler o PDF oficial.",
    );
  }

  try {
    const publicId = randomUUID();
    // Keep the target list aligned with the production role's column grant.
    // Drizzle's regular insert mentions every defaulted review column.
    const saved = await db.transaction(async (transaction) => {
      const savedRows = await transaction.execute<{ public_id: string }>(sql`
        insert into opportunity_document_snapshots (
          public_id,
          source_document_id,
          document_url,
          source_host,
          file_name,
          mime_type,
          document_bytes,
          checksum_sha256,
          byte_length,
          page_count,
          extracted_text,
          page_texts,
          text_length,
          parser_version,
          source_policy,
          authorization_scope,
          authorized_at,
          initiated_by_user_id
        ) values (
          ${publicId},
          ${source.id},
          ${captured.documentUrl},
          ${captured.sourceHost},
          ${captured.fileName},
          ${captured.mimeType},
          ${captured.documentBytes},
          ${captured.checksumSha256},
          ${captured.byteLength},
          ${captured.pageCount},
          ${captured.extractedText},
          ${JSON.stringify(captured.pageTexts)}::jsonb,
          ${captured.textLength},
          ${captured.parserVersion},
          'official_document',
          ${OFFICIAL_DOCUMENT_AUTHORIZATION_SCOPE},
          ${new Date("2026-09-01T12:00:00.000-03:00").toISOString()},
          ${user.id}
        )
        on conflict (source_document_id, checksum_sha256) do nothing
        returning public_id
      `);
      const row = savedRows[0];
      if (!row) return null;
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "editorial.notice_document.captured",
        entityType: "opportunity_document_snapshot",
        entityId: row.public_id,
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
      return row;
    });
    if (!saved) return errorState("Esta versão do PDF já está armazenada para a fonte.");
    refreshNoticeEngine();
    return {
      status: "success",
      message: `PDF oficial capturado (${captured.pageCount} páginas) e enviado para revisão independente.`,
    };
  } catch (error) {
    console.error(
      "Falha ao persistir captura oficial.",
      error instanceof Error ? error.name : "UnknownError",
    );
    return errorState("Não foi possível armazenar o PDF oficial. A equipe técnica foi informada.");
  }
}

const snapshotReviewSchema = z.object({
  snapshotPublicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2_000),
  ownerOverride: z.enum(["true"]).optional(),
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
    ownerOverride: formData.get("ownerOverride") || undefined,
  });
  if (!parsed.success) return errorState("Revise os dados da decisão do PDF.");
  const db = getDb();
  const [snapshot] = await db
    .select({
      id: opportunityDocumentSnapshots.id,
      status: opportunityDocumentSnapshots.status,
      initiatedByUserId: opportunityDocumentSnapshots.initiatedByUserId,
      authorizationScope: opportunityDocumentSnapshots.authorizationScope,
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
  const approved = parsed.data.decision === "approve";
  const isInitiator = snapshot.initiatedByUserId === user.id;
  const ownerOverride = approved && isInitiator && parsed.data.ownerOverride === "true";
  if (approved && isInitiator && !ownerOverride) {
    return errorState("Confirme que esta é uma aprovação explícita do proprietário.");
  }
  if (approved && parsed.data.ownerOverride === "true" && !isInitiator) {
    return errorState("A exceção do proprietário só pode ser registrada pelo autor da captura.");
  }
  if (ownerOverride && !isEditorialOwnerApprover(user.email)) {
    return errorState("Somente a conta do proprietário configurada pode registrar esta exceção.");
  }
  if (ownerOverride && snapshot.authorizationScope !== OFFICIAL_DOCUMENT_AUTHORIZATION_SCOPE) {
    return errorState("Esta captura não possui a autorização formal exigida para a exceção.");
  }
  if (parsed.data.decision === "approve" && snapshot.sourceStatus !== "approved") {
    return errorState("A fonte oficial vinculada precisa continuar aprovada.");
  }

  const approvalBasis = ownerOverride ? "owner_override" : "independent_review";
  const now = new Date();
  try {
    await db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(opportunityDocumentSnapshots)
        .set({
          status: approved ? "approved" : "rejected",
          approvalBasis,
          authorizedByUserId: ownerOverride ? user.id : undefined,
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
        metadata: {
          notes: parsed.data.notes || null,
          approvalBasis,
          authorizationScope: snapshot.authorizationScope,
        },
      });
    });
    refreshNoticeEngine();
    return {
      status: "success",
      message: approved
        ? ownerOverride
          ? "PDF oficial aprovado pelo proprietário. Requisitos e questões continuam em revisão separada."
          : "PDF oficial aprovado para extração do programa."
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
      // Keep the target list aligned with the production role's column grant.
      // Drizzle's regular insert mentions every defaulted review column.
      const values = candidates.map(
        (candidate) => sql`(
          ${snapshot.opportunityId},
          ${snapshot.sourceDocumentId},
          ${snapshot.id},
          ${candidate.suggestedSubjectId},
          ${candidate.requirementText},
          ${candidate.sourceLocator},
          ${user.id}
        )`,
      );
      const rows = await transaction.execute<{ id: string }>(sql`
        insert into opportunity_requirements (
          opportunity_id,
          source_document_id,
          source_snapshot_id,
          subject_id,
          requirement_text,
          source_locator,
          created_by_user_id
        ) values ${sql.join(values, sql`, `)}
        on conflict (source_document_id, requirement_text) do nothing
        returning id::text
      `);
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
    console.error(
      "Falha ao extrair conteúdo programático.",
      error instanceof Error ? error.name : "UnknownError",
    );
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
  if (
    !canReviewEditorialSubmission({
      initiatorUserId: requirement.createdByUserId,
      reviewerUserId: user.id,
      reviewerEmail: user.email,
    })
  ) {
    return errorState("Somente a conta proprietária pode revisar o próprio requisito.");
  }
  if (parsed.data.notes.length < 10) {
    return errorState("Registre uma nota de revisão com pelo menos 10 caracteres.");
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
  const approvalMode =
    requirement.createdByUserId === user.id ? "owner_self_review" : "independent_review";
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
    metadata: { notes: parsed.data.notes, approvalMode },
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

  try {
    // Botão e worker usam a mesma validação e a mesma identidade.
    const result = await generateNoticeQuestionDraftForRequirement(getDb(), parsed.data.requirementId, user.id);
    refreshNoticeEngine();
    return {
      status: "success",
      message: result.created
        ? "Rascunho gerado. Ele ainda precisa de autoria assumida e revisão humana na Fábrica Autoral."
        : "Este requisito já possui o mesmo rascunho; nenhuma duplicação foi criada.",
    };
  } catch (error) {
    return errorState(error instanceof NoticeDraftGenerationError
      ? error.message : "Não foi possível registrar o rascunho. Tente novamente.");
  }
}

const editionMappingSchema = z.object({
  opportunityPublicId: z.string().uuid(),
  examEditionId: z.coerce.number().int().positive(),
  notes: z.string().trim().min(20).max(1500),
  confirmed: z.literal("on"),
});

export async function mapOpportunityEditionAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const parsed = editionMappingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Escolha a edição, registre a evidência e confirme a conferência humana.");
  try {
    await getDb().transaction(async (transaction) => {
      const [opportunity] = await transaction.select().from(contestOpportunities)
        .where(eq(contestOpportunities.publicId, parsed.data.opportunityPublicId)).for("update");
      const [edition] = await transaction.select().from(examEditions)
        .where(eq(examEditions.id, parsed.data.examEditionId)).for("share");
      if (!opportunity || !edition ||
          opportunity.careerTrackId !== edition.careerTrackId ||
          opportunity.specializationId !== edition.specializationId ||
          ["draft", "canceled", "archived"].includes(edition.status) || !edition.officialUrl) {
        throw new Error("A edição precisa ter fonte oficial e corresponder à carreira e especialidade do concurso.");
      }
      if (opportunity.examEditionId && opportunity.examEditionId !== edition.id &&
          opportunity.editorialStatus === "reviewed") {
        throw new Error("Para trocar um vínculo já confirmado, retorne primeiro o concurso à revisão.");
      }
      const assignments = await transaction.select({ bankId: opportunityOrganizerAssignments.quizBankId })
        .from(opportunityOrganizerAssignments)
        .innerJoin(quizBanks, eq(opportunityOrganizerAssignments.quizBankId, quizBanks.id))
        .where(and(
          eq(opportunityOrganizerAssignments.opportunityId, opportunity.id),
          eq(opportunityOrganizerAssignments.status, "reviewed"),
          isNull(opportunityOrganizerAssignments.validUntil),
          eq(quizBanks.isActive, true),
          sql`${opportunityOrganizerAssignments.role} in ('primary_responsible', 'examination_provider')`,
        )).for("share", { of: opportunityOrganizerAssignments });
      if (!assignments.length || assignments.some((assignment) => assignment.bankId !== edition.bankId)) {
        throw new Error("A banca da edição precisa coincidir com a organizadora oficialmente revisada.");
      }
      await transaction.update(contestOpportunities)
        .set({ examEditionId: edition.id, updatedAt: new Date() })
        .where(eq(contestOpportunities.id, opportunity.id));
      await transaction.insert(auditLogs).values({
        actorUserId: user.id, action: "editorial.opportunity.edition_mapped",
        entityType: "contest_opportunity", entityId: opportunity.publicId,
        metadata: { examEditionPublicId: edition.publicId, notes: parsed.data.notes, humanConfirmed: true },
      });
    });
    refreshNoticeEngine();
    revalidatePath("/app/quiz");
    return { status: "success", message: "Edição vinculada explicitamente. Questões ainda dependem de revisão e fonte válida." };
  } catch (error) {
    // Mensagens de domínio são locais; mensagens do driver podem conter SQL/dados.
    return errorState(error instanceof Error && !("query" in error) && !("cause" in error)
      ? error.message : "O vínculo não pôde ser salvo. Verifique se a edição já está vinculada a outro concurso.");
  }
}

export async function retryEditorialJobAction(
  _state: NoticeEngineActionState,
  formData: FormData,
): Promise<NoticeEngineActionState> {
  const user = await requireAdmin("/admin/motor-editais");
  const jobKey = z.string().min(1).max(200).safeParse(formData.get("jobKey"));
  if (!jobKey.success) return errorState("Pendência inválida.");
  const updated = await getDb().transaction(async (transaction) => {
    const rows = await transaction.update(editorialAutomationJobs)
      .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastErrorCode: null, updatedAt: new Date() })
      .where(and(eq(editorialAutomationJobs.jobKey, jobKey.data),
        inArray(editorialAutomationJobs.status, ["blocked", "failed"])))
      .returning({ jobKey: editorialAutomationJobs.jobKey });
    if (rows.length) await transaction.insert(auditLogs).values({
      actorUserId: user.id, action: "automation.editorial.retry_requested",
      entityType: "editorial_automation_job", entityId: jobKey.data,
      metadata: { editorialChecksPreserved: true },
    });
    return rows.length;
  });
  refreshNoticeEngine();
  return updated
    ? { status: "success", message: "Reavaliação enfileirada para a próxima rodada. Nenhuma revisão foi dispensada." }
    : errorState("A pendência mudou ou já está em execução.");
}
