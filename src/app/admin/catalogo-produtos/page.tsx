import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { contestStoreProducts } from "@/lib/db/schema";
import {
  CONTEST_CATALOG,
  CONTEST_ACCESS_OPTIONS,
  catalogContestPath,
  contestTitle,
} from "@/lib/commerce/catalog";
import { contestCategories } from "@/lib/opportunities/categories";
import { CourseProductionCard } from "@/components/admin/course-production-card";
import courseResearch from "@/lib/editorial/course-source-research.json";
import {
  buildCourseProductionPlan,
  COURSE_PRODUCTION_NEXT_STEP_LABELS,
} from "@/lib/editorial/course-production-plan";
import { formatBRL, PLANS } from "@/lib/plans";
import {
  approvedProductQuestionCount,
  hasMinimumCourseQuestionCount,
  MINIMUM_COURSE_QUESTION_COUNT,
} from "@/lib/commerce/minimum-course-content";

export default async function ProductCatalogAdminPage() {
  await requireSuperAdmin("/admin/catalogo-produtos");
  const workorders = buildCourseProductionPlan(courseResearch);
  const orderBySlug = new Map(workorders.map((order) => [order.productSlug, order]));
  const products = await getDb().select({
    product: contestStoreProducts,
    validQuestionCount: approvedProductQuestionCount(
      contestStoreProducts.slug, contestStoreProducts.opportunityId,
    ),
  }).from(contestStoreProducts);
  const catalogSlugs = new Set(CONTEST_CATALOG.map((contest) => contest.slug));
  const productBySlug = new Map(products.map((row) => [row.product.slug, row]));
  const productsAtMinimum = products.filter((row) =>
    catalogSlugs.has(row.product.slug) && hasMinimumCourseQuestionCount(row.validQuestionCount),
  ).length;
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
        OPERAÇÃO COMERCIAL
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Catálogo de produtos
      </h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400">
        {CONTEST_CATALOG.length} concursos separados, oito carreiras, uma fonte
        de preços. Sincronizar preços não libera conteúdo nem abre vendas.
      </p>
      <p className="mt-3 text-sm text-amber-100">
        {productsAtMinimum} de {CONTEST_CATALOG.length} cursos com pelo menos{" "}
        {MINIMUM_COURSE_QUESTION_COUNT} questões válidas. Rascunhos, propostas
        pendentes e vínculos desatualizados não entram nessa contagem.
      </p>
      <section aria-labelledby="production-plan-title" className="mt-8 overflow-hidden rounded-2xl border border-amber-200/25 bg-[#171b1a]">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">CADERNO DE PRODUÇÃO · 75 CURSOS</p>
            <h2 id="production-plan-title" className="mt-3 font-serif text-3xl text-amber-50">Cada concurso, seu próprio percurso.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Fonte, edição, cargo, banca e programa individualizados. Este plano organiza
              a preparação; não representa questões geradas nem agentes executando em segundo plano.
              Consulte os detalhes de cada curso abaixo.
            </p>
          </div>
          <div className="border-l-2 border-amber-200/40 pl-5">
            <p className="text-5xl font-semibold tracking-tight text-amber-100">{(CONTEST_CATALOG.length * MINIMUM_COURSE_QUESTION_COUNT).toLocaleString("pt-BR")}</p>
            <p className="mt-2 max-w-48 text-xs leading-6 text-slate-400">vínculos válidos como piso total · 68 por curso, sem equivaler à cobertura integral de cada edital</p>
          </div>
        </div>
        <dl className="grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(COURSE_PRODUCTION_NEXT_STEP_LABELS).map(([step, label]) => (
            <div key={step} className="flex items-center justify-between gap-4 border-b border-r border-white/10 px-6 py-4">
              <dt className="text-xs leading-5 text-slate-300">{label}</dt>
              <dd className="text-2xl font-semibold text-amber-100">{workorders.filter((order) => order.nextStep === step).length}</dd>
            </div>
          ))}
        </dl>
        <p className="px-6 py-4 text-xs leading-6 text-slate-400">
          Pesquisa consolidada em {courseResearch.checkedAt.slice(0, 10)}. Edições históricas,
          programas ainda não lidos e fontes bloqueadas permanecem identificados. Não foi
          presumida uma nova abertura a partir de notícia, resultado ou homologação.
        </p>
      </section>
      <nav aria-label="Ir para carreira no caderno de produção" className="mt-6 flex flex-wrap gap-2">
        {contestCategories.map((category) => (
          <a key={category.slug} href={`#producao-${category.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-xs text-slate-200 hover:border-amber-200/50 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200">
            {category.name}
          </a>
        ))}
      </nav>
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/15 p-5">
          <h2 className="font-bold">Avulsos</h2>
          {CONTEST_ACCESS_OPTIONS.map((option) => (
            <p className="mt-3 text-sm text-slate-400" key={option.key}>
              {option.label}: {formatBRL(option.amountCents)}{option.billingLabel} · recorrente
            </p>
          ))}
        </div>
        <div className="rounded-2xl border border-white/15 p-5">
          <h2 className="font-bold">Master</h2>
          {PLANS.map((plan) => (
            <p className="mt-3 text-sm text-slate-400" key={plan.slug}>
              {formatBRL(plan.priceCents)}
              {plan.billingLabel} · recorrente
            </p>
          ))}
        </div>
        <div className="rounded-2xl border border-white/15 p-5">
          <h2 className="font-bold">Antes da liberação</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Vincular edição oficial, aprovar pelo menos {MINIMUM_COURSE_QUESTION_COUNT}{" "}
            questões distintas com aderência ao produto, conferir escopo editorial, validar preços
            Stripe e realizar compra de teste. Vendas fechadas até autorização.
          </p>
        </div>
      </div>
      {contestCategories.map((category) => (
        <section key={category.slug} id={`producao-${category.slug}`} className="mt-10 scroll-mt-28 md:scroll-mt-6">
          <h2 className="mb-5 text-2xl font-semibold">{category.name}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {CONTEST_CATALOG.filter(
              (item) => item.categorySlug === category.slug,
            ).map((contest) => {
              const row = productBySlug.get(contest.slug);
              const product = row?.product;
              const validQuestionCount = row?.validQuestionCount ?? 0;
              const missingQuestionCount = Math.max(0, MINIMUM_COURSE_QUESTION_COUNT - validQuestionCount);
              const order = orderBySlug.get(contest.slug)!;
              return (
                <article
                  key={contest.slug}
                  className="rounded-xl border border-white/15 p-5"
                >
                  <Link
                    href={catalogContestPath(contest)}
                    className="font-bold text-amber-100"
                  >
                    {contestTitle(contest)}
                  </Link>
                  <p className="mt-2 text-xs text-slate-400">
                    {contest.editionLabel} ·{" "}
                    {contest.jurisdictionCodes.join(" / ")}
                  </p>
                  <dl className="mt-4 space-y-2 text-xs">
                    <div>
                      <dt className="inline text-slate-500">Questões válidas: </dt>
                      <dd className="inline text-amber-100">
                        {validQuestionCount} / {MINIMUM_COURSE_QUESTION_COUNT}{" "}
                        — {missingQuestionCount > 0
                          ? `faltam ${missingQuestionCount} para o mínimo`
                          : "mínimo editorial atingido; demais liberações ainda necessárias"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-slate-500">Editorial: </dt>
                      <dd className="inline">{product?.status ?? "draft"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-slate-500">Stripe: </dt>
                      <dd className="inline">
                        {product?.stripeProductId ?? "Ainda não sincronizado"} ·{" "}
                        {product?.stripeMode ?? "teste planejado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-slate-500">
                        Preços mensal / anual:{" "}
                      </dt>
                      <dd className="inline break-all">
                        Mensal: {product?.stripePriceMonthly ?? "pendente"} /{" "}
                        Anual: {product?.stripePriceAnnual ?? "pendente"}
                      </dd>
                    </div>
                  </dl>
                  <CourseProductionCard order={order} />
                  <Link
                    href={`/checkout/concurso/${contest.slug}`}
                    className="mt-4 inline-flex min-h-11 items-center text-xs font-bold text-emerald-200"
                  >
                    Ver prévia do checkout
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
