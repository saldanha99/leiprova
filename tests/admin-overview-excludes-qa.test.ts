import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");

describe("painel admin: contas de teste fora das métricas", () => {
  it("assinantes contam só a Stripe; cortesia/QA aparece à parte", () => {
    expect(page).toContain("count(*) filter (where ${subscriptions.provider} = 'stripe' and ${subscriptions.status} in ('active', 'trialing')");
    expect(page).toContain("${subscriptions.provider} <> 'stripe'");
    expect(page).toContain("acessos de cortesia/QA fora da contagem");
  });

  it("usuários cadastrados ignoram o domínio reservado de teste", () => {
    expect(page).toContain("not ilike '%@example.invalid'");
  });
});
