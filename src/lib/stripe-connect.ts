import "server-only";

import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";

export const STRIPE_CONNECT_CHARGE_MODEL = "separate_charges_and_transfers" as const;
export const STRIPE_CONNECT_COUNTRY = "BR" as const;
export const STRIPE_CONNECT_CURRENCY = "brl" as const;
export const STRIPE_CONNECT_TOTAL_BPS = 10_000 as const;

export type StripeConnectReadinessReason =
  | "disabled"
  | "br_approval_missing"
  | "mode_invalid"
  | "country_invalid"
  | "currency_invalid"
  | "secret_key_missing"
  | "secret_key_invalid"
  | "restricted_key_required"
  | "secret_key_reused"
  | "secret_key_mode_mismatch"
  | "return_url_missing"
  | "return_url_invalid"
  | "refresh_url_missing"
  | "refresh_url_invalid"
  | "app_url_missing"
  | "app_url_invalid"
  | "redirect_origin_mismatch"
  | "callback_origin_mismatch"
  | "live_redirect_requires_https";

export type StripeConnectOnboardingReadinessReason =
  | StripeConnectReadinessReason
  | "onboarding_disabled";

export type StripeConnectMode = "test" | "live";
export type StripeConnectSecretKeyType = "restricted" | "secret";
export type StripeConnectEnvironment = Readonly<Record<string, string | undefined>>;

export type StripeConnectReadiness = {
  ready: boolean;
  enabled: boolean;
  brApproved: boolean;
  chargeModel: typeof STRIPE_CONNECT_CHARGE_MODEL;
  country: typeof STRIPE_CONNECT_COUNTRY;
  currency: typeof STRIPE_CONNECT_CURRENCY;
  mode: StripeConnectMode | null;
  secretKeyType: StripeConnectSecretKeyType | null;
  callbackUrlsConfigured: boolean;
  reasons: StripeConnectReadinessReason[];
};

export type StripeConnectOnboardingReadiness = {
  ready: boolean;
  enabled: boolean;
  mode: StripeConnectMode | null;
  reasons: StripeConnectOnboardingReadinessReason[];
};

export type StripeConnectSplitAllocation = {
  recipientId: string;
  shareBps: number;
};

export type StripeConnectSplitRule = {
  platformShareBps: number;
  allocations: StripeConnectSplitAllocation[];
};

export type StripeConnectSplitValidationReason =
  | "platform_share_invalid"
  | "recipient_id_invalid"
  | "recipient_share_invalid"
  | "duplicate_recipient"
  | "total_share_invalid";

export type StripeConnectSplitValidation = {
  valid: boolean;
  totalBps: number;
  reasons: StripeConnectSplitValidationReason[];
};

export type StripeConnectSplitAmounts = {
  totalAmountCents: number;
  platformAmountCents: number;
  allocations: Array<StripeConnectSplitAllocation & { amountCents: number }>;
};

type StripeConnectClient = Pick<Stripe, "accounts" | "accountLinks" | "transfers">;

export type StripeConnectRuntimeOptions = {
  environment?: StripeConnectEnvironment;
  client?: StripeConnectClient;
};

type StripeConnectConfiguration = {
  secretKey: string;
  returnUrl: string;
  refreshUrl: string;
};

export class StripeConnectUnavailableError extends Error {
  readonly reasons: readonly StripeConnectOnboardingReadinessReason[];

  constructor(reasons: readonly StripeConnectOnboardingReadinessReason[]) {
    super("Stripe Connect não está habilitado ou possui configuração incompleta.");
    this.name = "StripeConnectUnavailableError";
    this.reasons = [...reasons];
  }
}

export class StripeConnectInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConnectInputError";
  }
}

function readEnv(environment: StripeConnectEnvironment, name: string) {
  const value = environment[name]?.trim();
  return value || null;
}

