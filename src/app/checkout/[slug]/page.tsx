import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CreditCard,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { CheckoutClient } from "@/components/checkout/checkout-client";
import { CheckoutUnavailable } from "@/components/checkout/checkout-unavailable";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { requireUser } from "@/lib/auth";
import { formatBRL, getMonthlyEquivalentCents, getPlan } from "@/lib/plans";
import { getCheckoutAvailability } from "@/lib/stripe";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const plan = getPlan(slug);
  if (!plan) return <CheckoutUnavailable invalidPlan />;

  const availability = getCheckoutAvailability(plan);
  if (!availability.available) return <CheckoutUnavailable />;

  const user = await requireUser(`/checkout/${plan.slug}`);
  const price = formatBRL(plan.priceCents);
  const isAnnual = plan.slug === "foco";
  const monthlyEquivalent = formatBRL(getMonthlyEquivalentCents(plan));
  const buttonLabel = `Assinar por ${price}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b12] px-4 py-5 text-white sm:px-6 lg:py-8">
      <div className="pointer-events-none absolute -left-40 top-24 size-[34rem] rounded-full bg-emerald-400/[.055] blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-amber-300/[.06] blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <LeiProvaMark href="/" />
          <Link
            href="/#planos"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Alterar plano
          </Link>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:mt-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-10">
          <aside className="lg:sticky lg:top-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.07] px-3 py-1.5 text-xs font-bold uppercase tracking-[.13em] text-amber-200">
              <Sparkles className="size-3.5" aria-hidden="true" /> Seu próximo
              ciclo
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">
              Finalize com segurança
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              Você está a um passo de transformar leitura de lei seca em treino
              ativo, revisão e memória de longo prazo.
            </p>

            <section className="mt-7 overflow-hidden rounded-[1.6rem] border border-amber-300/15 bg-[linear-gradient(145deg,#111b28_0%,#091723_60%,#0b201c_100%)] p-6 shadow-2xl shadow-black/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.13em] text-emerald-300">
                    Plano escolhido
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">
                    {plan.name}
                  </h2>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
                  <BadgeCheck className="size-5" aria-hidden="true" />
                </span>
              </div>

              {isAnnual ? (
                <div className="mt-6 border-b border-white/8 pb-6">
                  <p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">
                    Equivalente a
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="pb-1 text-sm font-semibold text-amber-200">
                      por mês
                    </span>
                    <strong className="text-3xl tracking-[-.045em] text-amber-200">
                      {monthlyEquivalent}
                    </strong>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {price} cobrados a cada 12 meses. Equivalência mensal; não é
                    parcelamento.
                  </p>
                </div>
              ) : (
                <div className="mt-6 flex items-end gap-2 border-b border-white/8 pb-6">
                  <strong className="text-3xl tracking-[-.045em]">
                    {price}
                  </strong>
                  <span className="pb-1 text-sm text-slate-500">
                    {plan.billingLabel}
                  </span>
                </div>
              )}

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm leading-5 text-slate-300"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-emerald-300">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-300">
                <CreditCard className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Compra vinculada a</p>
                <p className="truncate text-sm font-medium text-slate-200">
                  {user.email}
                </p>
              </div>
            </div>
          </aside>

          <section className="rounded-[1.75rem] border border-white/9 bg-[#08131f]/95 p-5 shadow-2xl shadow-black/25 backdrop-blur sm:p-7 lg:p-8">
            <div className="mb-6 flex items-start gap-3 border-b border-white/8 pb-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-300">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-[-.025em]">
                  Forma de pagamento
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  A Stripe mostra apenas os métodos habilitados e compatíveis
                  com este plano.
                </p>
              </div>
            </div>

            <CheckoutClient
              planSlug={plan.slug}
              publishableKey={availability.publishableKey}
              buttonLabel={buttonLabel}
            />

            <p className="mt-6 border-t border-white/8 pt-5 text-center text-[11px] leading-5 text-slate-600">
              Ao continuar, você concorda com os termos da oferta e com a
              política de privacidade. A renovação ocorre no período indicado
              até o cancelamento.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
