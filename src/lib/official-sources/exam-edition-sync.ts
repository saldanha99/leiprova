import "server-only";

import { createHash } from "node:crypto";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import {
  auditLogs,
  examEditions,
  quizBanks,
  quizCareerSpecializations,
  quizCareerTracks,
} from "@/lib/db/schema";
import { parseOfficialExamUrl } from "@/lib/official-sources/exam-registry";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const sourceExternalIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

function normalizedTextSchema(minimum: number, maximum: number) {
  return z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(minimum).max(maximum));
}

function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1900 &&
    year <= 2100 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const discoveredExamEditionSchema = z
  .object({
    bankSlug: slugSchema,
    careerSlug: slugSchema,
    specializationSlug: slugSchema.optional(),
    sourceExternalId: sourceExternalIdSchema,
    title: normalizedTextSchema(3, 300),
    organizer: normalizedTextSchema(2, 200),
    jurisdiction: normalizedTextSchema(2, 160),
    officialUrl: z.string().trim().min(1).max(2_000),
    examDate: z.string().refine(isIsoCalendarDate, "A data da prova deve usar YYYY-MM-DD."),
    durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
    sourceObservedAt: z
      .iso.datetime({ offset: true })
      .refine(
        (value) => new Date(value).getTime() <= Date.now() + 5 * 60 * 1_000,
        "A observação da fonte não pode estar no futuro.",
      ),
  })
  .strict();

export type DiscoveredExamEdition = {
  bankSlug: string;
  careerSlug: string;
  specializationSlug: string | null;
  sourceExternalId: string;
  title: string;
  organizer: string;
  jurisdiction: string;
  officialUrl: string;
  examDate: string;
  durationMinutes: number | null;
  sourceObservedAt: string;
};

export function normalizeDiscoveredExamEdition(input: unknown): DiscoveredExamEdition {
  const parsed = discoveredExamEditionSchema.parse(input);
  const officialUrl = parseOfficialExamUrl(parsed.bankSlug, parsed.officialUrl);
  officialUrl.hash = "";

  return {
    ...parsed,
    specializationSlug: parsed.specializationSlug ?? null,
    officialUrl: officialUrl.toString(),
    durationMinutes: parsed.durationMinutes ?? null,
    sourceObservedAt: new Date(parsed.sourceObservedAt).toISOString(),
  };
}

export function buildSynchronizedExamEditionPublicId(input: DiscoveredExamEdition) {
  const digest = createHash("sha256")
    .update(`${input.bankSlug}\0${input.sourceExternalId}`)
    .digest("hex")
    .slice(0, 16);
  const year = input.examDate.slice(0, 4);

  return `exam-${input.bankSlug}-${input.careerSlug}-${year}-${digest}`;
}

export type ResolvedDiscoveredExamEdition = DiscoveredExamEdition & {
  bankId: number;
  careerTrackId: number;
  specializationId: number | null;
};

export function assertSpecializationSelection(
  specializationSlug: string | null,
  careerHasActiveSpecializations: boolean,
) {
  if (!specializationSlug && careerHasActiveSpecializations) {
    throw new Error(
      "A carreira possui especializações ativas; informe a especialização da edição.",
    );
  }
}

export type ExistingExamEditionSyncState = {
  publicId: string;
  bankId: number;
  careerTrackId: number;
  specializationId: number | null;
  sourceExternalId: string | null;
  title: string;
  organizer: string | null;
  jurisdiction: string | null;
  officialUrl: string | null;
  examDate: string;
  durationMinutes: number | null;
  status: string;
  sourcePolicy: string;
  sourceContentStored: boolean;
  sourceCheckedAt: Date | null;
};

const safeMetadataFields = [
  "title",
  "organizer",
  "jurisdiction",
  "officialUrl",
  "examDate",
  "durationMinutes",
] as const;

export type SafeExamEditionMetadataField = (typeof safeMetadataFields)[number];

export type ExamEditionSyncPlan =
  | { outcome: "unchanged"; changedFields: readonly [] }
  | {
      outcome: "update";
      changedFields: SafeExamEditionMetadataField[];
      values: {
        title: string;
        organizer: string;
        jurisdiction: string;
        officialUrl: string;
        examDate: string;
        durationMinutes: number | null;
      };
    };

export class ExamEditionSyncConflictError extends Error {
  constructor(
    readonly code:
      | "identity_mismatch"
      | "taxonomy_move"
      | "source_policy_conflict"
      | "source_url_conflict"
      | "review_required"
      | "stale_observation",
    message: string,
  ) {
    super(message);
    this.name = "ExamEditionSyncConflictError";
  }
}

