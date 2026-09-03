"use server";

import { randomUUID } from "node:crypto";

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  auditLogs,
  examEditions,
  examSourcePortals,
  legalActs,
  legalArticles,
  legalSourceSnapshots,
  legalTextSnapshots,
  legalVersions,
  quizBanks,
  quizCareerSpecializations,
  quizCareerTracks,
} from "@/lib/db/schema";
import { resolveExamMetadataSpecialization } from "@/lib/official-sources/exam-metadata-selection";
import {
  fetchOfficialConsolidatedLegalText,
  fetchOfficialLegalDocument,
  verifyOfficialExamUrl,
} from "@/lib/official-sources/fetch";
import { getOfficialLegalSource } from "@/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "@/lib/official-sources/legal-text";

export type SourceActionState = { status: "idle" | "success" | "error"; message: string };

function errorState(message: string): SourceActionState {
  return { status: "error", message };
}

function safeLogDetail(error: unknown) {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  if (!cause || typeof cause !== "object") return "falha sem código";
  const record = cause as { code?: unknown; name?: unknown };
  return `${typeof record.name === "string" ? record.name : "Error"}${typeof record.code === "string" ? ` (${record.code})` : ""}`;
}

function publicActionError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (
    !message ||
    message.length > 500 ||
    /(?:^Failed query:|\bparams:|permission denied|\bSQLSTATE\b|\bconstraint\b|\brelation\b|\bcolumn\b)/i.test(
      message,
    )
  ) {
    return fallback;
  }
  return message;
}

const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export async function syncLegalSourceAction(
  _state: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  const user = await requireAdmin();
  const parsed = slugSchema.safeParse(formData.get("slug"));
  if (!parsed.success) return errorState("Fonte jurídica inválida.");

  const registered = getOfficialLegalSource(parsed.data);
  if (!registered) return errorState("A lei não pertence ao registro oficial permitido.");

  const db = getDb();
  const [act] = await db
    .select({ id: legalActs.id, officialUrl: legalActs.officialUrl })
    .from(legalActs)
    .where(and(eq(legalActs.slug, registered.slug), eq(legalActs.isActive, true)))
    .limit(1);
  if (!act || act.officialUrl !== registered.officialUrl) return errorState("O registro da fonte diverge da configuração oficial.");

  try {
    const snapshot = await fetchOfficialLegalDocument(registered.monitorUrl);
    const [saved] = await db
      .insert(legalSourceSnapshots)
      .values({
        publicId: randomUUID(),
        legalActId: act.id,
        ...snapshot,
        status: "pending_review",
        initiatedByUserId: user.id,
        lastSeenAt: snapshot.fetchedAt,
      })
      .onConflictDoUpdate({
        target: [legalSourceSnapshots.legalActId, legalSourceSnapshots.checksumSha256],
        set: { lastSeenAt: snapshot.fetchedAt, httpStatus: snapshot.httpStatus },
      })
      .returning({ publicId: legalSourceSnapshots.publicId, status: legalSourceSnapshots.status });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: "editorial.legal_source.checked",
      entityType: "legal_source_snapshot",
      entityId: saved.publicId,
      metadata: { legalActSlug: registered.slug, checksum: snapshot.checksumSha256, status: saved.status },
    });

    revalidatePath("/admin/fontes-oficiais");
    return {
      status: "success",
      message: saved.status === "pending_review" ? "Nova fotografia registrada para revisão independente." : "Fonte conferida; o conteúdo oficial permanece igual à fotografia já registrada.",
    };
  } catch (error) {
    console.error("Falha ao sincronizar fonte jurídica.", safeLogDetail(error));
    return errorState(publicActionError(error, "Não foi possível consultar a fonte oficial."));
  }
}

const reviewSnapshotSchema = z.object({
  publicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(1500),
});

