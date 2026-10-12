import { randomUUID } from "node:crypto";

import { and, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import {
  auditLogs,
  legalActs,
  legalArticles,
  legalSourceSnapshots,
  legalTextSnapshots,
  legalVersions,
  users,
} from "../src/lib/db/schema";
import {
  fetchOfficialConsolidatedLegalText,
  fetchOfficialLegalDocument,
  type LegalTextProvider,
} from "../src/lib/official-sources/fetch";
import { getOfficialLegalSource } from "../src/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "../src/lib/official-sources/legal-text";
import { getPlanaltoConsolidatedSource } from "../src/lib/official-sources/planalto-text";
import { CAMARA_PROCUREMENT_REVIEW_LIMITATIONS, CAMARA_PROCUREMENT_SOURCE } from "../src/lib/official-sources/camara-procurement-text";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";

// Carrega uma lei do registro oficial na biblioteca, sob autorização registrada
// do proprietário: cria o ato, captura a fotografia de monitoramento e a
// compilação consolidada do Senado e ativa a versão com os artigos em texto
// oficial — os mesmos passos e registros de /admin/fontes-oficiais. A contagem
// de artigos do parser precisa bater com a da captura.
// Uso: tsx scripts/load-official-laws.ts [--apply] [--capture-only] lei=<slug> ...
// Planalto: somente --capture-only, sem aprovação ou ativação de corpus.
// Sem --apply, tudo roda numa transação desfeita ao final (prévia).

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function parseLawLoadArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  const captureOnly = args.includes("--capture-only");
  const providerArgs = args.filter((arg) => arg.startsWith("--provider="));
  if (providerArgs.length > 1) throw new Error("Informe somente um provedor de compilação.");
  const provider = providerArgs[0]?.slice("--provider=".length);
  if (provider !== undefined && !["camara", "planalto", "senado"].includes(provider)) throw new Error("Provedor de compilação inválido.");
  const slugs = args
    .filter((arg) => arg !== "--apply" && arg !== "--capture-only" && !arg.startsWith("--provider="))
    .map((arg) => {
      const [verb, slug, extra] = arg.split("=");
      if (verb !== "lei" || extra !== undefined || !SLUG.test(slug ?? "")) {
        throw new Error(`Argumento inválido: ${arg}. Use lei=<slug do registro>.`);
      }
      if (!getOfficialLegalSource(slug)) throw new Error(`Lei fora do registro oficial: ${slug}.`);
      return slug;
    });
  if (!slugs.length) throw new Error("Informe ao menos uma lei=<slug>.");
  if (new Set(slugs).size !== slugs.length) throw new Error("A mesma lei aparece mais de uma vez.");
  return { apply, captureOnly, slugs, ...(provider ? { provider: provider as LegalTextProvider } : {}) };
}

class PreviewRollback extends Error {}

