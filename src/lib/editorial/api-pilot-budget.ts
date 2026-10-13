import { z } from "zod";

// One owner-authorized pilot, never a daily allowance. USD3 at a conservative
// budget conversion ceiling of BRL10/USD reserves at most BRL30; not an FX quote.
export const PILOT_MAX_MICRO_USD = 3_000_000;
export const pilotBudgetSchema = z.object({
  schemaVersion: z.literal(1), pilotId: z.literal("editorial-api-20261013"),
  maxMicroUsd: z.literal(PILOT_MAX_MICRO_USD), maxTotalBrl: z.literal(30),
  brlPerUsdCeiling: z.literal(10), spentMicroUsd: z.number().int().nonnegative().max(PILOT_MAX_MICRO_USD),
  reservations: z.record(z.string(), z.number().int().positive()),
  receipts: z.record(z.string(), z.number().int().nonnegative()),
}).strict().refine(ledger => Object.values(ledger.receipts).reduce((sum, value) => sum + value, 0) === ledger.spentMicroUsd,
  "Saldo e recibos divergentes; não reiniciar ou liberar orçamento.");
export type PilotBudget = z.infer<typeof pilotBudgetSchema>;

export function newPilotBudget(): PilotBudget {
  return pilotBudgetSchema.parse({ schemaVersion: 1, pilotId: "editorial-api-20261013",
    maxMicroUsd: PILOT_MAX_MICRO_USD, maxTotalBrl: 30, brlPerUsdCeiling: 10,
    spentMicroUsd: 0, reservations: {}, receipts: {} });
}

export function reservePilotCall(raw: unknown, id: string, maximumMicroUsd: number): PilotBudget {
  const ledger = pilotBudgetSchema.parse(raw);
  if (!id || !Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd <= 0) throw new Error("Reserva inválida.");
  if (Object.keys(ledger.reservations).length) throw new Error("Custo pendente exige reconciliação antes de repetir.");
  if (Object.hasOwn(ledger.receipts, id)) throw new Error("Chamada já liquidada; não repetir.");
  if (ledger.spentMicroUsd + maximumMicroUsd > ledger.maxMicroUsd) throw new Error("Teto total do piloto insuficiente.");
  return { ...ledger, reservations: { [id]: maximumMicroUsd } };
}

export function settlePilotCall(raw: unknown, id: string, actualMicroUsd: number): PilotBudget {
  const ledger = pilotBudgetSchema.parse(raw);
  const reserved = ledger.reservations[id];
  if (!reserved || !Number.isSafeInteger(actualMicroUsd) || actualMicroUsd < 0 || actualMicroUsd > reserved) {
    throw new Error("Custo ausente ou acima da reserva; manter bloqueio para reconciliação.");
  }
  return { ...ledger, spentMicroUsd: ledger.spentMicroUsd + actualMicroUsd,
    reservations: {}, receipts: { ...ledger.receipts, [id]: actualMicroUsd } };
}

export function usageCostMicroUsd(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Recibo sem custo verificável.");
  const amount = Math.ceil(value * 1_000_000);
  if (!Number.isSafeInteger(amount)) throw new Error("Custo inválido.");
  return amount;
}
