import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../drizzle/0021_sweet_micromacro.sql", import.meta.url),
  "utf8",
);

describe("persistência do motor de editais", () => {
  it("deduplica requisitos por fonte e texto", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "opportunity_requirements_source_text_uidx" ON "opportunity_requirements" USING btree ("source_document_id","requirement_text")',
    );
  });

  it("registra autoria e exige revisão independente dos requisitos", () => {
    expect(migration).toContain(
      'ALTER TABLE "opportunity_requirements" ADD COLUMN "created_by_user_id" bigint',
    );
    expect(migration).toMatch(
      /opportunity_requirements_independent_review_check[\s\S]*?"reviewed_by_user_id" <> "opportunity_requirements"\."created_by_user_id"/,
    );
  });

  it("aceita geração determinística somente com metadados auditáveis", () => {
    expect(migration).toContain("'human', 'ai_assisted', 'rule_based'");
    expect(migration).toMatch(
      /questions_generator_metadata_check[\s\S]*?"authorship_method" = 'human' or[\s\S]*?"generator_model"[\s\S]*?"prompt_version"/,
    );
  });
});
