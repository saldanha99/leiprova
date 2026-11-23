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
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-els-danger/15 bg-els-danger/[.06] text-els-danger-ink">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <Link href="/recuperar-acesso" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber">
            Solicitar novo link
          </Link>
          <Link href="/entrar" className="text-sm font-semibold text-els-fg-3 transition hover:text-els-fg min-h-11 inline-flex items-center">Voltar para entrar</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crie sua senha de acesso"
      description="Última etapa: escolha uma senha pessoal. Depois disso, você entra direto no portal de estudos."
    >
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-els-green/15 bg-els-green/[.05] px-4 py-3 text-sm text-els-green-ink">
        <CheckCircle2 className="size-5 shrink-0 text-els-green-ink" aria-hidden="true" />
        Link verificado e pronto para uso.
      </div>
      <ActivateAccountAccessForm token={token} action={activateAccountAccessAction} />
    </AuthShell>
  );
}