export async function reviewLegalSnapshotAction(
  _state: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  const user = await requireAdmin();
  const parsed = reviewSnapshotSchema.safeParse({
    publicId: formData.get("publicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return errorState("Revise os dados da decisão.");
  if (parsed.data.decision === "reject" && parsed.data.notes.length < 10) {
    return errorState("Explique a rejeição em pelo menos 10 caracteres.");
  }

  const db = getDb();
  const [snapshot] = await db
    .select({ id: legalSourceSnapshots.id, legalActId: legalSourceSnapshots.legalActId, status: legalSourceSnapshots.status, initiatorId: legalSourceSnapshots.initiatedByUserId })
    .from(legalSourceSnapshots)
    .where(eq(legalSourceSnapshots.publicId, parsed.data.publicId))
    .limit(1);
  if (!snapshot || snapshot.status !== "pending_review") return errorState("A fotografia não está mais pendente.");
  if (snapshot.initiatorId === user.id) return errorState("Quem iniciou a conferência não pode aprovar ou rejeitar a própria fotografia.");

  const approved = parsed.data.decision === "approve";
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      if (approved) {
        await transaction
          .update(legalSourceSnapshots)
          .set({ status: "superseded" })
          .where(and(eq(legalSourceSnapshots.legalActId, snapshot.legalActId), eq(legalSourceSnapshots.status, "approved"), ne(legalSourceSnapshots.id, snapshot.id)));
      }

      const updated = await transaction
        .update(legalSourceSnapshots)
        .set({
          status: approved ? "approved" : "rejected",
          reviewedByUserId: user.id,
          reviewNotes: parsed.data.notes || null,
          reviewedAt: now,
        })
        .where(and(eq(legalSourceSnapshots.id, snapshot.id), eq(legalSourceSnapshots.status, "pending_review")))
        .returning({ id: legalSourceSnapshots.id });
      if (!updated[0]) throw new Error("A fotografia já foi decidida por outro editor.");

      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: approved ? "editorial.legal_source.approved" : "editorial.legal_source.rejected",
        entityType: "legal_source_snapshot",
        entityId: parsed.data.publicId,
        metadata: { notes: parsed.data.notes || null },
      });
    });
  } catch (error) {
    return errorState(publicActionError(error, "Não foi possível registrar a decisão."));
  }

  revalidatePath("/admin/fontes-oficiais");
  return { status: "success", message: approved ? "Fotografia aprovada como referência de conferência." : "Fotografia rejeitada e mantida apenas no histórico." };
}

export async function captureLegalTextAction(
  _state: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  const user = await requireAdmin();
  const parsed = slugSchema.safeParse(formData.get("slug"));
  if (!parsed.success) return errorState("Fonte jurídica inválida.");

  const registered = getOfficialLegalSource(parsed.data);
  if (!registered) return errorState("A lei não pertence ao registro oficial permitido.");

  const db = getDb();
  const [act] = await db
    .select({ id: legalActs.id, officialUrl: legalActs.officialUrl })
    .from(legalActs)
    .where(and(eq(legalActs.slug, registered.slug), eq(legalActs.isActive, true)))
    .limit(1);
  if (!act || act.officialUrl !== registered.officialUrl) {
    return errorState("O registro da lei diverge da configuração oficial.");
  }

  const [monitorSnapshot] = await db
    .select({ id: legalSourceSnapshots.id })
    .from(legalSourceSnapshots)
    .where(
      and(
        eq(legalSourceSnapshots.legalActId, act.id),
        eq(legalSourceSnapshots.status, "approved"),
      ),
    )
    .orderBy(desc(legalSourceSnapshots.reviewedAt), desc(legalSourceSnapshots.fetchedAt))
    .limit(1);
  if (!monitorSnapshot) {
    return errorState("A fotografia de monitoramento precisa ser revisada antes da captura integral.");
  }

  try {
    const captured = await fetchOfficialConsolidatedLegalText(registered.monitorUrl);
    const [saved] = await db
      .insert(legalTextSnapshots)
      .values({
        publicId: randomUUID(),
        legalActId: act.id,
        monitorSnapshotId: monitorSnapshot.id,
        ...captured,
        status: "pending_review",
        initiatedByUserId: user.id,
        lastSeenAt: captured.fetchedAt,
      })
      .onConflictDoUpdate({
        target: [legalTextSnapshots.legalActId, legalTextSnapshots.checksumSha256],
        set: { lastSeenAt: captured.fetchedAt },
      })
      .returning({ publicId: legalTextSnapshots.publicId, status: legalTextSnapshots.status });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: "editorial.legal_text.captured",
      entityType: "legal_text_snapshot",
      entityId: saved.publicId,
      metadata: {
        legalActSlug: registered.slug,
        sourceUrl: captured.sourceUrl,
        checksum: captured.checksumSha256,
        articleCount: captured.articleCount,
        parserVersion: captured.parserVersion,
        status: saved.status,
      },
    });
    revalidatePath("/admin/fontes-oficiais");
    revalidatePath("/admin/motor-editais");
    return {
      status: "success",
      message:
        saved.status === "pending_review"
          ? `${captured.articleCount} artigo(s) capturado(s) e preservado(s) para revisão independente.`
          : "Texto conferido; a compilação oficial permanece igual à versão já registrada.",
    };
  } catch (error) {
    console.error("Falha ao capturar texto jurídico consolidado.", safeLogDetail(error));
    return errorState(publicActionError(error, "Não foi possível capturar a compilação oficial."));
  }
}

