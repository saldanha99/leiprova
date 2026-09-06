import Stripe from "stripe";
import { constants } from "node:fs";
import { chmod, mkdir, open, realpath } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectInventory, validateInventoryTarget } from "../src/lib/commerce/stripe-inventory";
import { buildStripeRetirementPlan, retireStripeCatalog, verifyAuthorizedUiBytes,
  type StripeRetirementClient } from "../src/lib/commerce/stripe-retirement";

const project = fileURLToPath(new URL("../", import.meta.url));

async function privateBase() {
  const expected = path.join(await realpath(project), ".local", "commerce");
  if (await realpath(expected) !== expected) throw new Error("Base privada redirecionada.");
  return expected;
}

async function privateJsonFile(filename: string, base: string) {
  const resolved = path.resolve(project, filename);
  if (!resolved.startsWith(`${base}${path.sep}`) || await realpath(resolved) !== resolved)
    throw new Error("Inventário fora da pasta privada ou redirecionado.");
  const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > 8 * 1024 * 1024) throw new Error("Inventário inválido.");
    const text = await handle.readFile("utf8");
    const after = await handle.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || await realpath(resolved) !== resolved)
      throw new Error("Inventário alterado durante leitura.");
    return text;
  } finally { await handle.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (new Set(args).size !== args.length || !args.includes("--mode=live") || args.some((arg) =>
    arg !== "--mode=live" && arg !== "--apply" && !arg.startsWith("--inventory=") && !arg.startsWith("--ui=")))
    throw new Error("Opções inválidas.");
  const inventoryArgs = args.filter((arg) => arg.startsWith("--inventory="));
  const uiArgs = args.filter((arg) => arg.startsWith("--ui="));
  if (inventoryArgs.length !== 1 || uiArgs.length !== 1) throw new Error("Informe os dois inventários.");
  const base = await privateBase();
  const uiText = await privateJsonFile(uiArgs[0].slice(5), base);
  verifyAuthorizedUiBytes(uiText);
  const apiText = await privateJsonFile(inventoryArgs[0].slice(12), base);
  const plan = buildStripeRetirementPlan(uiText, JSON.parse(apiText));
  const summary = { accountId: plan.accountId, stripeMode: plan.mode, fingerprint: plan.fingerprint,
    approvedProducts: plan.products.map((product) => product.id),
    catalogPriceCount: plan.products.reduce((sum, product) => sum + product.prices.length, 0),
    preservedProductIds: plan.preservedProductIds, excludedOtherProducts: plan.excludedOtherProducts,
    existingSubscriptionReferences: plan.existingSubscriptionReferences,
    subscriptionCancellation: false, deleteOperations: false, checkoutChanges: false };
  if (!args.includes("--apply")) {
    console.log(JSON.stringify({ ...summary, mode: "preview", remoteVerified: false, remoteWrites: false }));
    return;
  }
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  validateInventoryTarget(key, "live", process.env.LEIPROVA_COMMERCE_EXPECTED_STRIPE_ACCOUNT);
  if (!key.startsWith("rk_live_")) throw new Error("Use a chave restrita live autorizada.");
  const directory = path.join(base, "stripe-retirement");
  await mkdir(directory, { mode: 0o700, recursive: true });
  if (await privateBase() !== base || await realpath(directory) !== directory) throw new Error("Destino privado redirecionado.");
  await chmod(directory, 0o700);
  const receiptPath = path.join(directory, `retirement-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.jsonl`);
  const receipt = await open(receiptPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let sequence = 0;
  const record = async (event: object) => {
    await receipt.writeFile(JSON.stringify({ sequence: sequence++, at: new Date().toISOString(), ...event }) + "\n");
    await receipt.sync();
  };
  try {
    await record({ event: "started", ...summary,
      inventorySha256: createHash("sha256").update(apiText).digest("hex"),
      uiSha256: createHash("sha256").update(uiText).digest("hex"),
      note: "Arquivar não cancela assinaturas nem impede suas cobranças futuras. Intent sem confirmação exige releitura. Inline prices fora do inventário." });
    console.log(JSON.stringify({ mode: "apply", receipt: receiptPath, fingerprint: plan.fingerprint }));
    const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia", maxNetworkRetries: 2 });
    const priceSummary = (price: Stripe.Price) => ({ id: price.id, active: price.active, livemode: price.livemode,
      productId: typeof price.product === "string" ? price.product : price.product.id });
    const client: StripeRetirementClient = {
      accountId: async () => (await stripe.accounts.retrieve(null)).id,
      hasActiveLinksOrOpenSessions: async () => {
        const links = await stripe.paymentLinks.list({ active: true, limit: 1 });
        const sessions = await stripe.checkout.sessions.list({ status: "open", limit: 1 });
        return Boolean(links.data.length || links.has_more || sessions.data.length || sessions.has_more);
      },
      product: async (id) => {
        const product = await stripe.products.retrieve(id);
        return { id: product.id, name: product.name, active: product.active, livemode: product.livemode, deleted: Boolean(product.deleted) };
      },
      price: async (id) => priceSummary(await stripe.prices.retrieve(id)),
      productPrices: async (id) => [
        ...await collectInventory(stripe.prices.list({ product: id, active: true, limit: 100 })),
        ...await collectInventory(stripe.prices.list({ product: id, active: false, limit: 100 })),
      ].map(priceSummary),
      archiveProduct: async (id, idempotencyKey) => { await stripe.products.update(id, { active: false }, { idempotencyKey }); },
      archivePrice: async (id, idempotencyKey) => { await stripe.prices.update(id, { active: false }, { idempotencyKey }); },
    };
    await retireStripeCatalog(uiText, JSON.parse(apiText), client, record);
    await record({ event: "completed", fingerprint: plan.fingerprint, productsVerified: plan.products.length });
    console.log(JSON.stringify({ status: "completed", receipt: receiptPath, productsVerified: plan.products.length }));
  } catch {
    await record({ event: "interrupted", completion: "not_certified", action: "Revisar intents e estado remoto antes de retomar; não presumir rollback." });
    throw new Error("Arquivamento interrompido; recibo parcial preservado.");
  } finally { await receipt.close(); }
}

void main().catch(() => {
  // Nunca imprimir erros Stripe, objetos de cliente, URLs privadas ou credenciais.
  console.error("Operação não concluída. Confira inventários, conta, chave restrita e recibo privado. Pode haver arquivamentos parciais; não há rollback automático.");
  process.exitCode = 1;
});
