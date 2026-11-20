import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { followupsAfter } from "@/lib/editorial/agent-work-queue";

const bridge = readFileSync(new URL("../scripts/editorial-agent-work.ts", import.meta.url), "utf8");

describe("follow-up imediato depois da conclusão", () => {
  it("roda só depois do mapa preparado do Guardião", () => {
    expect(followupsAfter("mapping:123", { state: "prepared" })).toBe(true);
    // Recibo repetido de uma resposta já aplicada também pode abrir autoria.
    expect(followupsAfter("mapping:123", { state: "prepared", replayed: true })).toBe(true);
  });

  it("não roda depois de autoria, bloqueio, substituição ou descoberta", () => {
    expect(followupsAfter("author:123", { state: "prepared" })).toBe(false);
    expect(followupsAfter("mapping:123", { state: "blocked" })).toBe(false);
    expect(followupsAfter("mapping:123", { state: "superseded" })).toBe(false);
    expect(followupsAfter("discovery:cebraspe:2026-11-20", { state: "prepared" })).toBe(false);
    expect(followupsAfter("mapping:abc", { state: "prepared" })).toBe(false);
    expect(followupsAfter("mapping:1", null)).toBe(false);
  });

  it("a ponte consulta a regra antes do lote de follow-ups", () => {
    expect(bridge).toMatch(/if\(followupsAfter\(request\.jobKey,result\)\) \{\s+try \{ await prepareAgentWork\(db,new Date\(\),\{followupsOnly:true\}\); \}/u);
  });
});
