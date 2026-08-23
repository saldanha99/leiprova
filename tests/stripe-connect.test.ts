import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateStripeConnectSplit,
  createStripeConnectAccountLink,
  createStripeConnectedExpressAccount,
  createStripeConnectTransfer,
  getStripeConnectOnboardingReadiness,
  getStripeConnectReadiness,
  retrieveStripeConnectedAccount,
  StripeConnectUnavailableError,
  type StripeConnectRuntimeOptions,
  validateStripeConnectSplit,
} from "@/lib/stripe-connect";

const READY_ENVIRONMENT = {
  STRIPE_CONNECT_ONBOARDING_ENABLED: "true",
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_CONNECT_BR_APPROVED: "true",
  STRIPE_CONNECT_MODE: "test",
  STRIPE_CONNECT_COUNTRY: "BR",
  STRIPE_CONNECT_CURRENCY: "brl",
  STRIPE_CONNECT_SECRET_KEY: "rk_test_examplekey1234567890",
  APP_URL: "http://localhost:3000",
  STRIPE_CONNECT_RETURN_URL: "http://localhost:3000/admin/stripe-connect/return",
  STRIPE_CONNECT_REFRESH_URL: "http://localhost:3000/admin/stripe-connect/refresh",
} as const;

function createClientDouble() {
  const accountsCreate = vi.fn().mockResolvedValue({ id: "acct_example" });
  const accountsRetrieve = vi.fn().mockResolvedValue({ id: "acct_example" });
  const accountLinksCreate = vi.fn().mockResolvedValue({ url: "https://connect.stripe.test/example" });
  const transfersCreate = vi.fn().mockResolvedValue({ id: "tr_example" });

  const client = {
    accounts: { create: accountsCreate, retrieve: accountsRetrieve },
    accountLinks: { create: accountLinksCreate },
    transfers: { create: transfersCreate },
  } as unknown as NonNullable<StripeConnectRuntimeOptions["client"]>;

  return {
    client,
    accountsCreate,
    accountsRetrieve,
    accountLinksCreate,
    transfersCreate,
  };
}

