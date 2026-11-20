import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  attributionMetadata,
  buildFbc,
  checkoutTrackingSchema,
  decorateUrl,
  mergeAttribution,
  newEventId,
  parseUrlParams,
  purchaseEventId,
} from "@/lib/tracking";

const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

describe("captura de atribuição (LEI 10)", () => {
  it("guarda TODOS os parâmetros da URL, com limites", () => {
    const params = parseUrlParams("?utm_source=ig_reels&utm_medium=camp&fbclid=ABC&x_custom=1&x_custom=2");
    expect(params).toEqual({ utm_source: "ig_reels", utm_medium: "camp", fbclid: "ABC", x_custom: "1" });
    const many = parseUrlParams("?" + Array.from({ length: 60 }, (_, i) => `k${i}=v`).join("&"));
    expect(Object.keys(many)).toHaveLength(40);
    expect(parseUrlParams(`?big=${"a".repeat(1000)}`).big).toHaveLength(300);
  });

  it("reconstrói _fbc a partir do fbclid quando não há cookie", () => {
    expect(buildFbc("ABC", NOW)).toBe(`fb.1.${NOW}.ABC`);
    const merged = mergeAttribution(null, { search: "?fbclid=ABC", path: "/", cookieHeader: "_fbp=fb.1.1.2; _ga=GA1.1.9", nowMs: NOW });
    expect(merged).toMatchObject({ fbp: "fb.1.1.2", ga: "GA1.1.9", fbc: `fb.1.${NOW}.ABC`, landingPath: "/" });
  });

  it("cookie _fbc existente tem prioridade; primeira entrada da sessão é preservada", () => {
    const first = mergeAttribution(null, { search: "?utm_source=a", path: "/lp", cookieHeader: "", nowMs: NOW });
    const later = mergeAttribution(first, { search: "?utm_source=b", path: "/x", cookieHeader: "_fbc=fb.1.5.OLD", nowMs: NOW + 1 });
    expect(later.params.utm_source).toBe("a");
    expect(later.landingPath).toBe("/lp");
    expect(later.fbc).toBe("fb.1.5.OLD");
  });

  it("event_id compartilhado e Purchase determinístico pelo id da sessão", () => {
    expect(newEventId("InitiateCheckout", () => "1234abcd-ef")).toBe("initiatecheckout_1234abcd-ef");
    expect(purchaseEventId("cs_test_1")).toBe("purchase_cs_test_1");
  });

  it("metadata curta só com UTMs, click ids e cookies", () => {
    const merged = mergeAttribution(null, { search: "?utm_source=s&utm_campaign=c&gclid=G&outro=x", path: "/", cookieHeader: "_fbp=P", nowMs: NOW });
    expect(attributionMetadata(merged)).toEqual({
      trk_utm_source: "s", trk_utm_campaign: "c", trk_gclid: "G", trk_fbp: "P", trk_landing_path: "/",
    });
    expect(attributionMetadata(null)).toEqual({});
  });

  it("repassa UTMs e click ids a um link sem sobrescrever os existentes", () => {
    const merged = mergeAttribution(null, { search: "?utm_source=s&fbclid=F", path: "/", cookieHeader: "", nowMs: NOW });
    expect(decorateUrl("/checkout/ritmo?utm_source=keep", merged, "https://editaleiseca.com.br"))
      .toBe("/checkout/ritmo?utm_source=keep&fbclid=F");
  });

  it("o servidor só aceita o pacote validado", () => {
    const attribution = mergeAttribution(null, { search: "?utm_source=s", path: "/", cookieHeader: "", nowMs: NOW });
    expect(checkoutTrackingSchema.safeParse({ eventId: "initiatecheckout_0123456789", attribution }).success).toBe(true);
    expect(checkoutTrackingSchema.safeParse({ eventId: "purchase_x", attribution }).success).toBe(false);
    expect(checkoutTrackingSchema.safeParse({ eventId: "initiatecheckout_0123456789", attribution, extra: 1 }).success).toBe(false);
  });
});

describe("integração no checkout", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  it("CTAs de checkout são <a> (Link) com id único e sem target=_blank", () => {
    for (const [file, id] of [
      ["src/components/contests/contest-pricing.tsx", "cta-checkout-concurso-"],
      ["src/components/checkout/contest-cart.tsx", "cta-checkout-master-"],
      ["src/components/landing/PricingPlans.tsx", "cta-checkout-master-"],
    ] as const) {
      const source = read(file);
      expect(source).toContain(`id={\`${id}`);
    }
    expect(read("src/components/contests/contest-pricing.tsx")).not.toMatch(/checkout[^\n]*target="_blank"/u);
  });

  it("InitiateCheckout, AddPaymentInfo e Purchase usam o mesmo event_id no Pixel e na CAPI", () => {
    expect(read("src/components/checkout/checkout-client.tsx")).toContain('browserTrack("InitiateCheckout", initiateEventId');
    expect(read("src/components/checkout/checkout-client.tsx")).toContain('browserTrack("AddPaymentInfo"');
    expect(read("src/components/checkout/return-status.tsx")).toContain('browserTrack("Purchase", purchaseEventId(sessionId)');
    expect(read("src/lib/tracking-server.ts")).toContain("eventId: `purchase_${session.id}`");
  });

  it("GTM só carrega com ID válido; e-mail vem antes do nome", () => {
    expect(read("src/components/tracking/tracking-bootstrap.tsx")).toContain("GTM_ID_PATTERN.test(GTM_ID)");
    const form = read("src/components/auth/purchase-identity-form.tsx");
    expect(form.indexOf('name="email"')).toBeLessThan(form.indexOf('name="name"'));
  });
});
