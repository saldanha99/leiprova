import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import {
  auditLogs,
  contestOpportunities,
  opportunityDocumentSnapshots,
  opportunityRequirements,
  opportunitySourceDocuments,
  quizSubjects,
  users,
} from "../src/lib/db/schema";
import { extractOfficialSyllabusCandidates } from "../src/lib/editorial/official-syllabus-extractor";
import {
  generateNoticeQuestionDraftForRequirement,
  NoticeDraftGenerationError,
} from "../src/lib/editorial/notice-draft-service";
import {
  captureOfficialPdf,
  discoverOfficialDocumentCandidates,
} from "../src/lib/opportunities/official-document-fetch";
import {
  OFFICIAL_DOCUMENT_AUTHORIZATION_SCOPE,
  parseOfficialOpportunitySourceUrl,
} from "../src/lib/opportunities/source-monitor-policy";

const MAX_DOCUMENT_ATTEMPTS_PER_RUN = 12;
const MAX_NEW_DOCUMENTS_PER_RUN = 6;
const MAX_DRAFT_ATTEMPTS_PER_RUN = 50;
const MAX_NEW_DRAFTS_PER_RUN = 25;
const AUTHORIZED_AT = new Date("2026-09-01T12:00:00.000-03:00");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Defina DATABASE_URL antes de executar a automação editorial.");

const ownerEmail = process.env.EDITORIAL_OWNER_APPROVER_EMAIL?.trim().toLowerCase();
if (!ownerEmail) {
  throw new Error("Defina EDITORIAL_OWNER_APPROVER_EMAIL para identificar a conta responsável.");
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client, { schema });
const pause = () => new Promise((resolve) => setTimeout(resolve, 400));

function safeError(error: unknown) {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  if (!cause || typeof cause !== "object") return "Falha sem detalhe seguro.";
  const record = cause as { code?: unknown; message?: unknown; name?: unknown };
  return JSON.stringify({
    name: typeof record.name === "string" ? record.name : "Error",
    code: typeof record.code === "string" ? record.code : undefined,
    message:
      typeof record.message === "string"
        ? record.message.slice(0, 300)
        : "Falha sem detalhe seguro.",
  });
}

async function requireOwner() {
  const [owner] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${ownerEmail}`)
    .limit(1);
  if (!owner || (owner.role !== "editor" && owner.role !== "admin")) {
    throw new Error("A conta proprietária precisa existir com papel editorial.");
  }
  return owner;
}

async function capturePendingOfficialDocuments(ownerUserId: number) {
  const sources = await db
    .select({
      id: opportunitySourceDocuments.id,
      publicId: opportunitySourceDocuments.publicId,
      title: opportunitySourceDocuments.title,
      sourceUrl: opportunitySourceDocuments.sourceUrl,
    })
    .from(opportunitySourceDocuments)
    .innerJoin(
      contestOpportunities,
      eq(opportunitySourceDocuments.opportunityId, contestOpportunities.id),
    )
    .where(
      and(
        eq(opportunitySourceDocuments.status, "approved"),
        eq(contestOpportunities.editorialStatus, "reviewed"),
      ),
    )
    .orderBy(desc(opportunitySourceDocuments.observedAt));

  let checkedSources = 0;
  let discovered = 0;
  let attempts = 0;
  let capturedCount = 0;
  let unchanged = 0;
  let failures = 0;

  sourceLoop: for (const source of sources) {
    try {
      const official = parseOfficialOpportunitySourceUrl(source.sourceUrl);
      const [candidates, storedRows] = await Promise.all([
        discoverOfficialDocumentCandidates(official.url, official.sourceId, source.title),
        db
          .select({ documentUrl: opportunityDocumentSnapshots.documentUrl })
          .from(opportunityDocumentSnapshots)
          .where(eq(opportunityDocumentSnapshots.sourceDocumentId, source.id)),
      ]);
      checkedSources += 1;
      discovered += candidates.length;

      const storedUrls = new Set(storedRows.map((item) => item.documentUrl));
      const unseen = candidates.filter((candidate) => !storedUrls.has(candidate.url));
      const selected = [...unseen];
      if (candidates[0] && !selected.some((candidate) => candidate.url === candidates[0]?.url)) {
        selected.push(candidates[0]);
      }

      for (const candidate of selected) {
        if (
          attempts >= MAX_DOCUMENT_ATTEMPTS_PER_RUN ||
          capturedCount >= MAX_NEW_DOCUMENTS_PER_RUN
        ) {
          break sourceLoop;
        }
        attempts += 1;
        try {
          const captured = await captureOfficialPdf(candidate, official.sourceId);
          const publicId = randomUUID();
          const savedRows = await db.execute<{ public_id: string }>(sql`
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
              ${AUTHORIZED_AT.toISOString()},
              ${ownerUserId}
            )
            on conflict (source_document_id, checksum_sha256) do nothing
            returning public_id
          `);
          const saved = savedRows[0];
          if (!saved) {
            unchanged += 1;
            continue;
          }
          capturedCount += 1;
          await db.insert(auditLogs).values({
            actorUserId: ownerUserId,
            action: "automation.notice_document.captured",
            entityType: "opportunity_document_snapshot",
            entityId: saved.public_id,
            metadata: {
              sourceDocumentPublicId: source.publicId,
              checksumSha256: captured.checksumSha256,
              byteLength: captured.byteLength,
              pageCount: captured.pageCount,
              parserVersion: captured.parserVersion,
              status: "pending_review",
            },
          });
        } catch (error) {
          failures += 1;
          console.warn(`[documento:${source.publicId}]`, safeError(error));
        }
        await pause();
      }
    } catch (error) {
      failures += 1;
      console.warn(`[fonte:${source.publicId}]`, safeError(error));
    }
    await pause();
  }

  return {
    checkedSources,
    discovered,
    attempts,
    captured: capturedCount,
    unchanged,
    failures,
    limits: {
      attempts: MAX_DOCUMENT_ATTEMPTS_PER_RUN,
      newDocuments: MAX_NEW_DOCUMENTS_PER_RUN,
    },
  };
}

async function extractApprovedSyllabi(ownerUserId: number) {
  const [snapshots, subjects] = await Promise.all([
    db
      .select({
        id: opportunityDocumentSnapshots.id,
        publicId: opportunityDocumentSnapshots.publicId,
        sourceDocumentId: opportunityDocumentSnapshots.sourceDocumentId,
        opportunityId: opportunitySourceDocuments.opportunityId,
        pageTexts: opportunityDocumentSnapshots.pageTexts,
      })
      .from(opportunityDocumentSnapshots)
      .innerJoin(
        opportunitySourceDocuments,
        eq(opportunityDocumentSnapshots.sourceDocumentId, opportunitySourceDocuments.id),
      )
      .innerJoin(
        contestOpportunities,
        eq(opportunitySourceDocuments.opportunityId, contestOpportunities.id),
      )
      .where(
        and(
          eq(opportunityDocumentSnapshots.status, "approved"),
          eq(opportunitySourceDocuments.status, "approved"),
          eq(contestOpportunities.editorialStatus, "reviewed"),
        ),
      )
      .orderBy(opportunityDocumentSnapshots.id),
    db
      .select({ id: quizSubjects.id, name: quizSubjects.name })
      .from(quizSubjects)
      .where(eq(quizSubjects.isActive, true)),
  ]);

  let checked = 0;
  let skipped = 0;
  let inserted = 0;
  let failures = 0;

  for (const snapshot of snapshots) {
    const [existing] = await db
      .select({ id: opportunityRequirements.id })
      .from(opportunityRequirements)
      .where(eq(opportunityRequirements.sourceSnapshotId, snapshot.id))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    checked += 1;
    try {
      const candidates = extractOfficialSyllabusCandidates(snapshot.pageTexts, subjects);
      if (!candidates.length) {
        failures += 1;
        console.warn(`[programa:${snapshot.publicId}] nenhum requisito reconhecido.`);
        continue;
      }
      const values = candidates.map(
        (candidate) => sql`(
          ${snapshot.opportunityId},
          ${snapshot.sourceDocumentId},
          ${snapshot.id},
          ${candidate.suggestedSubjectId},
          ${candidate.requirementText},
          ${candidate.sourceLocator},
          ${ownerUserId}
        )`,
      );
      const rows = await db.execute<{ id: string }>(sql`
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
      inserted += rows.length;
      await db.insert(auditLogs).values({
        actorUserId: ownerUserId,
        action: "automation.notice_syllabus.extracted",
        entityType: "opportunity_document_snapshot",
        entityId: snapshot.publicId,
        metadata: {
          identified: candidates.length,
          inserted: rows.length,
          extractionPolicy: "deterministic_verbatim_lines",
          status: "draft",
        },
      });
    } catch (error) {
      failures += 1;
      console.warn(`[programa:${snapshot.publicId}]`, safeError(error));
    }
    await pause();
  }

  return { checked, skipped, inserted, failures };
}

