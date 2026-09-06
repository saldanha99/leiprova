import { describe, expect, it } from "vitest";
import { draftOperationFingerprint, requireDraftOperationTarget } from "@/lib/editorial/draft-operation-target";

const bundle = "pacote-ficticio-qa";
const environment = { nodeEnv: "production", appUrl: "https://leiprova.2b.app.br", approval: `draft-only:${bundle}`, sourceBundleId: bundle };
const url = "postgresql://leiprova_app:dummy@leiprova-pooler:5432/leiprova";

describe("operador independente de rascunhos", () => {
  it("vincula confirmação ao conteúdo, operador e arquivos do pacote", () => {
    const manifest = { operatorPublicId: "operador-ficticio-a", sourceBundleId: bundle, batchFiles: ["fgv.json"] };
    const original = draftOperationFingerprint("a".repeat(64), manifest);
    expect(draftOperationFingerprint("a".repeat(64), { ...manifest })).toBe(original);
    expect(draftOperationFingerprint("b".repeat(64), manifest)).not.toBe(original);
    expect(draftOperationFingerprint("a".repeat(64), { ...manifest, operatorPublicId: "operador-ficticio-b" })).not.toBe(original);
    expect(draftOperationFingerprint("a".repeat(64), { ...manifest, batchFiles: ["fcc.json"] })).not.toBe(original);
    expect(draftOperationFingerprint("a".repeat(64), { ...manifest, sourceBundleId: "outro" })).not.toBe(original);
  });
  it("aceita somente papel e destino interno do LeiProva", () => {
    expect(requireDraftOperationTarget(url, environment).database).toBe("leiprova");
  });
  it.each([undefined, "", "leiprova-160-2026-09-05", "draft-only:outro-pacote"])("não reutiliza autorização humana antiga: %s", (approval) => {
    expect(() => requireDraftOperationTarget(url, { ...environment, approval })).toThrow();
  });
  it.each([
    "postgresql://postgres:dummy@leiprova-pooler:5432/leiprova",
    "postgresql://leiprova_app:dummy@127.0.0.1:5432/leiprova",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5432/outro",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5432/leiprova?options=x",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5432/leiprova#x",
  ])("bloqueia outro destino/privilégio: %s", (connection) => {
    expect(() => requireDraftOperationTarget(connection, environment)).toThrow();
  });
  it("bloqueia outro site e ausência de conexão explícita", () => {
    expect(() => requireDraftOperationTarget(url, { ...environment, appUrl: "https://outro.example" })).toThrow();
    expect(() => requireDraftOperationTarget(undefined, environment)).toThrow();
  });
  it("mantém desenvolvimento em banco sintético restrito", () => {
    expect(requireDraftOperationTarget("postgres://tester:dummy@127.0.0.1:55439/leiprova_automation_test", { sourceBundleId: bundle }).database).toBe("leiprova_automation_test");
    expect(() => requireDraftOperationTarget(url, { sourceBundleId: bundle })).toThrow();
  });
});