/**
 * Pure conflict/diff core. It deliberately omits status from the update set so a
 * discovery can never publish, cancel or reactivate an edition.
 */
export function planExamEditionMetadataSync(
  existing: ExistingExamEditionSyncState,
  discovered: ResolvedDiscoveredExamEdition,
): ExamEditionSyncPlan {
  if (
    existing.bankId !== discovered.bankId ||
    existing.sourceExternalId !== discovered.sourceExternalId
  ) {
    throw new ExamEditionSyncConflictError(
      "identity_mismatch",
      "A edição carregada não corresponde à identidade externa descoberta.",
    );
  }

  if (
    existing.careerTrackId !== discovered.careerTrackId ||
    existing.specializationId !== discovered.specializationId
  ) {
    throw new ExamEditionSyncConflictError(
      "taxonomy_move",
      "A mesma identidade externa já pertence a outra carreira ou especialização.",
    );
  }

  if (existing.sourcePolicy !== "metadata_only" || existing.sourceContentStored) {
    throw new ExamEditionSyncConflictError(
      "source_policy_conflict",
      "A identidade externa já está ligada a uma edição com conteúdo ou política protegida.",
    );
  }

  if (existing.officialUrl) {
    try {
      parseOfficialExamUrl(discovered.bankSlug, existing.officialUrl);
    } catch {
      throw new ExamEditionSyncConflictError(
        "source_url_conflict",
        "A identidade externa já está ligada a um host incompatível com o portal da banca.",
      );
    }
  }

  const values = {
    title: discovered.title,
    organizer: discovered.organizer,
    jurisdiction: discovered.jurisdiction,
    officialUrl: discovered.officialUrl,
    examDate: discovered.examDate,
    durationMinutes: discovered.durationMinutes,
  };
  const changedFields = safeMetadataFields.filter((field) => existing[field] !== values[field]);

  if (changedFields.length && existing.status !== "draft") {
    throw new ExamEditionSyncConflictError(
      "review_required",
      "A edição já saiu do rascunho; os novos metadados precisam de revisão humana antes de substituir o catálogo público.",
    );
  }

  if (changedFields.length && !isNewerSourceObservation(existing.sourceCheckedAt, discovered.sourceObservedAt)) {
    throw new ExamEditionSyncConflictError(
      "stale_observation",
      "A descoberta é anterior ou igual à última observação registrada e não pode sobrescrever metadados mais recentes.",
    );
  }

  return changedFields.length
    ? { outcome: "update", changedFields: [...changedFields], values }
    : { outcome: "unchanged", changedFields: [] };
}

export function isNewerSourceObservation(
  current: Date | null,
  candidateIso: string,
) {
  return current === null || new Date(candidateIso).getTime() > current.getTime();
}

export type ExamEditionSyncResult = {
  outcome: "created" | "updated" | "unchanged";
  publicId: string;
  status: string;
  changedFields: SafeExamEditionMetadataField[];
};