function parseStripeSecretKey(secretKey: string | null) {
  if (!secretKey) return null;

  const match = /^(sk|rk)_(test|live)_[A-Za-z0-9]{12,}$/.exec(secretKey);
  if (!match) return null;

  return {
    type: match[1] === "rk" ? ("restricted" as const) : ("secret" as const),
    mode: match[2] as StripeConnectMode,
  };
}

function parseCallbackUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function getStripeConnectReadiness(
  environment: StripeConnectEnvironment = process.env,
): StripeConnectReadiness {
  const reasons: StripeConnectReadinessReason[] = [];
  const enabled = readEnv(environment, "STRIPE_CONNECT_ENABLED")?.toLowerCase() === "true";
  if (!enabled) reasons.push("disabled");

  const brApproved = readEnv(environment, "STRIPE_CONNECT_BR_APPROVED")?.toLowerCase() === "true";
  if (!brApproved) reasons.push("br_approval_missing");

  const rawMode = readEnv(environment, "STRIPE_CONNECT_MODE")?.toLowerCase() ?? "test";
  const mode: StripeConnectMode | null = rawMode === "test" || rawMode === "live" ? rawMode : null;
  if (!mode) reasons.push("mode_invalid");

  const country = (readEnv(environment, "STRIPE_CONNECT_COUNTRY") ?? STRIPE_CONNECT_COUNTRY).toUpperCase();
  if (country !== STRIPE_CONNECT_COUNTRY) reasons.push("country_invalid");

  const currency = (readEnv(environment, "STRIPE_CONNECT_CURRENCY") ?? STRIPE_CONNECT_CURRENCY).toLowerCase();
  if (currency !== STRIPE_CONNECT_CURRENCY) reasons.push("currency_invalid");

  const secretKey = readEnv(environment, "STRIPE_CONNECT_SECRET_KEY");
  const parsedSecretKey = parseStripeSecretKey(secretKey);
  if (!secretKey) reasons.push("secret_key_missing");
  else if (!parsedSecretKey) reasons.push("secret_key_invalid");
  else {
    if (parsedSecretKey.type !== "restricted") reasons.push("restricted_key_required");
    if (mode && parsedSecretKey.mode !== mode) reasons.push("secret_key_mode_mismatch");
  }

  const checkoutSecretKey = readEnv(environment, "STRIPE_SECRET_KEY");
  if (secretKey && checkoutSecretKey && secretKey === checkoutSecretKey) {
    reasons.push("secret_key_reused");
  }

  const returnUrlValue = readEnv(environment, "STRIPE_CONNECT_RETURN_URL");
  const refreshUrlValue = readEnv(environment, "STRIPE_CONNECT_REFRESH_URL");
  const appUrlValue = readEnv(environment, "APP_URL") ?? readEnv(environment, "NEXT_PUBLIC_APP_URL");
  const returnUrl = parseCallbackUrl(returnUrlValue);
  const refreshUrl = parseCallbackUrl(refreshUrlValue);
  const appUrl = parseCallbackUrl(appUrlValue);

  if (!returnUrlValue) reasons.push("return_url_missing");
  else if (!returnUrl) reasons.push("return_url_invalid");

  if (!refreshUrlValue) reasons.push("refresh_url_missing");
  else if (!refreshUrl) reasons.push("refresh_url_invalid");

  if (!appUrlValue) reasons.push("app_url_missing");
  else if (!appUrl) reasons.push("app_url_invalid");

  if (returnUrl && refreshUrl && returnUrl.origin !== refreshUrl.origin) {
    reasons.push("redirect_origin_mismatch");
  }

  if (
    appUrl &&
    [returnUrl, refreshUrl].some((url) => url && url.origin !== appUrl.origin)
  ) {
    reasons.push("callback_origin_mismatch");
  }

  if (mode === "live" && [appUrl, returnUrl, refreshUrl].some((url) => url && url.protocol !== "https:")) {
    reasons.push("live_redirect_requires_https");
  }

  return {
    ready: reasons.length === 0,
    enabled,
    brApproved,
    chargeModel: STRIPE_CONNECT_CHARGE_MODEL,
    country: STRIPE_CONNECT_COUNTRY,
    currency: STRIPE_CONNECT_CURRENCY,
    mode,
    secretKeyType: parsedSecretKey?.type ?? null,
    callbackUrlsConfigured: Boolean(returnUrl && refreshUrl),
    reasons,
  };
}

