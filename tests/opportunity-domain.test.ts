import { describe, expect, it } from "vitest";

import {
  assertOpportunityPublishable,
  canTransitionEditorialStatus,
  canTransitionOpportunityStage,
  deriveCurrentEditionQuizBank,
  deriveCurrentPrimaryResponsible,
  EDITORIAL_STATUSES,
  normalizeOpportunity,
  OPPORTUNITY_STAGES,
  OpportunityDomainError,
  QUIZ_BANK_SLUGS,
  RESPONSIBLE_ROLES,
  RESPONSIBLE_TYPES,
  transitionOpportunityEditorialStatus,
  transitionOpportunityStage,
  type Opportunity,
} from "@/lib/opportunities/domain";

const responsibleReview = {
  reviewerId: "reviewer-1",
  reviewedAt: "2024-05-02T15:00:00-03:00",
};

const humanReview = {
  ...responsibleReview,
  decision: "approved" as const,
};

const officialSource = {
  kind: "official" as const,
  publisher: "Ministério Público do Estado de São Paulo",
  url: "https://www.mpsp.mp.br/concursos/analista-2026#edital",
  checkedAt: "2024-05-02T14:00:00-03:00",
};

function commissionPrimary(overrides: Record<string, unknown> = {}) {
  return {
    id: "responsibility-primary",
    editionId: "mpsp-analista-2026",
    organizationName: "Comissão do 97º Concurso do MPSP",
    responsibleType: "institutional_commission",
    role: "primary_responsible",
    isCurrent: true,
    quizBankSlug: null,
    review: responsibleReview,
    ...overrides,
  };
}

function externalPrimary(overrides: Record<string, unknown> = {}) {
  return {
    id: "responsibility-primary",
    editionId: "mpsp-analista-2026",
    organizationName: "Fundação Getulio Vargas",
    responsibleType: "external_organizer",
    role: "primary_responsible",
    isCurrent: true,
    quizBankSlug: "fgv",
    review: responsibleReview,
    ...overrides,
  };
}

function opportunityInput(overrides: Record<string, unknown> = {}) {
  return {
    id: "opportunity-mpsp-analista-2026",
    slug: "mpsp-analista-2026",
    title: "Analista Jurídico — MPSP 2026",
    categorySlug: "carreiras-juridicas",
    specializationSlug: "analista-juridico",
    jurisdictionCode: "SP",
    stage: "pre_notice",
    editorialStatus: "draft",
    edition: {
      id: "mpsp-analista-2026",
      year: 2026,
      responsibilities: [],
    },
    officialSource: null,
    humanReview: null,
    publishedAt: null,
    ...overrides,
  };
}

function publishableOpportunity(overrides: Record<string, unknown> = {}): Opportunity {
  return normalizeOpportunity(
    opportunityInput({
      stage: "notice_published",
      editorialStatus: "pending_review",
      edition: {
        id: "mpsp-analista-2026",
        year: 2026,
        responsibilities: [commissionPrimary()],
      },
      officialSource,
      humanReview,
      ...overrides,
    }),
  );
}

describe("vocabulário do domínio de oportunidades", () => {
  it("expõe todos os estágios operacionais e editoriais previstos", () => {
    expect(OPPORTUNITY_STAGES).toEqual([
      "authorized",
      "commission_formed",
      "organizer_selected",
      "pre_notice",
      "notice_published",
      "registration_open",
      "registration_closed",
      "exam_scheduled",
      "exam_held",
      "result_published",
      "homologated",
      "closed",
      "suspended",
      "canceled",
    ]);
    expect(EDITORIAL_STATUSES).toEqual([
      "draft",
      "pending_review",
      "reviewed",
      "suspended",
    ]);
  });

  it("distingue tipo, papel e as quatro bancas editoriais canônicas", () => {
    expect(RESPONSIBLE_TYPES).toEqual([
      "external_organizer",
      "institutional_commission",
      "hybrid",
    ]);
    expect(RESPONSIBLE_ROLES).toEqual([
      "primary_responsible",
      "examination_provider",
      "logistics_provider",
    ]);
    expect(QUIZ_BANK_SLUGS).toEqual(["vunesp", "fgv", "fcc", "cebraspe"]);
  });
});

