import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { planMprjFormatEvidence } from "@/lib/editorial/mprj-format-admission";
import { officialQuestionContractSchema, officialQuestionContractInputSchema, questionContractFingerprint } from "@/lib/editorial/official-question-contract";
import { currentQuestionContractExists } from "@/lib/editorial/question-contract-query";
import { parseMprjFormatArgs } from "../scripts/review-mprj-format-contract";
import { syntheticQuestionContract } from "./fixtures/question-contract";

import { contract, document, observation } from "./fixtures/mprj-format";
const plan = (doc: unknown = document, obs = observation, date = "2026-10-16") => planMprjFormatEvidence(contract(), doc, obs, date);

describe("admissão MPRJ delimitada e preservação do contrato", () => {
  it("ambos schemas mantêm strict e todos refinamentos, sem omit após superRefine", () => {
    for (const schema of [officialQuestionContractSchema, officialQuestionContractInputSchema]) {
      expect(schema.safeParse(contract()).success).toBe(true);
      for (const bad of [{ optionKeys: ["A", "B"] }, { officialAnswerKeys: ["A", "B"] }, { profile: { ...contract().profile, format: "true_false" } }, { unknown: true }])
        expect(schema.safeParse({ ...contract(), ...bad }).success).toBe(false);
    }
    const enriched = { ...contract(), formatEvidence: plan().evidence };
    expect(officialQuestionContractSchema.safeParse(enriched).success).toBe(true);
    expect(officialQuestionContractInputSchema.safeParse(enriched).success).toBe(false);
    expect(officialQuestionContractSchema.safeParse({ ...enriched, opportunityId: 21 }).success).toBe(false);
    expect(questionContractFingerprint(syntheticQuestionContract())).toBe(questionContractFingerprint(syntheticQuestionContract()));
  });
  it.each([{ status: "suspended" }, { editionId: 42 }, { bankSlug: "other" }, { publicId: "wrong" }, { sourceUrl: "https://example.invalid/x.pdf" },
    { storageKey: "forbidden" }, { byteLength: 1000 }, { documentType: "answer_key" }, { roleName: "Outro cargo" }, { publishedOn: "2026-06-02" },
    { checksum: "d".repeat(64) }, { sourcePolicy: "licensed" }, { institution: "OTHER" }, { opportunityPublicId: "22222222-2222-4222-8222-222222222222" },
  ])("recusa contexto ou fonte divergente: %j", patch => expect(() => plan({ ...document, ...patch })).toThrow());
  it.each(["sourceSha256", "robotsSha256", "pageTextSha256"] as const)("fingerprint cobre %s", key => {
    expect(plan().evidence.evidenceId).not.toBe(plan(document, { ...observation, [key]: "d".repeat(64) }).evidence.evidenceId);
  });
  it("timestamp com micros, publicId e janela de refresh entram no hash", () => {
    for (const patch of [{ documentUpdatedAt: document.documentUpdatedAt.replace("123456", "123457") },
      { publicId: "22222222-2222-4222-8222-222222222222" }, { editionUpdatedAt: "2026-10-16" }, { opportunityUpdatedAt: "2026-10-16" }])
      expect(plan().evidence.evidenceId).not.toBe(plan({ ...document, ...patch }).evidence.evidenceId);
    expect(plan().evidence.evidenceId).not.toBe(plan(document, observation, "2026-10-17").evidence.evidenceId);
  });
  it("SQL corrente exige evidência MPRJ sem mudar significado dos payloads legados", () => {
    const query = new PgDialect().sqlToQuery(currentQuestionContractExists(sql`external.id`)).sql;
    expect(query).toContain("case when current_scoped_contract.opportunity_id=20");
    expect(query).toContain("public.mprj_question_format_evidence_current");
    expect(query).toContain("else not (current_scoped_contract.payload ? 'formatEvidence') end");
  });
  it("migração: FK exata, NOT NULL, RLS correlacionada, grants mínimos e expiração", () => {
    const migration = readFileSync("drizzle/0056_official_question_format_evidence.sql", "utf8");
    expect(migration).toContain("FOREIGN KEY (exam_edition_document_id, exam_edition_id, document_type)");
    expect(migration).toContain("d.exam_edition_id=official_question_format_evidence.exam_edition_id");
    expect(migration).toContain("d.public_id=official_question_format_evidence.document_public_id");
    expect(migration).toContain("e.bank_id=b.id AND b.slug='fgv' AND b.is_active");
    expect(migration).toContain("f.expires_at>now()"); expect(migration).toContain("f.document_updated_at");
    expect(migration).toContain("SECURITY DEFINER SET search_path = pg_catalog");
    expect(migration).toContain("REVOKE ALL ON public.official_question_format_evidence FROM leiprova_app");
    expect(migration).not.toMatch(/GRANT (?:INSERT|UPDATE|ALL)/u);
    for (const column of ["exam_edition_document_id", "exam_edition_id", "document_type", "document_public_id", "bank_id", "source_sha256"])
      expect(migration).toMatch(new RegExp(column + " (?:bigint|text) NOT NULL"));
  });
  it("CLI strict, admin explícito e apply preso à prévia", () => {
    const base = ["--input=private.json", "--actor=11111111-1111-4111-8111-111111111111", "--mode=preview"];
    expect(parseMprjFormatArgs(base).mode).toBe("preview");
    for (const args of [[...base, "--extra=x"], [...base, "--mode=apply"], base.filter(arg => !arg.startsWith("--actor")),
      [...base.slice(0, 2), "--mode=apply"], [...base, "--refresh", "--refresh"]]) expect(() => parseMprjFormatArgs(args)).toThrow();
  });
});
