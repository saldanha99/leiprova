import { describe, expect, it } from "vitest";
import { contestCheckoutSessionResponse } from "@/lib/commerce/checkout-session-response";

const session = { status: "open", ui_mode: "elements", client_secret: "synthetic_client_secret", url: null } as const;
describe("retomada segura de checkout por concurso", () => {
  it("retorna segredo de sessão somente para Elements aberto", () => {
    expect(contestCheckoutSessionResponse(session, "order_synthetic")).toEqual({ clientSecret: "synthetic_client_secret", orderId: "order_synthetic" });
  });
  it.each(["complete", "expired"] as const)("não reutiliza %s", (status) => {
    expect(contestCheckoutSessionResponse({ ...session, status }, "order_synthetic")).toBeNull();
  });
  it("não libera sessão incompleta ou modo inesperado", () => {
    expect(contestCheckoutSessionResponse({ ...session, client_secret: null }, "order_synthetic")).toBeNull();
    expect(contestCheckoutSessionResponse({ ...session, ui_mode: "embedded" }, "order_synthetic")).toBeNull();
  });
  it("preserva sessões antigas hospedadas sem expor segredo", () => {
    expect(contestCheckoutSessionResponse({ ...session, ui_mode: "hosted", url: "https://checkout.stripe.com/c/pay/synthetic" }, "order_synthetic"))
      .toEqual({ url: "https://checkout.stripe.com/c/pay/synthetic" });
  });
  it.each(["http://checkout.stripe.com/c/pay/test", "https://checkout.stripe.com.attacker.invalid/pay", "javascript:alert(1)", "not-a-url"])("não redireciona para %s", (url) => {
    expect(contestCheckoutSessionResponse({ ...session, ui_mode: "hosted", url }, "order_synthetic")).toBeNull();
  });
});
