import { NextRequest } from "next/server";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), values: vi.fn(), onConflictDoNothing: vi.fn(),
  master: vi.fn(), track: vi.fn(), process: vi.fn(), tx: { synthetic: true },
}));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ insert: mocks.insert }) }));
vi.mock("@/lib/stripe/master-subscription", () => ({ processMasterStripeEvent: mocks.master }));
vi.mock("@/lib/commerce/webhook-transaction", () => ({ withTrackedContestStripeEvent: mocks.track }));
vi.mock("@/app/api/stripe/webhook/process", () => ({ processStripeEvent: mocks.process }));
vi.mock("@/lib/stripe", async () => {
  const { default: SDK } = await import("stripe");
  const sdk = new SDK("sk_test_synthetic_no_network");
  return {
    getStripeClient: () => sdk,
    getStripeWebhookConfiguration: () => ({
      secretKey: "sk_test_synthetic_no_network", webhookSecret: "whsec_synthetic_signature_only",
    }),
    stripeKeyExpectsLivemode: () => false,
  };
});
import { POST } from "@/app/api/stripe/webhook/route";

const sdk = new Stripe("sk_test_synthetic_no_network");
const event = {
  id: "evt_synthetic_course", type: "invoice.paid", livemode: false,
  created: 1_700_000_000, api_version: "2026-04-22.dahlia", request: { id: "req_synthetic" },
  data: { object: { id: "in_synthetic", object: "invoice", customer_email: "never-store@example.invalid" } },
};
function request(input = event, valid = true) {
  const payload = JSON.stringify(input);
  return new NextRequest("https://example.invalid/api/stripe/webhook", {
    method: "POST", body: payload, headers: {
      "stripe-signature": valid ? sdk.webhooks.generateTestHeaderString({
        payload, secret: "whsec_synthetic_signature_only",
      }) : "t=0,v1=invalid",
    },
  });
}

describe("rota do webhook: verificação e unidade de concurso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.master.mockResolvedValue(false);
    mocks.process.mockResolvedValue(undefined);
    mocks.track.mockImplementation(async (_event, work) => {
      await work(mocks.tx);
      return { duplicate: false };
    });
  });

  it("assinatura criptográfica inválida não cria evento nem chama processadores", async () => {
    expect((await POST(request(event, false))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("modo incompatível falha antes de persistir ou conceder direitos", async () => {
    expect((await POST(request({ ...event, livemode: true }))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("encaminha a mesma tx e só guarda envelope sem dados pessoais", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(event, mocks.tx);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      payload: { objectId: "in_synthetic", objectType: "invoice", created: event.created, requestId: "req_synthetic" },
    }));
    expect(JSON.stringify(mocks.values.mock.calls)).not.toContain("never-store");
  });
  it("retry retorna 500 sem qualquer update tardio fora da transação", async () => {
    mocks.track.mockRejectedValueOnce(new Error("conexão caiu"));
    expect((await POST(request())).status).toBe(500);
    // O objeto db nem oferece update: uma marcação tardia failed quebraria este teste.
    expect(mocks.values).toHaveBeenCalledTimes(1);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("duplicata confirmada retorna 200 sem executar efeitos", async () => {
    mocks.track.mockResolvedValueOnce({ duplicate: true });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("Master permanece fora da transação de concurso", async () => {
    mocks.master.mockResolvedValueOnce(true);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
});
