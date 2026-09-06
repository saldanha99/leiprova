import { z } from "zod";

export const persistentQaAccountsSchema = z
  .object({
    environment: z.literal("synthetic-persistent-only"),
    accounts: z
      .array(
        z.object({
          email: z.enum([
            "qa-admin@example.invalid",
            "qa-master@example.invalid",
            "qa-avulso@example.invalid",
          ]),
          role: z.enum(["student", "admin"]),
          name: z.string().min(4),
          access: z.enum(["admin", "master", "contest"]),
          password: z.string().min(20).max(128),
        }),
      )
      .length(3),
  })
  .superRefine(({ accounts }, context) => {
    const expected = {
      admin: "qa-admin@example.invalid",
      master: "qa-master@example.invalid",
      contest: "qa-avulso@example.invalid",
    };
    if (
      new Set(accounts.map((account) => account.access)).size !== 3 ||
      accounts.some(
        (account) =>
          account.email !== expected[account.access] ||
          account.role !== (account.access === "admin" ? "admin" : "student"),
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Os três perfis precisam de identidades sintéticas distintas e papéis corretos.",
      });
    }
  });

export function assertPersistentQaDatabase(
  url: string | undefined,
  environment: string | undefined,
) {
  if (!url || environment !== "synthetic")
    throw new Error(
      "Homologação sintética precisa de confirmação e banco explícitos.",
    );
  const parsed = new URL(url);
  const local =
    parsed.hostname === "127.0.0.1" &&
    parsed.port === "55439" &&
    parsed.username === "leiprova_test";
  const container =
    parsed.hostname === "leiprova-qa-db" &&
    parsed.port === "5432" &&
    parsed.username === "leiprova_qa_owner";
  if (
    (!local && !container) ||
    parsed.pathname !== "/leiprova_qa" ||
    !["postgres:", "postgresql:"].includes(parsed.protocol)
  ) {
    throw new Error(
      "Somente o banco separado leiprova_qa é aceito. Produção não é permitida.",
    );
  }
  return url;
}
