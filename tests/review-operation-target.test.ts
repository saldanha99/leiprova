import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sourceBundle as sourceTemplate } from "./fixtures/local-authoring";
import { importFingerprint, parseLocalImport } from "@/lib/editorial/local-import-plan";
import { parseReview80Arguments, parseReview80Package, requireReview80ApplyFingerprint, requireReviewOperationTarget,
  REVIEW_80_APPROVAL, REVIEW_80_BATCH_FILES, REVIEW_80_BUNDLE_ID, review80OperationFingerprint } from "@/lib/editorial/review-operation-target";

const url = "postgresql://leiprova_app:dummy@leiprova-pooler:5432/leiprova";
const environment = { nodeEnv: "production", appUrl: "https://leiprova.2b.app.br", approval: REVIEW_80_APPROVAL };

// Nenhum pacote privado, identidade real ou banco é usado nestes testes.
function fixture(count = 20, bundleId = REVIEW_80_BUNDLE_ID) {
  const sources = { ...structuredClone(sourceTemplate), id: bundleId, sources: sourceTemplate.sources.slice(0, count) };
  const batches = (["fgv", "fcc", "vunesp", "cebraspe"] as const).map((bank) => ({
    schemaVersion: 1, batchId: `${bundleId}-${bank}`, bankSlug: bank, editorialStatus: "draft", humanReview: "pending",
    generator: { agentName: "Fixture sintética", model: "sem-modelo-teste-ficticio", runtime: "codex-desktop", generatedOn: "2026-09-06" },
    questions: sources.sources.map((source, index) => ({
      id: `${source.id}-${bank}-v1`, sourceId: source.id, type: bank === "cebraspe" ? "true_false" : "multiple_choice",
      difficulty: 1,
      prompt: `Cenário fictício ${Array.from({ length: 10 }, (_, part) => createHash("sha256").update(`${bank}:${index}:${part}`).digest("hex").slice(0, 16)).join(" ")} para testar o contrato de revisão.`,
      explanation: "Explicação inteiramente fictícia para testes de software, sem qualquer validade jurídica.",
      learningObjective: "Conferir o contrato operacional usando somente dados inventados.",
      supportingQuote: source.text,
      options: bank === "cebraspe" ? [
        { key: "C", text: "Certo", isCorrect: index % 2 === 0, rationale: "Justificativa inteiramente fictícia para teste do contrato." },
        { key: "E", text: "Errado", isCorrect: index % 2 !== 0, rationale: "Justificativa inteiramente fictícia para teste do contrato." },
      ] : ["A", "B", "C", "D", "E"].map((key, option) => ({
        key, text: `Alternativa fictícia ${key} do exemplo`, isCorrect: option === index % 5,
        rationale: "Justificativa inteiramente fictícia para teste do contrato.",
      })),
    })),
  }));
  const mapping = { schemaVersion: 1, sourceBundleId: bundleId, bindings: sources.sources.map((source, index) => ({
    sourceId: source.id, legalArticleId: index + 1, legalVersionId: 1, versionChecksum: "a".repeat(64), subjectId: 1, topicId: 1,
  })) };
  const input = parseLocalImport(sources, batches, mapping);
  const authorization = { schemaVersion: 1, sourceBundleId: bundleId, actorPublicId: "11111111-1111-4111-8111-111111111111",
    sourcesSha256: input.validation.sourcesSha256, mappingSha256: importFingerprint(input.mapping),
    banks: input.validation.banks.map(({ bank, sha256 }) => ({ bank, sha256 })),
    humanReviewConfirmed: true, cleanRoomAttested: true,
    reference: "confirmacao-ficticia-exclusiva-de-teste", notes: "Declaração fictícia para testar software; não aprova conteúdo jurídico real." };
  return { sources, batches, mapping, authorization };
}

describe("destino exclusivo de revisão das 80 questões", () => {
  it("aceita pooler restrito e habilitação específica", () => {
    expect(requireReviewOperationTarget(url, environment)).toEqual({ connectionString: url, database: "leiprova" });
    expect(requireReviewOperationTarget(url.replace("leiprova-pooler:5432", "pooler"), environment).database).toBe("leiprova");
  });
  it.each([undefined, "", "leiprova-160-2026-09-05", `draft-only:${REVIEW_80_BUNDLE_ID}`, "import_pending_bindings", "review-80:outro-pacote"])("rejeita habilitação ausente ou de outro fluxo: %s", (approval) => {
    expect(() => requireReviewOperationTarget(url, { ...environment, approval })).toThrow();
  });
  it.each([
    "postgresql://postgres:dummy@leiprova-pooler:5432/leiprova",
    "postgresql://leiprova_owner:dummy@leiprova-pooler:5432/leiprova",
    "postgresql://leiprova_app:dummy@127.0.0.1:5432/leiprova",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5433/leiprova",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5432/outro",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5432/leiprova?options=x",
    "postgresql://leiprova_app:dummy@leiprova-pooler:5432/leiprova#x",
    "https://leiprova_app:dummy@leiprova-pooler/leiprova",
    "not-a-url",
  ])("bloqueia privilégio ou destino diferente: %s", (connection) => {
    expect(() => requireReviewOperationTarget(connection, environment)).toThrow();
  });
  it("não usa conexão implícita e exige o site exato", () => {
    expect(() => requireReviewOperationTarget(undefined, environment)).toThrow("explicitamente");
    expect(() => requireReviewOperationTarget(url, { ...environment, appUrl: "https://homolog.leiprova.2b.app.br" })).toThrow();
  });
  it("sem modo produção aceita somente banco local dedicado", () => {
    expect(requireReviewOperationTarget("postgres://tester:dummy@127.0.0.1:55440/leiprova_editorial_local", {}).database).toBe("leiprova_editorial_local");
    expect(() => requireReviewOperationTarget(url, {})).toThrow();
    expect(() => requireReviewOperationTarget("postgres://tester:dummy@127.0.0.1:5432/leiprova", {})).toThrow();
  });
});