describe("normalização e imutabilidade", () => {
  it("normaliza texto, slugs, UF, instantes e URL sem fragmento", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        slug: "  MPSP-ANALISTA-2026 ",
        title: "  Analista   Jurídico\nMPSP 2026 ",
        categorySlug: " CARREIRAS-JURIDICAS ",
        specializationSlug: undefined,
        jurisdictionCode: " sp ",
        officialSource,
      }),
    );

    expect(opportunity).toMatchObject({
      slug: "mpsp-analista-2026",
      title: "Analista Jurídico MPSP 2026",
      categorySlug: "carreiras-juridicas",
      specializationSlug: null,
      jurisdictionCode: "SP",
      officialSource: {
        url: "https://www.mpsp.mp.br/concursos/analista-2026",
        checkedAt: "2024-05-02T17:00:00.000Z",
      },
    });
  });

  it("congela toda a estrutura que pode ser exposta como somente leitura", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [externalPrimary()],
        },
        officialSource,
      }),
    );

    expect(Object.isFrozen(opportunity)).toBe(true);
    expect(Object.isFrozen(opportunity.edition)).toBe(true);
    expect(Object.isFrozen(opportunity.edition.responsibilities)).toBe(true);
    expect(Object.isFrozen(opportunity.edition.responsibilities[0])).toBe(true);
    expect(Object.isFrozen(opportunity.edition.responsibilities[0].review)).toBe(true);
    expect(Object.isFrozen(opportunity.officialSource)).toBe(true);
    expect(() =>
      (opportunity.edition.responsibilities as ResponsibleAssignmentForMutation[]).push(
        {} as ResponsibleAssignmentForMutation,
      ),
    ).toThrow();
  });

  it("rejeita campos livres, identificadores inválidos e jurisdição desconhecida", () => {
    expect(() => normalizeOpportunity({ ...opportunityInput(), bankSlug: "fgv" })).toThrow(
      /Unrecognized key|unrecognized/i,
    );
    expect(() => normalizeOpportunity(opportunityInput({ id: "id com espaço" }))).toThrow();
    expect(() => normalizeOpportunity(opportunityInput({ jurisdictionCode: "XX" }))).toThrow();
  });

  it("aceita apenas uma fonte marcada como oficial e servida por HTTPS público", () => {
    expect(() =>
      normalizeOpportunity(
        opportunityInput({ officialSource: { ...officialSource, kind: "secondary" } }),
      ),
    ).toThrow();
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          officialSource: { ...officialSource, url: "http://www.mpsp.mp.br/edital" },
        }),
      ),
    ).toThrow(/HTTPS público/);
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          officialSource: { ...officialSource, url: "https://localhost/edital" },
        }),
      ),
    ).toThrow(/HTTPS público/);
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          officialSource: { ...officialSource, url: "https://user:secret@mpsp.mp.br/edital" },
        }),
      ),
    ).toThrow(/credenciais/);
  });
});

type ResponsibleAssignmentForMutation = Opportunity["edition"]["responsibilities"][number];

