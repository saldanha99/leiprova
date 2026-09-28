import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { auditLogs } from "@/lib/db/schema";

type Database = PostgresJsDatabase<typeof schema>;

/** Fases que ainda aguardam a prova e podem virar "prova realizada" pela data oficial. */
export const EXAM_PENDING_LIFECYCLE_STATUSES = [
  "notice_published",
  "registration_open",
  "registration_closed",
  "exam_scheduled",
] as const;

export type LifecycleTransition = Readonly<{
  to: "registration_closed" | "exam_held";
  basis: "registration_ends_at" | "exam_date";
}>;

type LifecycleDates = Readonly<{
  lifecycleStatus: string;
  registrationEndsAt: string | null;
  examDate: string | null;
}>;

/** Avanço determinado só pelas datas oficiais já revisadas; nunca inventa etapa.
 * A prova já realizada prevalece sobre o fim das inscrições. */
export function dateDrivenLifecycleTransition(
  opportunity: LifecycleDates,
  todayIso: string,
): LifecycleTransition | null {
  if (
    opportunity.examDate &&
    opportunity.examDate < todayIso &&
    (EXAM_PENDING_LIFECYCLE_STATUSES as readonly string[]).includes(
      opportunity.lifecycleStatus,
    )
  ) {
    return { to: "exam_held", basis: "exam_date" };
  }
  if (
    opportunity.lifecycleStatus === "registration_open" &&
    opportunity.registrationEndsAt &&
    opportunity.registrationEndsAt < todayIso
  ) {
    return { to: "registration_closed", basis: "registration_ends_at" };
  }
  return null;
}

type AdvancedOpportunity = {
  publicId: string;
  slug: string;
  fromStatus: string;
  toStatus: "registration_closed" | "exam_held";
  statusAsOf: string;
};

/** Aplica o avanço aos editais revisados. "Hoje" vem do próprio banco, em
 * America/Sao_Paulo, a mesma data que a trava da migração 0043 usa para aceitar
 * a mudança; assim o relógio do worker não decide sozinho. */
export async function advanceOpportunityLifecycles(
  db: Database,
  actorUserId: number,
) {
  const pendingStatuses = sql.join(
    EXAM_PENDING_LIFECYCLE_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );
  return db.transaction(async (transaction) => {
    const rows = await transaction.execute<AdvancedOpportunity>(sql`
      with today as (
        select (now() at time zone 'America/Sao_Paulo')::date as value
      ), due as (
        select opportunity.id,
          opportunity.lifecycle_status as from_status,
          case
            when opportunity.exam_date < today.value
              and opportunity.lifecycle_status in (${pendingStatuses})
              then 'exam_held'
            else 'registration_closed'
          end as to_status
        from contest_opportunities opportunity
        cross join today
        where opportunity.editorial_status = 'reviewed'
          and (
            (opportunity.exam_date < today.value
              and opportunity.lifecycle_status in (${pendingStatuses}))
            or (opportunity.lifecycle_status = 'registration_open'
              and opportunity.registration_ends_at < today.value)
          )
        for update of opportunity
      )
      update contest_opportunities opportunity
      set lifecycle_status = due.to_status,
        status_as_of = today.value,
        updated_by_user_id = ${actorUserId},
        updated_at = now()
      from due, today
      where opportunity.id = due.id
      returning opportunity.public_id as "publicId",
        opportunity.slug,
        due.from_status as "fromStatus",
        due.to_status as "toStatus",
        today.value::text as "statusAsOf"
    `);

    const transitions = [...rows];
    for (const row of transitions) {
      await transaction.insert(auditLogs).values({
        actorUserId,
        action: "automation.opportunity.lifecycle_advanced",
        entityType: "contest_opportunity",
        entityId: row.publicId,
        metadata: {
          slug: row.slug,
          from: row.fromStatus,
          to: row.toStatus,
          basis: row.toStatus === "exam_held" ? "exam_date" : "registration_ends_at",
          statusAsOf: row.statusAsOf,
          reviewedDatesOnly: true,
        },
      });
    }
    return {
      advanced: transitions.length,
      transitions: transitions.map(({ slug, fromStatus, toStatus }) => ({
        slug,
        from: fromStatus,
        to: toStatus,
      })),
    };
  });
}
