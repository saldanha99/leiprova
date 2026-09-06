import Stripe from "stripe";
import postgres from "postgres";
import { CONTEST_CATALOG } from "../src/lib/commerce/catalog";
import { PLANS } from "../src/lib/plans";
import { validateStripeSyncTarget } from "../src/lib/commerce/stripe-mode-policy";
import {
  ensureMasterStripeCatalog,
  stripeCatalogSyncPreview,
} from "../src/lib/commerce/stripe-master-catalog";
import { ensureContestStripeCatalog } from "../src/lib/commerce/stripe-contest-catalog";

// Nenhuma escrita sem --apply; live exige destino e conta explicitamente identificados.
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--apply", "--reactivate", "--mode=test", "--mode=live"].includes(arg))
  )
    throw new Error("Opções aceitas: --mode=test|live, --apply e --reactivate.");
  if (args.includes("--mode=test") && args.includes("--mode=live"))
    throw new Error("Escolha somente um modo.");
  const mode = args.includes("--mode=live") ? "live" : "test";
  const reactivate = args.includes("--reactivate");
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ ...stripeCatalogSyncPreview(mode), reactivate }));
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
    const knownMasterPrices: Record<string, string | null> = {};
    for (const plan of PLANS) {
      const rows =
        await db`select id, stripe_price_id from plans where slug=${plan.slug} and amount_cents=${plan.priceCents} and currency='brl' and billing_type=${plan.billingMonths === 12 ? "year" : "month"}`;
      if (rows.length !== 1)
        throw new Error(
          "Plano Master ausente ou divergente no banco. Revise antes de sincronizar.",
        );
      knownMasterPrices[plan.slug] = rows[0].stripe_price_id;
    }
    for (const contest of CONTEST_CATALOG) {
      const [known] = await db`select stripe_product_id, stripe_price_monthly, stripe_price_annual from contest_store_products where slug=${contest.slug}`;
      const catalog = await ensureContestStripeCatalog(stripe, mode, contest, {
        reactivate,
        knownProductId: known?.stripe_product_id,
        knownPriceIds: { monthly: known?.stripe_price_monthly, annual: known?.stripe_price_annual },
      });
      const monthly = catalog.prices.find((price) => price.key === "monthly")!.priceId;
      const annual = catalog.prices.find((price) => price.key === "annual")!.priceId;
      const updated = await db`insert into contest_store_products (slug,stripe_product_id,stripe_price_monthly,stripe_price_annual,stripe_mode)
        values (${contest.slug},${catalog.productId},${monthly},${annual},${mode})
        on conflict(slug) do update set stripe_product_id=excluded.stripe_product_id,stripe_price_monthly=excluded.stripe_price_monthly,stripe_price_annual=excluded.stripe_price_annual,stripe_mode=excluded.stripe_mode,updated_at=now()
        where (contest_store_products.stripe_mode=excluded.stripe_mode or contest_store_products.stripe_product_id is null)
          and (contest_store_products.stripe_product_id is null or contest_store_products.stripe_product_id=excluded.stripe_product_id)
          and (contest_store_products.stripe_price_monthly is null or contest_store_products.stripe_price_monthly=excluded.stripe_price_monthly)
          and (contest_store_products.stripe_price_annual is null or contest_store_products.stripe_price_annual=excluded.stripe_price_annual)
        returning slug,stripe_product_id,stripe_price_monthly,stripe_price_annual,stripe_mode`;
      if (updated.length !== 1 || updated[0].slug !== contest.slug ||
        updated[0].stripe_product_id !== catalog.productId || updated[0].stripe_price_monthly !== monthly ||
        updated[0].stripe_price_annual !== annual || updated[0].stripe_mode !== mode) {
        throw new Error("Vínculo local do concurso divergiu durante a sincronização. Revise os IDs antes de retomar.");
      }
    }
    const master = await ensureMasterStripeCatalog(stripe, mode, { reactivate, knownPriceIds: knownMasterPrices });
    for (const { plan, priceId } of master.prices) {
      // IDs do banco e da configuração precisam apontar para o mesmo preço.
      const updated =
        await db`update plans set stripe_price_id=${priceId}, name=${plan.name}, updated_at=now() where slug=${plan.slug} and amount_cents=${plan.priceCents} and currency='brl' and billing_type=${plan.billingMonths === 12 ? "year" : "month"}
          and stripe_price_id is not distinct from ${knownMasterPrices[plan.slug]}
          returning id,stripe_price_id`;
      if (updated.length !== 1 || updated[0].stripe_price_id !== priceId)
        throw new Error(
          "Plano Master ausente, valor ou vínculo alterado no banco. Nenhum seed foi executado.",
        );
      console.log(`${plan.stripePriceEnv}=${priceId}`); // Identificador público, nunca segredo.
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