describe("responsável primário vigente por edição", () => {
  it("permite autorização e pré-edital sem responsável já selecionado", () => {
    expect(normalizeOpportunity(opportunityInput({ stage: "authorized" })).edition.responsibilities)
      .toEqual([]);
    expect(normalizeOpportunity(opportunityInput({ stage: "pre_notice" })).edition.responsibilities)
      .toEqual([]);
  });

  it("exige um responsável primário revisado a partir do edital", () => {
    expect(() =>
      normalizeOpportunity(opportunityInput({ stage: "notice_published" })),
    ).toThrow(/exige exatamente um responsável primário vigente/);

    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          stage: "registration_open",
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [commissionPrimary({ review: null })],
          },
        }),
      ),
    ).toThrow(/precisa de revisão humana/);
  });

  it("admite comissão institucional sem inventar uma banca", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        stage: "notice_published",
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [commissionPrimary()],
        },
      }),
    );

    expect(deriveCurrentPrimaryResponsible(opportunity)?.responsibleType).toBe(
      "institutional_commission",
    );
    expect(deriveCurrentEditionQuizBank(opportunity)).toBeNull();
  });

  it("rejeita mais de um responsável primário vigente", () => {
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [
              commissionPrimary(),
              commissionPrimary({ id: "responsibility-primary-2" }),
            ],
          },
        }),
      ),
    ).toThrow(/somente um responsável primário vigente/);
  });

  it("rejeita mais de um provedor de prova vigente", () => {
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [
              commissionPrimary(),
              externalPrimary({
                id: "provider-1",
                role: "examination_provider",
              }),
              externalPrimary({
                id: "provider-2",
                role: "examination_provider",
              }),
            ],
          },
        }),
      ),
    ).toThrow(/somente um provedor de prova vigente/);
  });

  it("permite organizador externo fora dos quatro perfis sem inventar uma banca", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [externalPrimary({ quizBankSlug: null })],
        },
      }),
    );
    expect(deriveCurrentEditionQuizBank(opportunity)).toBeNull();

    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [externalPrimary({ quizBankSlug: "aocp" })],
          },
        }),
      ),
    ).toThrow();
  });

  it("não converte comissão institucional ou logística em banca", () => {
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [commissionPrimary({ quizBankSlug: "fgv" })],
          },
        }),
      ),
    ).toThrow(/não pode ser tratado como banca/);

    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [
              commissionPrimary({
                id: "logistics",
                role: "logistics_provider",
                responsibleType: "hybrid",
                quizBankSlug: "fgv",
              }),
            ],
          },
        }),
      ),
    ).toThrow(/não pode ser tratado como banca/);
  });

  it("deriva a banca do provedor externo em um arranjo híbrido", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        stage: "notice_published",
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [
            commissionPrimary({ responsibleType: "hybrid" }),
            externalPrimary({
              id: "external-exam-provider",
              role: "examination_provider",
              quizBankSlug: "vunesp",
            }),
          ],
        },
      }),
    );

    expect(deriveCurrentEditionQuizBank(opportunity)).toBe("vunesp");
  });

  it("rejeita bancas vigentes conflitantes na mesma edição", () => {
    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [
              externalPrimary({ quizBankSlug: "fgv" }),
              externalPrimary({
                id: "external-exam-provider",
                role: "examination_provider",
                quizBankSlug: "vunesp",
              }),
            ],
          },
        }),
      ),
    ).toThrow(/mais de uma banca canônica vigente/);
  });

  it("não expõe banca descoberta sem revisão", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [externalPrimary({ review: null })],
        },
      }),
    );

    expect(deriveCurrentEditionQuizBank(opportunity)).toBeNull();
  });

  it("ignora atribuição inativa e jamais herda banca de edição passada", () => {
    const currentEdition = normalizeOpportunity(
      opportunityInput({
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [
            externalPrimary({
              id: "old-provider",
              isCurrent: false,
              quizBankSlug: "fgv",
            }),
          ],
        },
      }),
    );
    expect(deriveCurrentEditionQuizBank(currentEdition)).toBeNull();

    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          edition: {
            id: "mpsp-analista-2026",
            year: 2026,
            responsibilities: [externalPrimary({ editionId: "mpsp-analista-2025" })],
          },
        }),
      ),
    ).toThrow(/nunca são herdados de edição passada/);
  });
});

describe("transições operacionais", () => {
  it("aceita progressão, saltos oficiais previstos e reabertura de inscrições", () => {
    expect(canTransitionOpportunityStage("authorized", "pre_notice")).toBe(true);
    expect(canTransitionOpportunityStage("authorized", "notice_published")).toBe(true);
    expect(canTransitionOpportunityStage("registration_closed", "registration_open")).toBe(true);
    expect(canTransitionOpportunityStage("notice_published", "exam_scheduled")).toBe(true);
  });

  it("mantém atualização idempotente e bloqueia regressões inválidas", () => {
    const opportunity = normalizeOpportunity(opportunityInput());
    expect(transitionOpportunityStage(opportunity, "pre_notice")).toBe(opportunity);
    expect(canTransitionOpportunityStage("pre_notice", "authorized")).toBe(false);
    expect(() => transitionOpportunityStage(opportunity, "exam_held")).toThrow(
      /Transição operacional inválida/,
    );
  });

  it("bloqueia a abertura do edital sem responsável primário vigente", () => {
    const opportunity = normalizeOpportunity(opportunityInput());

    try {
      transitionOpportunityStage(opportunity, "notice_published");
      throw new Error("A transição deveria ter falhado.");
    } catch (error) {
      expect(error).toBeInstanceOf(OpportunityDomainError);
      expect((error as OpportunityDomainError).code).toBe("current_primary_required");
    }
  });

  it("avança até a prova e torna encerrado um estado terminal", () => {
    let opportunity = normalizeOpportunity(
      opportunityInput({
        stage: "notice_published",
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [commissionPrimary()],
        },
      }),
    );
    opportunity = transitionOpportunityStage(opportunity, "registration_open");
    opportunity = transitionOpportunityStage(opportunity, "registration_closed");
    opportunity = transitionOpportunityStage(opportunity, "exam_scheduled");
    opportunity = transitionOpportunityStage(opportunity, "exam_held");
    opportunity = transitionOpportunityStage(opportunity, "closed");

    expect(opportunity.stage).toBe("closed");
    expect(() => transitionOpportunityStage(opportunity, "pre_notice")).toThrow(
      /Transição operacional inválida/,
    );
  });
});

