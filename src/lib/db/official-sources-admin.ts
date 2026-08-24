import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import {
  examEditions,
  examSourcePortals,
  legalActs,
  legalSourceSnapshots,
  quizBanks,
  quizCareerTracks,
  users,
} from "@/lib/db/schema";

export async function getOfficialSourcesSnapshot() {
  const db = getDb();
  const initiator = alias(users, "source_initiator");
  const reviewer = alias(users, "source_reviewer");

  const [laws, snapshots, portals, careers, exams, metrics] = await Promise.all([
    db
      .select({
        id: legalActs.id,
        slug: legalActs.slug,
        title: legalActs.title,
        shortTitle: legalActs.shortTitle,
        officialUrl: legalActs.officialUrl,
        isActive: legalActs.isActive,
        lastSeenAt: sql<Date | null>`max(${legalSourceSnapshots.lastSeenAt})`,
        pendingCount: sql<number>`count(*) filter (where ${legalSourceSnapshots.status} = 'pending_review')::int`,
        approvedCount: sql<number>`count(*) filter (where ${legalSourceSnapshots.status} = 'approved')::int`,
      })
      .from(legalActs)
      .leftJoin(legalSourceSnapshots, eq(legalSourceSnapshots.legalActId, legalActs.id))
      .groupBy(legalActs.id)
      .orderBy(legalActs.shortTitle),
    db
      .select({
        publicId: legalSourceSnapshots.publicId,
        legalActId: legalSourceSnapshots.legalActId,
        actTitle: legalActs.shortTitle,
        sourceUrl: legalSourceSnapshots.sourceUrl,
        checksumSha256: legalSourceSnapshots.checksumSha256,
        contentLength: legalSourceSnapshots.contentLength,
        articleMarkerCount: legalSourceSnapshots.articleMarkerCount,
        status: legalSourceSnapshots.status,
        initiatedByUserId: legalSourceSnapshots.initiatedByUserId,
        initiatorName: initiator.name,
        reviewerName: reviewer.name,
        reviewNotes: legalSourceSnapshots.reviewNotes,
        fetchedAt: legalSourceSnapshots.fetchedAt,
        reviewedAt: legalSourceSnapshots.reviewedAt,
      })
      .from(legalSourceSnapshots)
      .innerJoin(legalActs, eq(legalSourceSnapshots.legalActId, legalActs.id))
      .leftJoin(initiator, eq(legalSourceSnapshots.initiatedByUserId, initiator.id))
      .leftJoin(reviewer, eq(legalSourceSnapshots.reviewedByUserId, reviewer.id))
      .orderBy(desc(legalSourceSnapshots.fetchedAt))
      .limit(80),
    db
      .select({
        id: examSourcePortals.id,
        bankId: quizBanks.id,
        bankSlug: quizBanks.slug,
        bankName: quizBanks.name,
        officialUrl: examSourcePortals.officialUrl,
        lastHttpStatus: examSourcePortals.lastHttpStatus,
        lastPageTitle: examSourcePortals.lastPageTitle,
        lastFinalUrl: examSourcePortals.lastFinalUrl,
        lastError: examSourcePortals.lastError,
        lastCheckedAt: examSourcePortals.lastCheckedAt,
      })
      .from(examSourcePortals)
      .innerJoin(quizBanks, eq(examSourcePortals.quizBankId, quizBanks.id))
      .orderBy(quizBanks.name),
    db
      .select({ id: quizCareerTracks.id, name: quizCareerTracks.name })
      .from(quizCareerTracks)
      .where(eq(quizCareerTracks.isActive, true))
      .orderBy(quizCareerTracks.name),
    db
      .select({
        publicId: examEditions.publicId,
        title: examEditions.title,
        examDate: examEditions.examDate,
        jurisdiction: examEditions.jurisdiction,
        officialUrl: examEditions.officialUrl,
        sourcePageTitle: examEditions.sourcePageTitle,
        sourceHttpStatus: examEditions.sourceHttpStatus,
        sourceContentStored: examEditions.sourceContentStored,
        bankName: quizBanks.name,
        careerName: quizCareerTracks.name,
        createdAt: examEditions.createdAt,
      })
      .from(examEditions)
      .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
      .innerJoin(quizCareerTracks, eq(examEditions.careerTrackId, quizCareerTracks.id))
      .where(eq(examEditions.sourcePolicy, "metadata_only"))
      .orderBy(desc(examEditions.examDate), desc(examEditions.id))
      .limit(60),
    Promise.all([
      db.select({ value: sql<number>`count(*)::int` }).from(legalActs).where(eq(legalActs.isActive, true)),
      db.select({ value: sql<number>`count(*)::int` }).from(legalSourceSnapshots).where(eq(legalSourceSnapshots.status, "pending_review")),
      db.select({ value: sql<number>`count(*) filter (where ${examSourcePortals.lastHttpStatus} between 200 and 399)::int` }).from(examSourcePortals),
      db.select({ value: sql<number>`count(*)::int` }).from(examEditions).where(eq(examEditions.sourcePolicy, "metadata_only")),
    ]),
  ]);

  return {
    laws,
    snapshots,
    portals,
    careers,
    exams,
    metrics: {
      monitoredLaws: metrics[0][0]?.value ?? 0,
      pendingSnapshots: metrics[1][0]?.value ?? 0,
      healthyPortals: metrics[2][0]?.value ?? 0,
      metadataExams: metrics[3][0]?.value ?? 0,
    },
  };
}

export type OfficialSourcesSnapshot = Awaited<ReturnType<typeof getOfficialSourcesSnapshot>>;
