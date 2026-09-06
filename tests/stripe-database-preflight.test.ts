import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  STRIPE_COMMERCE_DATABASE_PERMISSIONS,
  STRIPE_COMMERCE_DATABASE_PREFLIGHT_QUERY,
  validateStripeCommerceDatabaseSnapshot,
  withStripeCommerceDatabasePreflight,
} from "@/lib/commerce/stripe-database-preflight";

const target = { databaseUrl: "postgres://leiprova_commerce:synthetic@db:5432/leiprova", mode: "live" as const };
const snapshot = () => ({
  databaseName: "leiprova", currentUser: "leiprova_commerce", sessionUser: "leiprova_commerce",
  inRecovery: false, defaultReadOnly: false, schemaUsage: true, publicTablesResolved: true, unrestrictedRows: true,
  permissions: STRIPE_COMMERCE_DATABASE_PERMISSIONS.map((permission) => ({ ...permission, allowed: true })),
});

describe("preflight operacional antes de mutações Stripe", () => {
  it("permite privilégio por coluna, sem exigir superusuário ou grants globais", () => {
    expect(validateStripeCommerceDatabaseSnapshot(snapshot(), target)).toEqual({
      databaseName: "leiprova", user: "leiprova_commerce", verified: true,
    });
    expect(STRIPE_COMMERCE_DATABASE_PERMISSIONS.some((permission) => String(permission.privilege) === "DELETE")).toBe(false);
    expect(STRIPE_COMMERCE_DATABASE_PERMISSIONS.filter((permission) => permission.table === "subscriptions")
      .every((permission) => permission.privilege === "SELECT")).toBe(true);
  });

  it("confirma banco de homologação isolado e o usuário realmente conectado", () => {
    expect(validateStripeCommerceDatabaseSnapshot({ ...snapshot(), databaseName: "leiprova_staging" }, {
      databaseUrl: "postgres://leiprova_commerce:synthetic@db/leiprova_staging", mode: "test",
    }).verified).toBe(true);
  });

  it("usuário escapado na URL é comparado decodificado", () => {
    expect(validateStripeCommerceDatabaseSnapshot(snapshot(), {
      ...target, databaseUrl: "postgres://leiprova%5Fcommerce:synthetic@db/leiprova",
    }).verified).toBe(true);
  });

  it.each([
    { databaseName: "outro_projeto" }, { currentUser: "leiprova_app" }, { sessionUser: "outro_operador" },
    { inRecovery: true }, { defaultReadOnly: true }, { schemaUsage: false },
    { publicTablesResolved: false }, { unrestrictedRows: false },
  ])("falha de identidade/disponibilidade impede toda operação Stripe: %j", async (override) => {
    const createProduct = vi.fn();
    const inspect = vi.fn(async () => ({ ...snapshot(), ...override }));
    await expect(withStripeCommerceDatabasePreflight({ ...target, inspect }, createProduct)).rejects.toThrow();
    expect(inspect).toHaveBeenCalledOnce();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it.each(STRIPE_COMMERCE_DATABASE_PERMISSIONS)("cada permissão ausente bloqueia API mutável: $table.$column $privilege", async (missing) => {
    const current = snapshot();
    current.permissions = current.permissions.map((permission) => ({ ...permission,
      allowed: !(permission.table === missing.table && permission.column === missing.column && permission.privilege === missing.privilege),
    }));
    const createProduct = vi.fn();
    await expect(withStripeCommerceDatabasePreflight({ ...target, inspect: async () => current }, createProduct)).rejects.toThrow("privilégios");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it.each([
    "postgres://leiprova_app:synthetic@db/leiprova",
    "postgres://leiprova_qa_app:synthetic@db/leiprova",
    "postgres://db/leiprova",
    "postgres://leiprova_commerce:synthetic@db/outro",
    "not-a-url",
    "https://leiprova_commerce:synthetic@example.invalid/leiprova",
  ])("destino impróprio é recusado antes até da inspeção: %s", async (databaseUrl) => {
    const inspect = vi.fn(async () => snapshot());
    const createProduct = vi.fn();
    await expect(withStripeCommerceDatabasePreflight({ ...target, databaseUrl, inspect }, createProduct)).rejects.toThrow();
    expect(inspect).not.toHaveBeenCalled();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("snapshot incompleto não é certificado por omitir a permissão que falhou", async () => {
    const current = snapshot();
    current.permissions.pop();
    const createProduct = vi.fn();
    await expect(withStripeCommerceDatabasePreflight({ ...target, inspect: async () => current }, createProduct)).rejects.toThrow("privilégios");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("snapshot duplicado ou privilégio inventado não substitui os esperados", () => {
    const current = snapshot();
    current.permissions[1] = current.permissions[0];
    expect(() => validateStripeCommerceDatabaseSnapshot(current, target)).toThrow("privilégios");
    expect(() => validateStripeCommerceDatabaseSnapshot({ ...snapshot(), permissions: [
      ...snapshot().permissions, { table: "users", column: "id", privilege: "SELECT", allowed: true },
    ] }, target)).toThrow("privilégios");
  });

  it("falha da conexão não executa callback de sincronização", async () => {
    const createProduct = vi.fn();
    await expect(withStripeCommerceDatabasePreflight({ ...target, inspect: async () => { throw new Error("DB offline"); } }, createProduct)).rejects.toThrow("DB offline");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("só chama operação mutável depois da inspeção concluída e validada", async () => {
    const order: string[] = [];
    const createProduct = vi.fn(async () => { order.push("stripe-write"); return "prod_synthetic"; });
    const result = await withStripeCommerceDatabasePreflight({ ...target,
      inspect: async () => { order.push("inspect-complete"); return snapshot(); },
    }, createProduct);
    expect(result).toBe("prod_synthetic");
    expect(order).toEqual(["inspect-complete", "stripe-write"]);
    expect(createProduct).toHaveBeenCalledOnce();
  });

  it("consulta somente metadados/permissões e compara resolução de public", () => {
    const query = STRIPE_COMMERCE_DATABASE_PREFLIGHT_QUERY;
    expect(query).toContain("current_database()");
    expect(query).toContain("has_column_privilege");
    expect(query).toContain("row_security_active");
    expect(query).toContain("to_regclass(table_name) = to_regclass('public.' || table_name)");
    expect(query).not.toMatch(/\b(?:grant|revoke|delete from|insert into|update public|create table|alter table)\b/i);
  });

  it("operador real envolve o sincronizador no guard e conclui a transação de leitura antes da Stripe", () => {
    const source = readFileSync(new URL("../scripts/sync-contest-stripe.ts", import.meta.url), "utf8");
    expect(source).toContain('db.begin("read only"');
    expect(source).toContain("set local statement_timeout = '5s'");
    expect(source).toContain("tx.unsafe(STRIPE_COMMERCE_DATABASE_PREFLIGHT_QUERY)");
    expect(source.indexOf("await withStripeCommerceDatabasePreflight(")).toBeLessThan(source.indexOf("await ensureContestStripeCatalog("));
    expect(source.indexOf("await withStripeCommerceDatabasePreflight(")).toBeLessThan(source.indexOf("await ensureMasterStripeCatalog("));
  });
});
