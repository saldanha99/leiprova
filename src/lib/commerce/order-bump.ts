import { z } from "zod";

/**
 * Oferta extra no checkout (order bump). DESLIGADA por padrão: só aparece com
 * ORDER_BUMP_CONFIG preenchido. Não define preço: o valor vem de um preço que já
 * existe na Stripe (stripePriceId) e o texto mostra o preço configurado aqui, que
 * precisa ser o mesmo do preço da Stripe (o checkout confere antes de cobrar).
 *
 * Formato (JSON numa linha):
 * {"kind":"second_contest","headline":"...","priceCents":0,"stripePriceId":"price_...","stripeCouponId":null}
 * {"kind":"master_upgrade","headline":"...","priceCents":0,"stripePriceId":"price_..."}
 */
export const orderBumpConfigSchema = z
  .object({
    kind: z.enum(["second_contest", "master_upgrade"]),
    headline: z.string().trim().min(10).max(120),
    detail: z.string().trim().max(240).optional(),
    priceCents: z.number().int().positive(),
    stripePriceId: z.string().regex(/^price_[A-Za-z0-9]{8,}$/),
    stripeCouponId: z.string().regex(/^[A-Za-z0-9_-]{3,64}$/).nullable().optional(),
  })
  .strict();

export type OrderBumpConfig = z.infer<typeof orderBumpConfigSchema>;

/** Lê a configuração; qualquer erro desliga a oferta (falha fechada). */
export function readOrderBumpConfig(raw = process.env.ORDER_BUMP_CONFIG): OrderBumpConfig | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = orderBumpConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Mostra a oferta só quando ela faz sentido para o carrinho atual. */
export function orderBumpApplies(
  config: OrderBumpConfig | null,
  cart: { contestCount: number; hasMaster: boolean; maxContests: number },
) {
  if (!config) return false;
  if (config.kind === "master_upgrade") return !cart.hasMaster;
  return !cart.hasMaster && cart.contestCount > 0 && cart.contestCount < cart.maxContests;
}
