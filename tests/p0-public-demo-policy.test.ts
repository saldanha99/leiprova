import { describe, expect, it } from "vitest";

import {
  describeDemoEditorialState,
  resolvePublicDemoSurface,
} from "@/lib/editorial/public-demo-policy";
import { DEMO_CONTENT_PROVENANCE, DEMO_PUBLIC_SURFACE, DEMO_QUESTIONS } from "@/lib/demo-content";

const SENTINELA = "ENUNCIADO-JURIDICO-SENTINELA-NAO-DEVE-VAZAR";

// Fixtures carregam enunciado, gabarito e texto legal de propósito: sem isso a
// asserção de "não vaza conteúdo jurídico" seria tautológica.
const questions = [
  {
    slug: "cf-1",
    legalAct: "Constituição Federal de 1988",
    prompt: SENTINELA,
    literalText: SENTINELA,
    explanation: SENTINELA,
    articleRef: "Art. 5º, IV",
  },
  {
    slug: "cf-2",
    legalAct: "Constituição Federal de 1988",
    prompt: SENTINELA,
    literalText: SENTINELA,
    explanation: SENTINELA,
    articleRef: "Art. 37",
  },
];

describe("portão editorial da demonstração pública", () => {
  it("não serve conteúdo jurídico enquanto a revisão humana não estiver registrada", () => {
    const surface = resolvePublicDemoSurface({
      provenance: { humanReviewRecorded: false, publicationStage: "beta" },
      questions,
    });
    expect(surface.kind).toBe("editorial_preview");
    expect(surface.kind === "editorial_preview" && surface.reason).toBe("human_review_not_recorded");
  });

  it("expõe apenas metadado factual do acervo, nunca o enunciado", () => {
    const surface = resolvePublicDemoSurface({
      provenance: { humanReviewRecorded: false, publicationStage: "beta" },
      questions,
    });
    expect(surface.kind === "editorial_preview" && surface.pendingCount).toBe(2);
    expect(surface.kind === "editorial_preview" && surface.legalActs).toEqual([
      "Constituição Federal de 1988",
    ]);
    expect(JSON.stringify(surface)).not.toContain(SENTINELA);
  });

  it("serve a sessão quando a revisão humana estiver registrada", () => {
    const surface = resolvePublicDemoSurface({
      provenance: { humanReviewRecorded: true, publicationStage: "published" },
      questions,
    });
    expect(surface.kind).toBe("reviewed_session");
    expect(surface.kind === "reviewed_session" && surface.questions).toHaveLength(2);
    // contraprova: quando liberado, o enunciado É entregue — logo a asserção
    // anterior mede mesmo a diferença entre bloquear e servir.
    expect(JSON.stringify(surface)).toContain(SENTINELA);
  });

  it("falha fechada quando a revisão existe mas o acervo está vazio", () => {
    const surface = resolvePublicDemoSurface({
      provenance: { humanReviewRecorded: true, publicationStage: "published" },
      questions: [],
    });
    expect(surface.kind === "editorial_preview" && surface.reason).toBe("no_question_available");
  });

  it("descreve o estado editorial sem alegar revisão inexistente", () => {
    const text = describeDemoEditorialState(
      resolvePublicDemoSurface({
        provenance: { humanReviewRecorded: false, publicationStage: "beta" },
        questions,
      }),
    );
    expect(text).toContain("em revisão humana");
    expect(describeDemoEditorialState({ kind: "reviewed_session", questions })).toBeNull();
  });

  it("regressão: com a proveniência atual do repositório a demo não serve questão", () => {
    expect(DEMO_CONTENT_PROVENANCE.humanReviewRecorded).toBe(false);
    expect(DEMO_PUBLIC_SURFACE.kind).toBe("editorial_preview");
  });

  it("o acervo permanece íntegro e continua exportado", () => {
    expect(DEMO_QUESTIONS.length).toBeGreaterThan(0);
    expect(DEMO_QUESTIONS[0].officialUrl).toContain("planalto.gov.br");
  });
});
