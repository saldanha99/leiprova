import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { getTransactionalEmailConfig } from "@/lib/transactional-email";
import { safeRedirectPath } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next);
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <AuthShell title="Que bom ter você de volta" description="Entre para continuar sua meta de hoje e as revisões pendentes.">
      <AuthForm
        mode="login"
        action={loginAction}
        nextPath={nextPath}
        accountAccessEnabled={Boolean(getTransactionalEmailConfig())}
      />
    </AuthShell>
  );
}
