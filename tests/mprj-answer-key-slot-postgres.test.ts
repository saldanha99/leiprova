import { readFileSync } from "node:fs";

import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const rawUrl = process.env.MPRJ_ANSWER_KEY_CHECK_TEST_DATABASE_URL;
const approval = process.env.MPRJ_ANSWER_KEY_CHECK_TEST_APPROVAL;
let testUrl: string | undefined;

if (rawUrl) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("MPRJ PostgreSQL test requires a valid isolated loopback URL.");
  }
  if (
    approval !== "isolated-mprj-answer-key-check" ||
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    parsed.port !== "55446" ||
    parsed.pathname !== "/leiprova_mprj_check_test" ||
    parsed.username !== "leiprova_test" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("MPRJ PostgreSQL test accepts only its explicitly approved isolated loopback database.");
  }
  testUrl = rawUrl;
} else if (approval) {
  throw new Error("MPRJ PostgreSQL test approval is set without its isolated test URL.");
}

const client = testUrl
  ? postgres(testUrl, { max: 1, prepare: false, onnotice: () => undefined })
  : null;

afterAll(async () => {
  await client?.end();
});

const migration = readFileSync(
  new URL("../drizzle/0055_composite_answer_key_evidence.sql", import.meta.url),
  "utf8",
);
const checkExpression = migration.match(
  /ADD CONSTRAINT "contest_product_exam_references_answer_key_decision_check" CHECK \(([\s\S]*?)\);/u,
)?.[1];

if (!checkExpression) {
  throw new Error("Could not extract the MPRJ answer-key slot check from migration 0055.");
}

describe.skipIf(!client)("third answer-key slot PostgreSQL constraints", () => {
  it("rejects partial or wrong-scope slots and accepts absent or valid pairs", async () => {
    await client!.begin(async (tx) => {
      await tx.unsafe(`
        create temporary table mprj_check_documents (
          id bigint not null,
          exam_edition_id bigint not null,
          document_type text not null,
          unique (id, exam_edition_id, document_type)
        ) on commit drop
      `);
      await tx.unsafe(`
        create temporary table mprj_check_references (
          id bigint primary key,
          exam_edition_id bigint not null,
          primary_document_id bigint not null,
          answer_key_document_id bigint not null,
          answer_key_decision_document_id bigint,
          answer_key_decision_document_type text,
          constraint mprj_check_slot_fk foreign key (
            answer_key_decision_document_id,
            exam_edition_id,
            answer_key_decision_document_type
          ) references mprj_check_documents(id, exam_edition_id, document_type),
          constraint mprj_check_slot_check check (${checkExpression})
        ) on commit drop
      `);
      await tx.unsafe(`
        insert into mprj_check_documents(id, exam_edition_id, document_type) values
          (10, 1, 'answer_key_decision'),
          (11, 2, 'answer_key_decision'),
          (12, 1, 'answer_key')
      `);

      const insert = async (
        executor: postgres.TransactionSql,
        id: number,
        decisionId: number | null,
        decisionType: string | null,
      ) =>
        executor`
          insert into mprj_check_references (
            id, exam_edition_id, primary_document_id, answer_key_document_id,
            answer_key_decision_document_id, answer_key_decision_document_type
          ) values (
            ${id}, 1, 2, 3, ${decisionId}, ${decisionType}
          )
        `;

      await expect(insert(tx, 1, null, null)).resolves.toBeDefined();
      await expect(insert(tx, 2, 10, "answer_key_decision")).resolves.toBeDefined();

      const expectRejected = async (
        id: number,
        decisionId: number | null,
        decisionType: string | null,
        expectedCode: "23503" | "23514",
      ) => {
        await expect(
          tx.savepoint((nested) => insert(nested, id, decisionId, decisionType)),
        ).rejects.toMatchObject({ code: expectedCode });
      };

      await expectRejected(3, 10, null, "23514");
      await expectRejected(4, 999, "answer_key_decision", "23503");
      await expectRejected(5, 11, "answer_key_decision", "23503");
      await expectRejected(6, 12, "answer_key_decision", "23503");
      await expectRejected(7, 12, "answer_key", "23514");
      await expectRejected(8, null, "answer_key_decision", "23514");
      await expectRejected(9, 2, "answer_key_decision", "23514");
      await expectRejected(10, 3, "answer_key_decision", "23514");
    });
  });
});