export function getStripeConnectOnboardingReadiness(
  environment: StripeConnectEnvironment = process.env,
): StripeConnectOnboardingReadiness {
  const serviceReadiness = getStripeConnectReadiness(environment);
  const enabled = readEnv(environment, "STRIPE_CONNECT_ONBOARDING_ENABLED")?.toLowerCase() === "true";
  const ignoredReasons = new Set<StripeConnectReadinessReason>(["disabled"]);

  // A conta de teste pode concluir o onboarding antes da liberação comercial no Brasil.
  // Em live, a aprovação explícita continua obrigatória.
  if (serviceReadiness.mode === "test") ignoredReasons.add("br_approval_missing");

  const reasons: StripeConnectOnboardingReadinessReason[] = serviceReadiness.reasons.filter(
    (reason) => !ignoredReasons.has(reason),
  );
  if (!enabled) reasons.unshift("onboarding_disabled");

  return {
    ready: reasons.length === 0,
    enabled,
    mode: serviceReadiness.mode,
    reasons,
  };
}

export function validateStripeConnectSplit(rule: StripeConnectSplitRule): StripeConnectSplitValidation {
  const reasons = new Set<StripeConnectSplitValidationReason>();

  if (
    !Number.isSafeInteger(rule.platformShareBps) ||
    rule.platformShareBps < 0 ||
    rule.platformShareBps > STRIPE_CONNECT_TOTAL_BPS
  ) {
    reasons.add("platform_share_invalid");
  }

  const recipients = new Set<string>();
  let allocationsTotalBps = 0;

  for (const allocation of rule.allocations) {
    const recipientId = allocation.recipientId.trim();
    if (!recipientId || recipientId.length > 128) reasons.add("recipient_id_invalid");
    else if (recipients.has(recipientId)) reasons.add("duplicate_recipient");
    else recipients.add(recipientId);

    if (
      !Number.isSafeInteger(allocation.shareBps) ||
      allocation.shareBps <= 0 ||
      allocation.shareBps > STRIPE_CONNECT_TOTAL_BPS
    ) {
      reasons.add("recipient_share_invalid");
    } else {
      allocationsTotalBps += allocation.shareBps;
    }
  }

  const totalBps =
    Number.isSafeInteger(rule.platformShareBps) && rule.platformShareBps >= 0
      ? rule.platformShareBps + allocationsTotalBps
      : allocationsTotalBps;
  if (totalBps !== STRIPE_CONNECT_TOTAL_BPS) reasons.add("total_share_invalid");

  return { valid: reasons.size === 0, totalBps, reasons: [...reasons] };
}