const reviewLegalTextSchema = z.object({
  publicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().min(10).max(1500),
});

export async function reviewLegalTextAction(
  _state: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  const user = await requireAdmin();
  const parsed = reviewLegalTextSchema.safeParse({
    publicId: formData.get("publicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return errorState("Registre uma nota de revisão com pelo menos 10 caracteres.");
  }

  const db = getDb();
  const [snapshot] = await db
    .select({
      id: legalTextSnapshots.id,
      legalActId: legalTextSnapshots.legalActId,
      monitorSnapshotId: legalTextSnapshots.monitorSnapshotId,
      sourceUrl: legalTextSnapshots.sourceUrl,
      checksumSha256: legalTextSnapshots.checksumSha256,
      normalizedContent: legalTextSnapshots.normalizedContent,
      articleCount: legalTextSnapshots.articleCount,
      fetchedAt: legalTextSnapshots.fetchedAt,
      status: legalTextSnapshots.status,
      initiatorId: legalTextSnapshots.initiatedByUserId,
    })
    .from(legalTextSnapshots)
    .where(eq(legalTextSnapshots.publicId, parsed.data.publicId))
    .limit(1);
  if (!snapshot || snapshot.status !== "pending_review") {
    return errorState("A compilação não está mais pendente.");
  }
  if (snapshot.initiatorId === user.id) {
    return errorState("Quem capturou o texto não pode aprovar ou rejeitar a própria compilação.");
  }

  const approved = parsed.data.decision === "approve";
  let articles: ReturnType<typeof parseConsolidatedLegalArticles> = [];
  if (approved) {
    try {
      articles = parseConsolidatedLegalArticles(snapshot.normalizedContent);
    } catch (error) {
      return errorState(publicActionError(error, "Não foi possível validar os artigos capturados."));
    }
    if (articles.length !== snapshot.articleCount) {
      return errorState("A contagem de artigos divergiu da captura original.");
    }
  }

  const now = new Date();
  try {
    await db.transaction(async (transaction) => {
      if (approved) {
        const [monitor] = await transaction
          .select({ status: legalSourceSnapshots.status })
          .from(legalSourceSnapshots)
          .where(eq(legalSourceSnapshots.id, snapshot.monitorSnapshotId))
          .limit(1);
        if (!monitor || monitor.status !== "approved") {
          throw new Error("A fotografia de monitoramento deixou de estar aprovada.");
        }

        await transaction
          .update(legalTextSnapshots)
          .set({ status: "superseded", updatedAt: now })
          .where(
            and(
              eq(legalTextSnapshots.legalActId, snapshot.legalActId),
              eq(legalTextSnapshots.status, "approved"),
              ne(legalTextSnapshots.id, snapshot.id),
            ),
          );
        await transaction
          .update(legalVersions)
          .set({ status: "superseded" })
          .where(
            and(
              eq(legalVersions.legalActId, snapshot.legalActId),
              eq(legalVersions.status, "current"),
            ),
          );

        const [version] = await transaction
          .insert(legalVersions)
          .values({
            legalActId: snapshot.legalActId,
            sourceUrl: snapshot.sourceUrl,
            checksumSha256: snapshot.checksumSha256,
            verifiedAt: snapshot.fetchedAt,
            status: "current",
          })
          .onConflictDoUpdate({
            target: [legalVersions.legalActId, legalVersions.checksumSha256],
            set: {
              sourceUrl: snapshot.sourceUrl,
              verifiedAt: snapshot.fetchedAt,
              status: "current",
            },
          })
          .returning({ id: legalVersions.id });

        for (let offset = 0; offset < articles.length; offset += 250) {
          await transaction
            .insert(legalArticles)
            .values(
              articles.slice(offset, offset + 250).map((article) => ({
                legalVersionId: version.id,
                articleRef: article.articleRef,
                articleOrder: article.articleOrder,
                heading: article.heading,
                path: article.path,
                literalText: article.literalText,
                editorialStatus: "reviewed" as const,
                sourceRights: "official_text" as const,
              })),
            )
            .onConflictDoUpdate({
              target: [legalArticles.legalVersionId, legalArticles.path],
              set: {
                articleRef: sql`excluded.article_ref`,
                articleOrder: sql`excluded.article_order`,
                heading: sql`excluded.heading`,
                literalText: sql`excluded.literal_text`,
                editorialStatus: "reviewed",
                sourceRights: "official_text",
                updatedAt: now,
              },
            });
        }
      }

      const updated = await transaction
        .update(legalTextSnapshots)
        .set({
          status: approved ? "approved" : "rejected",
          reviewedByUserId: user.id,
          reviewedAt: now,
          reviewNotes: parsed.data.notes,
          updatedAt: now,
        })
        .where(
          and(
            eq(legalTextSnapshots.id, snapshot.id),
            eq(legalTextSnapshots.status, "pending_review"),
          ),
        )
        .returning({ id: legalTextSnapshots.id });
      if (!updated[0]) throw new Error("A compilação já foi decidida por outro editor.");

      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: approved ? "editorial.legal_text.approved" : "editorial.legal_text.rejected",
        entityType: "legal_text_snapshot",
        entityId: parsed.data.publicId,
        metadata: {
          notes: parsed.data.notes,
          articleCount: snapshot.articleCount,
          checksum: snapshot.checksumSha256,
        },
      });
    });
  } catch (error) {
    return errorState(publicActionError(error, "Não foi possível registrar a decisão."));
  }

  revalidatePath("/admin/fontes-oficiais");
  revalidatePath("/admin/motor-editais");
  return {
    status: "success",
    message: approved
      ? `${articles.length} artigo(s) ativado(s) a partir da compilação revisada.`
      : "Compilação rejeitada e preservada no histórico.",
  };
}

