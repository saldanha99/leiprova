import { StripeConnectPanel, type ConnectPanelReadiness } from "@/components/admin/stripe-connect-panel";
import { requireSuperAdmin } from "@/lib/auth";
import { getStripeConnectAdminSnapshot } from "@/lib/db/connect-admin";
import {
  getStripeConnectReadiness,
  getStripeConnectOnboardingReadiness,
  STRIPE_CONNECT_CHARGE_MODEL,
  STRIPE_CONNECT_CURRENCY,
  STRIPE_CONNECT_TOTAL_BPS,
} from "@/lib/stripe-connect";

const readinessMessages = {
  disabled: "A chave geral do Connect continua desligada.",
  br_approval_missing: "A aprovação explícita do Connect para recebedores no Brasil não foi registrada.",
  mode_invalid: "O modo do Connect precisa ser test ou live.",
  country_invalid: "A integração desta versão aceita somente contas BR.",
  currency_invalid: "A integração desta versão aceita somente BRL.",
  secret_key_missing: "Configure uma nova chave exclusiva do Connect no servidor.",
  secret_key_invalid: "A chave exclusiva do Connect não tem um formato reconhecido.",
  restricted_key_required: "O Connect exige uma restricted key exclusiva; chaves secretas amplas são bloqueadas.",
  secret_key_reused: "A chave do Connect não pode ser a mesma usada pelo checkout.",
  secret_key_mode_mismatch: "A chave do Connect não pertence ao mesmo ambiente configurado.",
  return_url_missing: "Configure a URL de retorno do onboarding.",
  return_url_invalid: "A URL de retorno do onboarding é inválida.",
  refresh_url_missing: "Configure a URL para renovar o onboarding.",
  refresh_url_invalid: "A URL para renovar o onboarding é inválida.",
  app_url_missing: "Configure a origem pública da Editalume no servidor.",
  app_url_invalid: "A origem pública da Editalume é inválida.",
  redirect_origin_mismatch: "As URLs de retorno e renovação precisam usar a mesma origem.",
  callback_origin_mismatch: "As URLs do onboarding precisam pertencer ao domínio público da Editalume.",
  live_redirect_requires_https: "O modo live exige HTTPS nas URLs de onboarding.",
} as const;

export default async function StripeConnectAdminPage() {
  await requireSuperAdmin();

  const [snapshot, serviceReadiness] = await Promise.all([
    getStripeConnectAdminSnapshot(),
    Promise.resolve(getStripeConnectReadiness()),
  ]);
  const onboardingReadiness = getStripeConnectOnboardingReadiness();

  const activeRule = snapshot.rules.find((rule) => rule.status === "active");
  const now = snapshot.generatedAt.getTime();
  const activeRuleTotal = activeRule
    ? activeRule.platformShareBps + activeRule.allocations.reduce((sum, allocation) => sum + allocation.shareBps, 0)
    : 0;
  const hasValidActiveRule = Boolean(
    activeRule &&
    activeRule.allocations.length > 0 &&
    activeRuleTotal === STRIPE_CONNECT_TOTAL_BPS &&
    activeRule.chargeModel === STRIPE_CONNECT_CHARGE_MODEL &&
    activeRule.currency === STRIPE_CONNECT_CURRENCY &&
    (!activeRule.effectiveFrom || activeRule.effectiveFrom.getTime() <= now) &&
    (!activeRule.effectiveUntil || activeRule.effectiveUntil.getTime() > now),
  );
  const activeRecipientsReady = Boolean(
    activeRule &&
    activeRule.allocations.length > 0 &&
    activeRule.allocations.every(
      (allocation) =>
        allocation.partnerStatus === "enabled" &&
        allocation.detailsSubmitted &&
        allocation.payoutsEnabled &&
        allocation.stripeAccountId,
    ),
  );
  const apiConfigured = Boolean(
    serviceReadiness.secretKeyType &&
    serviceReadiness.callbackUrlsConfigured &&
    serviceReadiness.mode &&
    !serviceReadiness.reasons.some((reason) =>
      [
        "mode_invalid",
        "country_invalid",
        "currency_invalid",
        "secret_key_missing",
        "secret_key_invalid",
        "restricted_key_required",
        "secret_key_reused",
        "secret_key_mode_mismatch",
        "return_url_missing",
        "return_url_invalid",
        "refresh_url_missing",
        "refresh_url_invalid",
        "app_url_missing",
        "app_url_invalid",
        "redirect_origin_mismatch",
        "callback_origin_mismatch",
        "live_redirect_requires_https",
      ].includes(reason),
    ),
  );

  const requirements: string[] = serviceReadiness.reasons.map((reason) => readinessMessages[reason]);
  if (!activeRecipientsReady) requirements.push("Conclua conta, KYC e payout de todos os recebedores da regra ativa.");
  if (!hasValidActiveRule) requirements.push("Ative uma regra vigente, compatível e cuja soma feche exatamente em 100%.");

  const readiness: ConnectPanelReadiness = {
    ready: serviceReadiness.ready && activeRecipientsReady && hasValidActiveRule,
    enabled: serviceReadiness.enabled,
    onboardingReady: onboardingReadiness.ready,
    apiConfigured,
    brApproved: serviceReadiness.brApproved,
    recipientsReady: activeRecipientsReady,
    activeRuleReady: hasValidActiveRule,
    liveMode: serviceReadiness.mode === "live" ? true : serviceReadiness.mode === "test" ? false : null,
    requirements,
  };

  return <StripeConnectPanel readiness={readiness} snapshot={snapshot} />;
}
