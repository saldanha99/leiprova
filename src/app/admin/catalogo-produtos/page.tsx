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
import { formatBRL, PLANS } from "@/lib/plans";
import {
  approvedProductQuestionCount,
  hasMinimumCourseQuestionCount,
  MINIMUM_COURSE_QUESTION_COUNT,
} from "@/lib/commerce/minimum-course-content";

export default async function ProductCatalogAdminPage() {
  await requireSuperAdmin("/admin/catalogo-produtos");
  const products = await getDb().select({
    product: contestStoreProducts,
    validQuestionCount: approvedProductQuestionCount(
      contestStoreProducts.slug, contestStoreProducts.opportunityId,
    ),
  }).from(contestStoreProducts);
  const catalogSlugs = new Set(CONTEST_CATALOG.map((contest) => contest.slug));
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
        <section key={category.slug} className="mt-10">
          <h2 className="mb-5 text-2xl font-semibold">{category.name}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {CONTEST_CATALOG.filter(
              (item) => item.categorySlug === category.slug,
            ).map((contest) => {
              const row = products.find((item) => item.product.slug === contest.slug);
              const product = row?.product;
              const validQuestionCount = row?.validQuestionCount ?? 0;
              const missingQuestionCount = Math.max(0, MINIMUM_COURSE_QUESTION_COUNT - validQuestionCount);
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
