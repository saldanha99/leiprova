"use server";

import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionNotebookItems,
  questionNotebooks,
  questions,
  savedStudyFilters,
} from "@/lib/db/schema";
import {
  canStudyQuestion,
  accessibleQuestionIds,
} from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export type StudyLibraryActionState = {
  status?: "success" | "error";
  message?: string;
};

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const nameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome.")
  .max(80, "Use no máximo 80 caracteres.");
const idSchema = z.coerce.number().int().positive();

const savedFilterSchema = z
  .object({
    name: nameSchema,
    legalActSlug: slugSchema,
    articleStartOrder: z.coerce.number().int().min(0),
    articleEndOrder: z.coerce.number().int().min(0),
  })
  .refine((value) => value.articleEndOrder >= value.articleStartOrder, {
    message: "O artigo final deve vir depois do inicial.",
  });

const notebookSchema = z.object({
  name: nameSchema,
  description: z
    .string()
    .trim()
    .max(240, "Use no máximo 240 caracteres.")
    .optional(),
});

const notebookItemSchema = z.object({
  notebookPublicId: z.string().uuid(),
  questionPublicId: z.string().trim().min(1).max(160),
});

function databaseCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
}

export async function saveStudyFilterAction(
  _previousState: StudyLibraryActionState,
  formData: FormData,
): Promise<StudyLibraryActionState> {
  const user = await requireUser("/app/leis");
  const parsed = savedFilterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Filtro inválido.",
    };
  }

  const db = getDb();
  const [act] = await db
    .select({ id: legalActs.id, versionId: legalVersions.id })
    .from(legalActs)
    .innerJoin(legalVersions, eq(legalVersions.legalActId, legalActs.id))
    .where(
      and(
        eq(legalActs.slug, parsed.data.legalActSlug),
        eq(legalActs.isActive, true),
        eq(legalVersions.status, "current"),
      ),
    )
    .limit(1);

  if (!act)
    return { status: "error", message: "Lei indisponível para estudo." };

  const boundaryArticles = await db
    .select({ order: legalArticles.articleOrder })
    .from(legalArticles)
    .where(
      and(
        eq(legalArticles.legalVersionId, act.versionId),
        eq(legalArticles.editorialStatus, "reviewed"),
        sql`${legalArticles.articleOrder} in (${parsed.data.articleStartOrder}, ${parsed.data.articleEndOrder})`,
      ),
    );
  const validOrders = new Set(boundaryArticles.map((article) => article.order));
  if (
    !validOrders.has(parsed.data.articleStartOrder) ||
    !validOrders.has(parsed.data.articleEndOrder)
  ) {
    return {
      status: "error",
      message: "Selecione artigos disponíveis nesta versão da lei.",
    };
  }

  const entitlement = await getStudyEntitlement(user.id);
  const [availableQuestions] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .where(
      and(
        eq(legalArticles.legalVersionId, act.versionId),
        eq(legalArticles.editorialStatus, "reviewed"),
        eq(questions.editorialStatus, "reviewed"),
        gte(legalArticles.articleOrder, parsed.data.articleStartOrder),
        lte(legalArticles.articleOrder, parsed.data.articleEndOrder),
        entitlement.hasFullAccess
          ? undefined
          : inArray(questions.publicId, accessibleQuestionIds(entitlement)),
      ),
    );
  if ((availableQuestions?.count ?? 0) === 0) {
    return {
      status: "error",
      message:
        "Este recorte ainda não possui questões disponíveis para sua conta.",
    };
  }

  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedStudyFilters)
    .where(eq(savedStudyFilters.userId, user.id));
  if ((usage?.count ?? 0) >= 30) {
    return {
      status: "error",
      message: "Você chegou ao limite de 30 filtros salvos.",
    };
  }

  try {
    await db.insert(savedStudyFilters).values({
      userId: user.id,
      legalActId: act.id,
      name: parsed.data.name,
      articleStartOrder: parsed.data.articleStartOrder,
      articleEndOrder: parsed.data.articleEndOrder,
    });
  } catch (error) {
    if (databaseCode(error) === "23505") {
      return { status: "error", message: "Já existe um filtro com esse nome." };
    }
    console.error("save_study_filter_failed", { code: databaseCode(error) });
    return {
      status: "error",
      message: "Não foi possível salvar o filtro agora.",
    };
  }

  revalidatePath(`/app/leis/${parsed.data.legalActSlug}`);
  return { status: "success", message: "Filtro salvo para usar novamente." };
}

export async function deleteStudyFilterAction(formData: FormData) {
  const user = await requireUser("/app/leis");
  const parsed = idSchema.safeParse(formData.get("filterId"));
  const slug = slugSchema.safeParse(formData.get("legalActSlug"));
  if (!parsed.success) return;

  await getDb()
    .delete(savedStudyFilters)
    .where(
      and(
        eq(savedStudyFilters.id, parsed.data),
        eq(savedStudyFilters.userId, user.id),
      ),
    );
  if (slug.success) revalidatePath(`/app/leis/${slug.data}`);
}

