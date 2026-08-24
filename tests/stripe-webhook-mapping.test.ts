import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import {
  isLeiProvaMetadata,
  normalizeSubscriptionStatus,
  objectId,
  parsePositiveInteger,
  subscriptionPeriod,
  unixDate,
} from "@/app/api/stripe/webhook/mapping";

/** Status locais que liberam acesso pago — espelha getStudyEntitlement. */
const LIBERAM_ACESSO = new Set(["active", "trialing"]);

describe("mapeamento de status da assinatura", () => {
  const esperado: Record<Stripe.Subscription.Status, string> = {
    incomplete: "incomplete",
    incomplete_expired: "expired",
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    paused: "paused",
  };

  it("traduz cada status da Stripe para o status local correspondente", () => {
    for (const [entrada, saida] of Object.entries(esperado)) {
      expect(normalizeSubscriptionStatus(entrada as Stripe.Subscription.Status), entrada).toBe(saida);
    }
  });

  it("só concede acesso a partir de active e trialing", () => {
    for (const [entrada, saida] of Object.entries(esperado)) {
      const concede = LIBERAM_ACESSO.has(saida);
      expect(concede, `${entrada} -> ${saida}`).toBe(entrada === "active" || entrada === "trialing");
    }
  });

  it("falha fechado diante de um status desconhecido", () => {
    // Se a Stripe introduzir um status novo, o padrão precisa ser negar acesso.
    const desconhecido = normalizeSubscriptionStatus("status_que_nao_existe" as Stripe.Subscription.Status);
    expect(LIBERAM_ACESSO.has(desconhecido)).toBe(false);
    expect(desconhecido).toBe("incomplete");
  });
});

describe("parsePositiveInteger", () => {
  it("aceita apenas inteiros positivos", () => {
    expect(parsePositiveInteger("1")).toBe(1);
    expect(parsePositiveInteger("42")).toBe(42);
  });

  it("recusa entradas que poderiam apontar para outro usuário ou quebrar a consulta", () => {
    for (const entrada of [
      null, undefined, "", "   ", "0", "-1", "1.5", "1e3", "abc",
      "1 OR 1=1", "1; drop table users", "٣", "+1", "0x10",
      String(Number.MAX_SAFE_INTEGER) + "0",
    ]) {
      expect(parsePositiveInteger(entrada as string | null | undefined), String(entrada)).toBeNull();
    }
  });
});

describe("guarda de metadados", () => {
  it("só reconhece eventos marcados como da LeiProva", () => {
    expect(isLeiProvaMetadata({ app: "leiprova" })).toBe(true);
  });

  it("ignora eventos de outra aplicação na mesma conta Stripe", () => {
    expect(isLeiProvaMetadata({ app: "outro-produto" })).toBe(false);
    expect(isLeiProvaMetadata({})).toBe(false);
    expect(isLeiProvaMetadata(null)).toBe(false);
    expect(isLeiProvaMetadata(undefined)).toBe(false);
  });
});

describe("janela de vigência da assinatura", () => {
  function assinaturaCom(periodos: readonly { start: number; end: number }[]) {
    return {
      items: { data: periodos.map((p) => ({ current_period_start: p.start, current_period_end: p.end })) },
    } as unknown as Stripe.Subscription;
  }

  it("usa o início mais cedo e o fim mais tarde entre os itens", () => {
    const periodo = subscriptionPeriod(assinaturaCom([
      { start: 1_700_000_000, end: 1_700_600_000 },
      { start: 1_699_000_000, end: 1_701_000_000 },
    ]));
    expect(periodo.start).toEqual(new Date(1_699_000_000 * 1000));
    expect(periodo.end).toEqual(new Date(1_701_000_000 * 1000));
  });

  it("devolve nulo quando a assinatura não traz itens", () => {
    expect(subscriptionPeriod(assinaturaCom([]))).toEqual({ start: null, end: null });
  });
});

describe("utilitários", () => {
  it("extrai id tanto de string quanto de objeto expandido", () => {
    expect(objectId("sub_123")).toBe("sub_123");
    expect(objectId({ id: "sub_123" })).toBe("sub_123");
    expect(objectId(null)).toBeNull();
    expect(objectId(undefined)).toBeNull();
  });

  it("converte timestamp unix e preserva ausência", () => {
    expect(unixDate(1_700_000_000)).toEqual(new Date(1_700_000_000 * 1000));
    expect(unixDate(null)).toBeNull();
    expect(unixDate(undefined)).toBeNull();
  });
});
