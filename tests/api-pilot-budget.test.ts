import { describe, expect, it } from "vitest";
import { newPilotBudget, reservePilotCall, settlePilotCall, usageCostMicroUsd } from "@/lib/editorial/api-pilot-budget";

describe("piloto com teto total de R$30", () => {
  it("recusa a próxima chamada antes de exceder o teto, incluindo sua reserva máxima", () => {
    const ledger = { ...newPilotBudget(), spentMicroUsd: 2_999_990, receipts: { earlier: 2_999_990 } };
    expect(() => reservePilotCall(ledger, "next", 11)).toThrow("Teto total");
    expect(reservePilotCall(ledger, "last", 10).reservations.last).toBe(10);
  });
  it("não repete chamada com custo incerto, inclusive depois de serializar/reiniciar", () => {
    const ledger = reservePilotCall(newPilotBudget(), "generation-1", 100_000);
    expect(() => reservePilotCall(JSON.parse(JSON.stringify(ledger)), "generation-1", 100_000)).toThrow("pendente");
    expect(() => reservePilotCall(ledger, "another", 1)).toThrow("pendente");
  });
  it("liquida gasto real e impede repetir o mesmo recibo", () => {
    const ledger = settlePilotCall(reservePilotCall(newPilotBudget(), "one", 100_000), "one", 55_000);
    expect(ledger.spentMicroUsd).toBe(55_000);
    expect(ledger.reservations).toEqual({});
    expect(() => reservePilotCall(ledger, "one", 100_000)).toThrow("já liquidada");
  });
  it("não libera custo ausente, negativo ou acima do máximo reservado", () => {
    const ledger = reservePilotCall(newPilotBudget(), "one", 100);
    for (const value of [-1, 101, NaN, Infinity]) expect(() => settlePilotCall(ledger, "one", value)).toThrow();
    for (const value of [undefined, null, "0.1", NaN, -1]) expect(() => usageCostMicroUsd(value)).toThrow();
    expect(ledger.reservations.one).toBe(100);
  });
  it("recusa alterar orçamento, conversão ou identidade do piloto ao retomar", () => {
    for (const patch of [{ maxTotalBrl: 100 }, { maxMicroUsd: 5_000_000 }, { brlPerUsdCeiling: 5 }, { pilotId: "other" }]) {
      expect(() => reservePilotCall({ ...newPilotBudget(), ...patch }, "one", 10)).toThrow();
    }
  });
  it("arredonda frações para cima e soma o gasto de todas as etapas", () => {
    expect(usageCostMicroUsd(0.0000001)).toBe(1);
    let ledger = newPilotBudget();
    for (const id of ["generation", "verification"]) ledger = settlePilotCall(reservePilotCall(ledger, id, 200), id, 123);
    expect(ledger.spentMicroUsd).toBe(246);
  });
  it("não permite zerar o saldo deixando recibos pagos no arquivo", () => {
    expect(() => reservePilotCall({ ...newPilotBudget(), receipts: { paid: 10 } }, "new", 1)).toThrow("divergentes");
  });
});
