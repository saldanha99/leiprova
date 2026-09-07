import { sql } from "drizzle-orm";
import { z } from "zod";
import { CONTEST_CATALOG, type CatalogContest } from "../commerce/catalog";
import { MINIMUM_COURSE_QUESTION_COUNT } from "../commerce/minimum-course-content";
import research from "./course-source-research.json";
import { courseResearchItemSchema } from "./course-production-plan";
import { AGENT_WORK_VERSION, validateDiscoveryUrl, workPayloadSchema, type AgentWorkPayload } from "./agent-work-contract";
import { enqueueAgentWork, type AgentDatabase } from "./agent-work-queue";

const productsSchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  opportunityId: z.number().int().positive().nullable(),
}).strict()).max(5000);
type IntakeProduct = z.infer<typeof productsSchema>[number];
type IntakeOrder = { key: string; payload: AgentWorkPayload; blockedReason: string | null };

/** Entrada por produto, sem usar a referência comercial de terceiros como fonte de edital. */
export function buildCourseIntakeOrders(
  input: readonly IntakeProduct[],
  catalog: readonly CatalogContest[] = CONTEST_CATALOG,
  references: unknown = research.items,
): IntakeOrder[] {
  const products = productsSchema.parse(input);
  const items = z.array(courseResearchItemSchema).max(5000).parse(references);
  if (new Set(products.map(item => item.slug)).size !== products.length ||
      new Set(catalog.map(item => item.slug)).size !== catalog.length ||
      new Set(items.map(item => item.productSlug)).size !== items.length) {
    throw new Error("Identidade duplicada na entrada editorial.");
  }
  const catalogBySlug = new Map(catalog.map(item => [item.slug, item]));
  const researchBySlug = new Map(items.map(item => [item.productSlug, item]));
  return products.filter(product => product.opportunityId === null).map(product => {
    const course = catalogBySlug.get(product.slug);
    const source = researchBySlug.get(product.slug);
    const sourceUrls = [...new Set((source?.officialUrls ?? []).flatMap(url => {
      try {
        const validated = validateDiscoveryUrl(url);
        // Suspensão observada no portal, sem contorno usando uma URL mais específica.
        if (new URL(validated).hostname === "www.vunesp.com.br") return [];
        return [validated];
      } catch { return []; }
    }))].slice(0, 30);
    const blockedReason = !course ? "course_identity_missing" : !source ? "course_research_missing" :
      !sourceUrls.length ? "course_official_source_unavailable" : null;
    const payload = workPayloadSchema.parse({
      version: AGENT_WORK_VERSION,
      title: course ? `Preparar curso — ${course.acronym} — ${course.role} — ${course.editionLabel}` : `Preparar curso — ${product.slug}`,
      instructions: "Analise somente o produto identificado neste pacote. Use agent-browser nas fontes oficiais permitidas: confirme órgão, cargo/especialidade, edição, UF, banca examinadora, edital e retificações, localizador do conteúdo programático e corte normativo. A banca citada na pesquisa ainda é uma hipótese, não confirmação. Registre evidência e lacunas; não copiar questões ou gabaritos, não acessar o concorrente, não contornar bloqueios. Para edição histórica, pré-edital ou identidade ambígua, explicar a decisão de escopo necessária sem mudar a oferta. Entregue propostas de descoberta para este produto; não aprovar, associar comercialmente ou publicar. Meta posterior: ao menos 68 questões compatíveis por curso, com perfil por banca E cargo, não distribuir todo o acervo em todos os produtos.",
      ...(course ? { role: course.role } : {}),
      articles: [], sourceUrls,
      context: {
        scope: "course_intake", productSlug: product.slug,
        minimumQuestionCount: MINIMUM_COURSE_QUESTION_COUNT,
        identity: course ? { institution: course.acronym, role: course.role, edition: course.editionLabel,
          category: course.categorySlug, jurisdictions: course.jurisdictionCodes } : null,
        researchStatus: source?.status ?? "missing",
        editionDescription: source?.editionDescription ?? null,
        bankCandidates: source?.bankNames ?? [],
        syllabusNotes: source?.syllabusNotes ?? null,
        requirementLocator: source?.requirementLocator ?? null,
        constraints: source?.constraints ?? ["Falta pesquisa oficial individualizada."],
        excludedSourceCount: (source?.officialUrls.length ?? 0) - sourceUrls.length,
        researchIsApproval: false, humanReviewRequired: true,
        nextStages: ["review_exact_product_edition", "capture_and_review_official_notice", "extract_syllabus",
          "map_versioned_law", "author_by_bank_and_role", "human_review", "approve_exact_product_bindings", "verify_minimum_68"],
      },
    });
    return { key: `course-intake:${product.slug}`, payload, blockedReason };
  });
}

/** Roda a cada ciclo: curso novo não fica invisível, nem vira aprovado por estar no catálogo. */
export async function prepareCourseIntake(db: AgentDatabase) {
  const products = await db.execute<IntakeProduct>(sql`
    select slug,opportunity_id::int as "opportunityId" from contest_store_products where status<>'retired' order by slug
  `);
  await db.execute(sql`update editorial_agent_work w set status='superseded',lease_token=null,lease_expires_at=null,
    last_error_code='course_scope_changed',updated_at=now()
    where w.kind='discovery' and w.payload->'context'->>'scope'='course_intake' and w.status in ('pending','running')
      and exists(select 1 from contest_store_products p where p.slug=w.payload->'context'->>'productSlug'
        and (p.opportunity_id is not null or p.status='retired'))`);
  const orders = buildCourseIntakeOrders(products);
  let enqueued = 0, blocked = 0;
  for (const order of orders) {
    if (!await enqueueAgentWork(db, order.key, "discovery", order.payload)) continue;
    enqueued++;
    if (order.blockedReason) {
      blocked++;
      await db.execute(sql`update editorial_agent_work set status='blocked',last_error_code=${order.blockedReason},
        result=${JSON.stringify({ schemaVersion: 1, publicationAllowed: false, outcome: "blocked",
          summary: "Preparação individual registrada; falta identidade ou fonte oficial permitida.",
          limitations: [order.blockedReason], evidence: [], mappings: [], discoveries: [], questions: [] })}::jsonb,
        updated_at=now() where job_key=${order.key} and status='pending'`);
    }
  }
  return { products: products.length, linked: products.length - orders.length, candidates: orders.length, enqueued, blocked };
}
