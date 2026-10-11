import "server-only";

import { isCommerceOpen } from "@/lib/launch";
import type { PlanDefinition } from "@/lib/plans";
import {
  getCheckoutAvailability,
  masterCheckoutMode,
  type CheckoutAvailability,
} from "@/lib/stripe";
import { listReleasedContestProducts } from "./store";

/** Decisão do proprietário (11/10/2026): com MASTER_CHECKOUT_ENABLED=auto, o
 * Master abre sozinho quando houver ao menos 3 concursos à venda, para não
 * cobrar o acesso a todo o catálogo com um único concurso disponível. */
export const MASTER_AUTO_MIN_RELEASED_CONTESTS = 3;

export function masterOpensWithReleasedContests(releasedContests: number) {
  return releasedContests >= MASTER_AUTO_MIN_RELEASED_CONTESTS;
}

/** Master aberto: chave "true", ou "auto" com o mínimo de concursos à venda.
 * Falha fechada quando a contagem não pode ser lida. A cobertura do catálogo
 * pelo período contratado continua sendo conferida no checkout e no webhook. */
export async function isMasterCheckoutEnabled() {
  const mode = masterCheckoutMode();
  if (mode !== "auto") return mode === "open";
  try {
    return masterOpensWithReleasedContests((await listReleasedContestProducts()).length);
  } catch {
    return false;
  }
}

/** Disponibilidade dos planos Master: a mesma checagem da venda, mais a chave própria. */
export async function getMasterCheckoutAvailability(
  plan: Pick<PlanDefinition, "stripePriceEnv">,
): Promise<CheckoutAvailability> {
  if (!(await isMasterCheckoutEnabled())) return { available: false, reason: "disabled" };
  return getCheckoutAvailability(plan);
}

/** Ofertas do Master (home, cadastro com plano, cartões e carrinho) só aparecem
 * como compráveis quando o Master também estiver aberto. */
export async function isMasterCommerceOpen() {
  return isCommerceOpen() && (await isMasterCheckoutEnabled());
}
