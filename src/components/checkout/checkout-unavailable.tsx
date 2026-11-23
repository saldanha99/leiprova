import Link from "next/link";
import { Construction, ShieldAlert } from "lucide-react";

import { LeiProvaMark } from "@/components/ui/leiprova-mark";

export function CheckoutUnavailable({ invalidPlan = false }: { invalidPlan?: boolean }) {
  return (
    <main className="min-h-screen bg-els-bg px-4 py-8 text-els-fg sm:px-6">
      <div className="mx-auto max-w-5xl">
        <LeiProvaMark href="/" />
        <section className="mx-auto mt-20 max-w-xl rounded-[1.75rem] border border-els-line bg-els-surface p-7 text-center shadow-2xl shadow-black/20 sm:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-els-amber/15 bg-els-amber/[.07] text-els-amber-ink">
            {invalidPlan ? <ShieldAlert className="size-8" /> : <Construction className="size-8" />}
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">
            {invalidPlan ? "Plano não encontrado" : "Checkout em preparação"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-els-fg-3">
            {invalidPlan
              ? "O plano informado não está disponível. Escolha uma opção publicada na página de planos."
              : "Os pagamentos ainda não foram habilitados com segurança neste ambiente. Nenhuma cobrança pode ser feita agora."}
          </p>
          <Link href="/#planos" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber-2">
            Voltar aos planos
          </Link>
        </section>
      </div>
    </main>
  );
}
