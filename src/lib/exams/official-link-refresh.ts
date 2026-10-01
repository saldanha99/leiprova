import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { auditLogs } from "@/lib/db/schema";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";

type Database = PostgresJsDatabase<typeof schema>;
type Verify = typeof verifyOfficialExamUrl;

/** Reconfere bem antes dos 30 dias que mantêm o link vendável e visível. */
export const OFFICIAL_LINK_REFRESH_AFTER_DAYS = 7;
const MAX_LINKS_PER_RUN = 24;

type LinkKind = "edition" | "document";

type DueLink = {
  kind: LinkKind;
  id: string;
  publicId: string;
  bankSlug: string;
  url: string;
};

export type LinkCheckFailure = Readonly<{
  kind: LinkKind;
  publicId: string;
  reason: string;
}>;

/** A página da edição só precisa responder; o documento precisa continuar sendo
 * o mesmo PDF no mesmo endereço, como na aprovação. Retorna o motivo da recusa. */
export function officialLinkFailureReason(
  kind: LinkKind,
  checked: Readonly<{ httpStatus: number; finalUrl: string; isPdf: boolean }>,
  url: string,
) {
  if (checked.httpStatus < 200 || checked.httpStatus > 399) {
    return `http_${checked.httpStatus}`;
  }
  if (kind === "document") {
    if (checked.finalUrl !== url) return "redirected";
    if (!checked.isPdf) return "not_pdf";
  }
  return null;
}

/** Só o que sustenta a página e a venda: edições e documentos de vínculos de
 * prova anterior aprovados. Link que falhar não é renovado e, ao passar dos 30
 * dias, fecha a venda sozinho; a falha fica auditada para revisão. */
export async function refreshApprovedOfficialExamLinks(
  db: Database,
  actorUserId: number,
  verify: Verify = verifyOfficialExamUrl,
) {
  const due = await db.execute<DueLink>(sql`
    select kind, id, "publicId", "bankSlug", url from (
      select 'edition' as kind,
        edition.id::text as id,
        edition.public_id as "publicId",
        bank.slug as "bankSlug",
        edition.official_url as url,
        edition.source_checked_at as checked_at
      from exam_editions edition
      join quiz_banks bank on bank.id = edition.bank_id
      where edition.official_url is not null
        and exists (
          select 1 from contest_product_exam_references reference
          where reference.exam_edition_id = edition.id and reference.status = 'approved'
        )
        and (edition.source_checked_at is null
          or edition.source_checked_at < now() - make_interval(days => ${OFFICIAL_LINK_REFRESH_AFTER_DAYS}))
      union all
      select 'document',
        document.id::text,
        document.public_id,
        bank.slug,
        document.source_url,
        document.source_checked_at
      from exam_edition_documents document
      join exam_editions edition on edition.id = document.exam_edition_id
      join quiz_banks bank on bank.id = edition.bank_id
      where document.status = 'approved'
        and exists (
          select 1 from contest_product_exam_references reference
          where reference.status = 'approved'
            and (reference.primary_document_id = document.id
              or reference.answer_key_document_id = document.id)
        )
        and document.source_checked_at < now() - make_interval(days => ${OFFICIAL_LINK_REFRESH_AFTER_DAYS})
    ) due_links
    order by checked_at nulls first, id
    limit ${MAX_LINKS_PER_RUN}
  `);

  const failures: LinkCheckFailure[] = [];
  let refreshed = 0;
  for (const link of due) {
    let checked: Awaited<ReturnType<Verify>>;
    try {
      checked = await verify(link.bankSlug, link.url);
    } catch {
      failures.push({ kind: link.kind, publicId: link.publicId, reason: "unreachable" });
      continue;
    }
    const reason = officialLinkFailureReason(link.kind, checked, link.url);
    if (reason) {
      failures.push({ kind: link.kind, publicId: link.publicId, reason });
      continue;
    }
    const checkedAt = checked.checkedAt.toISOString();
    if (link.kind === "edition") {
      await db.execute(sql`
        update exam_editions
        set source_checked_at = ${checkedAt}::timestamptz,
          updated_by_user_id = ${actorUserId}, updated_at = now()
        where id = ${link.id}::bigint and official_url = ${link.url}
      `);
    } else {
      await db.execute(sql`
        update exam_edition_documents
        set source_checked_at = ${checkedAt}::timestamptz,
          http_status = ${checked.httpStatus}, updated_at = now()
        where id = ${link.id}::bigint and status = 'approved' and source_url = ${link.url}
      `);
    }
    refreshed += 1;
  }

  if (failures.length) {
    await db.insert(auditLogs).values({
      actorUserId,
      action: "automation.exam_link.check_failed",
      entityType: "exam_link_refresh",
      metadata: { failures },
    });
  }
  return { checked: due.length, refreshed, failures };
}
