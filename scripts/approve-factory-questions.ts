import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import {
  auditLogs,
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  questionStyleProfiles,
  quizBanks,
  users,
} from "../src/lib/db/schema";
import { evaluateOriginalQuestionApproval } from "../src/lib/editorial/approval-eligibility";
import { currentLegalSourceExists, lockApprovalScope } from "../src/lib/editorial/approval-lock";
import { EDITORIAL_BATCH_LIMIT, isGeneratedAuthorshipMethod } from "../src/lib/editorial/clean-room";
import { buildDossierFingerprint } from "../src/lib/editorial/dossier-fingerprint";
import { findMostSimilarQuestion } from "../src/lib/editorial/originality";
import { readOfficialQuestionContract } from "../src/lib/editorial/question-contract-service";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";

// Aprova em massa as inéditas da fábrica de um concurso, sob declaração do
// proprietário de que as conferiu (decisão de 11/10/2026: "eu já vi tudo, libere
// tudo em massa"). Faz o envio à revisão e a aprovação do painel
// /admin/fabrica-autoral numa só transação, com as mesmas checagens: procedência
// autoral, fonte oficial vigente, perfil da banca, alternativas, gabarito e
// originalidade. Item reprovado numa checagem fica em rascunho e é listado. A
// auditoria registra a autorização do proprietário, não uma conferência item a
// item no painel. Não cria vínculo nem libera produto.
// --standing: autorização permanente do proprietário (11/10/2026, "aprovar sozinho,
// sem me perguntar"), usada pela linha automática deploy/editorial-release-chain.sh;
// a auditoria registra que nenhum humano conferiu o item.
// Uso: tsx scripts/approve-factory-questions.ts [--apply] [--standing] --contest=<slug do edital>
// Sem --apply, tudo roda numa transação desfeita ao final (prévia).

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function parseFactoryApprovalArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  const standing = args.includes("--standing");
  const rest = args.filter((arg) => arg !== "--apply" && arg !== "--standing");
  const contest = rest.length === 1 ? /^--contest=(.+)$/u.exec(rest[0])?.[1] : undefined;
  if (!contest || !SLUG.test(contest)) throw new Error("Use --contest=<slug do edital> [--apply] [--standing].");
  return { apply, standing, contestSlug: contest };
}

type Skipped = { publicId: string; reason: string };

class PreviewRollback extends Error {}

