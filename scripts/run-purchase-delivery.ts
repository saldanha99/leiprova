import { runPurchaseDeliveryWorker } from "../src/lib/commerce/purchase-delivery";
import { setTimeout as delay } from "node:timers/promises";

// O loop é explícito e pertence ao serviço da aplicação, não ao agendador do Codex.
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--run" && arg !== "--loop" && !/^--limit=\d+$/.test(arg)) ||
      new Set(args).size !== args.length || args.filter((arg) => arg.startsWith("--limit=")).length > 1)
    throw new Error("Opções inválidas.");
  if (args.includes("--loop") && !args.includes("--run")) throw new Error("Loop exige execução explícita.");
  const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limite inválido.");
  if (!args.includes("--run")) {
    console.log(JSON.stringify({ preview: true, sendsExecuted: false, limit }));
    return;
  }
  const stop = new AbortController();
  const requestStop = () => stop.abort();
  process.once("SIGTERM", requestStop);
  process.once("SIGINT", requestStop);
  try {
    do {
      const startedAt = Date.now();
      try {
        // Somente contagens e estados: nunca destinatários, payload, credenciais ou erro bruto.
        console.log(JSON.stringify(await runPurchaseDeliveryWorker({ limit })));
      } catch {
        console.error("purchase_delivery_worker_failed");
        if (!args.includes("--loop")) { process.exitCode = 1; break; }
      }
      if (!args.includes("--loop") || stop.signal.aborted) break;
      // Execuções longas nunca se sobrepõem; a próxima rodada começa no mínimo após um segundo.
      await delay(Math.max(1_000, 60_000 - (Date.now() - startedAt)), undefined, { signal: stop.signal }).catch(() => {});
    } while (!stop.signal.aborted);
  } finally {
    process.removeListener("SIGTERM", requestStop);
    process.removeListener("SIGINT", requestStop);
  }
}

void main().catch(() => {
  console.error("purchase_delivery_worker_failed");
  process.exitCode = 1;
});
