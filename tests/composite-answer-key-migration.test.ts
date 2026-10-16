import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../drizzle/0055_composite_answer_key_evidence.sql", import.meta.url),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
) as { entries: { idx: number; tag: string; when: number }[] };
const grants = readFileSync(
  new URL("../deploy/grant-app-role.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(
  new URL("../src/lib/db/schema.ts", import.meta.url),
  "utf8",
);

describe("migração 0055 — evidência final composta do gabarito", () => {
  it("entra no journal depois da 0054, sem renumerar a migração alheia", () => {
    const entries = journal.entries;
    const position = entries.findIndex((entry) => entry.idx === 55);
    const last = entries[position];
    const previous = entries[position - 1];
    expect(last?.idx).toBe(55);
    expect(last?.tag).toBe("0055_composite_answer_key_evidence");
    expect(previous?.idx).toBe(54);
    expect(previous?.tag).toBe("0054_camara_cp_correction");
    expect(last!.when).toBeGreaterThan(previous!.when);
    expect(new Set(entries.map((entry) => entry.idx)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.tag)).size).toBe(entries.length);
  });

  it("admite o tipo novo de documento sem remover os dois conhecidos", () => {
    expect(migration).toContain(
      `ALTER TABLE "exam_edition_documents" DROP CONSTRAINT "exam_edition_documents_type_check"`,
    );
    expect(migration).toMatch(
      /CONSTRAINT "exam_edition_documents_type_check" CHECK \("document_type" in \('question_booklet', 'answer_key', 'answer_key_decision'\)\)/u,
    );
  });

  it("reescreve o check de quantidade com o terceiro ramo, sem o qual o tipo novo violaria os dois", () => {
    expect(migration).toContain(
      `ALTER TABLE "exam_edition_documents" DROP CONSTRAINT "exam_edition_documents_expected_questions_check"`,
    );
    expect(migration).toMatch(
      /CONSTRAINT "exam_edition_documents_expected_questions_check" CHECK \([\s\S]*?"document_type" = 'question_booklet'[\s\S]*?"expected_question_count" between 1 and 300[\s\S]*?"document_type" in \('answer_key', 'answer_key_decision'\)[\s\S]*?"expected_question_count" is null/u,
    );
  });

  it("prende o ato a link externo com metadados, sem cópia nem licença", () => {
    expect(migration).toMatch(
      /CONSTRAINT "exam_edition_documents_decision_external_check" CHECK \("document_type" <> 'answer_key_decision' or \([\s\S]*?"distribution_mode" = 'external_link'[\s\S]*?"source_policy" = 'metadata_only'[\s\S]*?"storage_key" is null[\s\S]*?"byte_length" is null/u,
    );
    expect(migration).not.toMatch(/licensed_content|hosted_copy/u);
  });

  it("cria a coluna de finalidade anulável com o domínio fechado", () => {
    expect(migration).toContain(
      `ALTER TABLE "exam_editions" ADD COLUMN "answer_key_finality" text`,
    );
    expect(migration).toMatch(
      /CONSTRAINT "exam_editions_answer_key_finality_check" CHECK \("answer_key_finality" is null or "answer_key_finality" in \('definitive_document', 'preliminary_plus_maintenance_act'\)\)/u,
    );
  });

  it("cria o terceiro slot com FK composto id+edição+tipo e check condicional", () => {
    expect(migration).toContain(
      `ALTER TABLE "contest_product_exam_references" ADD COLUMN "answer_key_decision_document_id" bigint`,
    );
    expect(migration).toContain(
      `ALTER TABLE "contest_product_exam_references" ADD COLUMN "answer_key_decision_document_type" text`,
    );
    expect(migration).toMatch(
      /ADD CONSTRAINT "contest_product_exam_references_answer_key_decision_scope_fk" FOREIGN KEY \("answer_key_decision_document_id","exam_edition_id","answer_key_decision_document_type"\) REFERENCES "public"\."exam_edition_documents"\("id","exam_edition_id","document_type"\)/u,
    );
    expect(migration).toMatch(
      /CONSTRAINT "contest_product_exam_references_answer_key_decision_check" CHECK \([\s\S]*?"answer_key_decision_document_id" is null[\s\S]*?"answer_key_decision_document_type" is null[\s\S]*?"answer_key_decision_document_id" is not null[\s\S]*?"answer_key_decision_document_type" is not null[\s\S]*?"answer_key_decision_document_type" = 'answer_key_decision'[\s\S]*?<> "primary_document_id"[\s\S]*?<> "answer_key_document_id"/u,
    );
  });

  it("todo identificador novo cabe no limite de 63 caracteres do PostgreSQL", () => {
    const identifiers = [...migration.matchAll(/"([a-z0-9_]{20,})"/gu)].map((match) => match[1]);
    expect(identifiers.length).toBeGreaterThan(5);
    for (const identifier of identifiers) {
      expect(identifier.length).toBeLessThanOrEqual(63);
    }
  });

  it("declara por escrito o limite que o banco não impõe", () => {
    expect(migration).toMatch(/NÃO é expressável em\s*\n--\s*CHECK de tabela única/u);
    expect(migration).toContain("mprj-previous-exam-admission.ts");
  });

  it("não faz backfill, não libera produto e não toca a migração 0054", () => {
    // `ON UPDATE no action` faz parte da FK; o que não pode existir é DML.
    expect(migration).not.toMatch(/\bupdate\s+"?[a-z_]+"?\s+set\b/iu);
    expect(migration).not.toMatch(/\binsert\s+into\b/iu);
    expect(migration).not.toMatch(/\bdelete\s+from\b/iu);
    expect(migration).not.toMatch(/released|feature_flag|stripe/iu);
    expect(migration).not.toContain("legal_cp_correction_evidence");
  });

  it("concede ao app_user insert nas duas colunas novas do vínculo", () => {
    const block = grants.slice(
      grants.indexOf("grant insert (\n  public_id,\n  product_slug,"),
    );
    expect(block).toContain("answer_key_decision_document_id");
    expect(block).toContain("answer_key_decision_document_type");
  });

  it("o schema Drizzle acompanha a migração coluna a coluna", () => {
    expect(schema).toContain(`answerKeyFinality: text("answer_key_finality")`);
    expect(schema).toContain(
      `answerKeyDecisionDocumentId: bigint("answer_key_decision_document_id"`,
    );
    expect(schema).toContain(
      `answerKeyDecisionDocumentType: text("answer_key_decision_document_type")`,
    );
    expect(schema).toContain(
      `name: "contest_product_exam_references_answer_key_decision_scope_fk"`,
    );
    expect(schema).toContain("exam_editions_answer_key_finality_check");
    expect(schema).toContain("exam_edition_documents_decision_external_check");
    expect(schema).toContain(
      "contest_product_exam_references_answer_key_decision_check",
    );
    expect(schema).toMatch(
      /answerKeyDecisionDocumentId\} is not null\s+and \$\{table\.answerKeyDecisionDocumentType\} is not null\s+and \$\{table\.answerKeyDecisionDocumentType\} = 'answer_key_decision'/u,
    );
    expect(schema).toContain(
      `sql\`\${table.documentType} in ('question_booklet', 'answer_key', 'answer_key_decision')\``,
    );
  });
});
