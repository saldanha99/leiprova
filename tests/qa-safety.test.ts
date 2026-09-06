import { describe, expect, it } from "vitest";
import {
  assertPersistentQaDatabase,
  persistentQaAccountsSchema,
} from "../scripts/lib/qa-safety";

describe("homologação persistente — isolamento obrigatório", () => {
  it("aceita apenas banco e usuários exclusivos de QA", () => {
    for (const url of [
      "postgres://leiprova_test@127.0.0.1:55439/leiprova_qa",
      "postgresql://leiprova_qa_owner:fiction@leiprova-qa-db:5432/leiprova_qa",
    ])
      expect(assertPersistentQaDatabase(url, "synthetic")).toBe(url);
  });
  it.each([
    "postgres://leiprova_owner@leiprova-db:5432/leiprova",
    "postgres://leiprova_owner@127.0.0.1:55439/leiprova_qa",
    "postgres://leiprova_test@127.0.0.1:5432/leiprova_qa",
    "postgres://leiprova_test@127.0.0.1:55439/leiprova_automation_test",
    "postgres://leiprova_qa_owner@example.com:5432/leiprova_qa",
    "https://leiprova_test@127.0.0.1:55439/leiprova_qa",
  ])("recusa destino fora da homologação: %s", (url) =>
    expect(() => assertPersistentQaDatabase(url, "synthetic")).toThrow(),
  );
  it("recusa ausência de confirmação de ambiente", () => {
    expect(() =>
      assertPersistentQaDatabase(
        "postgres://leiprova_test@127.0.0.1:55439/leiprova_qa",
        undefined,
      ),
    ).toThrow();
  });
  const accounts = [
    {
      email: "qa-admin@example.invalid",
      name: "QA Admin",
      role: "admin",
      access: "admin",
      password: "synthetic-not-real-password",
    },
    {
      email: "qa-master@example.invalid",
      name: "QA Master",
      role: "student",
      access: "master",
      password: "synthetic-not-real-password",
    },
    {
      email: "qa-avulso@example.invalid",
      name: "QA Individual",
      role: "student",
      access: "contest",
      password: "synthetic-not-real-password",
    },
  ];
  it("exige os três perfis sintéticos com papéis corretos", () => {
    expect(
      persistentQaAccountsSchema.safeParse({
        environment: "synthetic-persistent-only",
        accounts,
      }).success,
    ).toBe(true);
    expect(
      persistentQaAccountsSchema.safeParse({
        environment: "synthetic-persistent-only",
        accounts: accounts.map((account) => ({ ...account, role: "admin" })),
      }).success,
    ).toBe(false);
    expect(
      persistentQaAccountsSchema.safeParse({
        environment: "synthetic-persistent-only",
        accounts: [accounts[0], accounts[0], accounts[2]],
      }).success,
    ).toBe(false);
    expect(
      persistentQaAccountsSchema.safeParse({
        environment: "synthetic-persistent-only",
        accounts: accounts.map((account) => ({
          ...account,
          email: "real@example.com",
        })),
      }).success,
    ).toBe(false);
  });
});
