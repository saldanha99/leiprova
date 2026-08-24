import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { activateAccountAccessAction } from "@/app/actions/account-access";
import { ActivateAccountAccessForm } from "@/components/auth/account-access-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAccountAccessTokenStatus } from "@/lib/account-access";

export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default async function ActivateAccountAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = await getAccountAccessTokenStatus(token);

  if (status !== "valid") {
    return (
      <AuthShell
        title={status === "used" ? "Link já utilizado" : status === "expired" ? "Link expirado" : "Link inválido"}
        description="Este endereço não pode mais criar uma senha. Solicite um novo link para continuar com segurança."
      >
        <div className="grid gap-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-rose-300/15 bg-rose-300/[.06] text-rose-300">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <Link href="/recuperar-acesso" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
            Solicitar novo link
          </Link>
          <Link href="/entrar" className="text-sm font-semibold text-slate-400 transition hover:text-white">Voltar para entrar</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crie sua senha de acesso"
      description="Última etapa: escolha uma senha pessoal. Depois disso, você entra direto no portal de estudos."
    >
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[.05] px-4 py-3 text-sm text-emerald-100">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-hidden="true" />
        Link verificado e pronto para uso.
      </div>
      <ActivateAccountAccessForm token={token} action={activateAccountAccessAction} />
    </AuthShell>
  );
}
