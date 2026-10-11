import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { productBindingPackageSchema } from "../src/lib/commerce/product-binding-policy";
import { requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";

// Monta o pacote de PROPOSTAS de vínculo (questão revisada ↔ requisito do edital)
// a partir das questões que o Autor escreveu para cada requisito, registradas na
// auditoria "automation.agent.prepared". Só lê o banco: imprime o JSON que o
// importador (editorial:bindings:import) recebe como pendente. Aprovar continua
// sendo revisão humana em /admin/catalogo-produtos/<produto>/vinculos.
// Uso: tsx scripts/propose-product-bindings.ts --product=<slug>

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_LEGAL_QUOTE = 12_000;
const MAX_ITEMS = 250;

export type AuthoredQuestion = Readonly<{
  requirementId: number;
  requirementText: string;
  requirementLocator: string;
  requirementArticleId: number | null;
  opportunityPublicId: string;
  opportunitySlug: string;
  questionPublicId: string;
  legalArticleId: number;
  articleRef: string;
  act: string;
  literalText: string;
}>;

export function parseProposeArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const product = args.length === 1 ? /^--product=(.+)$/u.exec(args[0])?.[1] : undefined;
  if (!product || !SLUG.test(product)) throw new Error("Use --product=<slug do produto>.");
  return { productSlug: product };
}

/** Um requisito aceita um único artigo (revisão de requisito exige unanimidade):
 * vale o artigo já mapeado no requisito ou, sem mapeamento, o que reúne mais
 * questões revisadas; empate fica com o menor id, para o pacote ser estável. */
export function selectBindableQuestions(rows: readonly AuthoredQuestion[]) {
  const byRequirement = new Map<number, AuthoredQuestion[]>();
  for (const row of rows) byRequirement.set(row.requirementId, [...(byRequirement.get(row.requirementId) ?? []), row]);
  const selected: AuthoredQuestion[] = [];
  for (const [, items] of [...byRequirement].sort(([left], [right]) => left - right)) {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(item.legalArticleId, (counts.get(item.legalArticleId) ?? 0) + 1);
    const article = items[0].requirementArticleId ??
      [...counts].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0][0];
    selected.push(
      ...items
        .filter((item) => item.legalArticleId === article)
        .sort((left, right) => left.questionPublicId.localeCompare(right.questionPublicId)),
    );
  }
  return selected;
}

export function buildProposalPackage(productSlug: string, rows: readonly AuthoredQuestion[]) {
  const items = selectBindableQuestions(rows).slice(0, MAX_ITEMS).map((row) => ({
    productSlug,
    opportunityPublicId: row.opportunityPublicId,
    requirementId: row.requirementId,
    questionPublicId: row.questionPublicId,
    requirementQuote: row.requirementText,
    // Prefixo do texto oficial continua sendo citação literal do artigo.
    legalQuote: row.literalText.slice(0, MAX_LEGAL_QUOTE),
    scopeNotes:
      `Questão inédita do Autor, já revisada, sobre ${row.act} — ${row.articleRef}, escrita para o item ` +
      `"${row.requirementLocator}" do programa (${row.opportunitySlug}). Cobre a literalidade desse artigo; ` +
      "não cobre os demais temas do item. Vínculo pendente de revisão humana de aderência.",
  }));
  return productBindingPackageSchema.parse({ schemaVersion: 1, items });
}

async function main() {
  const { productSlug } = parseProposeArgs(process.argv.slice(2));
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  try {
    const rows = await db.transaction(async (transaction) => {
      await transaction.execute(sql`set transaction read only`);
      return transaction.execute<AuthoredQuestion>(sql`
        with authored as (
          select split_part(audit.entity_id, ':', 2)::bigint as requirement_id,
            jsonb_array_elements_text(audit.metadata->'importedQuestionPublicIds') as question_public_id
          from audit_logs audit
          where audit.action = 'automation.agent.prepared' and audit.entity_id ~ '^author:[0-9]{1,18}$'
        )
        select distinct requirement.id::int as "requirementId",
          requirement.requirement_text as "requirementText",
          requirement.source_locator as "requirementLocator",
          requirement.legal_article_id::int as "requirementArticleId",
          opportunity.public_id as "opportunityPublicId",
          opportunity.slug as "opportunitySlug",
          question.public_id as "questionPublicId",
          question.legal_article_id::int as "legalArticleId",
          article.article_ref as "articleRef",
          act.short_title as act,
          article.literal_text as "literalText"
        from contest_store_products product
        join contest_opportunities opportunity on opportunity.id = product.opportunity_id
        join opportunity_requirements requirement on requirement.opportunity_id = opportunity.id
        join authored on authored.requirement_id = requirement.id
        join questions question on question.public_id = authored.question_public_id
        join legal_articles article on article.id = question.legal_article_id
        join legal_versions version on version.id = article.legal_version_id and version.status = 'current'
        join legal_acts act on act.id = version.legal_act_id and act.is_active
        where product.slug = ${productSlug}
          and question.editorial_status = 'reviewed'
          and requirement.editorial_status <> 'suspended'
          and not exists (
            select 1 from contest_product_question_bindings binding
            where binding.product_slug = product.slug and binding.question_id = question.id
              and binding.requirement_id = requirement.id and binding.status in ('pending_review', 'approved')
          )
      `);
    });
    if (!rows.length) {
      console.error(`Nenhuma questão revisada do Autor sem vínculo para ${productSlug}.`);
      process.exitCode = 3;
      return;
    }
    console.log(JSON.stringify(buildProposalPackage(productSlug, rows), null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam as funções sem banco.
if (process.argv[1]?.endsWith("propose-product-bindings.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha ao montar as propostas.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
