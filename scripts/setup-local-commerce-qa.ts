import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { z } from "zod";
import { bindSyntheticProductQuestions } from "./lib/synthetic-product-bindings";
import {
  CONTEST_ACCESS_OPTIONS,
  CONTEST_CATALOG,
} from "../src/lib/commerce/catalog";

const accountSchema = z.object({
  environment: z.literal("synthetic-local-only"),
  accounts: z.array(
    z.object({
      email: z.string().endsWith("@example.invalid"),
      role: z.enum(["student", "admin"]),
      name: z.string(),
      access: z.enum(["admin", "master", "contest", "free"]),
      password: z.string().min(15),
    }),
  ),
});
async function main() {
  const url = process.env.LEIPROVA_TEST_DATABASE_URL;
  if (!url) throw new Error("Informe o banco sintético.");
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55439" ||
    parsed.pathname !== "/leiprova_automation_test" ||
    parsed.username !== "leiprova_test"
  )
    throw new Error("Somente banco local sintético de QA.");
  const accounts = accountSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../.local/commerce/acessos-qa.json", import.meta.url),
        "utf8",
      ),
    ),
  ).accounts;
  const db = postgres(url, { max: 1 });
  try {
    for (const contest of CONTEST_CATALOG)
      await db`insert into contest_store_products(slug) values(${contest.slug}) on conflict do nothing`;
    const [plan] =
      await db`insert into plans(slug,name,description,billing_type,amount_cents,is_active)
      values('qa-commerce-master','Master sintético de QA','Somente testes locais','month',29700,false)
      on conflict(slug) do update set name=excluded.name returning id`;
    const [fixture] = await db`select o.id from contest_opportunities o
      join question_opportunities qo on qo.opportunity_id=o.id
      join questions q on q.id=qo.question_id
      join legal_articles a on a.id=q.legal_article_id
      join legal_versions v on v.id=a.legal_version_id
      join opportunity_requirements r on r.opportunity_id=o.id and r.legal_article_id=a.id
      where o.slug like 'teste-%' and v.source_url='https://example.invalid/test-fixture'
      and q.editorial_status='reviewed' and r.editorial_status='reviewed' and a.editorial_status='reviewed'
      and o.editorial_status='reviewed' and v.status='current' order by o.id limit 1`;
    if (!fixture)
      throw new Error("Prepare primeiro as questões sintéticas de QA.");
    for (const account of accounts) {
      const passwordHash = await hash(account.password, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const [user] =
        await db`insert into users(public_id,email,name,role,password_hash,email_verified_at)
        values(${randomUUID()},${account.email},${account.name},${account.role},${passwordHash},now())
        on conflict(lower(email)) do update set password_hash=excluded.password_hash,role=excluded.role returning id`;
      if (account.access === "master") {
        await db`insert into subscriptions(user_id,plan_id,provider,status,access_ends_at)
          values(${user.id},${plan.id},'synthetic_test','active',now()+interval '30 days')
          on conflict(user_id) where status in ('active','trialing','past_due')
          do update set access_ends_at=excluded.access_ends_at,status='active',updated_at=now()
          where subscriptions.provider='synthetic_test'`;
      }
      if (account.access === "contest") {
        const slug = CONTEST_CATALOG.find(
          (item) => item.acronym === "PC-BA" && item.role === "Delegado",
        )!.slug;
        const id = "qa-commerce-avulso-order";
        await db`update contest_store_products set opportunity_id=${fixture.id} where slug=${slug}`;
        await bindSyntheticProductQuestions(db, slug);
        const monthly = CONTEST_ACCESS_OPTIONS.find(
          (item) => item.key === "monthly",
        )!;
        const lines = [
          {
            productSlug: slug,
            accessKey: monthly.key,
            months: monthly.months,
            amountCents: monthly.amountCents,
            stripePriceId: "synthetic-no-stripe",
            opportunityId: Number(fixture.id),
          },
        ];
        await db`insert into contest_orders(id,user_id,status,amount_cents,lines,stripe_mode)
          values(${id},${user.id},'paid',${monthly.amountCents},${db.json(lines)},'test')
          on conflict(id) do update set lines=excluded.lines,amount_cents=excluded.amount_cents,updated_at=now()
          where contest_orders.user_id=excluded.user_id and contest_orders.stripe_mode='test'
          and contest_orders.stripe_session_id is null and contest_orders.stripe_subscription_id is null`;
        await db`insert into contest_purchases(order_id,product_slug,opportunity_id,user_id,status,access_starts_at,access_ends_at)
          values(${id},${slug},${fixture.id},${user.id},'active',now(),now()+interval '1 month')
          on conflict(order_id,product_slug) do update set status='active',
          access_starts_at=excluded.access_starts_at,access_ends_at=excluded.access_ends_at,updated_at=now()
          where contest_purchases.user_id=excluded.user_id`;
      }
      console.log(`${account.email}: ${account.access} (somente QA local)`);
    }
    await db`grant select on contest_store_products,contest_product_question_bindings to leiprova_automation_app`;
    await db`grant select,insert,update on contest_orders,contest_purchases to leiprova_automation_app`;
  } finally {
    await db.end();
  }
}
void main().catch(() => {
  console.error(
    "Falha no setup local. Nenhum banco real é aceito. Confira fixtures e arquivo privado de acessos.",
  );
  process.exitCode = 1;
});