export function calculateStripeConnectSplit(
  totalAmountCents: number,
  rule: StripeConnectSplitRule,
): StripeConnectSplitAmounts {
  if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents < 0) {
    throw new StripeConnectInputError("O valor total precisa ser um inteiro não negativo em centavos.");
  }

  const validation = validateStripeConnectSplit(rule);
  if (!validation.valid) {
    throw new StripeConnectInputError(`Regra de split inválida: ${validation.reasons.join(", ")}.`);
  }

  const participants = [
    {
      key: "0:platform",
      kind: "platform" as const,
      recipientId: null,
      shareBps: rule.platformShareBps,
    },
    ...rule.allocations.map((allocation) => ({
      key: `1:${allocation.recipientId.trim()}`,
      kind: "recipient" as const,
      recipientId: allocation.recipientId.trim(),
      shareBps: allocation.shareBps,
    })),
  ];

  const denominator = BigInt(STRIPE_CONNECT_TOTAL_BPS);
  const total = BigInt(totalAmountCents);
  const amounts = participants.map((participant) => {
    const numerator = total * BigInt(participant.shareBps);
    return {
      ...participant,
      amountCents: Number(numerator / denominator),
      remainder: numerator % denominator,
    };
  });

  const distributedCents = amounts.reduce((sum, participant) => sum + participant.amountCents, 0);
  const remainingCents = totalAmountCents - distributedCents;
  const remainderOrder = [...amounts].sort((left, right) => {
    if (left.remainder === right.remainder) return left.key.localeCompare(right.key);
    return left.remainder > right.remainder ? -1 : 1;
  });

  for (let index = 0; index < remainingCents; index += 1) {
    remainderOrder[index].amountCents += 1;
  }

  const platformAmountCents = amounts.find((participant) => participant.kind === "platform")?.amountCents;
  if (platformAmountCents === undefined) {
    throw new StripeConnectInputError("Não foi possível calcular a parcela da plataforma.");
  }

  const recipientAmounts = new Map(
    amounts
      .filter((participant) => participant.kind === "recipient" && participant.recipientId)
      .map((participant) => [participant.recipientId as string, participant.amountCents]),
  );

  return {
    totalAmountCents,
    platformAmountCents,
    allocations: rule.allocations.map((allocation) => ({
      recipientId: allocation.recipientId.trim(),
      shareBps: allocation.shareBps,
      amountCents: recipientAmounts.get(allocation.recipientId.trim()) ?? 0,
    })),
  };
}

function requireStripeConnectRuntime(options: StripeConnectRuntimeOptions = {}) {
  const environment = options.environment ?? process.env;
  const readiness = getStripeConnectReadiness(environment);
  if (!readiness.ready) throw new StripeConnectUnavailableError(readiness.reasons);

  const secretKey = readEnv(environment, "STRIPE_CONNECT_SECRET_KEY");
  const returnUrl = readEnv(environment, "STRIPE_CONNECT_RETURN_URL");
  const refreshUrl = readEnv(environment, "STRIPE_CONNECT_REFRESH_URL");
  if (!secretKey || !returnUrl || !refreshUrl) {
    throw new StripeConnectUnavailableError(readiness.reasons);
  }

  const configuration: StripeConnectConfiguration = { secretKey, returnUrl, refreshUrl };
  return {
    configuration,
    client: options.client ?? getStripeClient(configuration.secretKey),
  };
}

function requireStripeConnectOnboardingRuntime(options: StripeConnectRuntimeOptions = {}) {
  const environment = options.environment ?? process.env;
  const readiness = getStripeConnectOnboardingReadiness(environment);
  if (!readiness.ready) throw new StripeConnectUnavailableError(readiness.reasons);

  const secretKey = readEnv(environment, "STRIPE_CONNECT_SECRET_KEY");
  const returnUrl = readEnv(environment, "STRIPE_CONNECT_RETURN_URL");
  const refreshUrl = readEnv(environment, "STRIPE_CONNECT_REFRESH_URL");
  if (!secretKey || !returnUrl || !refreshUrl) {
    throw new StripeConnectUnavailableError(readiness.reasons);
  }

  const configuration: StripeConnectConfiguration = { secretKey, returnUrl, refreshUrl };
  return {
    configuration,
    client: options.client ?? getStripeClient(configuration.secretKey),
  };
}

function assertControlledReference(value: string, label: string, maximumLength = 128) {
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > maximumLength ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)
  ) {
    throw new StripeConnectInputError(`${label} inválido.`);
  }
  return normalized;
}

function assertIdempotencyKey(value: string) {
  const normalized = assertControlledReference(value, "Idempotency key", 255);
  if (normalized.length < 8 || /[sr]k_(?:test|live)_/i.test(normalized)) {
    throw new StripeConnectInputError("Idempotency key inválida.");
  }
  return normalized;
}