describe("configuração do Stripe Connect", () => {
  it("permanece fail-closed por padrão e não expõe segredos no status", () => {
    const readiness = getStripeConnectReadiness({});

    expect(readiness.ready).toBe(false);
    expect(readiness.enabled).toBe(false);
    expect(readiness.reasons).toEqual(
      expect.arrayContaining(["disabled", "br_approval_missing", "secret_key_missing", "return_url_missing", "refresh_url_missing", "app_url_missing"]),
    );
    expect(JSON.stringify(readiness)).not.toContain("STRIPE_CONNECT_SECRET_KEY");
  });

  it("reconhece uma configuração completa de teste com chave restrita", () => {
    expect(getStripeConnectReadiness(READY_ENVIRONMENT)).toEqual({
      ready: true,
      enabled: true,
      brApproved: true,
      chargeModel: "separate_charges_and_transfers",
      country: "BR",
      currency: "brl",
      mode: "test",
      secretKeyType: "restricted",
      callbackUrlsConfigured: true,
      reasons: [],
    });
  });

  it("separa onboarding de teste da ativação dos repasses", () => {
    const environment = {
      ...READY_ENVIRONMENT,
      STRIPE_CONNECT_ENABLED: "false",
      STRIPE_CONNECT_BR_APPROVED: "false",
    };

    expect(getStripeConnectReadiness(environment).ready).toBe(false);
    expect(getStripeConnectOnboardingReadiness(environment)).toEqual({
      ready: true,
      enabled: true,
      mode: "test",
      reasons: [],
    });
  });

  it("rejeita modo incompatível e callbacks HTTP em live mode", () => {
    const readiness = getStripeConnectReadiness({
      ...READY_ENVIRONMENT,
      STRIPE_CONNECT_MODE: "live",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toEqual(
      expect.arrayContaining(["secret_key_mode_mismatch", "live_redirect_requires_https"]),
    );
  });

  it("exige uma restricted key exclusiva para o Connect", () => {
    const broadKey = getStripeConnectReadiness({
      ...READY_ENVIRONMENT,
      STRIPE_CONNECT_SECRET_KEY: "sk_test_examplekey1234567890",
    });
    const reusedKey = getStripeConnectReadiness({
      ...READY_ENVIRONMENT,
      STRIPE_SECRET_KEY: READY_ENVIRONMENT.STRIPE_CONNECT_SECRET_KEY,
    });

    expect(broadKey.ready).toBe(false);
    expect(broadKey.reasons).toContain("restricted_key_required");
    expect(reusedKey.ready).toBe(false);
    expect(reusedKey.reasons).toContain("secret_key_reused");
  });

  it("rejeita callbacks em origens diferentes", () => {
    const readiness = getStripeConnectReadiness({
      ...READY_ENVIRONMENT,
      STRIPE_CONNECT_REFRESH_URL: "http://127.0.0.1:3000/admin/stripe-connect/refresh",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("redirect_origin_mismatch");
  });

  it("rejeita callbacks que não pertencem à origem pública da aplicação", () => {
    const readiness = getStripeConnectReadiness({
      ...READY_ENVIRONMENT,
      STRIPE_CONNECT_RETURN_URL: "https://example.net/admin/stripe-connect/return",
      STRIPE_CONNECT_REFRESH_URL: "https://example.net/admin/stripe-connect/refresh",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("callback_origin_mismatch");
  });
});

describe("regras de split do Stripe Connect", () => {
  it("exige plataforma + parceiros somando exatamente 10.000 basis points", () => {
    expect(
      validateStripeConnectSplit({
        platformShareBps: 2_000,
        allocations: [
          { recipientId: "partner-a", shareBps: 3_000 },
          { recipientId: "partner-b", shareBps: 5_000 },
        ],
      }),
    ).toEqual({ valid: true, totalBps: 10_000, reasons: [] });

    expect(
      validateStripeConnectSplit({
        platformShareBps: 2_000,
        allocations: [
          { recipientId: "partner-a", shareBps: 4_000 },
          { recipientId: "partner-a", shareBps: 3_000 },
        ],
      }),
    ).toEqual({
      valid: false,
      totalBps: 9_000,
      reasons: ["duplicate_recipient", "total_share_invalid"],
    });
  });

  it("rateia centavos sem perda pelo maior resto", () => {
    const split = calculateStripeConnectSplit(101, {
      platformShareBps: 2_000,
      allocations: [
        { recipientId: "partner-a", shareBps: 3_000 },
        { recipientId: "partner-b", shareBps: 5_000 },
      ],
    });

    expect(split).toEqual({
      totalAmountCents: 101,
      platformAmountCents: 20,
      allocations: [
        { recipientId: "partner-a", shareBps: 3_000, amountCents: 30 },
        { recipientId: "partner-b", shareBps: 5_000, amountCents: 51 },
      ],
    });
    expect(
      split.platformAmountCents + split.allocations.reduce((sum, item) => sum + item.amountCents, 0),
    ).toBe(101);
  });

  it("desempata restos de forma estável, sem depender da ordem dos parceiros", () => {
    const first = calculateStripeConnectSplit(1, {
      platformShareBps: 0,
      allocations: [
        { recipientId: "partner-b", shareBps: 5_000 },
        { recipientId: "partner-a", shareBps: 5_000 },
      ],
    });
    const second = calculateStripeConnectSplit(1, {
      platformShareBps: 0,
      allocations: [
        { recipientId: "partner-a", shareBps: 5_000 },
        { recipientId: "partner-b", shareBps: 5_000 },
      ],
    });

    expect(Object.fromEntries(first.allocations.map((item) => [item.recipientId, item.amountCents]))).toEqual({
      "partner-a": 1,
      "partner-b": 0,
    });
    expect(Object.fromEntries(second.allocations.map((item) => [item.recipientId, item.amountCents]))).toEqual({
      "partner-a": 1,
      "partner-b": 0,
    });
  });
});

describe("operações do Stripe Connect", () => {
  const double = createClientDouble();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia todas as operações quando onboarding e Connect estão desabilitados", () => {
    const options = {
      environment: {
        ...READY_ENVIRONMENT,
        STRIPE_CONNECT_ENABLED: "false",
        STRIPE_CONNECT_ONBOARDING_ENABLED: "false",
      },
      client: double.client,
    };

    const operations = [
      () =>
        createStripeConnectedExpressAccount(
          {
            partnerId: "partner-1",
            createdByUserId: "user-1",
            idempotencyKey: "connect-account:partner-1",
          },
          options,
        ),
      () =>
        createStripeConnectAccountLink(
          { connectedAccountId: "acct_example123", idempotencyKey: "connect-link:partner-1" },
          options,
        ),
      () => retrieveStripeConnectedAccount("acct_example123", options),
      () =>
        createStripeConnectTransfer(
          {
            amountCents: 1_000,
            connectedAccountId: "acct_example123",
            sourceChargeId: "ch_example123",
            transferGroup: "payment:1",
            splitAllocationId: "allocation-1",
            paymentReference: "payment-1",
            idempotencyKey: "connect-transfer:allocation-1",
          },
          options,
        ),
    ];

    for (const operation of operations) {
      expect(operation).toThrow(StripeConnectUnavailableError);
    }
    expect(double.accountsCreate).not.toHaveBeenCalled();
    expect(double.accountsRetrieve).not.toHaveBeenCalled();
    expect(double.accountLinksCreate).not.toHaveBeenCalled();
    expect(double.transfersCreate).not.toHaveBeenCalled();
  });

  it("cria conta Express BR com as capabilities exigidas para transfers", async () => {
    await createStripeConnectedExpressAccount(
      {
        partnerId: "partner-1",
        createdByUserId: "user-1",
        email: "financeiro@example.com",
        idempotencyKey: "connect-account:partner-1",
      },
      { environment: READY_ENVIRONMENT, client: double.client },
    );

    expect(double.accountsCreate).toHaveBeenCalledWith(
      {
        type: "express",
        country: "BR",
        email: "financeiro@example.com",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          app: "leiprova",
          integration: "stripe_connect",
          charge_model: "separate_charges_and_transfers",
          partner_id: "partner-1",
          created_by_user_id: "user-1",
        },
      },
      { idempotencyKey: "connect-account:partner-1" },
    );
  });

  it("cria link de onboarding, consulta conta e cria repasse associado à cobrança", async () => {
    const options = { environment: READY_ENVIRONMENT, client: double.client };

    await createStripeConnectAccountLink(
      { connectedAccountId: "acct_example123", idempotencyKey: "connect-link:partner-1" },
      options,
    );
    await retrieveStripeConnectedAccount("acct_example123", options);
    await createStripeConnectTransfer(
      {
        amountCents: 3_499,
        connectedAccountId: "acct_example123",
        sourceChargeId: "ch_example123",
        transferGroup: "payment:123",
        splitAllocationId: "allocation-123",
        paymentReference: "payment-123",
        idempotencyKey: "connect-transfer:allocation-123",
      },
      options,
    );

    expect(double.accountLinksCreate).toHaveBeenCalledWith(
      {
        account: "acct_example123",
        refresh_url: READY_ENVIRONMENT.STRIPE_CONNECT_REFRESH_URL,
        return_url: READY_ENVIRONMENT.STRIPE_CONNECT_RETURN_URL,
        type: "account_onboarding",
      },
      { idempotencyKey: "connect-link:partner-1" },
    );
    expect(double.accountsRetrieve).toHaveBeenCalledWith("acct_example123");
    expect(double.transfersCreate).toHaveBeenCalledWith(
      {
        amount: 3_499,
        currency: "brl",
        destination: "acct_example123",
        source_transaction: "ch_example123",
        transfer_group: "payment:123",
        metadata: {
          app: "leiprova",
          integration: "stripe_connect",
          charge_model: "separate_charges_and_transfers",
          split_allocation_id: "allocation-123",
          payment_reference: "payment-123",
        },
      },
      { idempotencyKey: "connect-transfer:allocation-123" },
    );
  });
});
