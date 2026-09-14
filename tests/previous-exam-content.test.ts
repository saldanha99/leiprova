import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  approvedProductPreviousExamReferenceExists,
  approvedProductPreviousExamExpectedQuestionCount,
  approvedProductPreviousExamQuestionCount,
  approvedProductPreviousExamQuestionExists,
  approvedReleasedProductPreviousExamQuestionExists,
  licensedPreviousExamContentSatisfied,
  MINIMUM_LICENSED_PREVIOUS_EXAM_QUESTION_COUNT,
  PREVIOUS_EXAM_SOURCE_FRESHNESS_DAYS,
} from "../src/lib/commerce/previous-exam-content";

describe("conteúdo real licenciado por produto", () => {
  it("mantém a constante visual legada e usa frescor de 30 dias", () => {
    expect(MINIMUM_LICENSED_PREVIOUS_EXAM_QUESTION_COUNT).toBe(1);
    expect(PREVIOUS_EXAM_SOURCE_FRESHNESS_DAYS).toBe(30);
  });

  it("revalida licença, revisão, edição, caderno e produto exatos", () => {
    const query = new PgDialect().sqlToQuery(
      approvedProductPreviousExamQuestionExists(
        sql`${"concurso-x"}`,
        sql`${42}`,
        sql`${9}`,
      ),
    );

    expect(query.sql).toContain("contest_product_exam_references");
    expect(query.sql).toContain("exam_document.exam_edition_id = exam_reference.exam_edition_id");
    expect(query.sql).toContain("exam_reference.status = 'approved'");
    expect(query.sql).toContain("exam_document.status = 'approved'");
    expect(query.sql).toContain(
      "previous_question.exam_edition_document_id = exam_document.id",
    );
    expect(query.sql).toContain("exam_document.source_policy = 'licensed_content'");
    expect(query.sql).toContain("previous_question.source_rights = 'licensed'");
    expect(query.sql).toContain(
      "previous_question.source_title = exam_document.title",
    );
    expect(query.sql).toContain("previous_question.source_url = exam_document.source_url");
    expect(query.sql).toContain("opportunity.editorial_status = 'reviewed'");
    expect(query.sql).toContain(
      "opportunity.specialization_id is not distinct from exam_edition.specialization_id",
    );
    expect(query.sql).toContain(
      "opportunity.institution_acronym = exam_edition.institution_acronym",
    );
    expect(query.sql).toContain(
      "opportunity.jurisdiction_code = exam_edition.jurisdiction_code",
    );
    expect(query.sql).toContain("exam_bank.is_active = true");
    expect(query.sql).toContain("assignment.role = 'examination_provider'");
    expect(query.sql).toContain("from exam_editions newer_edition");
    expect(query.sql).toContain("newer_edition.exam_date = exam_edition.exam_date");
    expect(query.sql).toContain("newer_edition.id > exam_edition.id");
    expect(query.sql).not.toContain("newer_edition.source_checked_at");
    expect(query.sql).not.toContain("newer_edition.official_url");
    expect(query.sql).toContain("exam_edition.status in ('held', 'published')");
    expect(query.sql).toContain("exam_edition.exam_date < (current_timestamp at time zone 'America/Sao_Paulo')::date");
    expect(query.sql).toContain("current_timestamp - make_interval(days =>");
    expect(query.sql).not.toContain(
      "exam_reference.selection_verified_at >=",
    );
    expect(query.params).toContain(30);
    expect(query.sql).toContain("lower(substring(exam_document.source_url");
    expect(query.sql).toContain(
      "lower(split_part(exam_document.content_type, ';', 1)) = 'application/pdf'",
    );
    expect(query.sql).toContain("previous_question.licensed_at <= current_timestamp");
    expect(query.sql).toContain("previous_question.source_rights_holder = exam_document.rights_holder");
    expect(query.sql).toContain("previous_question.license_expires_at is not distinct from exam_document.license_expires_at");
    expect(query.sql).toContain("from quiz_career_subjects career_subject");
    expect(query.sql).toContain("previous_question.reviewed_by_user_id <> previous_question.created_by_user_id");
    expect(query.sql).toContain("previous_question.original_question_order between 1 and exam_document.expected_question_count");
    expect(query.sql).toContain("previous_question.type in ('true_false', 'multiple_choice')");
    expect(query.sql).toContain("from question_options invalid_option");
    expect(query.sql).toContain("from question_options correct_option");
    expect(query.sql).toContain("correct_option.is_correct = true");
    expect(query.sql).toContain("license_expires_at >= current_timestamp");
    expect(query.sql).toContain("America/Sao_Paulo");
    expect(query.params).toContain("concurso-x");
    expect(query.params).toContain(42);
    expect(query.params).toContain(9);
  });

  it("aceita a referência externa revisada sem afrouxar o gate de conteúdo", () => {
    const reference = new PgDialect().sqlToQuery(
      approvedProductPreviousExamReferenceExists(
        sql`${"concurso-x"}`,
        sql`${9}`,
      ),
    );

    expect(reference.sql).toContain("exam_document.source_policy = 'metadata_only'");
    expect(reference.sql).toContain(
      "answer_key_document.id = exam_reference.answer_key_document_id",
    );
    expect(reference.sql).toContain(
      "answer_key_document.document_type = 'answer_key'",
    );
    expect(reference.sql).toContain("answer_key_document.source_policy = 'metadata_only'");
    expect(reference.sql).toContain(
      "exam_document.license_evidence_checksum_sha256 ~ '^[0-9a-f]{64}$'",
    );
    expect(reference.sql).toContain(
      "answer_key_document.license_evidence_checksum_sha256 ~ '^[0-9a-f]{64}$'",
    );
    expect(reference.sql).toContain(
      "exam_document.license_evidence_checked_at <= exam_document.reviewed_at",
    );
    expect(reference.sql).toContain(
      "answer_key_document.license_evidence_checked_at <= answer_key_document.reviewed_at",
    );
    expect(reference.sql).toContain("from exam_editions newer_edition");
    expect(reference.sql).toContain("assignment.role = 'examination_provider'");
    expect(reference.params).toContain("concurso-x");
    expect(reference.params).toContain(9);
  });

  it("exige que a contagem qualificada seja exatamente a prevista no caderno", () => {
    const count = new PgDialect().sqlToQuery(
      approvedProductPreviousExamQuestionCount(sql`${"concurso-x"}`),
    );
    expect(count.sql).toContain("count(distinct licensed_question.id)");

    const expected = new PgDialect().sqlToQuery(
      approvedProductPreviousExamExpectedQuestionCount(sql`${"concurso-x"}`),
    );
    expect(expected.sql).toContain("exam_document.expected_question_count");

    const gate = new PgDialect().sqlToQuery(
      licensedPreviousExamContentSatisfied(sql`${"concurso-x"}`),
    );
    expect(gate.sql).toContain("between 1 and 300");
    expect(gate.sql).toContain("count(distinct licensed_question.id)");
    expect(gate.sql).toContain("= coalesce((");
  });

  it("só entrega ao Master questão pertencente a prova completa de produto liberado", () => {
    const query = new PgDialect().sqlToQuery(
      approvedReleasedProductPreviousExamQuestionExists(sql`${42}`),
    );
    expect(query.sql).toContain("from contest_store_products released_exam_product");
    expect(query.sql).toContain("released_exam_product.status = 'released'");
    expect(query.sql).toContain("exam_product.status = 'released'");
    expect(query.sql).toContain("count(distinct licensed_question.id)");
    expect(query.sql).toContain("exam_document.expected_question_count");
    expect(query.params).toContain(42);
  });
});
