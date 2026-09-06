import "server-only";
import { sql } from "drizzle-orm";
import type { getDb } from "../db/client";
import type { BindingAdminRow } from "./product-binding-admin";

/** Consulta somente leitura. O chamador deve exigir admin antes de acessar. */
export async function listProductBindingProposals(db: ReturnType<typeof getDb>, productSlug: string, page: number) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(productSlug) || productSlug.length > 160 ||
      !Number.isSafeInteger(page) || page < 1 || page > 10_000) throw new Error("Página ou produto inválido.");
  return db.execute<BindingAdminRow>(sql`
    select b.id as "bindingId", b.status,
      case when q.source_rights='original_authorial' then q.prompt else 'Conteúdo não autoral oculto' end as prompt,
      q.editorial_status as "questionStatus", o.public_id as "opportunityPublicId", o.title as "opportunityTitle",
      o.role_name as "roleName", e.public_id as "examEditionPublicId", e.title as "editionTitle", bank.name as "bankName",
      coalesce(p.opportunity_id=o.id,false) as "productAssociated", b.source_locator as "sourceLocator"
    from contest_product_question_bindings b
    join contest_store_products p on p.slug=b.product_slug
    join contest_opportunities o on o.id=b.opportunity_id
    join questions q on q.id=b.question_id
    left join exam_editions e on e.id=o.exam_edition_id
    left join quiz_banks bank on bank.id=e.bank_id
    where b.product_slug=${productSlug}
    order by (b.status='pending_review') desc, b.created_at desc, b.id
    limit 11 offset ${(page - 1) * 10}
  `);
}
