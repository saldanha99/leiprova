import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import * as schema from "../src/lib/db/schema";
import {
  reviewProductQuestionBindings,
} from "../src/lib/commerce/product-binding-review-service";
import { ProductBindingReviewError } from "../src/lib/commerce/product-binding-review-policy";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256 = /^[a-f0-9]{64}$/u;

function parseArguments(arguments_: readonly string[]) {
  const values = new Map<string, string>();
  for (const argument of arguments_) {
    const match = /^--(product|opportunity|actor|mode|fingerprint|reference)=(.+)$/u.exec(argument);
    if (!match || values.has(match[1])) {
      throw new ProductBindingReviewError(
        "Use --product=SLUG --opportunity=SLUG --actor=UUID --reference=REF --mode=preview|apply; apply exige --fingerprint=SHA256.",
      );
    }
    values.set(match[1], match[2]);
  }
  const mode = values.get("mode") ?? "preview";
  const expectedFingerprint = values.get("fingerprint");
  if (mode !== "preview" && mode !== "apply") throw new ProductBindingReviewError("Modo inválido.");
  if ((mode === "apply" && !sha256.test(expectedFingerprint ?? "")) ||
      (mode === "preview" && expectedFingerprint !== undefined)) {
    throw new ProductBindingReviewError("A aplicação exige a impressão SHA256 da prévia.");
  }
  return {
    actorPublicId: z.uuid().parse(values.get("actor")), expectedFingerprint, mode,
    opportunitySlug: slug.parse(values.get("opportunity")), productSlug: slug.parse(values.get("product")),
    reference: z.string().trim().min(10).max(250).parse(values.get("reference")),
  } as const;
}

function requireTarget(productSlug: string) {
  const connectionString = process.env.LEIPROVA_BINDING_REVIEW_DATABASE_URL;
  if (!connectionString) throw new ProductBindingReviewError("Defina LEIPROVA_BINDING_REVIEW_DATABASE_URL.");
  const target = new URL(connectionString);
  const production = process.env.NODE_ENV === "production" && process.env.APP_URL === "https://leiprova.2b.app.br" &&
    process.env.LEIPROVA_BINDING_REVIEW_APPROVED === `review-bindings:${productSlug}` &&
    ["leiprova-pooler", "pooler"].includes(target.hostname) && (!target.port || target.port === "5432") &&
    target.pathname === "/leiprova" && target.username === "leiprova_app";
  const local = target.hostname === "127.0.0.1" && target.pathname === "/leiprova_binding_test";
  if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash || (!production && !local)) {
    throw new ProductBindingReviewError("Destino de revisão de vínculos não permitido.");
  }
  return { connectionString, database: target.pathname.slice(1), production };
}

function operationFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const target = requireTarget(args.productSlug);
  const client = postgres(target.connectionString, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const db = drizzle(client, { schema });
    const [identity] = await db.execute<{ name: string; role: string; superuser: boolean }>(sql`
      select current_database() name,current_user role,(select rolsuper from pg_roles where rolname=current_user) superuser
    `);
    if (!identity || identity.name !== target.database || (target.production && (identity.role !== "leiprova_app" || identity.superuser))) {
      throw new ProductBindingReviewError("Identidade do banco não autorizada.");
    }
    const [scope] = await db.execute<{ opportunityPublicId: string; examEditionPublicId: string }>(sql`
      select opportunity.public_id as "opportunityPublicId",edition.public_id as "examEditionPublicId"
      from contest_store_products product join contest_opportunities opportunity on opportunity.id=product.opportunity_id
      join exam_editions edition on edition.id=opportunity.exam_edition_id
      where product.slug=${args.productSlug} and opportunity.slug=${args.opportunitySlug}
        and product.status='draft' and opportunity.editorial_status='reviewed'
    `);
    if (!scope) throw new ProductBindingReviewError("Produto, oportunidade ou edição não corresponde ao escopo revisado.");
    const rows = await db.execute<{ id: string }>(sql`
      select id from (
        select binding.id,binding.question_id,
          row_number() over(partition by binding.question_id order by binding.created_at desc,binding.id desc) ordinal
        from contest_product_question_bindings binding
        join questions question on question.id=binding.question_id
        join opportunity_requirements requirement on requirement.id=binding.requirement_id
        join opportunity_source_documents source on source.id=binding.source_document_id
        left join opportunity_document_snapshots snapshot on snapshot.id=binding.source_snapshot_id
        join contest_opportunities opportunity on opportunity.id=binding.opportunity_id
        where binding.product_slug=${args.productSlug} and opportunity.slug=${args.opportunitySlug}
          and binding.status='pending_review'
          and question.editorial_status='reviewed' and requirement.editorial_status='reviewed'
          and source.status='approved' and (binding.source_snapshot_id is null or snapshot.status='approved')
          and date_trunc('milliseconds',question.updated_at)=date_trunc('milliseconds',binding.question_updated_at)
      ) current_binding where ordinal=1 order by id
    `);
    if (!rows.length || rows.length > 250) throw new ProductBindingReviewError("Nenhum conjunto atual e revisável de vínculos foi encontrado.");
    const notes = `Aderência ao produto, edição, programa e questões confirmada pelo proprietário. Referência: ${args.reference}`;
    const input = {
      schemaVersion: 1 as const, productSlug: args.productSlug, opportunityPublicId: scope.opportunityPublicId,
      examEditionPublicId: scope.examEditionPublicId, bindingIds: rows.map((row) => row.id), notes,
      decision: "approve" as const, confirmations: { edition: true, program: true, adherence: true },
    };
    const preview = await reviewProductQuestionBindings(db, { input, actorPublicId: args.actorPublicId, mode: "preview" });
    if (preview.eligible !== preview.total || !preview.reviewerAllowed || preview.requiresOwnerOverride) {
      throw new ProductBindingReviewError(
        `O conjunto não pode ser decidido: elegíveis ${preview.eligible}/${preview.total}; ` +
        `revisor autorizado=${preview.reviewerAllowed}; exceção proprietária exigida=${preview.requiresOwnerOverride}.`,
      );
    }
    const fingerprint = operationFingerprint({ version: "current-product-bindings-review-v1", reference: args.reference,
      actorPublicId: args.actorPublicId, input, reviewFingerprint: preview.fingerprint });
    if (args.mode === "preview") {
      console.log(JSON.stringify({ mode: "preview", database: identity.name, fingerprint, total: preview.total,
        eligible: preview.eligible, bindingIds: input.bindingIds, productReleased: false, checkoutEnabled: false }, null, 2));
      return;
    }
    if (args.expectedFingerprint !== fingerprint) throw new ProductBindingReviewError("Dossiê ou contexto mudou; confira uma nova prévia.");
    const result = await reviewProductQuestionBindings(db, { input, actorPublicId: args.actorPublicId,
      mode: "apply", expectedFingerprint: preview.fingerprint });
    console.log(JSON.stringify({ database: identity.name, ...result, operationFingerprint: fingerprint }, null, 2));
  } finally { await client.end(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message.slice(0, 500) : "Falha sem detalhe seguro; nenhum vínculo foi aprovado.");
  process.exitCode = 1;
});
