import Link from "next/link";
import { Construction, ShieldAlert } from "lucide-react";

import { LeiProvaMark } from "@/components/ui/leiprova-mark";

export function CheckoutUnavailable({ invalidPlan = false }: { invalidPlan?: boolean }) {
  return (
    <main className="min-h-screen bg-[#050b12] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <LeiProvaMark href="/" />
        <section className="mx-auto mt-20 max-w-xl rounded-[1.75rem] border border-white/9 bg-[#0a1420] p-7 text-center shadow-2xl shadow-black/20 sm:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[.07] text-amber-300">
            {invalidPlan ? <ShieldAlert className="size-8" /> : <Construction className="size-8" />}
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">
            {invalidPlan ? "Plano não encontrado" : "Checkout em preparação"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {invalidPlan
              ? "O plano informado não está disponível. Escolha uma opção publicada na página de planos."
              : "Os pagamentos ainda não foram habilitados com segurança neste ambiente. Nenhuma cobrança pode ser feita agora."}
          </p>
          <Link href="/#planos" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
            Voltar aos planos
          </Link>
        </section>
      </div>
    </main>
  );
}