async function main() {
  const { apply, standing, contestSlug } = parseFactoryApprovalArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.QUESTION_APPROVAL_REFERENCE,
  });
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  let output: Record<string, unknown>;
  try {
    try {
      output = await db.transaction(async (transaction) => {
        await transaction.execute(sql`set local lock_timeout = '10s'`);
        const operators = await transaction
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin"))
          .limit(2);
        if (operators.length !== 1 || operators[0].role !== "admin") {
          throw new Error("A aprovação exige exatamente um administrador identificado.");
        }
        const operatorId = operators[0].id;

        const drafts = await transaction
          .select({
            id: questions.id,
            publicId: questions.publicId,
            status: questions.editorialStatus,
            creatorUserId: questions.createdByUserId,
            prompt: questions.prompt,
            explanation: questions.explanation,
            learningObjective: questions.learningObjective,
            difficulty: questions.difficulty,
            type: questions.type,
            legalArticleId: questions.legalArticleId,
            styleBankId: questions.styleBankId,
            questionContractId: questions.questionContractId,
            questionSourceRights: questions.sourceRights,
            authorshipMethod: questions.authorshipMethod,
            generatorModel: questions.generatorModel,
            promptVersion: questions.promptVersion,
            articleRef: legalArticles.articleRef,
            literalText: legalArticles.literalText,
            articleStatus: legalArticles.editorialStatus,
            articleSourceRights: legalArticles.sourceRights,
            versionStatus: legalVersions.status,
            sourceUrl: legalVersions.sourceUrl,
            sourceVerifiedAt: legalVersions.verifiedAt,
            actIsActive: legalActs.isActive,
            profileFormat: questionStyleProfiles.format,
            profileIsActive: questionStyleProfiles.isActive,
            bankIsActive: quizBanks.isActive,
          })
          .from(questions)
          .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
          .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
          .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
          .innerJoin(questionStyleProfiles, eq(questions.styleBankId, questionStyleProfiles.quizBankId))
          .innerJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
          .where(and(
            eq(questions.quizMode, "original_style"),
            eq(questions.editorialStatus, "draft"),
            isNull(questions.createdByUserId),
            sql`${questions.id} in (
              select link.question_id from question_opportunities link
              join contest_opportunities opportunity on opportunity.id = link.opportunity_id
              where opportunity.slug = ${contestSlug}
            )`,
          ))
          .orderBy(questions.createdAt, questions.id)
          .limit(EDITORIAL_BATCH_LIMIT);
        if (!drafts.length) throw new Error(`Nenhum rascunho da fábrica para ${contestSlug}.`);

        await lockApprovalScope(transaction, {
          questionIds: drafts.map((draft) => draft.id),
          legalArticleIds: drafts.map((draft) => draft.legalArticleId).filter((id): id is number => id !== null),
          styleBankIds: drafts.map((draft) => draft.styleBankId).filter((id): id is number => id !== null),
        });

        const [options, peers] = await Promise.all([
          transaction
            .select({
              questionId: questionOptions.questionId,
              optionKey: questionOptions.optionKey,
              text: questionOptions.text,
              isCorrect: questionOptions.isCorrect,
              rationale: questionOptions.rationale,
            })
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, drafts.map((draft) => draft.id))),
          transaction
            .select({ publicId: questions.publicId, prompt: questions.prompt })
            .from(questions)
            .where(eq(questions.sourceRights, "original_authorial")),
        ]);

        const now = new Date();
        const batchId = randomUUID();
        const notes = standing
          ? `Aprovação automática sob autorização permanente do proprietário, sem conferência humana do item (${reviewer.approvalReference}).`
          : `Aprovação em massa sob declaração do proprietário de que conferiu as questões (${reviewer.approvalReference}).`;
        const skipped: Skipped[] = [];
        const approved: Array<{ publicId: string; dossierFingerprint: string; similarityMaxBps: number;
          similarityReferencePublicId: string | null; generatorModel: string | null; promptVersion: string | null }> = [];

        for (const draft of drafts) {
          const own = options.filter((option) => option.questionId === draft.id).sort((a,b)=>a.optionKey.localeCompare(b.optionKey));
          if (!draft.questionContractId) {
            skipped.push({publicId:draft.publicId,reason:"Falta contrato oficial exato de cargo, edição e etapa; perfil global não autoriza aprovação da fábrica."});
            continue;
          }
          const [scope]=await transaction.execute<{opportunityId:number}>(sql`select c.opportunity_id::int as "opportunityId"
            from opportunity_question_contracts c join contest_opportunities o on o.id=c.opportunity_id
            where c.id=${draft.questionContractId} and o.slug=${contestSlug}`);
          const scoped=scope ? await readOfficialQuestionContract(transaction,scope.opportunityId,draft.questionContractId) : null;
          if (!isGeneratedAuthorshipMethod(draft.authorshipMethod) || !draft.generatorModel || !draft.promptVersion) {
            skipped.push({ publicId: draft.publicId, reason: "Procedência autoral incompleta." });
            continue;
          }
          const similarity = findMostSimilarQuestion(
            draft.prompt,
            peers.filter((peer) => peer.publicId !== draft.publicId),
          );
          const evaluation = evaluateOriginalQuestionApproval({
            ...draft,
            questionContract:scoped?.contract,questionContractIsCurrent:!!scoped,
            options:own.map(option=>({key:option.optionKey,text:option.text,correct:option.isCorrect})),
            status: "pending_review",
            creatorUserId: operatorId,
            cleanRoomAttestedAt: now,
            originalityCheckedAt: now,
            similarityMaxBps: similarity.scoreBps,
            optionTotal: own.length,
            optionCorrect: own.filter((option) => option.isCorrect).length,
          });
          if (!evaluation.allowed) {
            skipped.push({ publicId: draft.publicId, reason: evaluation.reason });
            continue;
          }
          const updated = await transaction
            .update(questions)
            .set({
              editorialStatus: "reviewed",
              createdByUserId: operatorId,
              cleanRoomAttestedAt: now,
              submittedAt: now,
              similarityMaxBps: similarity.scoreBps,
              similarityReferencePublicId: similarity.referencePublicId,
              originalityCheckedAt: now,
              reviewedByUserId: operatorId,
              reviewNotes: notes,
              verifiedAt: now,
              updatedAt: now,
            })
            .where(and(
              eq(questions.id, draft.id),
              eq(questions.editorialStatus, "draft"),
              isNull(questions.createdByUserId),
              currentLegalSourceExists(),
            ))
            .returning({ id: questions.id });
          if (!updated[0]) {
            skipped.push({ publicId: draft.publicId, reason: "A questão ou a fonte legal mudou durante a aprovação." });
            continue;
          }
          approved.push({
            publicId: draft.publicId,
            // Mesmo dossiê que o painel mostra ao revisor, para a trilha apontar o conteúdo aprovado.
            dossierFingerprint: buildDossierFingerprint({
              publicId: draft.publicId,
              type: draft.type,
              prompt: draft.prompt,
              explanation: draft.explanation,
              learningObjective: draft.learningObjective,
              difficulty: draft.difficulty,
              articleRef: draft.articleRef,
              literalText: draft.literalText,
              sourceUrl: draft.sourceUrl,
              sourceVerifiedAt: draft.sourceVerifiedAt,
              options: own.map(({ optionKey, text, isCorrect, rationale }) => ({ optionKey, text, isCorrect, rationale })),
            }),
            similarityMaxBps: similarity.scoreBps,
            similarityReferencePublicId: similarity.referencePublicId,
            generatorModel: draft.generatorModel,
            promptVersion: draft.promptVersion,
          });
        }

        if (approved.length) {
          const common = {
            batchId,
            batchSize: approved.length,
            contestSlug,
            approvalMode: standing ? "owner_standing_authorization" : "owner_authorization",
            approvalReference: reviewer.approvalReference,
            executionSource: "server_cli",
          };
          await transaction.insert(auditLogs).values(approved.flatMap((item) => [
            {
              actorUserId: operatorId,
              action: "editorial.generated_draft.batch_claimed",
              entityType: "question",
              entityId: item.publicId,
              metadata: {
                ...common,
                cleanRoomAttested: true,
                generatorModel: item.generatorModel,
                promptVersion: item.promptVersion,
                similarityMaxBps: item.similarityMaxBps,
                similarityReferencePublicId: item.similarityReferencePublicId,
              },
            },
            {
              actorUserId: operatorId,
              action: "editorial.original_question.batch_approved",
              entityType: "question",
              entityId: item.publicId,
              metadata: {
                ...common,
                reviewAttested: true,
                itemBindingMode: standing ? "owner_standing_authorization" : "owner_bulk_authorization",
                humanItemReview: !standing,
                dossierFingerprint: item.dossierFingerprint,
                notes,
              },
            },
          ]));
        }

        const summary = {
          contestSlug,
          approvalReference: reviewer.approvalReference,
          drafts: drafts.length,
          approved: approved.length,
          skipped,
        };
        if (!apply) throw new PreviewRollback(JSON.stringify(summary));
        return { mode: "applied", ...summary };
      }, { isolationLevel: "serializable" });
    } catch (error) {
      if (!(error instanceof PreviewRollback)) throw error;
      output = { mode: "preview", ...JSON.parse(error.message) };
    }
    console.log(JSON.stringify({ ...output, bindingsCreated: 0, productsReleased: 0 }, null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam `parseFactoryApprovalArgs` sem banco.
if (process.argv[1]?.endsWith("approve-factory-questions.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha na aprovação das inéditas.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