describe("publicação e fluxo editorial", () => {
  it("bloqueia publicação sem fonte oficial", () => {
    const opportunity = publishableOpportunity({ officialSource: null });

    try {
      assertOpportunityPublishable(opportunity);
      throw new Error("A publicação deveria ter sido bloqueada.");
    } catch (error) {
      expect(error).toBeInstanceOf(OpportunityDomainError);
      expect((error as OpportunityDomainError).code).toBe("official_source_required");
    }
  });

  it("bloqueia publicação sem aprovação humana", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        stage: "notice_published",
        editorialStatus: "pending_review",
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [commissionPrimary()],
        },
        officialSource,
        humanReview: null,
      }),
    );

    expect(() => assertOpportunityPublishable(opportunity)).toThrow(/aprovação humana/);
  });

  it("bloqueia revisão anterior à última conferência da fonte", () => {
    const opportunity = normalizeOpportunity(
      opportunityInput({
        stage: "notice_published",
        editorialStatus: "pending_review",
        edition: {
          id: "mpsp-analista-2026",
          year: 2026,
          responsibilities: [commissionPrimary()],
        },
        officialSource: {
          ...officialSource,
          checkedAt: "2024-05-03T12:00:00Z",
        },
        humanReview,
      }),
    );

    try {
      assertOpportunityPublishable(opportunity);
      throw new Error("A publicação deveria ter sido bloqueada.");
    } catch (error) {
      expect(error).toBeInstanceOf(OpportunityDomainError);
      expect((error as OpportunityDomainError).code).toBe("stale_human_review");
    }
  });

  it("exige checkedAt dentro da fonte e rejeita publicação montada diretamente sem revisão", () => {
    const sourceWithoutCheck = { ...officialSource } as Record<string, unknown>;
    delete sourceWithoutCheck.checkedAt;
    expect(() =>
      normalizeOpportunity(opportunityInput({ officialSource: sourceWithoutCheck })),
    ).toThrow();

    expect(() =>
      normalizeOpportunity(
        opportunityInput({
          editorialStatus: "reviewed",
          officialSource,
          humanReview: null,
          publishedAt: "2024-05-03T12:00:00Z",
        }),
      ),
    ).toThrow(/aprovação humana explícita/);
  });

  it("publica somente após aprovação e grava o instante normalizado", () => {
    const pendingReview = publishableOpportunity();
    const published = transitionOpportunityEditorialStatus(
      pendingReview,
      "reviewed",
      "2024-05-03T10:00:00-03:00",
    );

    expect(published.editorialStatus).toBe("reviewed");
    expect(published.publishedAt).toBe("2024-05-03T13:00:00.000Z");
    expect(() => assertOpportunityPublishable(published)).not.toThrow();
  });

  it("preserva a data ao suspender e a limpa ao reabrir a revisão", () => {
    const published = transitionOpportunityEditorialStatus(
      publishableOpportunity(),
      "reviewed",
      "2024-05-03T13:00:00Z",
    );
    const underReview = transitionOpportunityEditorialStatus(published, "pending_review");
    expect(underReview.publishedAt).toBeNull();

    const republished = normalizeOpportunity({
      ...published,
      editorialStatus: "reviewed",
    });
    const suspended = transitionOpportunityEditorialStatus(republished, "suspended");
    expect(suspended.publishedAt).toBe("2024-05-03T13:00:00.000Z");
    expect(transitionOpportunityEditorialStatus(suspended, "draft").publishedAt).toBeNull();
  });

  it("valida a máquina editorial e impede publicação direta do rascunho", () => {
    expect(canTransitionEditorialStatus("draft", "pending_review")).toBe(true);
    expect(canTransitionEditorialStatus("pending_review", "reviewed")).toBe(true);
    expect(canTransitionEditorialStatus("reviewed", "draft")).toBe(false);

    const draft = normalizeOpportunity(opportunityInput());
    expect(transitionOpportunityEditorialStatus(draft, "draft")).toBe(draft);
    expect(() => transitionOpportunityEditorialStatus(draft, "reviewed")).toThrow(
      /Transição editorial inválida/,
    );
  });

  it("rejeita data de transição inválida", () => {
    expect(() =>
      transitionOpportunityEditorialStatus(
        publishableOpportunity(),
        "reviewed",
        "não-é-data",
      ),
    ).toThrow(/data|datetime/i);
  });
});
