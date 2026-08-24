import Link from "next/link";
import { MailX } from "lucide-react";

import { requestAccountAccessAction } from "@/app/actions/account-access";
import { RequestAccountAccessForm } from "@/components/auth/account-access-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getTransactionalEmailConfig } from "@/lib/transactional-email";

export default function RecoverAccountAccessPage() {
  if (!getTransactionalEmailConfig()) {
    return (
      <AuthShell
        title="Recuperação em preparação"
        description="O canal automático de e-mail ainda não foi aberto. Sua conta e sua senha atual continuam inalteradas."
      >
        <div className="grid gap-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[.035] text-slate-300">
            <MailX className="size-6" aria-hidden="true" />
          </span>
          <Link href="/entrar" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
            Voltar para entrar
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recupere seu acesso"
      description="Informe o e-mail usado na compra ou no cadastro. Você receberá um link seguro para criar uma nova senha."
    >
      <RequestAccountAccessForm action={requestAccountAccessAction} />
    </AuthShell>
  );
}
