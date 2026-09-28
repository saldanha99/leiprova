import { readFileSync } from "node:fs";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import {
  advanceOpportunityLifecycles,
  dateDrivenLifecycleTransition,
} from "@/lib/opportunities/lifecycle-advance";

const migration = readFileSync(
  new URL("../drizzle/0043_contest_lifecycle_advance.sql", import.meta.url),
  "utf8",
);
const worker = readFileSync(
  new URL("../scripts/run-editorial-automation.ts", import.meta.url),
  "utf8",
);

const today = "2026-09-28";

describe("avanço de fase pelas datas oficiais", () => {
  it("encerra as inscrições no dia seguinte ao último dia de inscrição", () => {
    // ENAM 2026.2: inscrições até 24/09, prova em 29/11.
    const enam = { lifecycleStatus: "registration_open", registrationEndsAt: "2026-09-24", examDate: "2026-11-29" };

    expect(dateDrivenLifecycleTransition(enam, today)).toEqual({
      to: "registration_closed",
      basis: "registration_ends_at",
    });
    expect(dateDrivenLifecycleTransition({ ...enam, registrationEndsAt: today }, today)).toBeNull();
  });

  it("marca a prova realizada depois da data da prova, mesmo com inscrição aberta", () => {
    for (const lifecycleStatus of ["notice_published", "registration_open", "registration_closed", "exam_scheduled"]) {
      expect(
        dateDrivenLifecycleTransition({ lifecycleStatus, registrationEndsAt: "2026-08-04", examDate: "2026-09-20" }, today),
      ).toEqual({ to: "exam_held", basis: "exam_date" });
    }
    expect(
      dateDrivenLifecycleTransition({ lifecycleStatus: "registration_closed", registrationEndsAt: null, examDate: today }, today),
    ).toBeNull();
  });

  it("não inventa fase sem data oficial nem mexe em previsão ou encerrado", () => {
    expect(dateDrivenLifecycleTransition({ lifecycleStatus: "registration_open", registrationEndsAt: null, examDate: null }, today)).toBeNull();
    for (const lifecycleStatus of ["pre_notice", "authorized", "exam_held", "closed", "suspended", "canceled"]) {
      expect(
        dateDrivenLifecycleTransition({ lifecycleStatus, registrationEndsAt: "2026-01-01", examDate: "2026-02-01" }, today),
      ).toBeNull();
    }
  });
});

describe("etapa do worker", () => {
  function fakeDatabase(rows: unknown[]) {
    const queries: SQL[] = [];
    const audits: unknown[] = [];
    const transaction = {
      execute: vi.fn(async (query: SQL) => {
        queries.push(query);
        return rows;
      }),
      insert: vi.fn(() => ({ values: vi.fn(async (value: unknown) => { audits.push(value); }) })),
    };
    const db = { transaction: vi.fn(async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction)) };
    return { db: db as unknown as Parameters<typeof advanceOpportunityLifecycles>[0], queries, audits };
  }

  it("usa a data de São Paulo do próprio banco e audita cada transição", async () => {
    const { db, queries, audits } = fakeDatabase([
      { publicId: "p1", slug: "enam-2026-2", fromStatus: "registration_open", toStatus: "registration_closed", statusAsOf: today },
      { publicId: "p2", slug: "pgm-manaus-2026", fromStatus: "registration_closed", toStatus: "exam_held", statusAsOf: today },
    ]);

    const result = await advanceOpportunityLifecycles(db, 5);

    expect(result).toEqual({
      advanced: 2,
      transitions: [
        { slug: "enam-2026-2", from: "registration_open", to: "registration_closed" },
        { slug: "pgm-manaus-2026", from: "registration_closed", to: "exam_held" },
      ],
    });
    const query = new PgDialect().sqlToQuery(queries[0]);
    expect(query.sql).toContain("(now() at time zone 'America/Sao_Paulo')::date");
    expect(query.sql).toContain("opportunity.editorial_status = 'reviewed'");
    // Date em SQL bruto derrubou o worker de 14/09 a 27/09/2026.
    expect(query.params.filter((param) => param instanceof Date)).toEqual([]);
    expect(audits).toEqual([
      expect.objectContaining({
        actorUserId: 5,
        action: "automation.opportunity.lifecycle_advanced",
        entityId: "p1",
        metadata: expect.objectContaining({ basis: "registration_ends_at", reviewedDatesOnly: true }),
      }),
      expect.objectContaining({ entityId: "p2", metadata: expect.objectContaining({ basis: "exam_date" }) }),
    ]);
  });

  it("roda isolada, antes da captura de documentos, e entra no resumo", () => {
    const step = worker.indexOf('runIsolatedStep(failedSteps, "lifecycle"');
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(worker.indexOf('runIsolatedStep(failedSteps, "documents"'));
    expect(worker).toMatch(/failedSteps,\n\s+lifecycle,/u);
  });
});

describe("trava do edital revisado (migração 0043)", () => {
  it("libera só as duas transições por data e fecha datas nulas em falso", () => {
    expect(migration).toContain(`OLD."lifecycle_status" = 'registration_open'
          AND NEW."lifecycle_status" = 'registration_closed'
          AND OLD."registration_ends_at" < sao_paulo_today`);
    expect(migration).toContain(`AND NEW."lifecycle_status" = 'exam_held'
          AND OLD."exam_date" < sao_paulo_today`);
    expect(migration).toContain("date_driven_advance := COALESCE(");
    expect(migration).toContain(`NEW."status_as_of" = sao_paulo_today`);
  });

  it("continua bloqueando datas, fonte e revisor do edital revisado", () => {
    for (const column of ["registration_ends_at", "exam_date", "official_url", "source_checked_at", "reviewed_by_user_id", "title"]) {
      expect(migration).toContain(`NEW."${column}" IS DISTINCT FROM OLD."${column}"`);
    }
    expect(migration).not.toContain(`OR NEW."lifecycle_status" IS DISTINCT FROM OLD."lifecycle_status"\n      OR NEW."status_as_of"`);
  });
});