export async function verifyExamPortalAction(
  _state: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  const user = await requireAdmin();
  const parsed = z.coerce.number().int().positive().safeParse(formData.get("portalId"));
  if (!parsed.success) return errorState("Portal inválido.");

  const db = getDb();
  const [portal] = await db
    .select({ id: examSourcePortals.id, officialUrl: examSourcePortals.officialUrl, bankSlug: quizBanks.slug })
    .from(examSourcePortals)
    .innerJoin(quizBanks, eq(examSourcePortals.quizBankId, quizBanks.id))
    .where(eq(examSourcePortals.id, parsed.data))
    .limit(1);
  if (!portal) return errorState("Portal não encontrado.");

  try {
    const checked = await verifyOfficialExamUrl(portal.bankSlug, portal.officialUrl);
    await db.update(examSourcePortals).set({
      lastHttpStatus: checked.httpStatus,
      lastPageTitle: checked.pageTitle,
      lastFinalUrl: checked.finalUrl,
      lastError: null,
      lastCheckedAt: checked.checkedAt,
      updatedAt: checked.checkedAt,
    }).where(eq(examSourcePortals.id, portal.id));
    await db.insert(auditLogs).values({ actorUserId: user.id, action: "editorial.exam_portal.checked", entityType: "exam_source_portal", entityId: String(portal.id), metadata: { httpStatus: checked.httpStatus } });
    revalidatePath("/admin/fontes-oficiais");
    return { status: "success", message: `Portal oficial respondeu com HTTP ${checked.httpStatus}. Nenhum conteúdo de questão foi armazenado.` };
  } catch (error) {
    const message = publicActionError(error, "Não foi possível verificar o portal.");
    await db.update(examSourcePortals).set({ lastError: message, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(examSourcePortals.id, portal.id));
    revalidatePath("/admin/fontes-oficiais");
    return errorState(message);
  }
}

const examMetadataSchema = z.object({
  bankId: z.coerce.number().int().positive(),
  careerTrackId: z.coerce.number().int().positive(),
  specializationId: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  title: z.string().trim().min(5).max(220),
  examDate: z.iso.date(),
  jurisdiction: z.string().trim().max(120),
  officialUrl: z.url().max(1000),
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55);
}

export async function createExamMetadataAction(
  _state: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  const user = await requireAdmin();
  const parsed = examMetadataSchema.safeParse({
    bankId: formData.get("bankId"), careerTrackId: formData.get("careerTrackId"), title: formData.get("title"),
    specializationId: formData.get("specializationId"), examDate: formData.get("examDate"),
    jurisdiction: formData.get("jurisdiction"), officialUrl: formData.get("officialUrl"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Revise os metadados da prova.");

  const db = getDb();
  const [bank, career, activeSpecializations] = await Promise.all([
    db.select({ id: quizBanks.id, slug: quizBanks.slug }).from(quizBanks).where(and(eq(quizBanks.id, parsed.data.bankId), eq(quizBanks.isActive, true))).limit(1),
    db.select({ id: quizCareerTracks.id }).from(quizCareerTracks).where(and(eq(quizCareerTracks.id, parsed.data.careerTrackId), eq(quizCareerTracks.isActive, true))).limit(1),
    db
      .select({ id: quizCareerSpecializations.id })
      .from(quizCareerSpecializations)
      .where(
        and(
          eq(quizCareerSpecializations.careerTrackId, parsed.data.careerTrackId),
          eq(quizCareerSpecializations.isActive, true),
        ),
      ),
  ]);
  if (!bank[0] || !career[0]) return errorState("Banca ou carreira indisponível.");
  const specialization = resolveExamMetadataSpecialization(
    activeSpecializations,
    parsed.data.specializationId,
  );
  if (!specialization.success) return errorState(specialization.message);

  try {
    const checked = await verifyOfficialExamUrl(bank[0].slug, parsed.data.officialUrl);
    const publicId = `${bank[0].slug}-${parsed.data.examDate}-${slugify(parsed.data.title)}-${randomUUID().slice(0, 8)}`;
    await db.transaction(async (transaction) => {
      await transaction.insert(examEditions).values({
        publicId,
        bankId: bank[0].id,
        careerTrackId: career[0].id,
        specializationId: specialization.specializationId,
        title: parsed.data.title,
        examDate: parsed.data.examDate,
        jurisdiction: parsed.data.jurisdiction || null,
        officialUrl: checked.finalUrl,
        sourcePolicy: "metadata_only",
        sourceContentStored: false,
        sourcePageTitle: checked.pageTitle,
        sourceHttpStatus: checked.httpStatus,
        sourceCheckedAt: checked.checkedAt,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      });
      await transaction.insert(auditLogs).values({ actorUserId: user.id, action: "editorial.exam_metadata.created", entityType: "exam_edition", entityId: publicId, metadata: { policy: "metadata_only", sourceContentStored: false, officialUrl: checked.finalUrl, specializationId: specialization.specializationId } });
    });
    revalidatePath("/admin/fontes-oficiais");
    return { status: "success", message: "Metadados registrados. Nenhum enunciado, alternativa ou gabarito foi copiado." };
  } catch (error) {
    return errorState(publicActionError(error, "Não foi possível validar a página oficial da prova."));
  }
}
