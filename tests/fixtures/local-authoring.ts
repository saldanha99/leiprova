import { createHash } from "node:crypto";
import type { LocalAuthoringBatch, LocalSourceBundle } from "@/lib/editorial/local-authoring";

// Corpus inteiramente fictício para testar o motor sem publicar o lote editorial privado.
export const sourceBundle: LocalSourceBundle = {
  schemaVersion: 1, id: "qa-autoria-sintetica", title: "Regras inventadas exclusivamente para testes",
  officialUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  retrievedOn: "2026-09-05", captureMethod: "Fixture inventada; a URL testa somente a allowlist do contrato.",
  reviewStatus: "pending_human_review", scope: "Dados fictícios para testar o software; não possuem validade jurídica.",
  articleContext: "Contexto fictício de objetos coloridos e posições, exclusivo para testes de software.",
  sources: Array.from({ length: 40 }, (_, index) => ({
    id: `qa-fonte-${index + 1}`, articleRef: `Regra fictícia ${index + 1}`,
    text: `Regra inventada ${index + 1}: o objeto colorido de número ${index + 1} permanece na gaveta de teste.`,
  })),
};
export const cebraspeBatch: LocalAuthoringBatch = {
  schemaVersion: 1, batchId: sourceBundle.id + "-cebraspe", bankSlug: "cebraspe",
  editorialStatus: "draft", humanReview: "pending",
  generator: { agentName: "Fixture sintética", model: "nenhum-modelo-dados-de-teste", runtime: "codex-desktop", generatedOn: "2026-09-05" },
  questions: sourceBundle.sources.map((source, index) => ({
    id: source.id + "-cebraspe-v1", sourceId: source.id, type: "true_false", difficulty: 1,
    prompt: `Cenário fictício ${Array.from({ length: 8 }, (_, part) => createHash("sha256").update(index + ":" + part).digest("hex").slice(0, 16)).join(" ")}: o objeto está na posição indicada.`,
    explanation: "Justificativa inteiramente fictícia para testar persistência e revisão, sem conteúdo jurídico.",
    learningObjective: "Validar o comportamento do motor com dados sintéticos.",
    supportingQuote: source.text,
    options: [
      { key: "C", text: "Certo", isCorrect: index % 2 === 1, rationale: "Explicação fictícia da alternativa para o teste estrutural." },
      { key: "E", text: "Errado", isCorrect: index % 2 === 0, rationale: "Explicação fictícia da alternativa para o teste estrutural." },
    ],
  })),
};
