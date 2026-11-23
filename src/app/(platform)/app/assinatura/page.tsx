import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";

import { PortalButton } from "@/components/checkout/portal-button";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/db/queries";

export default async function SubscriptionPage() {
  const user = await requireUser("/app/assinatura");
  const { plan } = await getDashboardSnapshot(user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader eyebrow="Conta e cobrança" title="Assinatura" description="Consulte seu acesso e use o portal seguro da Stripe para gerenciar pagamento, faturas e cancelamento." icon={CreditCard} />
      <section className="mt-8 rounded-[1.75rem] border border-els-line bg-els-surface p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs uppercase tracking-[.14em] text-els-fg-3">Plano atual</p><h2 className="mt-2 text-2xl font-semibold">{plan?.name ?? "Acesso gratuito"}</h2><p className="mt-2 text-sm text-els-fg-3">{plan ? `Status: ${plan.status}` : "A demo e os primeiros exercícios continuam disponíveis."}</p></div>
          {plan ? (
            <PortalButton />
          ) : (
            <Link href="/#planos" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber">Conhecer os planos</Link>
          )}
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-els-green/10 bg-els-green/5 p-4 text-xs leading-5 text-els-fg-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-els-green-ink" /><p>A Edital Lei Seca não armazena dados completos do cartão. O formulário e o portal de cobrança são fornecidos pela Stripe.</p></div>
      </section>
    </main>
  );
}
