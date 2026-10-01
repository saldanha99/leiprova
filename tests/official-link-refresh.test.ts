import { readFileSync } from "node:fs";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import {
  OFFICIAL_LINK_REFRESH_AFTER_DAYS,
  officialLinkFailureReason,
  refreshApprovedOfficialExamLinks,
} from "@/lib/exams/official-link-refresh";

const worker = readFileSync(
  new URL("../scripts/run-editorial-automation.ts", import.meta.url),
  "utf8",
);

const pdf = "https://cdn.cebraspe.org.br/concursos/enam_25_2/arquivos/ENAM_PROVA.PDF";
const page = "https://www.cebraspe.org.br/concursos/enam_25_2";

describe("motivo de recusa do link oficial", () => {
  it("aceita a página da edição que responde, mesmo redirecionada e em HTML", () => {
    expect(officialLinkFailureReason("edition", { httpStatus: 200, finalUrl: `${page}/`, isPdf: false }, page)).toBeNull();
  });

  it("exige do documento o mesmo PDF no mesmo endereço", () => {
    expect(officialLinkFailureReason("document", { httpStatus: 200, finalUrl: pdf, isPdf: true }, pdf)).toBeNull();
    expect(officialLinkFailureReason("document", { httpStatus: 404, finalUrl: pdf, isPdf: false }, pdf)).toBe("http_404");
    expect(officialLinkFailureReason("document", { httpStatus: 200, finalUrl: page, isPdf: true }, pdf)).toBe("redirected");
    expect(officialLinkFailureReason("document", { httpStatus: 200, finalUrl: pdf, isPdf: false }, pdf)).toBe("not_pdf");
  });

  it("recusa a edição que deixou de responder", () => {
    expect(officialLinkFailureReason("edition", { httpStatus: 503, finalUrl: page, isPdf: false }, page)).toBe("http_503");
  });
});

describe("reconferência dos links aprovados", () => {
  function fakeDatabase(rows: unknown[]) {
    const queries: SQL[] = [];
    const audits: unknown[] = [];
    const db = {
      execute: vi.fn(async (query: SQL) => {
        queries.push(query);
        return queries.length === 1 ? rows : [];
      }),
      insert: vi.fn(() => ({ values: vi.fn(async (value: unknown) => { audits.push(value); }) })),
    };
    return { db: db as unknown as Parameters<typeof refreshApprovedOfficialExamLinks>[0], queries, audits };
  }

  const checkedAt = new Date("2026-10-01T12:00:00.000Z");

  it("renova só o que continua válido e audita o que falhou", async () => {
    const { db, queries, audits } = fakeDatabase([
      { kind: "document", id: "11", publicId: "doc-prova", bankSlug: "cebraspe", url: pdf },
      { kind: "edition", id: "7", publicId: "enam-2025-2", bankSlug: "cebraspe", url: page },
      { kind: "document", id: "12", publicId: "doc-gabarito", bankSlug: "cebraspe", url: `${pdf}?v=2` },
      { kind: "document", id: "13", publicId: "doc-fora", bankSlug: "cebraspe", url: `${pdf}?v=3` },
    ]);
    const verify = vi.fn(async (_bank: string, url: string) => {
      if (url.endsWith("v=3")) throw new Error("timeout");
      return {
        httpStatus: url.endsWith("v=2") ? 404 : 200,
        pageTitle: null,
        contentType: url === page ? "text/html" : "application/pdf",
        isPdf: url !== page,
        finalUrl: url,
        checkedAt,
      };
    });

    const result = await refreshApprovedOfficialExamLinks(db, 5, verify);

    expect(result).toEqual({
      checked: 4,
      refreshed: 2,
      failures: [
        { kind: "document", publicId: "doc-gabarito", reason: "http_404" },
        { kind: "document", publicId: "doc-fora", reason: "unreachable" },
      ],
    });
    const dialect = new PgDialect();
    const [select, documentUpdate, editionUpdate] = queries.map((query) => dialect.sqlToQuery(query));
    expect(queries).toHaveLength(3);
    expect(select.sql).toContain("reference.status = 'approved'");
    expect(select.sql).toContain("make_interval(days => $");
    expect(select.params).toContain(OFFICIAL_LINK_REFRESH_AFTER_DAYS);
    expect(documentUpdate.sql).toContain("update exam_edition_documents");
    expect(documentUpdate.sql).toContain("status = 'approved' and source_url = $");
    expect(documentUpdate.params).toEqual([checkedAt.toISOString(), 200, "11", pdf]);
    expect(editionUpdate.sql).toContain("update exam_editions");
    expect(editionUpdate.params).toEqual([checkedAt.toISOString(), 5, "7", page]);
    // Date em SQL bruto derrubou o worker de 14/09 a 27/09/2026.
    for (const query of [select, documentUpdate, editionUpdate]) {
      expect(query.params.filter((param) => param instanceof Date)).toEqual([]);
    }
    expect(audits).toEqual([
      expect.objectContaining({
        actorUserId: 5,
        action: "automation.exam_link.check_failed",
        entityType: "exam_link_refresh",
        metadata: { failures: result.failures },
      }),
    ]);
  });

  it("não audita nada quando não há link vencendo", async () => {
    const { db, queries, audits } = fakeDatabase([]);
    const verify = vi.fn();

    expect(await refreshApprovedOfficialExamLinks(db, 5, verify)).toEqual({ checked: 0, refreshed: 0, failures: [] });
    expect(verify).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    expect(audits).toEqual([]);
  });

  it("reconfere bem antes dos 30 dias que mantêm a venda aberta", () => {
    expect(OFFICIAL_LINK_REFRESH_AFTER_DAYS).toBeLessThan(30);
  });

  it("roda isolada, depois do avanço de fase e antes da captura de documentos", () => {
    const step = worker.indexOf('runIsolatedStep(failedSteps, "examLinks"');
    expect(step).toBeGreaterThan(worker.indexOf('runIsolatedStep(failedSteps, "lifecycle"'));
    expect(step).toBeLessThan(worker.indexOf('runIsolatedStep(failedSteps, "documents"'));
    expect(worker).toContain("refreshApprovedOfficialExamLinks(db, owner.id)");
    expect(worker).toMatch(/lifecycle,\n\s+examLinks,/u);
  });
});
