import Stripe from "stripe";
import postgres from "postgres";
import {
  CONTEST_CATALOG,
  CONTEST_ACCESS_OPTIONS,
  contestPriceLookupKey,
  contestTitle,
} from "../src/lib/commerce/catalog";
import { PLANS } from "../src/lib/plans";
import { validateStripeSyncTarget } from "../src/lib/commerce/stripe-mode-policy";

// Nenhuma escrita sem --apply; live exige destino e conta explicitamente identificados.
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--apply", "--mode=test", "--mode=live"].includes(arg))
  )
    throw new Error("Opções aceitas: --mode=test|live e --apply.");
  if (args.includes("--mode=test") && args.includes("--mode=live"))
    throw new Error("Escolha somente um modo.");
  const mode = args.includes("--mode=live") ? "live" : "test";
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify({
        mode: "dry-run",
        stripeMode: mode,
        contests: CONTEST_CATALOG.length,
        contestPrices: CONTEST_CATALOG.length * 2,
        masterPrices: PLANS.length,
        writes: false,
      }),
    );
    return;
  }
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const target = validateStripeSyncTarget({
    mode,
    secretKey: key,
    databaseUrl: process.env.LEIPROVA_COMMERCE_DATABASE_URL,
    environment: process.env.LEIPROVA_COMMERCE_ENVIRONMENT,
    expectedAccount: process.env.LEIPROVA_COMMERCE_EXPECTED_STRIPE_ACCOUNT,
    appUrl: process.env.APP_URL,
  });
  const stripe = new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
    maxNetworkRetries: 2,
  });
  const db = postgres(target.databaseUrl, { max: 1 });
  try {
    if (mode === "live" || target.expectedAccount) {
      const account = await stripe.accounts.retrieve(null);
      if (account.id !== target.expectedAccount)
        throw new Error("Conta Stripe divergente do destino autorizado.");
      if (
        mode === "live" &&
        (!account.charges_enabled || !account.details_submitted)
      )
        throw new Error(
          "Conta Stripe ainda não habilitada para aceitar pagamentos.",
        );
    }
    const foreignMode =
      await db`select slug from contest_store_products where stripe_mode <> ${mode} and stripe_product_id is not null limit 1`;
    if (foreignMode.length)
      throw new Error(
        "Banco contém produtos de outro modo Stripe. Não misture homologação e produção.",
      );
    const pendingBilling =
      await db`select id from subscriptions where status in ('active','trialing','past_due') limit 1`;
    if (mode === "live" && pendingBilling.length)
      throw new Error(
        "Há assinaturas existentes. A troca do catálogo Master exige reconciliação específica antes de continuar.",
      );
    for (const plan of PLANS) {
      const rows =
        await db`select id from plans where slug=${plan.slug} and amount_cents=${plan.priceCents} and currency='brl' and billing_type=${plan.billingMonths === 12 ? "year" : "month"}`;
      if (rows.length !== 1)
        throw new Error(
          "Plano Master ausente ou divergente no banco. Revise antes de sincronizar.",
        );
    }
    for (const contest of CONTEST_CATALOG) {
      const metadata = {
        app: "leiprova",
        commerce: "contest_v1",
        slug: contest.slug,
        editorial_status: "draft",
      };
      const found = await stripe.products.search({
        query: `metadata['app']:'leiprova' AND metadata['commerce']:'contest_v1' AND metadata['slug']:'${contest.slug}'`,
        limit: 2,
      });
      if (found.data.length > 1)
        throw new Error(
          "Produto duplicado na Stripe. Revise antes de continuar.",
        );
      const product =
        found.data[0] ??
        (await stripe.products.create(
          {
            name: `Editalume · ${contestTitle(contest)} · ${contest.editionLabel}`,
            metadata,
          },
          { idempotencyKey: `contest-product:${contest.slug}:v1` },
        ));
      if (product.livemode !== (mode === "live"))
        throw new Error("Produto de outro modo Stripe recusado.");
      const ids: string[] = [];
      for (const option of CONTEST_ACCESS_OPTIONS) {
        const lookup = contestPriceLookupKey(contest.slug, option.key);
        const existing = await stripe.prices.list({
          lookup_keys: [lookup],
          limit: 2,
        });
        const price =
          existing.data[0] ??
          (await stripe.prices.create(
            {
              product: product.id,
              unit_amount: option.amountCents,
              currency: "brl",
              lookup_key: lookup,
              metadata: { ...metadata, access_months: String(option.months) },
            },
            { idempotencyKey: lookup },
          ));
        if (
          price.livemode !== (mode === "live") ||
          price.recurring ||
          price.product !== product.id ||
          price.unit_amount !== option.amountCents ||
          price.currency !== "brl" ||
          !price.active
        )
          throw new Error("Preço existente incompatível.");
        ids.push(price.id);
      }
      await db`insert into contest_store_products (slug,stripe_product_id,stripe_price_6m,stripe_price_12m,stripe_mode)
        values (${contest.slug},${product.id},${ids[0]},${ids[1]},${mode})
        on conflict(slug) do update set stripe_product_id=excluded.stripe_product_id,stripe_price_6m=excluded.stripe_price_6m,stripe_price_12m=excluded.stripe_price_12m,stripe_mode=excluded.stripe_mode,updated_at=now()
        where contest_store_products.stripe_mode=excluded.stripe_mode or contest_store_products.stripe_product_id is null`;
    }
    for (const plan of PLANS) {
      const lookup = `leiprova_master_${plan.slug}_${plan.priceCents}_v1`;
      const found = await stripe.prices.list({
        lookup_keys: [lookup],
        limit: 2,
      });
      let price = found.data[0];
      if (!price) {
        const products = await stripe.products.search({
          query: `metadata['app']:'leiprova' AND metadata['plan_slug']:'${plan.slug}'`,
          limit: 2,
        });
        if (products.data.length > 1)
          throw new Error(
            "Produto Master duplicado. Revise antes de continuar.",
          );
        const product =
          products.data[0] ??
          (await stripe.products.create(
            {
              name: `Editalume Master · ${plan.name}`,
              metadata: { app: "leiprova", plan_slug: plan.slug },
            },
            { idempotencyKey: `master-product:${plan.slug}:v1` },
          ));
        price = await stripe.prices.create(
          {
            product: product.id,
            currency: "brl",
            unit_amount: plan.priceCents,
            recurring: {
              interval: plan.billingMonths === 12 ? "year" : "month",
            },
            lookup_key: lookup,
          },
          { idempotencyKey: lookup },
        );
      }
      if (
        price.livemode !== (mode === "live") ||
        !price.active ||
        price.currency !== "brl" ||
        price.unit_amount !== plan.priceCents ||
        price.recurring?.interval !==
          (plan.billingMonths === 12 ? "year" : "month") ||
        price.recurring?.interval_count !== 1
      )
        throw new Error("Preço Master divergente.");
      const product = await stripe.products.retrieve(
        typeof price.product === "string" ? price.product : price.product.id,
      );
      if (
        product.deleted ||
        product.metadata.app !== "leiprova" ||
        product.metadata.plan_slug !== plan.slug
      )
        throw new Error("Identidade do produto Master divergente.");
      // IDs do banco e da configuração precisam apontar para o mesmo preço.
      const updated =
        await db`update plans set stripe_price_id=${price.id}, name=${plan.name}, updated_at=now() where slug=${plan.slug} and amount_cents=${plan.priceCents} and currency='brl' and billing_type=${plan.billingMonths === 12 ? "year" : "month"} returning id`;
      if (updated.length !== 1)
        throw new Error(
          "Plano Master ausente ou valor divergente no banco. Nenhum seed foi executado.",
        );
      console.log(`${plan.stripePriceEnv}=${price.id}`); // Identificador público, nunca segredo.
    }
    console.log(
      `Catálogo sincronizado em ${mode.toUpperCase()}. Nenhuma liberação editorial, cobrança ou flag de venda alterada.`,
    );
  } finally {
    await db.end();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Stripe.errors.StripeError
      ? `Stripe recusou a operação (${error.type}). Confira permissões e modo na conta correta.`
      : error instanceof Error
        ? error.message
            .replace(
              /(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_-]+/g,
              "[segredo removido]",
            )
            .replace(/postgres(?:ql)?:\/\/\S+/g, "[conexão removida]")
        : "Falha na sincronização.",
  );
  process.exitCode = 1;
});
