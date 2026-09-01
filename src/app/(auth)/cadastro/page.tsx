import { redirect } from "next/navigation";
import Link from "next/link";
import { Construction } from "lucide-react";

import { beginPurchaseAction, registerAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { PurchaseIdentityForm } from "@/components/auth/purchase-identity-form";
import { getCurrentUser } from "@/lib/auth";
import { isRegistrationEnabled } from "@/lib/launch";
import { getPlan } from "@/lib/plans";
import { safeRedirectPath } from "@/lib/utils";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plano?: string }>;
}) {
  const params = await searchParams;
  const selectedPlan = getPlan(params.plano);
  const nextPath = selectedPlan ? `/checkout/${selectedPlan.slug}` : safeRedirectPath(params.next);
  if (await getCurrentUser()) redirect(nextPath);

  if (!isRegistrationEnabled()) {
    return (
      <AuthShell
        title="Cadastros abrem em breve"
        description="Esta é uma prévia pública da Editalume. Enquanto concluímos a revisão jurídica e operacional, você pode experimentar o método sem informar dados pessoais."
      >
        <div className="grid gap-4 text-center">
          <Construction className="mx-auto size-10 text-amber-300" aria-hidden="true" />
          <Link href="/demo" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950">
            Fazer a demonstração
          </Link>
          <Link href="/entrar" className="text-sm font-semibold text-slate-400 hover:text-white">
            Já fui convidado para a beta
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (selectedPlan) {
    return (
      <AuthShell
        title={`Comece com o ${selectedPlan.name}`}
        description="Informe onde deseja receber o acesso. Depois da confirmação do pagamento, enviaremos o link para você criar sua senha do portal."
      >
        <PurchaseIdentityForm action={beginPurchaseAction} planSlug={selectedPlan.slug} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crie sua conta gratuita"
      description="Faça um treino demonstrativo agora. Você só escolhe um plano quando quiser liberar o acervo completo."
    >
      <AuthForm mode="register" action={registerAction} nextPath={nextPath} />
    </AuthShell>
  );
}
