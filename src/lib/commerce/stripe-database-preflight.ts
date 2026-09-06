import { z } from "zod";

const permissions = (
  table: string,
  privilege: "SELECT" | "INSERT" | "UPDATE",
  columns: readonly string[],
) => columns.map((column) => ({ table, column, privilege }));

/** Apenas as operações realmente usadas pelo sincronizador; não exige DELETE nem escrita editorial. */
export const STRIPE_COMMERCE_DATABASE_PERMISSIONS = [
  ...permissions("subscriptions", "SELECT", ["id", "status"]),
  ...permissions("plans", "SELECT", ["id", "slug", "stripe_price_id", "amount_cents", "currency", "billing_type"]),
  ...permissions("plans", "UPDATE", ["stripe_price_id", "name", "updated_at"]),
  ...permissions("contest_store_products", "SELECT", ["slug", "stripe_product_id", "stripe_price_monthly", "stripe_price_annual", "stripe_mode"]),
  ...permissions("contest_store_products", "INSERT", ["slug", "stripe_product_id", "stripe_price_monthly", "stripe_price_annual", "stripe_mode"]),
  ...permissions("contest_store_products", "UPDATE", ["stripe_product_id", "stripe_price_monthly", "stripe_price_annual", "stripe_mode", "updated_at"]),
] as const;

const permissionKey = (permission: { table: string; column: string; privilege: string }) =>
  `${permission.table}.${permission.column}:${permission.privilege}`;

// Os valores são constantes internas, não entradas de usuário. A consulta é somente leitura.
export const STRIPE_COMMERCE_DATABASE_PREFLIGHT_QUERY = `
with required_permissions(table_name, column_name, privilege_name) as (
  values ${STRIPE_COMMERCE_DATABASE_PERMISSIONS.map((permission) =>
    `('${permission.table}', '${permission.column}', '${permission.privilege}')`).join(",\n  ")}
), required_tables(table_name) as (
  values ('plans'), ('contest_store_products'), ('subscriptions')
)
select
  current_database() as "databaseName",
  current_user::text as "currentUser",
  session_user::text as "sessionUser",
  pg_is_in_recovery() as "inRecovery",
  current_setting('default_transaction_read_only') = 'on' as "defaultReadOnly",
  has_schema_privilege(current_user, 'public', 'USAGE') as "schemaUsage",
  (select bool_and(coalesce(to_regclass(table_name) = to_regclass('public.' || table_name), false))
    from required_tables) as "publicTablesResolved",
  (select bool_and(case when to_regclass('public.' || table_name) is null then false
    else not row_security_active(to_regclass('public.' || table_name)) end)
    from required_tables) as "unrestrictedRows",
  (select jsonb_agg(jsonb_build_object(
    'table', table_name, 'column', column_name, 'privilege', privilege_name,
    'allowed', case when to_regclass('public.' || table_name) is null then false
      else coalesce(has_column_privilege(current_user, to_regclass('public.' || table_name), column_name, privilege_name), false) end
    )) from required_permissions) as permissions
`;

const snapshotSchema = z.object({
  databaseName: z.string().min(1),
  currentUser: z.string().min(1),
  sessionUser: z.string().min(1),
  inRecovery: z.boolean(),
  defaultReadOnly: z.boolean(),
  schemaUsage: z.boolean(),
  publicTablesResolved: z.boolean(),
  unrestrictedRows: z.boolean(),
  permissions: z.array(z.object({
    table: z.string(), column: z.string(), privilege: z.enum(["SELECT", "INSERT", "UPDATE"]), allowed: z.boolean(),
  }).strict()),
}).strict();

function expectedDatabaseIdentity(databaseUrl: string, mode: "test" | "live") {
  let url: URL;
  let databaseName: string;
  let user: string;
  try {
    url = new URL(databaseUrl);
    databaseName = decodeURIComponent(url.pathname.slice(1));
    user = decodeURIComponent(url.username);
  } catch {
    throw new Error("Conexão operacional inválida para preflight.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !user || !databaseName ||
    (mode === "live" ? databaseName !== "leiprova" : !/^leiprova(?:_[a-z0-9]+)*_(?:test|staging)$/.test(databaseName)) ||
    user.endsWith("_app")) {
    throw new Error("Preflight exige banco LeiProva e usuário operacional explícito, não o usuário da aplicação.");
  }
  return { databaseName, user };
}

export function validateStripeCommerceDatabaseSnapshot(
  snapshot: unknown,
  target: { databaseUrl: string; mode: "test" | "live" },
) {
  const expected = expectedDatabaseIdentity(target.databaseUrl, target.mode);
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error("Preflight retornou identidade ou privilégios incompletos.");
  const actual = parsed.data;
  if (actual.databaseName !== expected.databaseName || actual.currentUser !== expected.user || actual.sessionUser !== expected.user) {
    throw new Error("Banco ou usuário efetivo diverge da conexão operacional declarada.");
  }
  if (actual.inRecovery || actual.defaultReadOnly || !actual.schemaUsage || !actual.publicTablesResolved || !actual.unrestrictedRows) {
    throw new Error("Banco operacional somente leitura, restrito ou com resolução de tabelas divergente.");
  }
  const allowed = new Map(actual.permissions.map((permission) => [permissionKey(permission), permission.allowed]));
  if (allowed.size !== actual.permissions.length || allowed.size !== STRIPE_COMMERCE_DATABASE_PERMISSIONS.length ||
    STRIPE_COMMERCE_DATABASE_PERMISSIONS.some((permission) => allowed.get(permissionKey(permission)) !== true)) {
    throw new Error("Usuário operacional não possui todos os privilégios de coluna exigidos pelo catálogo.");
  }
  return { databaseName: expected.databaseName, user: expected.user, verified: true as const };
}

/** Encerra a inspeção antes da primeira operação externa; não mantém locks durante chamadas Stripe. */
export async function withStripeCommerceDatabasePreflight<T>(
  input: { databaseUrl: string; mode: "test" | "live"; inspect: () => Promise<unknown> },
  operation: () => Promise<T>,
) {
  expectedDatabaseIdentity(input.databaseUrl, input.mode);
  const snapshot = await input.inspect();
  validateStripeCommerceDatabaseSnapshot(snapshot, input);
  return operation();
}
