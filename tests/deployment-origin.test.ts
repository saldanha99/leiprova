import { afterEach, describe, expect, it, vi } from "vitest";

import { isAuthorizedProductionOrigin } from "@/lib/deployment-origin";
import { requireProductBindingTarget } from "@/lib/commerce/product-binding-policy";
import { requireDraftOperationTarget } from "@/lib/editorial/draft-operation-target";
import { requireEditorialOperationTarget } from "@/lib/editorial/operation-target";
import { requireReviewOperationTarget, REVIEW_80_APPROVAL } from "@/lib/editorial/review-operation-target";

const connection = "postgres://leiprova_app:fictional@leiprova-pooler:5432/leiprova";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("origem autorizada na migração", () => {
  it.each(["https://leiprova.2b.app.br", "https://editaleiseca.com.br"])("mantém operadores restritos em %s", (appUrl) => {
    const environment = { nodeEnv: "production", appUrl };
    expect(requireEditorialOperationTarget(connection, { ...environment, approval: "leiprova-160-2026-09-05" }).database).toBe("leiprova");
    expect(requireDraftOperationTarget(connection, { ...environment, sourceBundleId: "pacote-isolado", approval: "draft-only:pacote-isolado" }).database).toBe("leiprova");
    expect(requireReviewOperationTarget(connection, { ...environment, approval: REVIEW_80_APPROVAL }).database).toBe("leiprova");
    expect(requireProductBindingTarget(connection, appUrl, "production", "import_pending_bindings").production).toBe(true);
    expect(() => requireProductBindingTarget(connection, appUrl, "production")).toThrow();
    expect(() => requireDraftOperationTarget(connection.replace("leiprova_app", "postgres"), { ...environment,
      sourceBundleId: "pacote-isolado", approval: "draft-only:pacote-isolado" })).toThrow();
  });

  it.each(["http://editaleiseca.com.br", "https://editaleiseca.com.br/", "https://editaleiseca.com.br:443",
    "https://editaleiseca.com.br?x=1", "https://usuario@editaleiseca.com.br", "https://editaleiseca.com.br.evil.invalid",
    "https://www.editaleiseca.com.br", "https://homolog.leiprova.2b.app.br"])("não amplia aprovação para %s", (appUrl) => {
    expect(isAuthorizedProductionOrigin(appUrl)).toBe(false);
    expect(() => requireDraftOperationTarget(connection, { nodeEnv: "production", appUrl,
      sourceBundleId: "pacote-isolado", approval: "draft-only:pacote-isolado" })).toThrow();
  });

  it("gera vínculos e imagem do catálogo Stripe com a origem nova configurada", async () => {
    vi.stubEnv("APP_URL", "https://editaleiseca.com.br");
    vi.resetModules();
    const presentation = await import("@/lib/commerce/stripe-product-presentation");
    const master = presentation.masterStripePresentation();
    expect(master.url).toBe("https://editaleiseca.com.br/#planos");
    expect(master.images).toEqual(["https://editaleiseca.com.br/assets/contests/editorial-study-v2.webp"]);
  });
});
