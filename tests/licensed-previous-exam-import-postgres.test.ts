import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import {
  importLicensedPreviousExamBooklet,
  listLicensedPreviousExamReviewBatches,
  parseLicensedPreviousExamPayload,
  reviewLicensedPreviousExamBooklet,
} from "@/lib/editorial/licensed-previous-exam-import";
import { requireLocalImportTarget } from "@/lib/editorial/local-import-target";

// Somente banco descartável e conteúdo inteiramente sintético.
const testUrl = process.env.LEIPROVA_TEST_DATABASE_URL;
if (testUrl) requireLocalImportTarget(testUrl);
const client = testUrl ? postgres(testUrl, { max: 4, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
const database = () => {
  if (!db) throw new Error("Banco de QA não configurado.");
  return db;
};

function choices(keys: readonly string[]) {
  return keys.map((key) => ({
    key,
    text: `Alternativa fictícia ${key}`,
    rationale: `Justificativa fictícia e completa para a alternativa ${key}.`,
  }));
}

async function fixture() {
  const tag = randomUUID();
  const slugTag = tag.replaceAll("-", "");
  const now = new Date("2026-09-12T15:00:00.000Z");
  const [importer, reviewer] = await database()
    .insert(schema.users)
    .values([
      {
        publicId: randomUUID(),
        name: "Importador fictício",
        email: `importador-${tag}@example.invalid`,
        passwordHash: "not-a-password",
        role: "admin",
      },
      {
        publicId: randomUUID(),
        name: "Revisor fictício",
        email: `revisor-${tag}@example.invalid`,
        passwordHash: "not-a-password",
        role: "admin",
      },
    ])
    .returning();
  const [bank] = await database()
    .insert(schema.quizBanks)
    .values({
      slug: `banca-qa-${slugTag}`,
      name: "Banca fictícia",
      fullName: "Banca inteiramente fictícia de QA",
    })
    .returning();
  const [career] = await database()
    .insert(schema.quizCareerTracks)
    .values({
      slug: `carreira-qa-${slugTag}`,
      name: "Carreira fictícia",
      shortName: "QA",
      description: "Carreira inteiramente fictícia para teste do importador.",
    })
    .returning();
  const [subject, unrelatedSubject] = await database()
    .insert(schema.quizSubjects)
    .values([
      {
        slug: `materia-qa-${slugTag}`,
        name: "Matéria fictícia compatível",
        shortName: "QA",
      },
      {
        slug: `materia-fora-qa-${slugTag}`,
        name: "Matéria fictícia fora da carreira",
        shortName: "Fora",
      },
    ])
    .returning();
  await database().insert(schema.quizCareerSubjects).values({
    careerTrackId: career.id,
    subjectId: subject.id,
  });
  const sourceCheckedAt = new Date("2026-09-11T10:00:00.000Z");
  const [edition] = await database()
    .insert(schema.examEditions)
    .values({
      publicId: `edicao-qa-${slugTag}`,
      careerTrackId: career.id,
      bankId: bank.id,
      institutionAcronym: "ORGAO-QA",
      jurisdictionCode: "BR",
      title: "Edição histórica fictícia",
      officialUrl: "https://provas.example.invalid/edicao",
      examDate: "2025-01-10",
      publishedAt: new Date("2025-02-01T12:00:00.000Z"),
      status: "published",
      sourcePolicy: "licensed_content",
      sourceCheckedAt,
      sourceHttpStatus: 200,
      createdByUserId: importer.id,
      updatedByUserId: reviewer.id,
    })
    .returning();
  const [document] = await database()
    .insert(schema.examEditionDocuments)
    .values({
      publicId: randomUUID(),
      examEditionId: edition.id,
      documentType: "question_booklet",
      title: "Caderno fictício integral",
      sourceUrl: "https://provas.example.invalid/caderno.pdf",
      sourceHost: "provas.example.invalid",
      sourceCheckedAt,
      httpStatus: 200,
      contentType: "application/pdf",
      expectedQuestionCount: 2,
      distributionMode: "external_link",
      sourcePolicy: "licensed_content",
      rightsHolder: "Titular fictício",
      licenseBasis:
        "Autorização fictícia de QA para testar a reprodução controlada.",
      licenseReference: `https://licencas.example.invalid/evidencia/${tag}`,
      licenseEvidenceChecksumSha256: "a".repeat(64),
      licenseEvidenceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
      licensedAt: new Date("2026-09-01T12:00:00.000Z"),
      licenseExpiresAt: new Date("2027-09-01T12:00:00.000Z"),
      status: "approved",
      initiatedByUserId: importer.id,
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date("2026-09-11T12:00:00.000Z"),
      reviewNotes:
        "Documento fictício conferido por pessoa distinta somente para QA.",
    })
    .returning();
  const [answerKeyDocument] = await database()
    .insert(schema.examEditionDocuments)
    .values({
      publicId: randomUUID(),
      examEditionId: edition.id,
      documentType: "answer_key",
      title: "Gabarito fictício integral",
      sourceUrl: "https://provas.example.invalid/gabarito.pdf",
      sourceHost: "provas.example.invalid",
      sourceCheckedAt,
      httpStatus: 200,
      contentType: "application/pdf",
      expectedQuestionCount: null,
      distributionMode: "external_link",
      sourcePolicy: "licensed_content",
      rightsHolder: "Titular fictício",
      licenseBasis:
        "Autorização fictícia de QA para testar o gabarito controlado.",
      licenseReference: `https://licencas.example.invalid/evidencia-gabarito/${tag}`,
      licenseEvidenceChecksumSha256: "b".repeat(64),
      licenseEvidenceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
      licensedAt: new Date("2026-09-01T12:00:00.000Z"),
      licenseExpiresAt: new Date("2027-09-01T12:00:00.000Z"),
      status: "approved",
      initiatedByUserId: importer.id,
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date("2026-09-11T12:00:00.000Z"),
      reviewNotes:
        "Gabarito fictício conferido por pessoa distinta somente para QA.",
    })
    .returning();
  const payload = parseLicensedPreviousExamPayload(
    JSON.stringify({
      schemaVersion: 1,
      booklet: "QA",
      questions: [
        {
          order: 1,
          number: "1",
          subjectId: subject.id,
          topic: "Tema fictício um",
          prompt:
            "Primeiro enunciado integral e inteiramente fictício para testar o importador.",
          explanation:
            "Primeira explicação fictícia com tamanho suficiente para a validação.",
          difficulty: 2,
          type: "multiple_choice",
          correctOption: "C",
          options: choices(["A", "B", "C", "D"]),
        },
        {
          order: 2,
          number: "2",
          subjectId: subject.id,
          topic: "Tema fictício dois",
          prompt:
            "Segundo enunciado integral e inteiramente fictício para testar certo ou errado.",
          explanation:
            "Segunda explicação fictícia com tamanho suficiente para a validação.",
          difficulty: 3,
          type: "true_false",
          correctOption: "C",
          options: choices(["C", "E"]),
        },
      ],
    }),
  );
  return {
    importer,
    reviewer,
    unrelatedSubject,
    document,
    answerKeyDocument,
    edition,
    payload,
    now,
  };
}

describe.skipIf(!testUrl)("importação licenciada — PostgreSQL descartável", () => {
  beforeAll(async () => {
    const rows = await database().execute<{ name: string }>(
      sql`select current_database() as name`,
    );
    expect(rows[0]?.name).toBe("leiprova_automation_test");
  });

  afterAll(async () => {
    await client?.end();
  });

  it("importa e revisa o lote inteiro sem publicar automaticamente", async () => {
    const data = await fixture();
    const imported = await importLicensedPreviousExamBooklet(database(), {
      documentPublicId: data.document.publicId,
      answerKeyDocumentPublicId: data.answerKeyDocument.publicId,
      payload: data.payload,
      actorUserId: data.importer.id,
    });
    expect(imported).toMatchObject({
      importedQuestions: 2,
      editorialStatus: "pending_review",
      automaticApproval: false,
    });
    const pending = await database()
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.examEditionDocumentId, data.document.id));
    expect(pending).toHaveLength(2);
    expect(
      pending.every(
        (question) =>
          question.editorialStatus === "pending_review" &&
          question.examEditionId === data.edition.id &&
          question.reviewedByUserId === null,
      ),
    ).toBe(true);

    const batches = await listLicensedPreviousExamReviewBatches(database(), 10);
    const batch = batches.find(
      (candidate) => candidate.batchPublicId === imported.batchPublicId,
    );
    expect(batch).toBeTruthy();
    await expect(
      reviewLicensedPreviousExamBooklet(database(), {
        batchPublicId: imported.batchPublicId,
        reviewerUserId: data.importer.id,
        decision: "approve",
        notes: "Revisão fictícia integral executada por pessoa diferente.",
        fingerprint: batch!.fingerprint,
      }),
    ).rejects.toThrow("outro administrador");

    const reviewed = await reviewLicensedPreviousExamBooklet(database(), {
      batchPublicId: imported.batchPublicId,
      reviewerUserId: data.reviewer.id,
      decision: "approve",
      notes:
        "Conferi integralmente o lote fictício, as alternativas e a licença de QA.",
      fingerprint: batch!.fingerprint,
    });
    expect(reviewed).toMatchObject({
      reviewedQuestions: 2,
      resultingStatus: "reviewed",
      automaticPublication: false,
    });
    expect(
      (
        await database()
          .select()
          .from(schema.questions)
          .where(eq(schema.questions.examEditionDocumentId, data.document.id))
      ).every(
        (question) =>
          question.editorialStatus === "reviewed" &&
          question.reviewedByUserId === data.reviewer.id,
      ),
    ).toBe(true);
  });

  it("recusa matéria incompatível e duplicata ativa; libera nova versão após suspensão", async () => {
    const incompatible = await fixture();
    const invalidPayload = {
      ...incompatible.payload,
      questions: incompatible.payload.questions.map((question) => ({
        ...question,
        subjectId: incompatible.unrelatedSubject.id,
      })),
    };
    await expect(
      importLicensedPreviousExamBooklet(database(), {
        documentPublicId: incompatible.document.publicId,
        answerKeyDocumentPublicId:
          incompatible.answerKeyDocument.publicId,
        payload: invalidPayload,
        actorUserId: incompatible.importer.id,
      }),
    ).rejects.toThrow("não pertence à carreira");
    expect(
      await database()
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.examEditionDocumentId, incompatible.document.id)),
    ).toHaveLength(0);

    const data = await fixture();
    await importLicensedPreviousExamBooklet(database(), {
      documentPublicId: data.document.publicId,
      answerKeyDocumentPublicId: data.answerKeyDocument.publicId,
      payload: data.payload,
      actorUserId: data.importer.id,
    });
    await expect(
      importLicensedPreviousExamBooklet(database(), {
        documentPublicId: data.document.publicId,
        answerKeyDocumentPublicId: data.answerKeyDocument.publicId,
        payload: data.payload,
        actorUserId: data.importer.id,
      }),
    ).rejects.toThrow("versões ativas");
    await database()
      .update(schema.questions)
      .set({ editorialStatus: "suspended", updatedAt: data.now })
      .where(
        and(
          eq(schema.questions.examEditionDocumentId, data.document.id),
          eq(schema.questions.editorialStatus, "pending_review"),
        ),
      );
    await expect(
      importLicensedPreviousExamBooklet(database(), {
        documentPublicId: data.document.publicId,
        answerKeyDocumentPublicId: data.answerKeyDocument.publicId,
        payload: data.payload,
        actorUserId: data.importer.id,
      }),
    ).resolves.toMatchObject({ importedQuestions: 2 });
    const versions = await database()
      .select({ status: schema.questions.editorialStatus })
      .from(schema.questions)
      .where(eq(schema.questions.examEditionDocumentId, data.document.id));
    expect(versions.filter((item) => item.status === "suspended")).toHaveLength(2);
    expect(versions.filter((item) => item.status === "pending_review")).toHaveLength(2);
  });

  it("recusa licença sem SHA-256 e sela a evidência registrada", async () => {
    const data = await fixture();
    const missingHashPublicId = randomUUID();

    await expect(
      database().execute(sql`
        insert into exam_edition_documents (
          public_id, exam_edition_id, document_type, title, source_url,
          source_host, source_checked_at, http_status, content_type,
          distribution_mode, source_policy, rights_holder, license_basis,
          license_reference, license_evidence_checked_at, licensed_at,
          initiated_by_user_id
        ) values (
          ${missingHashPublicId}, ${data.edition.id}, 'answer_key',
          'Gabarito fictício sem hash',
          ${`https://provas.example.invalid/gabarito-sem-hash-${missingHashPublicId}.pdf`},
          'provas.example.invalid', ${data.now.toISOString()}::timestamptz, 200, 'application/pdf',
          'external_link', 'licensed_content', 'Titular fictício',
          'Autorização fictícia usada somente para validar a restrição.',
          ${`https://licencas.example.invalid/sem-hash/${missingHashPublicId}`},
          ${data.now.toISOString()}::timestamptz,
          ${data.now.toISOString()}::timestamptz, ${data.importer.id}
        )
      `),
    ).rejects.toMatchObject({ cause: { code: "23514" } });

    await expect(
      database()
        .update(schema.examEditionDocuments)
        .set({ licenseEvidenceChecksumSha256: "c".repeat(64) })
        .where(eq(schema.examEditionDocuments.id, data.document.id)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
