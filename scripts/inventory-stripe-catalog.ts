import Stripe from "stripe";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  collectInventory, inventoryCoverage, inventoryLineItems, inventoryPrice, inventoryProduct,
  LEIPROVA_STRIPE_ACCOUNT, requireInventoryMode, resolveStripeInventoryDirectory, validateInventoryTarget,
} from "../src/lib/commerce/stripe-inventory";

// Somente GETs na Stripe. Sem banco, cancelamento, arquivamento ou remoção.
async function main() {
  const args = process.argv.slice(2);
  if (new Set(args).size !== args.length || args.some((arg) => !["--mode=test", "--mode=live", "--capture"].includes(arg)) ||
    (args.includes("--mode=test") && args.includes("--mode=live"))) throw new Error("Opções inválidas.");
  const mode = args.includes("--mode=live") ? "live" : "test";
  if (!args.includes("--capture")) {
    console.log(JSON.stringify({ mode: "preview", stripeMode: mode, expectedAccount: LEIPROVA_STRIPE_ACCOUNT,
      remoteWrites: false, captureExecuted: false,
      resources: ["products", "prices", "active_payment_links", "open_checkout_sessions", "subscriptions"] }));
    return;
  }
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const target = validateInventoryTarget(key, mode, process.env.LEIPROVA_COMMERCE_EXPECTED_STRIPE_ACCOUNT);
  const directory = await resolveStripeInventoryDirectory(fileURLToPath(new URL("../", import.meta.url)));
  const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia", maxNetworkRetries: 2 });
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== target.expectedAccount) throw new Error("Conta recebida diverge da autorizada.");
  const startedAt = new Date().toISOString();
  const products = await collectInventory(stripe.products.list({ limit: 100 }));
  // Os filtros explícitos incluem preços arquivados, não apenas o padrão ativo.
  const prices = [
    ...await collectInventory(stripe.prices.list({ limit: 100, active: true })),
    ...await collectInventory(stripe.prices.list({ limit: 100, active: false })),
  ];
  if (new Set(prices.map((price) => price.id)).size !== prices.length)
    throw new Error("Preço mudou entre leituras; refaça o inventário.");
  const links = await collectInventory(stripe.paymentLinks.list({ limit: 100, active: true }));
  const sessions = await collectInventory(stripe.checkout.sessions.list({ limit: 100, status: "open" }));
  const subscriptions = await collectInventory(stripe.subscriptions.list({ limit: 100, status: "all" }));
  for (const row of [...products, ...prices, ...links, ...sessions, ...subscriptions]) requireInventoryMode(row, mode);
  const paymentLinks = [];
  for (const link of links) {
    const lines = await collectInventory(stripe.paymentLinks.listLineItems(link.id, { limit: 100 }));
    for (const line of lines) if (line.price) requireInventoryMode(line.price, mode);
    paymentLinks.push({ id: link.id, active: link.active, items: inventoryLineItems(lines) });
  }
  const checkoutSessions = [];
  for (const session of sessions) {
    const lines = await collectInventory(stripe.checkout.sessions.listLineItems(session.id, { limit: 100 }));
    for (const line of lines) if (line.price) requireInventoryMode(line.price, mode);
    checkoutSessions.push({ id: session.id, created: session.created, status: session.status,
      paymentStatus: session.payment_status, items: inventoryLineItems(lines) });
  }
  const subscriptionReferences = [];
  for (const subscription of subscriptions) {
    // Paginar os itens também: a lista embutida da assinatura pode ser parcial.
    const items = await collectInventory(stripe.subscriptionItems.list({ subscription: subscription.id, limit: 100 }));
    for (const item of items) requireInventoryMode(item.price, mode);
    subscriptionReferences.push({ id: subscription.id, status: subscription.status,
      priceIds: items.map((item) => item.price.id),
      productIds: items.map((item) => typeof item.price.product === "string" ? item.price.product : item.price.product.id) });
  }
  const report = { schemaVersion: 1, accountId: account.id, stripeMode: mode, startedAt, completedAt: new Date().toISOString(),
    readOnly: true, atomicSnapshot: false, remoteWrites: false, coverage: inventoryCoverage(mode),
    note: "Leitura paginada, não snapshot transacional. Conferir estado atual de cada ID antes de qualquer retirada. Este operador não remove nada.",
    counts: { products: products.length, activeProducts: products.filter((product) => product.active).length,
      catalogPrices: prices.length, activePaymentLinks: links.length, openCheckoutSessions: sessions.length, subscriptions: subscriptions.length },
    products: products.map(inventoryProduct), prices: prices.map(inventoryPrice), paymentLinks, checkoutSessions, subscriptionReferences };
  const text = JSON.stringify(report, null, 2) + "\n";
  if (await resolveStripeInventoryDirectory(fileURLToPath(new URL("../", import.meta.url))) !== directory)
    throw new Error("Pasta mudou durante o inventário.");
  const destination = path.join(directory, `inventory-${mode}-${startedAt.replace(/[:.]/g, "-")}.json`);
  await writeFile(destination, text, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ accountId: account.id, stripeMode: mode, counts: report.counts, readOnly: true,
    file: destination, sha256: createHash("sha256").update(text).digest("hex") }));
}

main().catch(() => {
  // Erros do provedor podem conter detalhes privados; não despejar a exceção.
  console.error("Inventário não concluído. Confira conta, modo, permissões de leitura e pasta privada. Nenhuma alteração remota foi executada.");
  process.exitCode = 1;
});
