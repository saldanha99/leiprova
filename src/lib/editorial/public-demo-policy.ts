/**
 * Política da demonstração pública.
 *
 * O projeto exige fonte oficial e revisão humana antes de publicar conteúdo
 * jurídico, mas a demonstração entregava questões de literalidade
 * constitucional com `humanReviewRecorded: false`. Aviso de beta não substitui
 * revisão.
 *
 * A regra aqui é simples e fecha por padrão: o conteúdo jurídico só é servido
 * quando a revisão humana estiver registrada na proveniência. Enquanto não
 * estiver, a página mostra o estado editorial e uma demonstração neutra da
 * interface — sem apagar o acervo, sem alterar as questões e sem declarar uma
 * revisão que não aconteceu.
 */

export type DemoProvenanceLike = {
  readonly humanReviewRecorded: boolean;
  readonly publicationStage: string;
};

export type DemoQuestionLike = {
  readonly slug: string;
  readonly legalAct: string;
};

export type PublicDemoSurface<TQuestion extends DemoQuestionLike> =
  | { readonly kind: "reviewed_session"; readonly questions: readonly TQuestion[] }
  | {
      readonly kind: "editorial_preview";
      readonly reason: "human_review_not_recorded" | "no_question_available";
      /** Metadado factual sobre o acervo. Não é conteúdo jurídico servido. */
      readonly pendingCount: number;
      readonly legalActs: readonly string[];
    };

export function resolvePublicDemoSurface<TQuestion extends DemoQuestionLike>(input: {
  readonly provenance: DemoProvenanceLike;
  readonly questions: readonly TQuestion[];
}): PublicDemoSurface<TQuestion> {
  const legalActs = [...new Set(input.questions.map((question) => question.legalAct))];

  if (!input.provenance.humanReviewRecorded) {
    return {
      kind: "editorial_preview",
      reason: "human_review_not_recorded",
      pendingCount: input.questions.length,
      legalActs,
    };
  }

  if (!input.questions.length) {
    return {
      kind: "editorial_preview",
      reason: "no_question_available",
      pendingCount: 0,
      legalActs,
    };
  }

  return { kind: "reviewed_session", questions: input.questions };
}

/** Texto único do estado editorial, para a página não improvisar redação. */
export function describeDemoEditorialState(
  surface: PublicDemoSurface<DemoQuestionLike>,
): string | null {
  if (surface.kind === "reviewed_session") return null;
  if (surface.reason === "no_question_available") {
    return "A demonstração está sendo remontada. Nenhuma questão está disponível no momento.";
  }
  return "As questões desta demonstração estão em revisão humana e por isso não são exibidas. O conteúdo jurídico só é publicado depois que a revisão é registrada.";
}
