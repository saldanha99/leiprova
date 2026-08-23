import { randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Administrador LeiProva";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!databaseUrl) throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL.");
  if (!email || !email.includes("@")) {
    throw new Error("Defina ADMIN_BOOTSTRAP_EMAIL com um e-mail válido.");
  }
  if (!password || password.length < 16 || password.length > 128) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD deve ter entre 16 e 128 caracteres.");
  }

  const passwordHash = await hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const client = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    const result = await client.begin(async (transaction) => {
    const existing = await transaction<{ id: string }[]>`
      select id::text
      from users
      where lower(email) = ${email}
      limit 1
      for update
    `;

    let userId: string;
    let operation: "created" | "updated";

    if (existing[0]) {
      userId = existing[0].id;
      operation = "updated";
      await transaction`
        update users
        set
          email = ${email},
          name = ${name},
          password_hash = ${passwordHash},
          role = 'admin',
          updated_at = now()
        where id = ${userId}
      `;
      await transaction`delete from auth_sessions where user_id = ${userId}`;
    } else {
      operation = "created";
      const inserted = await transaction<{ id: string }[]>`
        insert into users (public_id, email, name, password_hash, role)
        values (${randomUUID()}, ${email}, ${name}, ${passwordHash}, 'admin')
        returning id::text
      `;
      userId = inserted[0].id;
    }

    await transaction`
      insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${userId},
        'admin.bootstrap',
        'user',
        ${userId},
        jsonb_build_object('operation', cast(${operation} as text), 'source', 'server_cli')
      )
    `;

    return { operation, userId };
    });

    console.log(`Super admin ${result.operation}: ${email} (id ${result.userId}).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao configurar super admin.");
  process.exitCode = 1;
});
