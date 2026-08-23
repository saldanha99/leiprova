import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  leiprovaSql?: ReturnType<typeof postgres>;
  leiprovaDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  return postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: false,
    transform: { undefined: null },
  });
}

export function getDb() {
  if (!globalForDb.leiprovaSql) {
    globalForDb.leiprovaSql = createClient();
    globalForDb.leiprovaDb = drizzle(globalForDb.leiprovaSql, { schema });
  }

  return globalForDb.leiprovaDb!;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
