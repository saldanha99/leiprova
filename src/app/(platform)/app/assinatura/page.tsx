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
      <section className="mt-8 rounded-[1.75rem] border border-white/8 bg-[#09131f] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs uppercase tracking-[.14em] text-slate-500">Plano atual</p><h2 className="mt-2 text-2xl font-semibold">{plan?.name ?? "Acesso gratuito"}</h2><p className="mt-2 text-sm text-slate-500">{plan ? `Status: ${plan.status}` : "A demo e os primeiros exercícios continuam disponíveis."}</p></div>
          {plan ? (
            <PortalButton />
          ) : (
            <Link href="/#planos" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950">Conhecer os planos</Link>
          )}
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/5 p-4 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" /><p>A LeiProva não armazena dados completos do cartão. O formulário e o portal de cobrança são fornecidos pela Stripe.</p></div>
      </section>
    </main>
  );
}
