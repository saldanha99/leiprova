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

export default async function ProductCatalogAdminPage() {
  await requireSuperAdmin("/admin/catalogo-produtos");
  const products = await getDb().select().from(contestStoreProducts);
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
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/15 p-5">
          <h2 className="font-bold">Avulsos</h2>
          {CONTEST_ACCESS_OPTIONS.map((option) => (
            <p className="mt-3 text-sm text-slate-400" key={option.key}>
              {option.months} meses: {formatBRL(option.amountCents)} · único
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
            Vincular edição oficial, conferir escopo editorial, validar preços
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
              const product = products.find(
                (item) => item.slug === contest.slug,
              );
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
                        Preço 6 / 12 meses:{" "}
                      </dt>
                      <dd className="inline break-all">
                        {product?.stripePrice6m ?? "pendente"} /{" "}
                        {product?.stripePrice12m ?? "pendente"}
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
