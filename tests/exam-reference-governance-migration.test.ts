import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../drizzle/0038_exam_reference_governance.sql", import.meta.url),
  "utf8",
);
const snapshot = JSON.parse(
  readFileSync(
    new URL("../drizzle/meta/0038_snapshot.json", import.meta.url),
    "utf8",
  ),
) as {
  tables: Record<string, { indexes: Record<string, unknown> }>;
};

describe("governança de provas anteriores", () => {
  it("migra a identidade institucional e territorial obrigatória por estado editorial", () => {
    expect(migration).toContain(
      'ALTER TABLE "exam_editions" ADD COLUMN "institution_acronym" text',
    );
    expect(migration).toContain(
      'ALTER TABLE "exam_editions" ADD COLUMN "jurisdiction_code" text',
    );
    expect(migration).toContain(
      'CONSTRAINT "exam_editions_institution_acronym_check"',
    );
    expect(migration).toContain(
      'CONSTRAINT "exam_editions_jurisdiction_code_check"',
    );
    expect(migration).toMatch(
      /CONSTRAINT "exam_editions_scope_identity_check" CHECK \([\s\S]*?"status" not in \('scheduled', 'held', 'published'\)[\s\S]*?"institution_acronym" is not null[\s\S]*?"jurisdiction_code" is not null/,
    );
  });

  it("registra a quantidade integral esperada apenas no caderno de questões", () => {
    expect(migration).toContain('"expected_question_count" integer');
    expect(migration).toMatch(
      /CONSTRAINT "exam_edition_documents_expected_questions_check" CHECK \([\s\S]*?"document_type" = 'question_booklet'[\s\S]*?"expected_question_count" is not null[\s\S]*?"expected_question_count" between 1 and 300[\s\S]*?"document_type" = 'answer_key'[\s\S]*?"expected_question_count" is null/,
    );
  });

  it("cria a chave única de escopo antes das FKs compostas", () => {
    const uniqueScopeIndex = migration.indexOf(
      'CREATE UNIQUE INDEX "exam_edition_documents_identity_scope_uidx"',
    );
    const questionAnswerKeyForeignKey = migration.indexOf(
      'ADD CONSTRAINT "questions_exam_answer_key_document_scope_fk"',
    );

    expect(uniqueScopeIndex).toBeGreaterThan(-1);
    expect(questionAnswerKeyForeignKey).toBeGreaterThan(-1);
    expect(uniqueScopeIndex).toBeLessThan(questionAnswerKeyForeignKey);
  });

  it("preserva os índices parciais que permitem promoção e reproposição", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "exam_edition_documents_pending_scope_uidx"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "exam_edition_documents_approved_scope_uidx"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "contest_product_exam_references_active_identity_uidx"',
    );
    expect(migration).toContain("WHERE \"status\" in ('pending_review', 'approved')");
  });

  it("libera a ordem original somente quando a versão anterior foi suspensa", () => {
    expect(migration).toContain(
      'ALTER TABLE "questions" ADD COLUMN "exam_edition_document_id" bigint',
    );
    expect(migration).toContain('DROP INDEX "questions_exam_original_order_uidx"');
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "questions_exam_original_order_uidx"[\s\S]*?"exam_edition_document_id" is not null[\s\S]*?"original_question_order" is not null[\s\S]*?"editorial_status" <> 'suspended'/,
    );
    expect(migration).toContain(
      'CONSTRAINT "questions_exam_edition_document_id_exam_edition_documents_id_fk"',
    );
  });

  it("exige revisão independente e alternativas íntegras para questão real", () => {
    expect(migration).toMatch(
      /CONSTRAINT "questions_previous_exam_independent_review_check" CHECK \([\s\S]*?"quiz_mode" <> 'previous_exam'[\s\S]*?"reviewed_by_user_id" <> "questions"\."created_by_user_id"[\s\S]*?char_length\(btrim\("questions"\."review_notes"\)\) between 20 and 1500/,
    );
    expect(migration).toContain('CONSTRAINT "question_options_key_check"');
    expect(migration).toContain('CONSTRAINT "question_options_text_check"');
    expect(migration).toMatch(
      /TG_OP = 'INSERT'[\s\S]*?NEW\."quiz_mode" = 'previous_exam'[\s\S]*?NEW\."editorial_status" = 'reviewed'[\s\S]*?deve nascer em rascunho/,
    );
    expect(migration).toMatch(
      /NEW\."exam_edition_document_id" is null[\s\S]*?FROM public\.exam_edition_documents document[\s\S]*?document_row\."exam_edition_id" IS DISTINCT FROM NEW\."exam_edition_id"[\s\S]*?document_row\."license_reference" IS DISTINCT FROM NEW\."license_reference"/,
    );
    expect(migration).toMatch(
      /FROM public\.exam_edition_documents document[\s\S]*?FOR SHARE/,
    );
    expect(migration).toMatch(
      /NEW\."reviewed_by_user_id" = NEW\."created_by_user_id"[\s\S]*?NEW\."type" not in \('true_false', 'multiple_choice'\)[\s\S]*?count\(\*\) FILTER \(WHERE option_row\."is_correct"\)[\s\S]*?blank_rationale_count <> 0[\s\S]*?correct_count <> 1/,
    );
  });

  it("preserva no banco a identidade de quem propôs e de quem revisou", () => {
    expect(
      migration.match(/"initiated_by_user_id" bigint NOT NULL/g),
    ).toHaveLength(2);
    expect(migration).toMatch(
      /exam_edition_documents_independent_review_check[\s\S]*?"initiated_by_user_id" is not null[\s\S]*?"reviewed_by_user_id" <> "exam_edition_documents"\."initiated_by_user_id"/,
    );
    expect(migration).toMatch(
      /contest_product_exam_references_independent_review_check[\s\S]*?"initiated_by_user_id" is not null[\s\S]*?"reviewed_by_user_id" <> "contest_product_exam_references"\."initiated_by_user_id"/,
    );
    expect(
      migration.match(
        /FOREIGN KEY \("(?:initiated|reviewed)_by_user_id"\)[^;]+ON DELETE restrict/g,
      ),
    ).toHaveLength(4);
  });

  it("sela questão e opções após a revisão sem impedir sua suspensão", () => {
    expect(migration).toContain(
      "to_jsonb(NEW) - 'editorial_status' - 'updated_at'",
    );
    expect(migration).toMatch(
      /OLD\."editorial_status" = 'reviewed' AND NEW\."editorial_status" not in \('reviewed', 'suspended'\)/,
    );
    expect(migration).toContain(
      'CREATE TRIGGER "previous_exam_question_review_guard"',
    );
    expect(migration).toMatch(
      /CREATE TRIGGER "previous_exam_question_option_guard"\s+BEFORE INSERT OR UPDATE OR DELETE ON "question_options"/,
    );
    expect(migration).toMatch(
      /FROM public\.questions question[\s\S]*?ORDER BY question\."id"[\s\S]*?FOR UPDATE/,
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.guard_previous_exam_question_review() FROM PUBLIC",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.guard_previous_exam_question_options() FROM PUBLIC",
    );
  });

  it("declara uma única vez a validação de public_id do vínculo", () => {
    expect(
      migration.match(
        /CONSTRAINT "contest_product_exam_references_public_id_check"/g,
      ),
    ).toHaveLength(1);
  });

  it("exige PDF real no documento aprovado", () => {
    expect(migration).toContain(
      "lower(split_part(\"exam_edition_documents\".\"content_type\", ';', 1)) = 'application/pdf'",
    );
    expect(migration).toContain(
      'CONSTRAINT "exam_edition_documents_approval_check"',
    );
  });

  it("não aceita licença sem uma impressão SHA-256 explícita", () => {
    expect(migration).toMatch(
      /source_policy" = 'licensed_content'[\s\S]*?license_evidence_checksum_sha256" is not null[\s\S]*?license_evidence_checksum_sha256" ~ '\^\[0-9a-f\]\{64\}\$'/,
    );
    expect(migration).toMatch(
      /document_row\."license_evidence_checksum_sha256" is null[\s\S]*?document_row\."license_evidence_checksum_sha256" !~ '\^\[0-9a-f\]\{64\}\$'/,
    );
    expect(migration).toMatch(
      /answer_key_row\."license_evidence_checksum_sha256" is null[\s\S]*?answer_key_row\."license_evidence_checksum_sha256" !~ '\^\[0-9a-f\]\{64\}\$'/,
    );
  });

  it("mantém o lock de revisão delimitado e sem acesso público", () => {
    expect(migration).toContain(
      "CREATE FUNCTION public.lock_exam_document_review_edition(edition_id bigint)",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, pg_temp");
    expect(migration).toContain("SET lock_timeout = '5s'");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.lock_exam_document_review_edition(bigint) FROM PUBLIC",
    );
  });

  it("mantém o snapshot 0038 alinhado aos índices vigentes", () => {
    const documentIndexes =
      snapshot.tables["public.exam_edition_documents"]?.indexes ?? {};
    const referenceIndexes =
      snapshot.tables["public.contest_product_exam_references"]?.indexes ?? {};

    expect(documentIndexes).toHaveProperty(
      "exam_edition_documents_pending_scope_uidx",
    );
    expect(documentIndexes).toHaveProperty(
      "exam_edition_documents_approved_scope_uidx",
    );
    expect(documentIndexes).not.toHaveProperty(
      "exam_edition_documents_edition_type_url_uidx",
    );
    expect(referenceIndexes).toHaveProperty(
      "contest_product_exam_references_active_identity_uidx",
    );
    expect(referenceIndexes).not.toHaveProperty(
      "contest_product_exam_references_identity_uidx",
    );
  });
});
