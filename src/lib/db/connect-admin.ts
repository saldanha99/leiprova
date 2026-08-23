import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  stripeConnectPartners,
  stripeConnectSplitAllocations,
  stripeConnectSplitRules,
  stripeConnectTransferBatches,
  stripeConnectTransfers,
} from "@/lib/db/schema";

export async function getStripeConnectAdminSnapshot() {
  const db = getDb();

  const [partners, rules, allocations, batches, partnerSummary, batchSummary] = await Promise.all([
    db
      .select({
        id: stripeConnectPartners.id,
        publicId: stripeConnectPartners.publicId,
        displayName: stripeConnectPartners.displayName,
        legalName: stripeConnectPartners.legalName,
        email: stripeConnectPartners.email,
        country: stripeConnectPartners.country,
        currency: stripeConnectPartners.currency,
        stripeAccountId: stripeConnectPartners.stripeAccountId,
        status: stripeConnectPartners.status,
        detailsSubmitted: stripeConnectPartners.detailsSubmitted,
        chargesEnabled: stripeConnectPartners.chargesEnabled,
        payoutsEnabled: stripeConnectPartners.payoutsEnabled,
        requirementsCurrentlyDue: stripeConnectPartners.requirementsCurrentlyDue,
        requirementsPastDue: stripeConnectPartners.requirementsPastDue,
        updatedAt: stripeConnectPartners.updatedAt,
      })
      .from(stripeConnectPartners)
      .orderBy(desc(stripeConnectPartners.createdAt)),
    db
      .select({
        id: stripeConnectSplitRules.id,
        publicId: stripeConnectSplitRules.publicId,
        name: stripeConnectSplitRules.name,
        status: stripeConnectSplitRules.status,
        chargeModel: stripeConnectSplitRules.chargeModel,
        currency: stripeConnectSplitRules.currency,
        platformShareBps: stripeConnectSplitRules.platformShareBps,
        version: stripeConnectSplitRules.version,
        effectiveFrom: stripeConnectSplitRules.effectiveFrom,
        effectiveUntil: stripeConnectSplitRules.effectiveUntil,
        updatedAt: stripeConnectSplitRules.updatedAt,
      })
      .from(stripeConnectSplitRules)
      .orderBy(desc(stripeConnectSplitRules.createdAt)),
    db
      .select({
        ruleId: stripeConnectSplitAllocations.ruleId,
        partnerId: stripeConnectSplitAllocations.partnerId,
        partnerName: stripeConnectPartners.displayName,
        partnerStatus: stripeConnectPartners.status,
        stripeAccountId: stripeConnectPartners.stripeAccountId,
        detailsSubmitted: stripeConnectPartners.detailsSubmitted,
        payoutsEnabled: stripeConnectPartners.payoutsEnabled,
        shareBps: stripeConnectSplitAllocations.shareBps,
      })
      .from(stripeConnectSplitAllocations)
      .innerJoin(
        stripeConnectPartners,
        eq(stripeConnectSplitAllocations.partnerId, stripeConnectPartners.id),
      )
      .orderBy(stripeConnectSplitAllocations.ruleId, stripeConnectPartners.displayName),
    db
      .select({
        id: stripeConnectTransferBatches.id,
        status: stripeConnectTransferBatches.status,
        grossAmountCents: stripeConnectTransferBatches.grossAmountCents,
        platformAmountCents: stripeConnectTransferBatches.platformAmountCents,
        partnerAmountCents: stripeConnectTransferBatches.partnerAmountCents,
        currency: stripeConnectTransferBatches.currency,
        livemode: stripeConnectTransferBatches.livemode,
        failureMessage: stripeConnectTransferBatches.failureMessage,
        createdAt: stripeConnectTransferBatches.createdAt,
        completedAt: stripeConnectTransferBatches.completedAt,
      })
      .from(stripeConnectTransferBatches)
      .orderBy(desc(stripeConnectTransferBatches.createdAt))
      .limit(20),
    db
      .select({
        total: sql<number>`count(*)::int`,
        enabled: sql<number>`count(*) filter (where ${stripeConnectPartners.status} = 'enabled')::int`,
        onboarding: sql<number>`count(*) filter (where ${stripeConnectPartners.status} in ('onboarding', 'restricted'))::int`,
        payoutReady: sql<number>`count(*) filter (where ${stripeConnectPartners.payoutsEnabled})::int`,
      })
      .from(stripeConnectPartners),
    db
      .select({
        totalBatches: sql<number>`count(distinct ${stripeConnectTransferBatches.id})::int`,
        completedBatches: sql<number>`count(distinct ${stripeConnectTransferBatches.id}) filter (where ${stripeConnectTransferBatches.status} = 'completed')::int`,
        failedBatches: sql<number>`count(distinct ${stripeConnectTransferBatches.id}) filter (where ${stripeConnectTransferBatches.status} = 'failed')::int`,
        transferCount: sql<number>`count(${stripeConnectTransfers.id})::int`,
        transferredCents: sql<number>`coalesce(sum(${stripeConnectTransfers.amountCents}) filter (where ${stripeConnectTransfers.status} = 'succeeded'), 0)::bigint`,
      })
      .from(stripeConnectTransferBatches)
      .leftJoin(
        stripeConnectTransfers,
        eq(stripeConnectTransfers.batchId, stripeConnectTransferBatches.id),
      ),
  ]);

  return {
    generatedAt: new Date(),
    partners,
    rules: rules.map((rule) => ({
      ...rule,
      allocations: allocations.filter((allocation) => allocation.ruleId === rule.id),
    })),
    batches,
    summary: {
      partners: partnerSummary[0] ?? { total: 0, enabled: 0, onboarding: 0, payoutReady: 0 },
      transfers: batchSummary[0] ?? {
        totalBatches: 0,
        completedBatches: 0,
        failedBatches: 0,
        transferCount: 0,
        transferredCents: 0,
      },
    },
  };
}

export type StripeConnectAdminSnapshot = Awaited<ReturnType<typeof getStripeConnectAdminSnapshot>>;