describe("contrato exato do pacote de revisão", () => {
  const f = fixture();
  it("aceita 80 itens sintéticos, 20 por arquivo, com ambas as declarações e hashes exatos", () => {
    const parsed = parseReview80Package(f.sources, f.batches, f.mapping, f.authorization);
    expect(parsed.input.validation.totalQuestions).toBe(80);
    expect(REVIEW_80_BATCH_FILES).toEqual(["fgv.json", "fcc.json", "vunesp.json", "cebraspe.json"]);
    expect(parsed.authorization.actorPublicId).toBe(f.authorization.actorPublicId);
  });
  it("bloqueia outro lote mesmo com autorização correspondente", () => {
    const other = fixture(20, "cf-direitos-fundamentais-2026-09-05");
    expect(() => parseReview80Package(other.sources, other.batches, other.mapping, other.authorization)).toThrow("limitada");
  });
  it("bloqueia quantidade diferente e troca de arquivo/banca", () => {
    const short = fixture(19);
    expect(() => parseReview80Package(short.sources, short.batches, short.mapping, short.authorization)).toThrow("limitada");
    expect(() => parseReview80Package(f.sources, [f.batches[1], f.batches[0], ...f.batches.slice(2)], f.mapping, f.authorization)).toThrow("limitada");
    expect(() => parseReview80Package(f.sources, f.batches.slice(0, 3), f.mapping, f.authorization)).toThrow("limitada");
  });
  it.each([
    { humanReviewConfirmed: false }, { cleanRoomAttested: false }, { cleanRoomAttested: undefined },
    { actorPublicId: "identidade-invalida" }, { reference: "" }, { notes: "" },
  ])("não inventa declaração, ator ou justificativa: %j", (change) => {
    expect(() => parseReview80Package(f.sources, f.batches, f.mapping, { ...f.authorization, ...change })).toThrow("confirmações");
  });
  it("bloqueia autorização ausente e campos extras", () => {
    expect(() => parseReview80Package(f.sources, f.batches, f.mapping, undefined)).toThrow("confirmações");
    expect(() => parseReview80Package(f.sources, f.batches, f.mapping, { ...f.authorization, approveAllProducts: true })).toThrow("confirmações");
  });
  it.each([
    { sourceBundleId: "outro-pacote" }, { sourcesSha256: "b".repeat(64) }, { mappingSha256: "b".repeat(64) },
    { banks: [] }, { banks: [f.authorization.banks[0], f.authorization.banks[0], ...f.authorization.banks.slice(2)] },
    { banks: f.authorization.banks.map((bank, index) => index ? bank : { ...bank, sha256: "c".repeat(64) }) },
  ])("recusa versões não confirmadas: %j", (change) => {
    expect(() => parseReview80Package(f.sources, f.batches, f.mapping, { ...f.authorization, ...change })).toThrow();
  });
  it("prende fingerprint ao dossiê, revisor e texto da confirmação", () => {
    const initial = review80OperationFingerprint("a".repeat(64), f.authorization);
    expect(review80OperationFingerprint("a".repeat(64), { ...f.authorization })).toBe(initial);
    expect(review80OperationFingerprint("b".repeat(64), f.authorization)).not.toBe(initial);
    expect(review80OperationFingerprint("a".repeat(64), { ...f.authorization, actorPublicId: "22222222-2222-4222-8222-222222222222" })).not.toBe(initial);
    expect(review80OperationFingerprint("a".repeat(64), { ...f.authorization, notes: "Outra confirmação inteiramente fictícia para testar o contrato." })).not.toBe(initial);
    expect(() => requireReview80ApplyFingerprint(initial, initial)).not.toThrow();
    expect(() => requireReview80ApplyFingerprint(undefined, initial)).toThrow();
    expect(() => requireReview80ApplyFingerprint("b".repeat(64), initial)).toThrow();
    expect(() => requireReview80ApplyFingerprint(initial.toUpperCase(), initial)).toThrow();
  });
});

describe("argumentos do operador de revisão", () => {
  it("prévia é padrão e aplicação exige fingerprint explícito", () => {
    expect(parseReview80Arguments([])).toMatchObject({ mode: "preview" });
    expect(parseReview80Arguments(["--mode=apply", `--fingerprint=${"a".repeat(64)}`])).toMatchObject({ mode: "apply", fingerprint: "a".repeat(64) });
  });
  it.each([
    ["--mode=apply"], ["--mode=import-pending"], ["--mode=preview", "--mode=apply"],
    ["--phase=review-apply"], ["--approve-all=true"], ["--fingerprint=bad"],
    ["--mode=apply", "--fingerprint=bad"], [`--fingerprint=${"a".repeat(64)}`], ["--directory="],
  ])("recusa argumentos inválidos: %j", (...arguments_) => {
    expect(() => parseReview80Arguments(arguments_)).toThrow();
  });
});
