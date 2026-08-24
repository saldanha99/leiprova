"use server";

import { randomUUID } from "node:crypto";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  auditLogs,
  examEditions,
  examSourcePortals,
  legalActs,
  legalSourceSnapshots,
  quizBanks,
  quizCareerTracks,
} from "@/lib/db/schema";
import { verifyOfficialExamUrl, fetchOfficialLegalDocument } from "@/lib/official-sources/fetch";
import { getOfficialLegalSource } from "@/lib/official-sources/legal-registry";

export type SourceActionState = { status: "idle" | "success" | "error"; message: string };

function errorState(message: string): SourceActionState {
  return { status: "error", message };
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
    console.error("Falha ao sincronizar fonte jurídica.", error);
    return errorState(error instanceof Error ? error.message : "Não foi possível consultar a fonte oficial.");
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
    return errorState(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
  }

  revalidatePath("/admin/fontes-oficiais");
  return { status: "success", message: approved ? "Fotografia aprovada como referência de conferência." : "Fotografia rejeitada e mantida apenas no histórico." };
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
    const message = error instanceof Error ? error.message : "Não foi possível verificar o portal.";
    await db.update(examSourcePortals).set({ lastError: message, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(examSourcePortals.id, portal.id));
    revalidatePath("/admin/fontes-oficiais");
    return errorState(message);
  }
}

const examMetadataSchema = z.object({
  bankId: z.coerce.number().int().positive(),
  careerTrackId: z.coerce.number().int().positive(),
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
    examDate: formData.get("examDate"), jurisdiction: formData.get("jurisdiction"), officialUrl: formData.get("officialUrl"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Revise os metadados da prova.");

  const db = getDb();
  const [bank, career] = await Promise.all([
    db.select({ id: quizBanks.id, slug: quizBanks.slug }).from(quizBanks).where(and(eq(quizBanks.id, parsed.data.bankId), eq(quizBanks.isActive, true))).limit(1),
    db.select({ id: quizCareerTracks.id }).from(quizCareerTracks).where(and(eq(quizCareerTracks.id, parsed.data.careerTrackId), eq(quizCareerTracks.isActive, true))).limit(1),
  ]);
  if (!bank[0] || !career[0]) return errorState("Banca ou carreira indisponível.");

  try {
    const checked = await verifyOfficialExamUrl(bank[0].slug, parsed.data.officialUrl);
    const publicId = `${bank[0].slug}-${parsed.data.examDate}-${slugify(parsed.data.title)}-${randomUUID().slice(0, 8)}`;
    await db.transaction(async (transaction) => {
      await transaction.insert(examEditions).values({
        publicId,
        bankId: bank[0].id,
        careerTrackId: career[0].id,
        title: parsed.data.title,
        examDate: parsed.data.examDate,
        jurisdiction: parsed.data.jurisdiction || null,
        officialUrl: checked.finalUrl,
        status: "draft",
        sourcePolicy: "metadata_only",
        sourceContentStored: false,
        sourcePageTitle: checked.pageTitle,
        sourceHttpStatus: checked.httpStatus,
        sourceCheckedAt: checked.checkedAt,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      });
      await transaction.insert(auditLogs).values({ actorUserId: user.id, action: "editorial.exam_metadata.created", entityType: "exam_edition", entityId: publicId, metadata: { policy: "metadata_only", sourceContentStored: false, officialUrl: checked.finalUrl } });
    });
    revalidatePath("/admin/fontes-oficiais");
    return { status: "success", message: "Metadados registrados. Nenhum enunciado, alternativa ou gabarito foi copiado." };
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Não foi possível validar a página oficial da prova.");
  }
}
