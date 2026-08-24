import { afterEach, describe, expect, it } from "vitest";

import { getSupplierIdentity, isSupplierIdentityComplete, missingSupplierFields } from "@/lib/legal";

const CAMPOS = [
  "SUPPLIER_LEGAL_NAME",
  "SUPPLIER_TAX_ID",
  "SUPPLIER_ADDRESS",
  "SUPPLIER_EMAIL",
  "SUPPLIER_SUPPORT_CHANNEL",
  "SUPPLIER_DPO_CONTACT",
] as const;

function preencherTudo() {
  process.env.SUPPLIER_LEGAL_NAME = "Exemplo Educacional Ltda.";
  process.env.SUPPLIER_TAX_ID = "00.000.000/0001-00";
  process.env.SUPPLIER_ADDRESS = "Rua Exemplo, 1 — 00000-000, Cidade-UF";
  process.env.SUPPLIER_EMAIL = "atendimento@exemplo.test";
  process.env.SUPPLIER_SUPPORT_CHANNEL = "Seg a sex, 9h-18h";
  process.env.SUPPLIER_DPO_CONTACT = "encarregado@exemplo.test";
}

function limpar() {
  for (const campo of CAMPOS) delete process.env[campo];
  delete process.env.SUPPLIER_TRADE_NAME;
}

afterEach(limpar);

describe("identificação do fornecedor", () => {
  it("fica incompleta enquanto nada foi preenchido", () => {
    limpar();
    expect(isSupplierIdentityComplete()).toBe(false);
    expect(getSupplierIdentity()).toBeNull();
    expect(missingSupplierFields()).toEqual([...CAMPOS]);
  });

  it("rejeita preenchimento parcial em vez de aparentar conformidade", () => {
    limpar();
    for (const ausente of CAMPOS) {
      preencherTudo();
      delete process.env[ausente];
      expect(isSupplierIdentityComplete(), `faltando ${ausente}`).toBe(false);
      expect(missingSupplierFields()).toContain(ausente);
      limpar();
    }
  });

  it("trata espaço em branco como campo vazio", () => {
    preencherTudo();
    process.env.SUPPLIER_TAX_ID = "   ";
    expect(isSupplierIdentityComplete()).toBe(false);
  });

  it("aceita quando todos os campos obrigatórios estão presentes", () => {
    preencherTudo();
    expect(missingSupplierFields()).toEqual([]);
    expect(getSupplierIdentity()).toMatchObject({
      legalName: "Exemplo Educacional Ltda.",
      taxId: "00.000.000/0001-00",
      tradeName: null,
    });
  });
});

describe("trava do checkout", () => {
  async function disponibilidade() {
    // import dinâmico: stripe.ts lê o ambiente no momento da chamada.
    const [{ getCheckoutAvailability }, { PLANS }] = await Promise.all([
      import("@/lib/stripe"),
      import("@/lib/plans"),
    ]);
    return getCheckoutAvailability(PLANS[0]);
  }

  function ligarStripeDeTeste() {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.DATABASE_URL = "postgresql://u:p@127.0.0.1:5432/db";
    process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_exemplo";
    process.env.STRIPE_SECRET_KEY = "rk_test_exemplo";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_exemplo";
    process.env.STRIPE_PRICE_RITMO = "price_exemplo";
  }

  it("recusa abrir o checkout enquanto a identificação estiver incompleta", async () => {
    limpar();
    ligarStripeDeTeste();
    expect(await disponibilidade()).toEqual({ available: false, reason: "supplier_identity" });
  });

  it("libera assim que a identificação é publicada", async () => {
    ligarStripeDeTeste();
    preencherTudo();
    expect(await disponibilidade()).toMatchObject({ available: true });
  });
});