export async function syncDiscoveredExamEdition(input: unknown): Promise<ExamEditionSyncResult> {
  const discovered = normalizeDiscoveredExamEdition(input);
  const now = new Date();

  return getDb().transaction(async (transaction) => {
    const [bank] = await transaction
      .select({ id: quizBanks.id })
      .from(quizBanks)
      .where(and(eq(quizBanks.slug, discovered.bankSlug), eq(quizBanks.isActive, true)))
      .limit(1);
    if (!bank) throw new Error(`Banca ativa não encontrada: ${discovered.bankSlug}.`);

    const [career] = await transaction
      .select({ id: quizCareerTracks.id })
      .from(quizCareerTracks)
      .where(
        and(
          eq(quizCareerTracks.slug, discovered.careerSlug),
          eq(quizCareerTracks.isActive, true),
        ),
      )
      .limit(1);
    if (!career) throw new Error(`Carreira ativa não encontrada: ${discovered.careerSlug}.`);

    let specializationId: number | null = null;
    if (discovered.specializationSlug) {
      const [specialization] = await transaction
        .select({ id: quizCareerSpecializations.id })
        .from(quizCareerSpecializations)
        .where(
          and(
            eq(quizCareerSpecializations.careerTrackId, career.id),
            eq(quizCareerSpecializations.slug, discovered.specializationSlug),
            eq(quizCareerSpecializations.isActive, true),
          ),
        )
        .limit(1);
      if (!specialization) {
        throw new Error(
          `Especialização ativa não encontrada na carreira: ${discovered.specializationSlug}.`,
        );
      }
      specializationId = specialization.id;
    } else {
      const [activeSpecialization] = await transaction
        .select({ id: quizCareerSpecializations.id })
        .from(quizCareerSpecializations)
        .where(
          and(
            eq(quizCareerSpecializations.careerTrackId, career.id),
            eq(quizCareerSpecializations.isActive, true),
          ),
        )
        .limit(1);
      assertSpecializationSelection(null, Boolean(activeSpecialization));
    }

    const resolved: ResolvedDiscoveredExamEdition = {
      ...discovered,
      bankId: bank.id,
      careerTrackId: career.id,
      specializationId,
    };
    const publicId = buildSynchronizedExamEditionPublicId(discovered);
    const [inserted] = await transaction
      .insert(examEditions)
      .values({
        publicId,
        bankId: bank.id,
        careerTrackId: career.id,
        specializationId,
        sourceExternalId: discovered.sourceExternalId,
        title: discovered.title,
        organizer: discovered.organizer,
        jurisdiction: discovered.jurisdiction,
        officialUrl: discovered.officialUrl,
        examDate: discovered.examDate,
        durationMinutes: discovered.durationMinutes,
        sourcePolicy: "metadata_only",
        sourceContentStored: false,
        sourceCheckedAt: new Date(discovered.sourceObservedAt),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [examEditions.bankId, examEditions.sourceExternalId],
        where: isNotNull(examEditions.sourceExternalId),
      })
      .returning({ publicId: examEditions.publicId, status: examEditions.status });

    if (inserted) {
      await transaction.insert(auditLogs).values({
        action: "monitor.exam_edition.discovered",
        entityType: "exam_edition",
        entityId: inserted.publicId,
        metadata: {
          bankSlug: discovered.bankSlug,
          careerSlug: discovered.careerSlug,
          specializationSlug: discovered.specializationSlug,
          sourceExternalId: discovered.sourceExternalId,
          sourceObservedAt: discovered.sourceObservedAt,
          officialHost: new URL(discovered.officialUrl).hostname,
          status: inserted.status,
        },
      });

      return {
        outcome: "created",
        publicId: inserted.publicId,
        status: inserted.status,
        changedFields: [...safeMetadataFields],
      };
    }

    const [existing] = await transaction
      .select({
        id: examEditions.id,
        publicId: examEditions.publicId,
        bankId: examEditions.bankId,
        careerTrackId: examEditions.careerTrackId,
        specializationId: examEditions.specializationId,
        sourceExternalId: examEditions.sourceExternalId,
        title: examEditions.title,
        organizer: examEditions.organizer,
        jurisdiction: examEditions.jurisdiction,
        officialUrl: examEditions.officialUrl,
        examDate: examEditions.examDate,
        durationMinutes: examEditions.durationMinutes,
        status: examEditions.status,
        sourcePolicy: examEditions.sourcePolicy,
        sourceContentStored: examEditions.sourceContentStored,
        sourceCheckedAt: examEditions.sourceCheckedAt,
      })
      .from(examEditions)
      .where(
        and(
          eq(examEditions.bankId, bank.id),
          eq(examEditions.sourceExternalId, discovered.sourceExternalId),
        ),
      )
      .for("update")
      .limit(1);

    if (!existing) {
      throw new Error("A identidade externa desapareceu durante a sincronização.");
    }

    const plan = planExamEditionMetadataSync(existing, resolved);
    if (plan.outcome === "unchanged") {
      if (isNewerSourceObservation(existing.sourceCheckedAt, discovered.sourceObservedAt)) {
        await transaction
          .update(examEditions)
          .set({ sourceCheckedAt: new Date(discovered.sourceObservedAt) })
          .where(eq(examEditions.id, existing.id));
      }
      return {
        outcome: "unchanged",
        publicId: existing.publicId,
        status: existing.status,
        changedFields: [],
      };
    }

    await transaction
      .update(examEditions)
      .set({
        ...plan.values,
        sourceCheckedAt: new Date(discovered.sourceObservedAt),
        updatedAt: now,
      })
      .where(eq(examEditions.id, existing.id));
    await transaction.insert(auditLogs).values({
      action: "monitor.exam_edition.metadata_updated",
      entityType: "exam_edition",
      entityId: existing.publicId,
      metadata: {
        bankSlug: discovered.bankSlug,
        sourceExternalId: discovered.sourceExternalId,
        sourceObservedAt: discovered.sourceObservedAt,
        officialHost: new URL(discovered.officialUrl).hostname,
        changedFields: plan.changedFields,
        preservedStatus: existing.status,
      },
    });

    return {
      outcome: "updated",
      publicId: existing.publicId,
      status: existing.status,
      changedFields: plan.changedFields,
    };
  });
}
