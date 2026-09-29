import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { releaseBlockers } from "../scripts/release-contest-product";

const script = readFileSync(new URL("../scripts/release-contest-product.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

// Estado do ENAM 2026.2 em 28/09/2026, depois do avanço de fase.
const enam = {
  status: "draft",
  stripeMode: "live",
  stripeProductId: "prod_ficticio",
  monthlyPrice: "price_mensal_ficticio",
  annualPrice: "price_anual_ficticio",
  opportunityId: "7",
  editorialStatus: "reviewed",
  lifecycleStatus: "registration_closed",
  statusAsOf: "2026-09-28",
  registrationEndsAt: "2026-09-24",
  examDate: "2026-11-29",
  categorySlug: "carreiras-juridicas",
  questionCount: 68,
  previousExamLinked: true,
};
const slug = "enam-exame-nacional-da-magistratura-2026-2";

describe("liberação comercial de produto", () => {
  it("libera o produto que cumpre tudo o que a venda exige", () => {
    expect(releaseBlockers(slug, enam, "2026-09-28")).toEqual([]);
  });

  it("explica cada bloqueio em vez de liberar", () => {
    expect(releaseBlockers(slug, { ...enam, questionCount: 67 }, "2026-09-28")).toEqual([
      "67 de 68 questões aprovadas",
    ]);
    expect(releaseBlockers(slug, { ...enam, previousExamLinked: false }, "2026-09-28")).toEqual([
      "sem prova anterior oficial aprovada",
    ]);
    expect(releaseBlockers(slug, { ...enam, stripeMode: "test" }, "2026-09-28")).toEqual([
      "produto e preços LIVE da Stripe incompletos",
    ]);
    expect(releaseBlockers(slug, { ...enam, status: "released" }, "2026-09-28")).toEqual([
      "status atual released",
    ]);
    // Depois da prova o edital sai do catálogo e o produto não pode ser liberado.
    expect(releaseBlockers(slug, enam, "2026-11-30")).toEqual([
      "edital fora do catálogo público (fase ou data vencida)",
    ]);
    expect(releaseBlockers(slug, { ...enam, opportunityId: null, editorialStatus: null }, "2026-09-28")).toContain(
      "sem edital oficial revisado",
    );
  });

  it("trava o produto, serializa, audita e desfaz a prévia", () => {
    expect(script).toContain("select public.lock_product_binding_review_product(${slug})");
    expect(script).toContain('isolationLevel: "serializable"');
    expect(script).toContain('action: "commerce.product.released"');
    expect(script).toContain("if (!apply) throw new PreviewRollback");
    expect(script).toContain("where slug = ${slug} and status = 'draft'");
    expect(script).toContain("salesFlagsChanged: false");
    expect(packageJson).toContain(
      '"commerce:product:release": "tsx --env-file-if-exists=.env scripts/release-contest-product.ts"',
    );
  });
});
