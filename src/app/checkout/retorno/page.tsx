import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { connection } from "next/server";

import { CheckoutUnavailable } from "@/components/checkout/checkout-unavailable";
import { ReturnStatus } from "@/components/checkout/return-status";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { requireUser } from "@/lib/auth";
import { getStripePortalConfiguration } from "@/lib/stripe";

const CHECKOUT_SESSION_PATTERN = /^cs_[A-Za-z0-9_]{8,240}$/;

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  await connection();
  if (!getStripePortalConfiguration()) return <CheckoutUnavailable />;

  const query = await searchParams;
  const sessionId = typeof query.session_id === "string" ? query.session_id : null;

  if (!sessionId || !CHECKOUT_SESSION_PATTERN.test(sessionId)) {
    return (
      <main className="min-h-screen bg-els-bg px-4 py-8 text-els-fg sm:px-6">
        <div className="mx-auto max-w-5xl">
          <LeiProvaMark href="/" />
          <section className="mx-auto mt-20 max-w-xl rounded-[1.75rem] border border-els-line bg-els-surface p-7 text-center shadow-2xl shadow-black/20 sm:p-10">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-els-danger/15 bg-els-danger/[.07] text-els-danger-ink">
              <AlertTriangle className="size-8" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">
              Retorno de pagamento inválido
            </h1>
            <p className="mt-3 text-sm leading-6 text-els-fg-3">
              Este endereço não contém uma sessão de pagamento válida. Nenhuma cobrança foi iniciada por esta página.
            </p>
            <Link
              href="/#planos"
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber"
            >
              Voltar aos planos
            </Link>
          </section>
        </div>
      </main>
    );
  }

  await requireUser(`/checkout/retorno?session_id=${encodeURIComponent(sessionId)}`);

  return (
    <main className="relative min-h-screen overflow-hidden bg-els-bg px-4 py-8 text-els-fg sm:px-6">
      <div className="pointer-events-none absolute -left-40 top-24 size-[34rem] rounded-full bg-els-green/[.055] blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-els-amber/[.06] blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <LeiProvaMark href="/" />
        <div className="mt-20">
          <ReturnStatus sessionId={sessionId} />
        </div>
      </div>
    </main>
  );
}
