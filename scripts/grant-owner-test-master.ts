import { randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import postgres from "postgres";

import {
  ownerTestMasterBlocker,
  parseOwnerTestMasterConfig,
} from "./lib/owner-test-master";

// Concede (ou revoga) Master de teste a uma conta de aluno do proprietário.
// Assinatura `manual`, fim finito, sem Stripe, cobrança ou mudança de flags.
async function main() {
  const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL.");
  const config = parseOwnerTestMasterConfig(process.env);

  const passwordHash =
    config.mode === "grant" && config.password
      ? await hash(config.password, {
          algorithm: 2,
          memoryCost: 19_456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        })
      : null;

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const result = await client.begin(async (tx) => {
      const [account] = await tx<{ id: string; role: string }[]>`
        select id::text, role from users where lower(email) = ${config.email} limit 1 for update
      `;

      if (config.mode === "revoke") {
        if (!account) return { message: "Conta não encontrada; nada a revogar." };
        const revoked = await tx`
          update subscriptions
          set status = 'expired', access_ends_at = now(), current_period_end = now(), updated_at = now()
          where user_id = ${account.id} and provider = 'manual'
            and status in ('active', 'trialing', 'past_due')
        `;
        await tx`
          insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
          values (${account.id}, 'access.owner_test_master_revoked', 'user', ${account.id},
            jsonb_build_object('source', 'server_cli', 'revoked', ${revoked.count}::int))
        `;
        return { message: `Master de teste revogado (${revoked.count} registro).` };
      }

      const [current] = account
        ? await tx<{ id: string; provider: string }[]>`
            select id::text, provider from subscriptions
            where user_id = ${account.id} and status in ('active', 'trialing', 'past_due')
            limit 1 for update
          `
        : [];
      const blocker = ownerTestMasterBlocker(
        account ? { role: account.role } : null,
        current ? { provider: current.provider } : null,
        passwordHash !== null,
      );
      if (blocker) throw new Error(blocker);

      const [plan] = await tx<{ id: string }[]>`
        select id::text from plans where slug = ${config.planSlug} limit 1
      `;
      if (!plan) throw new Error(`Plano ${config.planSlug} não encontrado; rode o seed antes.`);

      let userId: string;
      if (account) {
        userId = account.id;
        if (passwordHash) {
          await tx`update users set password_hash = ${passwordHash}, updated_at = now() where id = ${userId}`;
          await tx`delete from auth_sessions where user_id = ${userId}`;
        }
      } else {
        const [inserted] = await tx<{ id: string }[]>`
          insert into users (public_id, email, name, password_hash, role, email_verified_at, terms_accepted_at)
          values (${randomUUID()}, ${config.email}, ${config.name}, ${passwordHash!}, 'student', now(), now())
          returning id::text
        `;
        userId = inserted.id;
      }

      const interval = `${config.days} days`;
      const [subscription] = current
        ? await tx<{ ends: Date }[]>`
            update subscriptions
            set plan_id = ${plan.id}, status = 'active', current_period_start = now(),
              current_period_end = now() + ${interval}::interval,
              access_ends_at = now() + ${interval}::interval,
              cancel_at_period_end = true, updated_at = now()
            where id = ${current.id}
            returning access_ends_at as ends
          `
        : await tx<{ ends: Date }[]>`
            insert into subscriptions (user_id, plan_id, provider, status, current_period_start,
              current_period_end, access_ends_at, cancel_at_period_end)
            values (${userId}, ${plan.id}, 'manual', 'active', now(),
              now() + ${interval}::interval, now() + ${interval}::interval, true)
            returning access_ends_at as ends
          `;

      await tx`
        insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
        values (${userId}, 'access.owner_test_master_granted', 'user', ${userId},
          jsonb_build_object('source', 'server_cli', 'provider', 'manual',
            'plan', cast(${config.planSlug} as text), 'days', ${config.days}::int,
            'account', cast(${account ? "existing" : "created"} as text)))
      `;

      return {
        message: `Master de teste ativo para ${config.email} até ${subscription.ends.toISOString()} (conta ${account ? "existente" : "criada"}, papel student).`,
      };
    });
    console.log(result.message);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao conceder Master de teste.");
  process.exitCode = 1;
});
