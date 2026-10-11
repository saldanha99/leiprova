import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { productPreviousExamRequirementMet } from "../src/lib/commerce/previous-exam-content";
import { parseWaiverArgs } from "../scripts/waive-previous-exam";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("dispensa de prova anterior por produto", () => {
  it("vende com prova anterior aprovada ou com dispensa do produto exato", () => {
    const query = new PgDialect().sqlToQuery(productPreviousExamRequirementMet(sql`${"tce-ma-analista-e-tecnico-2026"}`));
    expect(query.sql).toContain("exam_reference.status = 'approved'");
    expect(query.sql).toContain("or exists (\n      select 1 from contest_product_previous_exam_waivers waiver\n      where waiver.product_slug = $");
  });

  it("exige motivo que o aluno vai ler e recusa produto com prova anterior aprovada", () => {
    expect(parseWaiverArgs(["--", "--product=pp-ma-inspetor-2026", "--reason=A banca da última prova foi extinta e os arquivos saíram do ar."])).toEqual({
      apply: false,
      productSlug: "pp-ma-inspetor-2026",
      reason: "A banca da última prova foi extinta e os arquivos saíram do ar.",
    });
    expect(() => parseWaiverArgs(["--product=pp-ma-inspetor-2026", "--reason=curto"])).toThrow(/20 a 1\.000/u);
    expect(() => parseWaiverArgs(["--reason=Motivo suficiente para o aluno ler aqui."])).toThrow(/--product/u);
    const script = read("scripts/waive-previous-exam.ts");
    expect(script).toContain("já tem prova anterior aprovada; a dispensa não se aplica");
    expect(script).toContain('action: "commerce.previous_exam.waived"');
    expect(script).toContain("if (!apply) throw new PreviewRollback");
    expect(script).not.toMatch(/status: "released"/u);
  });

  it("mostra o motivo na página quando não há prova anterior", () => {
    const page = read("src/app/concursos/[categoria]/[uf]/[slug]/page.tsx");
    expect(page).toContain("const previousExamWaiverReason = !lastExam && result.referenceProductSlug");
    const landing = read("src/components/contests/contest-landing.tsx");
    expect(landing).toContain("{!lastExam && previousExamWaiverReason && (");
    expect(landing).toContain("Sem prova anterior oficial disponível.");
    expect(read("deploy/grant-app-role.sql")).toContain("contest_product_previous_exam_waivers,");
  });
});
