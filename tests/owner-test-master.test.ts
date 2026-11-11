import { describe, expect, it } from "vitest";

import {
  ownerTestMasterBlocker,
  parseOwnerTestMasterConfig,
} from "../scripts/lib/owner-test-master";

const password = "x".repeat(20);

describe("parseOwnerTestMasterConfig", () => {
  it("normaliza e aplica padrões", () => {
    expect(
      parseOwnerTestMasterConfig({ MASTER_TEST_EMAIL: " Dono+Aluno@Exemplo.com ", MASTER_TEST_PASSWORD: password }),
    ).toEqual({
      mode: "grant",
      email: "dono+aluno@exemplo.com",
      name: "Aluno Master de teste",
      password,
      days: 30,
      planSlug: "foco",
    });
  });

  it("aceita revogação só com e-mail", () => {
    expect(parseOwnerTestMasterConfig({ MASTER_TEST_EMAIL: "a@b.co", MASTER_TEST_REVOKE: "1" })).toEqual({
      mode: "revoke",
      email: "a@b.co",
    });
  });

  it.each([
    [{ MASTER_TEST_EMAIL: "invalido" }, /e-mail/],
    [{ MASTER_TEST_EMAIL: "a@b.co", MASTER_TEST_PASSWORD: "curta" }, /16 e 128/],
    [{ MASTER_TEST_EMAIL: "a@b.co", MASTER_TEST_DAYS: "91" }, /entre 1 e 90/],
    [{ MASTER_TEST_EMAIL: "a@b.co", MASTER_TEST_DAYS: "1.5" }, /entre 1 e 90/],
    [{ MASTER_TEST_EMAIL: "a@b.co", MASTER_TEST_PLAN: "vitalicio" }, /ritmo/],
  ])("recusa configuração inválida %#", (env, message) => {
    expect(() => parseOwnerTestMasterConfig(env)).toThrow(message);
  });
});

describe("ownerTestMasterBlocker", () => {
  it("não converte admin em aluno", () => {
    expect(ownerTestMasterBlocker({ role: "admin" }, null, true)).toMatch(/administrativo/);
  });

  it("exige senha para conta nova", () => {
    expect(ownerTestMasterBlocker(null, null, false)).toMatch(/exige/);
  });

  it("não sobrepõe assinatura Stripe vigente", () => {
    expect(ownerTestMasterBlocker({ role: "student" }, { provider: "stripe" }, false)).toMatch(/stripe/);
  });

  it("permite renovar Master manual de aluno existente sem trocar senha", () => {
    expect(ownerTestMasterBlocker({ role: "student" }, { provider: "manual" }, false)).toBeNull();
    expect(ownerTestMasterBlocker(null, null, true)).toBeNull();
  });
});
