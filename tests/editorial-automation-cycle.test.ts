import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  runExamLicensingSteps,
  runIsolatedStep,
  type EditorialStepFailure,
} from "@/lib/editorial/automation-cycle";
import type { LicenseEmailSender } from "@/lib/licensing/exam-license-automation";

type LicensingDatabase = Parameters<typeof runExamLicensingSteps>[0];

// Mesmo formato do erro que derrubou o worker de 14/09 a 27/09/2026.
function driverDateError() {
  return new Error("Failed query: select $1\nparams: Sun Sep 27 2026", {
    cause: Object.assign(
      new TypeError('The "string" argument must be of type string. Received an instance of Date'),
      { code: "ERR_INVALID_ARG_TYPE" },
    ),
  });
}

describe("etapas isoladas do ciclo editorial", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devolve o resultado da etapa sem registrar falha", async () => {
    const failures: EditorialStepFailure[] = [];

    await expect(
      runIsolatedStep(failures, "documents", async () => ({ captured: 2 })),
    ).resolves.toEqual({ captured: 2 });
    expect(failures).toEqual([]);
  });

  it("registra só o código seguro e deixa o ciclo seguir", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failures: EditorialStepFailure[] = [];

    await expect(
      runIsolatedStep(failures, "drafts", async () => {
        throw driverDateError();
      }),
    ).resolves.toBeNull();

    expect(failures).toEqual([{ step: "drafts", code: "ERR_INVALID_ARG_TYPE" }]);
    expect(warn).toHaveBeenCalledWith("[etapa:drafts]", '{"code":"ERR_INVALID_ARG_TYPE"}');
    expect(JSON.stringify([failures, warn.mock.calls])).not.toMatch(/Failed query|params|Received/u);
  });

  it("mantém preparação e conciliação quando o envio de licenças falha", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const execute = vi.fn(async (query: SQL) => {
      if (new PgDialect().sqlToQuery(query).sql.includes("next_follow_up_at <=")) {
        throw driverDateError();
      }
      return [];
    });
    const sender = vi.fn<LicenseEmailSender>();
    const failures: EditorialStepFailure[] = [];

    const licensing = await runExamLicensingSteps(
      { execute } as unknown as LicensingDatabase,
      1,
      failures,
      sender,
    );

    expect(licensing).toEqual({
      emailEnabled: true,
      prepared: { eligibleEditions: 0, created: 0, unchanged: 0, manualReview: 0, unsupportedBank: 0 },
      reconciled: { granted: 0, expired: 0 },
      dispatch: null,
    });
    expect(failures).toEqual([{ step: "licensing.dispatch", code: "ERR_INVALID_ARG_TYPE" }]);
    expect(sender).not.toHaveBeenCalled();
  });

  it("não consulta envios quando o e-mail de licença está desligado", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const failures: EditorialStepFailure[] = [];

    const licensing = await runExamLicensingSteps(
      { execute } as unknown as LicensingDatabase,
      1,
      failures,
      null,
    );

    expect(licensing.emailEnabled).toBe(false);
    expect(licensing.dispatch).toEqual({ due: 0, sent: 0, deferred: 0, manualReview: 0 });
    expect(failures).toEqual([]);
    const queries = execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query).sql);
    expect(queries.some((text) => text.includes("next_follow_up_at <="))).toBe(false);
  });
});
