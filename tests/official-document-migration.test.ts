import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../drizzle/0022_certain_baron_strucker.sql", import.meta.url),
  "utf8",
);

describe("migração da captura oficial de editais", () => {
  it("persiste bytes, texto por página, checksum e autorização com limites", () => {
    expect(migration).toMatch(/CREATE TABLE "opportunity_document_snapshots"/);
    expect(migration).toContain('"document_bytes" "bytea" NOT NULL');
    expect(migration).toContain('"page_texts" jsonb NOT NULL');
    expect(migration).toMatch(/byte_length" between 5 and 15728640/);
    expect(migration).toMatch(/page_count" between 1 and 250/);
    expect(migration).toContain("owner-approval-2026-09-01");
  });

  it("exige fonte e captura aprovadas e protege dependências revisadas", () => {
    expect(migration).toMatch(/validate_opportunity_document_snapshot_context/);
    expect(migration).toMatch(/A captura integral exige uma fonte oficial aprovada/);
    expect(migration).toMatch(/validate_opportunity_requirement_snapshot_context/);
    expect(migration).toMatch(/Conteúdo programático revisado exige captura oficial aprovada/);
    expect(migration).toMatch(/opportunity_document_snapshot_publication_guard/);
  });
});
