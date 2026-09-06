import { readFileSync } from "node:fs";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { cancelRecoverableContestOrder, findRecoverableContestSession, originalContestCheckoutExpiry,
  validateContestCheckoutSession, type RecoverableContestOrder } from "@/lib/commerce/contest-checkout-recovery";

const order = { id: "synthetic-order", userId: 1, status: "created", checkoutUiMode: "hosted", stripeMode: "test",
  stripeCustomerId: "cus_synthetic", stripeSessionId: null, stripeCreationStartedAt: new Date("2026-09-06T12:00:00Z"),
  createdAt: new Date("2026-09-06T12:00:00.999Z") } as RecoverableContestOrder;
const session = { id: "cs_synthetic", mode: "subscription", ui_mode: "hosted", livemode: false, status: "open", customer: "cus_synthetic",
  metadata: { app: "leiprova", commerce: "contest_subscription_v2", order_id: order.id, user_public_id: "user_synthetic" },
  client_reference_id: "user_synthetic" } as unknown as Stripe.Checkout.Session;
function stripeSessions() {
  const list = vi.fn().mockResolvedValue({ data: [], has_more: false });
  const retrieve = vi.fn().mockResolvedValue(session);
  const expire = vi.fn().mockResolvedValue({ ...session, status: "expired" });
  return { list, retrieve, expire, api: { list, retrieve, expire } as unknown as Parameters<typeof findRecoverableContestSession>[0] };
}

describe("guardas de retomada/cancelamento da compra avulsa", () => {
  it("preserva expiração original truncada em segundos sem renovar a janela", () => {
    expect(originalContestCheckoutExpiry(order)).toBe(Date.parse("2026-09-06T13:00:00Z") / 1000);
  });
  it.each([
    { livemode: true }, { ui_mode: "elements" }, { customer: "cus_other" }, { client_reference_id: "other" },
    { mode: "payment" }, { status: null }, { metadata: { ...session.metadata, app: "other" } },
    { metadata: { ...session.metadata, user_public_id: "other" } }, { metadata: { ...session.metadata, order_id: "other" } },
  ])("bloqueia divergência de identidade/modo: %j", (override) => {
    expect(() => validateContestCheckoutSession(order, "user_synthetic", { ...session, ...override } as Stripe.Checkout.Session)).toThrow("identity_mismatch");
  });
  it("permite pagamento único legado somente com ID já conhecido e identidade confirmada", () => {
    const legacy = { ...session, mode: "payment", metadata: { ...session.metadata, commerce: "contest_v1" } } as Stripe.Checkout.Session;
    expect(() => validateContestCheckoutSession({ ...order, stripeSessionId: session.id }, "user_synthetic", legacy)).not.toThrow();
    expect(() => validateContestCheckoutSession(order, "user_synthetic", legacy)).toThrow();
  });
  it("percorre lista inteira mesmo depois de encontrar um candidato", async () => {
    const stripe = stripeSessions();
    stripe.list.mockResolvedValueOnce({ data: [session], has_more: true }).mockResolvedValueOnce({ data: [{ ...session, id: "cs_duplicate" }], has_more: false });
    await expect(findRecoverableContestSession(stripe.api, order, "user_synthetic")).rejects.toThrow("duplicate_sessions");
    expect(stripe.list).toHaveBeenCalledTimes(2);
    expect(stripe.list.mock.calls[0][0]).toEqual({ customer: "cus_synthetic", limit: 100 });
  });
  it("página vazia incompleta e cursor repetido não comprovam ausência", async () => {
    const stripe = stripeSessions();
    stripe.list.mockResolvedValueOnce({ data: [], has_more: true });
    await expect(findRecoverableContestSession(stripe.api, order, "user_synthetic")).rejects.toThrow("incomplete");
    stripe.list.mockResolvedValueOnce({ data: [] });
    await expect(findRecoverableContestSession(stripe.api, order, "user_synthetic")).rejects.toThrow("incomplete");
    stripe.list.mockResolvedValue({ data: [{ id: "cs_repeated", metadata: {} }], has_more: true });
    await expect(findRecoverableContestSession(stripe.api, order, "user_synthetic")).rejects.toThrow("page_ambiguous");
  });
  it("pedido nunca iniciado não instancia Stripe e depende do CAS local", async () => {
    const execute = vi.fn().mockResolvedValue([{ id: order.id }]);
    const factory = vi.fn(() => stripeSessions().api);
    const db = { execute } as unknown as Parameters<typeof cancelRecoverableContestOrder>[0];
    expect(await cancelRecoverableContestOrder(db, factory, { ...order, stripeCustomerId: null, stripeCreationStartedAt: null }, "user_synthetic")).toBe("cancelled");
    expect(factory).not.toHaveBeenCalled();
    execute.mockResolvedValue([]);
    expect(await cancelRecoverableContestOrder(db, factory, { ...order, stripeCustomerId: null, stripeCreationStartedAt: null }, "user_synthetic")).toBe("conflict");
  });
  it("mostra cancelamento sem ID de sessão e retoma a seleção exata, sem enviar linhas internas", () => {
    const page = readFileSync("src/app/(platform)/app/compras/page.tsx", "utf8");
    expect(page).not.toContain("order.stripeSessionId &&");
    expect(page).toContain("items={order.lines.map(({ productSlug, accessKey }) => ({ productSlug, accessKey }))}");
    const resume = readFileSync("src/components/checkout/resume-contest-order.tsx", "utf8");
    expect(resume).toContain("attemptId: orderId, items");
    expect(resume).not.toContain("crypto.randomUUID");
  });
});
