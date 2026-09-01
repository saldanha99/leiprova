import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../drizzle/0018_happy_thaddeus_ross.sql", import.meta.url),
  "utf8",
);

describe("hardening da sincronização do catálogo", () => {
  it("mantém o contexto de edição coerente nas sessões", () => {
    expect(migration).toMatch(
      /ADD CONSTRAINT "quiz_sessions_exam_edition_check" CHECK \([\s\S]*"exam_scope" = 'latest'[\s\S]*"path" = 'career'[\s\S]*"path" = 'bank' and "mode" = 'previous_exam'[\s\S]*\)/,
    );
  });

  it("impede que a sincronização altere metadados públicos fora de draft", () => {
    expect(migration).toContain('OLD."status" <> \'draft\'');
    expect(migration).toContain('NEW."official_url" IS DISTINCT FROM OLD."official_url"');
    expect(migration).toContain('NEW."exam_date" IS DISTINCT FROM OLD."exam_date"');
    expect(migration).toContain('CREATE TRIGGER "exam_editions_non_draft_metadata_guard"');
    expect(migration).not.toContain('NEW."source_checked_at" IS DISTINCT FROM OLD."source_checked_at"');
  });

  it("só torna elegível uma edição cuja fonte oficial foi verificada", () => {
    expect(migration).toMatch(
      /ADD CONSTRAINT "exam_editions_eligible_source_check" CHECK \([\s\S]*"status" not in \('held', 'published'\)[\s\S]*"official_url" is not null[\s\S]*char_length\(btrim\("official_url"\)\) > 0[\s\S]*"source_checked_at" is not null/,
    );
  });
});
