import { describe, expect, it } from "vitest";

import {
  officialSourceMonitorHasHardFailures,
  resolveOfficialLegalSource,
} from "@/lib/official-sources/monitor-policy";

describe("política do monitor de fontes oficiais", () => {
  it("exige correspondência exata de slug e URL para todo ato ativo", () => {
    expect(
      resolveOfficialLegalSource(
        "regime-juridico-servidores-federais",
        "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
      ),
    ).toMatchObject({ matched: true });
    expect(resolveOfficialLegalSource("ato-nao-registrado", "https://www.planalto.gov.br/lei.htm")).toEqual({
      matched: false,
      reason: "unregistered_slug",
    });
    expect(
      resolveOfficialLegalSource(
        "regime-juridico-servidores-federais",
        "https://www.planalto.gov.br/ccivil_03/leis/outra-lei.htm",
      ),
    ).toEqual({ matched: false, reason: "official_url_mismatch" });
  });

  it("sinaliza qualquer falha dura parcial sem confundir degradação do catálogo", () => {
    expect(officialSourceMonitorHasHardFailures({ failed: 1 }, { failed: 0 })).toBe(true);
    expect(officialSourceMonitorHasHardFailures({ failed: 0 }, { failed: 1 })).toBe(true);
    expect(officialSourceMonitorHasHardFailures({ failed: 0 }, { failed: 0 })).toBe(false);
  });
});
