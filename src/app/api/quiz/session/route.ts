import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  examEditions,
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  quizBanks,
  quizCareerSpecializations,
  quizCareerSubjects,
  quizCareerTracks,
  quizSessionQuestions,
  quizSessions,
  quizSubjects,
  quizTopics,
} from "@/lib/db/schema";
import {
  consumeRateLimits,
  getRequestIp,
  rateLimitJsonResponse,
} from "@/lib/rate-limit";
import {
  calculateQuizDeadline,
  emptyQuizReason,
  formatQuizQuestionSource,
} from "@/lib/quiz/response";
import {
  ELIGIBLE_QUIZ_EXAM_STATUSES,
  isQuizExamEditionAvailableForSelection,
  saoPauloDateIso,
} from "@/lib/quiz/exam-edition-catalog";
import {
  quizSessionRequestSchema,
  resolveCatalogSelection,
  type QuizSessionQuestion,
} from "@/lib/quiz/session-contract";
import { FREE_STUDY_QUESTION_IDS } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

type DbSelection = {
  careerTrackId: number | null;
  specializationId: number | null;
  bankId: number | null;
  subjectId: number | null;
  topicId: number | null;
  careerSubjectIds: number[];
};

async function loadDbSelection(
  resolved: ReturnType<typeof resolveCatalogSelection>,
): Promise<DbSelection | null> {
  const db = getDb();
  const [careerRows, bankRows, subjectRows] = await Promise.all([
    resolved.career
      ? db
          .select({ id: quizCareerTracks.id })
          .from(quizCareerTracks)
          .where(and(eq(quizCareerTracks.slug, resolved.career.slug), eq(quizCareerTracks.isActive, true)))
          .limit(1)
      : Promise.resolve([]),
    resolved.bank
      ? db
          .select({ id: quizBanks.id })
          .from(quizBanks)
          .where(and(eq(quizBanks.slug, resolved.bank.slug), eq(quizBanks.isActive, true)))
          .limit(1)
      : Promise.resolve([]),
    resolved.subject
      ? db
          .select({ id: quizSubjects.id })
          .from(quizSubjects)
          .where(and(eq(quizSubjects.slug, resolved.subject.slug), eq(quizSubjects.isActive, true)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const careerTrackId = careerRows[0]?.id ?? null;
  const bankId = bankRows[0]?.id ?? null;
  const subjectId = subjectRows[0]?.id ?? null;
  if ((resolved.career && !careerTrackId) || (resolved.bank && !bankId) || (resolved.subject && !subjectId)) {
    return null;
  }

  const [specializationRows, topicRows, careerSubjects] = await Promise.all([
    resolved.specialization && careerTrackId
      ? db
          .select({ id: quizCareerSpecializations.id })
          .from(quizCareerSpecializations)
          .where(
            and(
              eq(quizCareerSpecializations.careerTrackId, careerTrackId),
              eq(quizCareerSpecializations.slug, resolved.specialization.slug),
              eq(quizCareerSpecializations.isActive, true),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    resolved.topic && subjectId
      ? db
          .select({ id: quizTopics.id })
          .from(quizTopics)
          .where(
            and(
              eq(quizTopics.subjectId, subjectId),
              eq(quizTopics.slug, resolved.topic.slug),
              eq(quizTopics.isActive, true),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    careerTrackId
      ? db
          .select({ subjectId: quizCareerSubjects.subjectId })
          .from(quizCareerSubjects)
          .where(eq(quizCareerSubjects.careerTrackId, careerTrackId))
      : Promise.resolve([]),
  ]);

  const specializationId = specializationRows[0]?.id ?? null;
  const topicId = topicRows[0]?.id ?? null;
  if ((resolved.specialization && !specializationId) || (resolved.topic && !topicId)) return null;
  if (careerTrackId && subjectId && !careerSubjects.some((row) => row.subjectId === subjectId)) return null;

  return {
    careerTrackId,
    specializationId,
    bankId,
    subjectId,
    topicId,
    careerSubjectIds: careerSubjects.map((row) => row.subjectId),
  };
}

function subjectCondition(selection: DbSelection) {
  if (selection.subjectId) return eq(questions.subjectId, selection.subjectId);
  if (selection.careerTrackId) {
    return selection.careerSubjectIds.length
      ? inArray(questions.subjectId, selection.careerSubjectIds)
      : sql`false`;
  }
  return isNotNull(questions.subjectId);
}

function examEditionConditions(
  selection: DbSelection,
  todayIso: string,
  examEditionPublicId?: string,
) {
  return and(
    inArray(examEditions.status, [...ELIGIBLE_QUIZ_EXAM_STATUSES]),
    lte(examEditions.examDate, todayIso),
    isNotNull(examEditions.officialUrl),
    sql`char_length(btrim(${examEditions.officialUrl})) > 0`,
    selection.careerTrackId ? eq(examEditions.careerTrackId, selection.careerTrackId) : undefined,
    selection.careerTrackId
      ? selection.specializationId
        ? eq(examEditions.specializationId, selection.specializationId)
        : isNull(examEditions.specializationId)
      : undefined,
    selection.bankId ? eq(examEditions.bankId, selection.bankId) : undefined,
    examEditionPublicId ? eq(examEditions.publicId, examEditionPublicId) : undefined,
  );
}

function licensedPreviousQuestionConditions(selection: DbSelection, now: Date) {
  return and(
    eq(questions.quizMode, "previous_exam"),
    eq(questions.editorialStatus, "reviewed"),
    eq(questions.sourceRights, "licensed"),
    isNotNull(questions.reviewedByUserId),
    isNotNull(questions.sourceTitle),
    isNotNull(questions.sourceUrl),
    isNotNull(questions.sourceRightsHolder),
    isNotNull(questions.licenseBasis),
    isNotNull(questions.licenseReference),
    isNotNull(questions.originalQuestionNumber),
    isNotNull(questions.originalQuestionOrder),
    isNotNull(questions.licensedAt),
    or(isNull(questions.licenseExpiresAt), gt(questions.licenseExpiresAt, now)),
    subjectCondition(selection),
    selection.topicId ? eq(questions.topicId, selection.topicId) : undefined,
  );
}

async function selectExamEdition(
  selection: DbSelection,
  todayIso: string,
  request: ReturnType<typeof quizSessionRequestSchema.parse>,
) {
  if (!request.examEditionId && (request.mode !== "previous_exam" || request.examScope === "all")) {
    return null;
  }

  const rows = await getDb()
    .select({
      id: examEditions.id,
      publicId: examEditions.publicId,
      title: examEditions.title,
      examDate: examEditions.examDate,
      durationMinutes: examEditions.durationMinutes,
      status: examEditions.status,
      officialUrl: examEditions.officialUrl,
      careerTrackId: examEditions.careerTrackId,
      specializationId: examEditions.specializationId,
      bankId: quizBanks.id,
      bankSlug: quizBanks.slug,
      bankName: quizBanks.name,
      bankIsActive: quizBanks.isActive,
    })
    .from(examEditions)
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .where(
      and(
        examEditionConditions(selection, todayIso, request.examEditionId),
        eq(quizBanks.isActive, true),
      ),
    )
    .orderBy(desc(examEditions.examDate), desc(examEditions.id))
    .limit(1);

  const edition = rows[0];
  return edition &&
    isQuizExamEditionAvailableForSelection(
      edition,
      selection,
      todayIso,
      request.examEditionId,
    )
    ? edition
    : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const limited = await consumeRateLimits([
    { policy: "quizSessionUserMinute", subject: { kind: "user", value: String(user.id) } },
    { policy: "quizSessionIpMinute", subject: { kind: "ip", value: getRequestIp(request.headers) } },
  ]);
  if (limited) return rateLimitJsonResponse(limited, "Você criou muitos simulados em pouco tempo.");

  const parsed = quizSessionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_selection", issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) },
      { status: 400 },
    );
  }

  const resolved = resolveCatalogSelection(parsed.data);
  const selection = await loadDbSelection(resolved);
  if (!selection) {
    return NextResponse.json({ error: "catalog_not_available" }, { status: 409 });
  }

  const now = new Date();
  const todayIso = saoPauloDateIso(now);
  const entitlement = await getStudyEntitlement(user.id, now);
  const selectedExamEdition = await selectExamEdition(selection, todayIso, parsed.data);
  if (parsed.data.examEditionId && !selectedExamEdition) {
    return NextResponse.json({ error: "exam_edition_not_available" }, { status: 400 });
  }
  const effectiveSelection =
    parsed.data.path === "career" && selectedExamEdition
      ? { ...selection, bankId: selectedExamEdition.bankId }
      : selection;

  const modeConditions =
    parsed.data.mode === "dry_law"
      ? and(
          eq(questions.quizMode, "dry_law"),
          isNotNull(questions.legalArticleId),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
        )
      : parsed.data.mode === "original_style"
        ? and(
            eq(questions.quizMode, "original_style"),
            effectiveSelection.bankId
              ? eq(questions.styleBankId, effectiveSelection.bankId)
              : sql`false`,
            eq(questions.sourceRights, "original_authorial"),
            isNotNull(questions.reviewedByUserId),
          )
        : and(
            licensedPreviousQuestionConditions(effectiveSelection, now),
            examEditionConditions(effectiveSelection, todayIso, parsed.data.examEditionId),
            parsed.data.examScope === "latest" || parsed.data.examEditionId
              ? selectedExamEdition
                ? eq(questions.examEditionId, selectedExamEdition.id)
                : sql`false`
              : undefined,
          );

  const questionJoinsAndConditions = and(
    eq(questions.editorialStatus, "reviewed"),
    sql`exists (
      select 1
      from question_options eligible_correct_option
      where eligible_correct_option.question_id = ${questions.id}
        and eligible_correct_option.is_correct = true
    )`,
    subjectCondition(effectiveSelection),
    effectiveSelection.topicId ? eq(questions.topicId, effectiveSelection.topicId) : undefined,
    modeConditions,
  );

  const [matchingContent] = await getDb()
    .select({ id: questions.id })
    .from(questions)
    .leftJoin(quizSubjects, eq(questions.subjectId, quizSubjects.id))
    .leftJoin(quizTopics, eq(questions.topicId, quizTopics.id))
    .leftJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .leftJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .leftJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .leftJoin(examEditions, eq(questions.examEditionId, examEditions.id))
    .where(questionJoinsAndConditions)
    .limit(1);

  const questionOrdering =
    parsed.data.mode === "previous_exam"
      ? parsed.data.examScope === "all" && !parsed.data.examEditionId
        ? [desc(examEditions.examDate), desc(examEditions.id), asc(questions.originalQuestionOrder)]
        : [asc(questions.originalQuestionOrder)]
      : [sql`random()`];

  const questionRows = await getDb()
    .select({
      id: questions.id,
      publicId: questions.publicId,
      prompt: questions.prompt,
      difficulty: questions.difficulty,
      quizMode: questions.quizMode,
      sourceTitle: questions.sourceTitle,
      sourceUrl: questions.sourceUrl,
      verifiedAt: questions.verifiedAt,
      subjectSlug: quizSubjects.slug,
      subjectName: quizSubjects.name,
      topicSlug: quizTopics.slug,
      topicName: quizTopics.name,
      articleRef: legalArticles.articleRef,
      legalActTitle: legalActs.shortTitle,
      officialLegalUrl: legalActs.officialUrl,
      originalQuestionOrder: questions.originalQuestionOrder,
    })
    .from(questions)
    .leftJoin(quizSubjects, eq(questions.subjectId, quizSubjects.id))
    .leftJoin(quizTopics, eq(questions.topicId, quizTopics.id))
    .leftJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .leftJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .leftJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .leftJoin(examEditions, eq(questions.examEditionId, examEditions.id))
    .where(
      and(
        questionJoinsAndConditions,
        entitlement.hasFullAccess
          ? undefined
          : inArray(questions.publicId, [...FREE_STUDY_QUESTION_IDS]),
      ),
    )
    .orderBy(...questionOrdering)
    .limit(parsed.data.count);

  const optionRows = questionRows.length
    ? await getDb()
        .select({
          questionId: questionOptions.questionId,
          id: questionOptions.optionKey,
          text: questionOptions.text,
        })
        .from(questionOptions)
        .where(inArray(questionOptions.questionId, questionRows.map((question) => question.id)))
        .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder))
    : [];

  const optionsByQuestion = new Map<number, Array<{ id: string; text: string }>>();
  for (const option of optionRows) {
    const options = optionsByQuestion.get(option.questionId) ?? [];
    options.push({ id: option.id, text: option.text });
    optionsByQuestion.set(option.questionId, options);
  }

  const sessionId = randomUUID();
  const deadlineAt = calculateQuizDeadline(now, {
    timed: parsed.data.timed,
    count: questionRows.length || parsed.data.count,
    editionDurationMinutes:
      parsed.data.mode === "previous_exam" ? selectedExamEdition?.durationMinutes : undefined,
  });
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  await getDb().transaction(async (tx) => {
    await tx.insert(quizSessions).values({
      id: sessionId,
      userId: user.id,
      path: parsed.data.path,
      careerTrackId: effectiveSelection.careerTrackId,
      specializationId: effectiveSelection.specializationId,
      bankId: effectiveSelection.bankId,
      subjectId: effectiveSelection.subjectId,
      topicId: effectiveSelection.topicId,
      mode: parsed.data.mode,
      experience: parsed.data.experience,
      timed: parsed.data.timed,
      examScope: parsed.data.examScope,
      examEditionId: selectedExamEdition?.id ?? null,
      requestedCount: parsed.data.count,
      questionCount: questionRows.length,
      startedAt: now,
      deadlineAt,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    if (questionRows.length) {
      await tx.insert(quizSessionQuestions).values(
        questionRows.map((question, index) => ({
          sessionId,
          questionId: question.id,
          position: index + 1,
        })),
      );
    }
  });

  const responseQuestions: QuizSessionQuestion[] = questionRows.map((question) => ({
    id: question.publicId,
    prompt: question.prompt,
    options: optionsByQuestion.get(question.id) ?? [],
    difficulty: question.difficulty,
    subject:
      question.subjectSlug && question.subjectName
        ? { slug: question.subjectSlug, name: question.subjectName }
        : null,
    topic:
      question.topicSlug && question.topicName
        ? { slug: question.topicSlug, name: question.topicName }
        : null,
    articleRef: question.articleRef,
    legalAct: question.legalActTitle,
    source: formatQuizQuestionSource({
      mode: question.quizMode as "dry_law" | "previous_exam" | "original_style",
      sourceTitle: question.sourceTitle,
      sourceUrl: question.sourceUrl,
      verifiedAt: question.verifiedAt,
      legalActTitle: question.legalActTitle,
      officialLegalUrl: question.officialLegalUrl,
      styleBankName: selectedExamEdition?.bankName ?? resolved.bank?.name ?? null,
    }),
  }));

  const availability = questionRows.length
    ? { status: "ready" as const, returnedCount: questionRows.length }
    : !matchingContent
      ? { status: "empty" as const, ...emptyQuizReason(parsed.data.mode) }
      : !entitlement.hasFullAccess
      ? {
          status: "empty" as const,
          reason: "available_but_locked" as const,
          message: "Este modo está disponível nos planos com acesso completo.",
        }
      : { status: "empty" as const, ...emptyQuizReason(parsed.data.mode) };

  return NextResponse.json(
    {
      sessionId,
      expiresAt: expiresAt.toISOString(),
      deadlineAt: deadlineAt?.toISOString() ?? null,
      selection: {
        path: parsed.data.path,
        career: resolved.career ? { slug: resolved.career.slug, name: resolved.career.name } : null,
        specialization: resolved.specialization,
        bank: selectedExamEdition
          ? { slug: selectedExamEdition.bankSlug, name: selectedExamEdition.bankName }
          : resolved.bank
            ? { slug: resolved.bank.slug, name: resolved.bank.name }
            : null,
        subject: resolved.subject ? { slug: resolved.subject.slug, name: resolved.subject.name } : null,
        topic: resolved.topic,
        mode: { slug: resolved.mode.slug, name: resolved.mode.name },
        experience: parsed.data.experience,
        timed: parsed.data.timed,
        examScope: parsed.data.examScope,
        examEdition: selectedExamEdition
          ? {
              id: selectedExamEdition.publicId,
              title: selectedExamEdition.title,
              examDate: selectedExamEdition.examDate,
              durationMinutes: selectedExamEdition.durationMinutes,
              status: selectedExamEdition.status,
              bank: { slug: selectedExamEdition.bankSlug, name: selectedExamEdition.bankName },
            }
          : null,
        availability,
        expiresAt: expiresAt.toISOString(),
        deadlineAt: deadlineAt?.toISOString() ?? null,
      },
      questions: responseQuestions,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