export async function createQuestionNotebookAction(
  _previousState: StudyLibraryActionState,
  formData: FormData,
): Promise<StudyLibraryActionState> {
  const user = await requireUser("/app/materiais");
  const parsed = notebookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Caderno inválido.",
    };
  }

  const db = getDb();
  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionNotebooks)
    .where(eq(questionNotebooks.userId, user.id));
  if ((usage?.count ?? 0) >= 30) {
    return {
      status: "error",
      message: "Você chegou ao limite de 30 cadernos.",
    };
  }

  try {
    await db.insert(questionNotebooks).values({
      publicId: randomUUID(),
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    });
  } catch (error) {
    if (databaseCode(error) === "23505") {
      return {
        status: "error",
        message: "Já existe um caderno com esse nome.",
      };
    }
    console.error("create_question_notebook_failed", {
      code: databaseCode(error),
    });
    return {
      status: "error",
      message: "Não foi possível criar o caderno agora.",
    };
  }

  revalidatePath("/app/materiais");
  return { status: "success", message: "Caderno criado." };
}

export async function deleteQuestionNotebookAction(formData: FormData) {
  const user = await requireUser("/app/materiais");
  const parsed = idSchema.safeParse(formData.get("notebookId"));
  if (!parsed.success) return;

  await getDb()
    .delete(questionNotebooks)
    .where(
      and(
        eq(questionNotebooks.id, parsed.data),
        eq(questionNotebooks.userId, user.id),
      ),
    );
  revalidatePath("/app/materiais");
}

export async function addQuestionToNotebookAction(
  _previousState: StudyLibraryActionState,
  formData: FormData,
): Promise<StudyLibraryActionState> {
  const user = await requireUser("/app/treinar");
  const parsed = notebookItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", message: "Selecione um caderno válido." };

  const entitlement = await getStudyEntitlement(user.id);
  if (!canStudyQuestion(entitlement, parsed.data.questionPublicId)) {
    return { status: "error", message: "Questão indisponível para sua conta." };
  }

  const db = getDb();
  const [[notebook], [question]] = await Promise.all([
    db
      .select({ id: questionNotebooks.id })
      .from(questionNotebooks)
      .where(
        and(
          eq(questionNotebooks.publicId, parsed.data.notebookPublicId),
          eq(questionNotebooks.userId, user.id),
        ),
      )
      .limit(1),
    db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(
        legalVersions,
        eq(legalArticles.legalVersionId, legalVersions.id),
      )
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(
        and(
          eq(questions.publicId, parsed.data.questionPublicId),
          eq(questions.editorialStatus, "reviewed"),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
        ),
      )
      .limit(1),
  ]);
  if (!notebook || !question)
    return { status: "error", message: "Caderno ou questão não encontrado." };

  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionNotebookItems)
    .where(eq(questionNotebookItems.notebookId, notebook.id));
  if ((usage?.count ?? 0) >= 500) {
    return {
      status: "error",
      message: "Este caderno chegou ao limite de 500 questões.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(questionNotebookItems)
      .values({ notebookId: notebook.id, questionId: question.id })
      .onConflictDoNothing();
    await tx
      .update(questionNotebooks)
      .set({ updatedAt: new Date() })
      .where(eq(questionNotebooks.id, notebook.id));
  });

  revalidatePath("/app/materiais");
  return { status: "success", message: "Questão adicionada ao caderno." };
}

export async function removeQuestionFromNotebookAction(formData: FormData) {
  const user = await requireUser("/app/materiais");
  const parsed = notebookItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const db = getDb();
  const [ownedItem] = await db
    .select({
      notebookId: questionNotebooks.id,
      questionId: questions.id,
    })
    .from(questionNotebooks)
    .innerJoin(
      questionNotebookItems,
      eq(questionNotebookItems.notebookId, questionNotebooks.id),
    )
    .innerJoin(questions, eq(questionNotebookItems.questionId, questions.id))
    .where(
      and(
        eq(questionNotebooks.userId, user.id),
        eq(questionNotebooks.publicId, parsed.data.notebookPublicId),
        eq(questions.publicId, parsed.data.questionPublicId),
      ),
    )
    .limit(1);
  if (!ownedItem) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(questionNotebookItems)
      .where(
        and(
          eq(questionNotebookItems.notebookId, ownedItem.notebookId),
          eq(questionNotebookItems.questionId, ownedItem.questionId),
        ),
      );
    await tx
      .update(questionNotebooks)
      .set({ updatedAt: new Date() })
      .where(eq(questionNotebooks.id, ownedItem.notebookId));
  });

  revalidatePath("/app/materiais");
  revalidatePath(`/app/materiais/cadernos/${parsed.data.notebookPublicId}`);
}