async function main() {
  const { apply, captureOnly, slugs, provider } = parseLawLoadArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.LEGAL_LOAD_REFERENCE,
  });
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  const results: Record<string, unknown>[] = [];
  try {
    for (const slug of slugs) {
      const source = getOfficialLegalSource(slug)!;
      if (getPlanaltoConsolidatedSource(source.monitorUrl) && !captureOnly) {
        throw new Error("Compilações alternativas do Planalto/Câmara exigem --capture-only e revisão posterior no painel; a autorização da fábrica não aprova fontes.");
      }
      // Rede fora da transação: a fonte é conferida de novo a cada execução.
      const monitor = await fetchOfficialLegalDocument(source.monitorUrl);
      const captured = await fetchOfficialConsolidatedLegalText(source.monitorUrl, { provider });
      const articles = parseConsolidatedLegalArticles(captured.normalizedContent);
      if (articles.length !== captured.articleCount || !articles.length) {
        throw new Error(`Contagem de artigos divergente em ${slug}: ${articles.length} de ${captured.articleCount}.`);
      }

      try {
        const result = await db.transaction(async (transaction) => {
          const now = new Date();
          const operators = await transaction
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin"))
            .limit(2);
          if (operators.length !== 1 || operators[0].role !== "admin") {
            throw new Error("A carga exige exatamente um administrador identificado.");
          }
          const operatorId = operators[0].id;
          const notes = `Carregada sob autorização do proprietário (${reviewer.approvalReference}): compilação oficial do Senado, ${articles.length} artigos conferidos pelo parser.`;

          await transaction
            .insert(legalActs)
            .values({
              slug: source.slug,
              title: source.title,
              shortTitle: source.shortTitle,
              actType: source.actType,
              actNumber: source.actNumber,
              actYear: source.actYear,
              jurisdiction: "federal",
              urn: source.lexmlUrn,
              officialUrl: source.officialUrl,
            })
            .onConflictDoNothing({ target: legalActs.slug });
          const [act] = await transaction
            .select({ id: legalActs.id, urn: legalActs.urn, officialUrl: legalActs.officialUrl, isActive: legalActs.isActive })
            .from(legalActs)
            .where(eq(legalActs.slug, source.slug))
            .for("update");
          if (!act || act.urn !== source.lexmlUrn || act.officialUrl !== source.officialUrl || !act.isActive) {
            throw new Error(`O ato ${slug} no banco diverge do registro oficial.`);
          }

          const [monitorRow] = await transaction
            .insert(legalSourceSnapshots)
            .values({
              publicId: randomUUID(),
              legalActId: act.id,
              ...monitor,
              status: "pending_review",
              initiatedByUserId: operatorId,
              lastSeenAt: monitor.fetchedAt,
            })
            .onConflictDoUpdate({
              target: [legalSourceSnapshots.legalActId, legalSourceSnapshots.checksumSha256],
              set: { lastSeenAt: monitor.fetchedAt, httpStatus: monitor.httpStatus },
            })
            .returning({ id: legalSourceSnapshots.id, publicId: legalSourceSnapshots.publicId, status: legalSourceSnapshots.status });
          if (monitorRow.status === "pending_review" && !captureOnly) {
            await transaction
              .update(legalSourceSnapshots)
              .set({ status: "superseded" })
              .where(and(
                eq(legalSourceSnapshots.legalActId, act.id),
                eq(legalSourceSnapshots.status, "approved"),
                ne(legalSourceSnapshots.id, monitorRow.id),
              ));
            await transaction
              .update(legalSourceSnapshots)
              .set({ status: "approved", reviewedByUserId: operatorId, reviewNotes: notes, reviewedAt: now })
              .where(and(eq(legalSourceSnapshots.id, monitorRow.id), eq(legalSourceSnapshots.status, "pending_review")));
            await transaction.insert(auditLogs).values({
              actorUserId: operatorId,
              action: "editorial.legal_source.approved",
              entityType: "legal_source_snapshot",
              entityId: monitorRow.publicId,
              metadata: { notes, approvalMode: "owner_authorization", approvalReference: reviewer.approvalReference, executionSource: "server_cli", legalActSlug: slug },
            });
          } else if (monitorRow.status !== "approved" && (!captureOnly || monitorRow.status !== "pending_review")) {
            throw new Error(`A fotografia de ${slug} foi ${monitorRow.status} antes; exige nova revisão no painel.`);
          }

          const [textRow] = await transaction
            .insert(legalTextSnapshots)
            .values({
              publicId: randomUUID(),
              legalActId: act.id,
              monitorSnapshotId: monitorRow.id,
              ...captured,
              status: "pending_review",
              initiatedByUserId: operatorId,
              lastSeenAt: captured.fetchedAt,
            })
            .onConflictDoUpdate({
              target: [legalTextSnapshots.legalActId, legalTextSnapshots.checksumSha256],
              set: { lastSeenAt: captured.fetchedAt },
            })
            .returning({ id: legalTextSnapshots.id, publicId: legalTextSnapshots.publicId, status: legalTextSnapshots.status });
          if (textRow.status === "approved") {
            const summary = { slug, articles: articles.length, monitor: monitorRow.status, text: "unchanged" };
            if (!apply) throw new PreviewRollback(JSON.stringify(summary));
            return summary;
          }
          if (textRow.status !== "pending_review") {
            throw new Error(`A compilação de ${slug} foi ${textRow.status} antes; exige nova revisão no painel.`);
          }

          if (captureOnly) {
            await transaction.insert(auditLogs).values({
              actorUserId: operatorId,
              action: "editorial.legal_text.captured",
              entityType: "legal_text_snapshot",
              entityId: textRow.publicId,
              metadata: { legalActSlug: slug, sourceUrl: captured.sourceUrl, checksum: captured.checksumSha256, articleCount: articles.length, parserVersion: captured.parserVersion, status: "pending_review", executionSource: "server_cli", captureReference: reviewer.approvalReference, humanReview: false, ...(captured.sourceUrl === CAMARA_PROCUREMENT_SOURCE.url ? { reviewLimitations: CAMARA_PROCUREMENT_REVIEW_LIMITATIONS, monetaryDependencyArticlePaths: ["art-6", "art-37", "art-70", "art-75", "art-95", "art-184-a"], judicialDependencyArticlePaths: ["art-75"], vetoReconciliationRequired: true } : {}) },
            });
            const summary = { slug, articles: articles.length, monitor: monitorRow.status, text: "pending_review", versionsActivated: 0 };
            if (!apply) throw new PreviewRollback(JSON.stringify(summary));
            return summary;
          }

          await transaction
            .update(legalTextSnapshots)
            .set({ status: "superseded", updatedAt: now })
            .where(and(
              eq(legalTextSnapshots.legalActId, act.id),
              eq(legalTextSnapshots.status, "approved"),
              ne(legalTextSnapshots.id, textRow.id),
            ));
          await transaction
            .update(legalVersions)
            .set({ status: "superseded" })
            .where(and(eq(legalVersions.legalActId, act.id), eq(legalVersions.status, "current")));
          const [version] = await transaction
            .insert(legalVersions)
            .values({
              legalActId: act.id,
              sourceUrl: captured.sourceUrl,
              checksumSha256: captured.checksumSha256,
              verifiedAt: captured.fetchedAt,
              status: "current",
            })
            .onConflictDoUpdate({
              target: [legalVersions.legalActId, legalVersions.checksumSha256],
              set: { sourceUrl: captured.sourceUrl, verifiedAt: captured.fetchedAt, status: "current" },
            })
            .returning({ id: legalVersions.id });
          for (let offset = 0; offset < articles.length; offset += 250) {
            await transaction
              .insert(legalArticles)
              .values(
                articles.slice(offset, offset + 250).map((article) => ({
                  legalVersionId: version.id,
                  articleRef: article.articleRef,
                  articleOrder: article.articleOrder,
                  heading: article.heading,
                  path: article.path,
                  literalText: article.literalText,
                  editorialStatus: "reviewed" as const,
                  sourceRights: "official_text" as const,
                })),
              )
              .onConflictDoUpdate({
                target: [legalArticles.legalVersionId, legalArticles.path],
                set: {
                  articleRef: sql`excluded.article_ref`,
                  articleOrder: sql`excluded.article_order`,
                  heading: sql`excluded.heading`,
                  literalText: sql`excluded.literal_text`,
                  editorialStatus: "reviewed",
                  sourceRights: "official_text",
                  updatedAt: now,
                },
              });
          }
          await transaction
            .update(legalTextSnapshots)
            .set({ status: "approved", reviewedByUserId: operatorId, reviewedAt: now, reviewNotes: notes, updatedAt: now })
            .where(and(eq(legalTextSnapshots.id, textRow.id), eq(legalTextSnapshots.status, "pending_review")));
          await transaction.insert(auditLogs).values({
            actorUserId: operatorId,
            action: "editorial.legal_text.approved",
            entityType: "legal_text_snapshot",
            entityId: textRow.publicId,
            metadata: {
              notes,
              articleCount: articles.length,
              checksum: captured.checksumSha256,
              approvalMode: "owner_authorization",
              approvalReference: reviewer.approvalReference,
              executionSource: "server_cli",
              legalActSlug: slug,
            },
          });
          const summary = { slug, articles: articles.length, monitor: "approved", text: "approved" };
          if (!apply) throw new PreviewRollback(JSON.stringify(summary));
          return summary;
        }, { isolationLevel: "serializable" });
        results.push({ mode: "applied", ...result });
      } catch (error) {
        if (!(error instanceof PreviewRollback)) throw error;
        results.push({ mode: "preview", ...JSON.parse(error.message) });
      }
    }
    console.log(JSON.stringify({ approvalReference: reviewer.approvalReference, questionsApproved: 0, results }, null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam `parseLawLoadArgs` sem banco.
if (process.argv[1]?.endsWith("load-official-laws.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha na carga das leis.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