async function generateReviewedRequirementDrafts(ownerUserId: number) {
  const requirements = await db
    .select({ id: opportunityRequirements.id })
    .from(opportunityRequirements)
    .where(eq(opportunityRequirements.editorialStatus, "reviewed"))
    .orderBy(opportunityRequirements.id);

  let attempts = 0;
  let created = 0;
  let unchanged = 0;
  let deferred = 0;
  let failures = 0;

  for (const requirement of requirements) {
    if (
      attempts >= MAX_DRAFT_ATTEMPTS_PER_RUN ||
      created >= MAX_NEW_DRAFTS_PER_RUN
    ) {
      break;
    }
    attempts += 1;
    try {
      const result = await generateNoticeQuestionDraftForRequirement(
        db,
        requirement.id,
        ownerUserId,
      );
      if (result.created) created += 1;
      else unchanged += 1;
    } catch (error) {
      if (error instanceof NoticeDraftGenerationError) {
        deferred += 1;
        console.warn(`[rascunho:${requirement.id}] ${error.message}`);
      } else {
        failures += 1;
        console.warn(`[rascunho:${requirement.id}]`, safeError(error));
      }
    }
    await pause();
  }

  return {
    attempts,
    created,
    unchanged,
    deferred,
    failures,
    limits: {
      attempts: MAX_DRAFT_ATTEMPTS_PER_RUN,
      newDrafts: MAX_NEW_DRAFTS_PER_RUN,
    },
  };
}

async function main() {
  try {
    const owner = await requireOwner();
    const documents = await capturePendingOfficialDocuments(owner.id);
    const syllabi = await extractApprovedSyllabi(owner.id);
    const drafts = await generateReviewedRequirementDrafts(owner.id);
    const summary = {
      completedAt: new Date().toISOString(),
      policy: "official_documents_to_draft_queue",
      approvalsAutomated: 0,
      publicationsAutomated: 0,
      documents,
      syllabi,
      drafts,
    };
    await db.insert(auditLogs).values({
      actorUserId: owner.id,
      action: "automation.editorial.completed",
      entityType: "editorial_automation",
      metadata: summary,
    });
    console.log(JSON.stringify(summary));
    if (documents.failures || syllabi.failures || drafts.failures) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha na automação editorial.", safeError(error));
  process.exitCode = 1;
});
