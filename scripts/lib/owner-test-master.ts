export const OWNER_TEST_MASTER_MAX_DAYS = 90;
export const OWNER_TEST_MASTER_DEFAULT_DAYS = 30;

export type OwnerTestMasterConfig =
  | { mode: "revoke"; email: string }
  | {
      mode: "grant";
      email: string;
      name: string;
      password: string | null;
      days: number;
      planSlug: "ritmo" | "foco";
    };

/**
 * Acesso Master de teste do proprietário: conta de papel `student`, assinatura
 * `manual` com fim finito e auditoria. Nunca toca Stripe, flags ou contas admin.
 */
export function parseOwnerTestMasterConfig(
  env: Record<string, string | undefined>,
): OwnerTestMasterConfig {
  const email = env.MASTER_TEST_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Defina MASTER_TEST_EMAIL com um e-mail válido.");
  }

  if (env.MASTER_TEST_REVOKE === "1") return { mode: "revoke", email };

  const password = env.MASTER_TEST_PASSWORD ?? null;
  if (password !== null && (password.length < 16 || password.length > 128)) {
    throw new Error("MASTER_TEST_PASSWORD deve ter entre 16 e 128 caracteres.");
  }

  const rawDays = env.MASTER_TEST_DAYS?.trim() || String(OWNER_TEST_MASTER_DEFAULT_DAYS);
  const days = Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > OWNER_TEST_MASTER_MAX_DAYS) {
    throw new Error(`MASTER_TEST_DAYS deve ser inteiro entre 1 e ${OWNER_TEST_MASTER_MAX_DAYS}.`);
  }

  const planSlug = env.MASTER_TEST_PLAN?.trim() || "foco";
  if (planSlug !== "ritmo" && planSlug !== "foco") {
    throw new Error("MASTER_TEST_PLAN deve ser 'ritmo' ou 'foco'.");
  }

  const name = env.MASTER_TEST_NAME?.trim() || "Aluno Master de teste";
  return { mode: "grant", email, name, password, days, planSlug };
}

export type ExistingAccount = { role: string } | null;
export type CurrentSubscription = { provider: string } | null;

/** Decide se a concessão pode prosseguir sem rebaixar admin nem sobrepor Stripe. */
export function ownerTestMasterBlocker(
  account: ExistingAccount,
  subscription: CurrentSubscription,
  hasPassword: boolean,
): string | null {
  if (account && account.role !== "student") {
    return "A conta existe com papel administrativo. Use outro e-mail (ex.: nome+aluno@...) para testar como aluno.";
  }
  if (!account && !hasPassword) {
    return "Conta nova exige MASTER_TEST_PASSWORD (16 a 128 caracteres).";
  }
  if (subscription && subscription.provider !== "manual") {
    return `A conta já tem assinatura ${subscription.provider} vigente; nada foi alterado.`;
  }
  return null;
}