function assertStripeAccountId(value: string) {
  const normalized = value.trim();
  if (!/^acct_[A-Za-z0-9]+$/.test(normalized)) {
    throw new StripeConnectInputError("Identificador da conta conectada inválido.");
  }
  return normalized;
}

function assertStripeChargeId(value: string) {
  const normalized = value.trim();
  if (!/^ch_[A-Za-z0-9]+$/.test(normalized)) {
    throw new StripeConnectInputError("Identificador da cobrança de origem inválido.");
  }
  return normalized;
}

export function createStripeConnectedExpressAccount(
  input: {
    partnerId: string;
    createdByUserId: string;
    email?: string | null;
    idempotencyKey: string;
  },
  options: StripeConnectRuntimeOptions = {},
) {
  const { client } = requireStripeConnectOnboardingRuntime(options);
  const partnerId = assertControlledReference(input.partnerId, "Identificador do parceiro");
  const createdByUserId = assertControlledReference(input.createdByUserId, "Identificador do operador");
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
  const email = input.email?.trim() || undefined;

  return client.accounts.create(
    {
      type: "express",
      country: STRIPE_CONNECT_COUNTRY,
      email,
      // Stripe requires card_payments together with transfers for BR accounts,
      // even when the platform uses separate charges and transfers.
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        app: "leiprova",
        integration: "stripe_connect",
        charge_model: STRIPE_CONNECT_CHARGE_MODEL,
        partner_id: partnerId,
        created_by_user_id: createdByUserId,
      },
    },
    { idempotencyKey },
  );
}

export function createStripeConnectAccountLink(
  input: { connectedAccountId: string; idempotencyKey: string },
  options: StripeConnectRuntimeOptions = {},
) {
  const { client, configuration } = requireStripeConnectOnboardingRuntime(options);
  const connectedAccountId = assertStripeAccountId(input.connectedAccountId);
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);

  return client.accountLinks.create(
    {
      account: connectedAccountId,
      refresh_url: configuration.refreshUrl,
      return_url: configuration.returnUrl,
      type: "account_onboarding",
    },
    { idempotencyKey },
  );
}

export function retrieveStripeConnectedAccount(
  connectedAccountId: string,
  options: StripeConnectRuntimeOptions = {},
) {
  const { client } = requireStripeConnectOnboardingRuntime(options);
  return client.accounts.retrieve(assertStripeAccountId(connectedAccountId));
}

export function createStripeConnectTransfer(
  input: {
    amountCents: number;
    connectedAccountId: string;
    sourceChargeId: string;
    transferGroup: string;
    splitAllocationId: string;
    paymentReference: string;
    idempotencyKey: string;
  },
  options: StripeConnectRuntimeOptions = {},
) {
  const { client } = requireStripeConnectRuntime(options);
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new StripeConnectInputError("O repasse precisa ser um inteiro positivo em centavos.");
  }

  const connectedAccountId = assertStripeAccountId(input.connectedAccountId);
  const sourceChargeId = assertStripeChargeId(input.sourceChargeId);
  const transferGroup = assertControlledReference(input.transferGroup, "Grupo do repasse", 200);
  const splitAllocationId = assertControlledReference(
    input.splitAllocationId,
    "Identificador da alocação",
  );
  const paymentReference = assertControlledReference(
    input.paymentReference,
    "Referência do pagamento",
  );
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);

  return client.transfers.create(
    {
      amount: input.amountCents,
      currency: STRIPE_CONNECT_CURRENCY,
      destination: connectedAccountId,
      source_transaction: sourceChargeId,
      transfer_group: transferGroup,
      metadata: {
        app: "leiprova",
        integration: "stripe_connect",
        charge_model: STRIPE_CONNECT_CHARGE_MODEL,
        split_allocation_id: splitAllocationId,
        payment_reference: paymentReference,
      },
    },
    { idempotencyKey },
  );
}
