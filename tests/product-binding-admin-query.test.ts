import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { getDb } from "../src/lib/db/client";
vi.mock("server-only", () => ({}));
import { listProductBindingProposals } from "../src/lib/commerce/product-binding-admin-query";

describe("consulta administrativa isolada de vínculos", () => {
  it("consulta apenas o produto escolhido, com parâmetros e página limitada", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    await listProductBindingProposals({ execute } as unknown as ReturnType<typeof getDb>, "produto-qa", 2);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain("where b.product_slug=$1");
    expect(query.sql).toContain("limit 11 offset $2");
    expect(query.params).toEqual(["produto-qa", 10]);
    expect(query.sql).toContain("q.source_rights='original_authorial'");
    expect(query.sql).toContain("else 'Conteúdo não autoral oculto'");
    expect(query.sql).not.toMatch(/\b(update|insert|delete|grant)\b/iu);
    expect(query.sql).not.toMatch(/users|email|password/iu);
  });
  it.each([["produto-qa", 0], ["produto-qa", 10_001], ["produto-qa", 1.5], ["produto'; drop table questions", 1], ["a".repeat(161), 1]])(
    "recusa escopo ou paginação inválidos antes de consultar (%s, %s)", async (slug, page) => {
      const execute = vi.fn();
      await expect(listProductBindingProposals({ execute } as unknown as ReturnType<typeof getDb>, String(slug), Number(page))).rejects.toThrow("inválido");
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
