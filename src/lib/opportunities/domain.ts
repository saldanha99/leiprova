import { z } from "zod";

export const OPPORTUNITY_STAGES = [
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
] as const;

export const OPPORTUNITY_STAGE_LABELS = {
  authorized: "Autorizado",
  commission_formed: "Comissão formada",
  organizer_selected: "Responsável selecionado",
  pre_notice: "Pré-edital",
  notice_published: "Edital publicado",
  registration_open: "Inscrições abertas",
  registration_closed: "Inscrições encerradas",
  exam_scheduled: "Prova agendada",
  exam_held: "Prova realizada",
  result_published: "Resultado publicado",
  homologated: "Homologado",
  closed: "Encerrado",
  suspended: "Suspenso",
  canceled: "Cancelado",
} as const satisfies Record<(typeof OPPORTUNITY_STAGES)[number], string>;

export const EDITORIAL_STATUSES = [
  "draft",
  "pending_review",
  "reviewed",
  "suspended",
] as const;

export const RESPONSIBLE_TYPES = [
  "external_organizer",
  "institutional_commission",
  "hybrid",
] as const;

export const RESPONSIBLE_ROLES = [
  "primary_responsible",
  "examination_provider",
  "logistics_provider",
] as const;

export const QUIZ_BANK_SLUGS = ["vunesp", "fgv", "fcc", "cebraspe"] as const;

export const BRAZILIAN_JURISDICTION_CODES = [
  "BR",
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];
export type ResponsibleType = (typeof RESPONSIBLE_TYPES)[number];
export type ResponsibleRole = (typeof RESPONSIBLE_ROLES)[number];
export type QuizBankSlug = (typeof QUIZ_BANK_SLUGS)[number];
export type BrazilianJurisdictionCode = (typeof BRAZILIAN_JURISDICTION_CODES)[number];

export const opportunityStageSchema = z.enum(OPPORTUNITY_STAGES);
export const editorialStatusSchema = z.enum(EDITORIAL_STATUSES);
export const responsibleTypeSchema = z.enum(RESPONSIBLE_TYPES);
export const responsibleRoleSchema = z.enum(RESPONSIBLE_ROLES);
export const quizBankSlugSchema = z.enum(QUIZ_BANK_SLUGS);
export const brazilianJurisdictionCodeSchema = z.enum(BRAZILIAN_JURISDICTION_CODES);

const identifierSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/));

const slugSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

function normalizedTextSchema(minimum: number, maximum: number) {
  return z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(minimum).max(maximum));
}

function normalizedInstantSchema(label: string) {
  return z
    .iso.datetime({ offset: true })
    .transform((value) => new Date(value).toISOString())
    .refine(
      (value) => new Date(value).getTime() <= Date.now() + 5 * 60 * 1_000,
      `${label} não pode estar no futuro.`,
    );
}

const nullableInstantSchema = (label: string) =>
  normalizedInstantSchema(label)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const officialHttpsUrlSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(2_000))
  .transform((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Informe uma URL oficial válida." });
      return z.NEVER;
    }

    const hostname = url.hostname.toLowerCase();
    const isLocalHostname =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]";

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !hostname ||
      isLocalHostname
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A fonte oficial precisa usar HTTPS público, porta padrão e não pode conter credenciais.",
      });
      return z.NEVER;
    }

    url.hash = "";
    return url.toString();
  });

export const reviewRecordSchema = z
  .object({
    reviewerId: identifierSchema,
    reviewedAt: normalizedInstantSchema("A data da revisão"),
  })
  .strict();

export const officialSourceSchema = z
  .object({
    kind: z.literal("official"),
    publisher: normalizedTextSchema(2, 200),
    url: officialHttpsUrlSchema,
    checkedAt: normalizedInstantSchema("A data de conferência da fonte"),
  })
  .strict();

export const humanReviewSchema = reviewRecordSchema
  .extend({
    decision: z.enum(["approved", "changes_requested"]),
  })
  .strict();

export const responsibleAssignmentSchema = z
  .object({
    id: identifierSchema,
    editionId: identifierSchema,
    organizationName: normalizedTextSchema(2, 240),
    responsibleType: responsibleTypeSchema,
    role: responsibleRoleSchema,
    isCurrent: z.boolean(),
    quizBankSlug: quizBankSlugSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    review: reviewRecordSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict()
  .superRefine((assignment, context) => {
    if (
      assignment.quizBankSlug &&
      (assignment.responsibleType === "institutional_commission" ||
        assignment.role === "logistics_provider")
    ) {
      context.addIssue({
        code: "custom",
        path: ["quizBankSlug"],
        message:
          "Comissão institucional ou prestador apenas logístico não pode ser tratado como banca de questões.",
      });
    }
  });

export const editionReferenceSchema = z
  .object({
    id: identifierSchema,
    year: z.number().int().min(2000).max(2100),
    responsibilities: z.array(responsibleAssignmentSchema).max(20),
  })
  .strict();

function stageRequiresCurrentPrimary(stage: OpportunityStage) {
  return (
    stage === "organizer_selected" ||
    stage === "notice_published" ||
    stage === "registration_open" ||
    stage === "registration_closed" ||
    stage === "exam_scheduled" ||
    stage === "exam_held" ||
    stage === "result_published" ||
    stage === "homologated" ||
    stage === "closed"
  );
}

function getCurrentAssignments(
  edition: z.infer<typeof editionReferenceSchema>,
  role?: ResponsibleRole,
) {
  return edition.responsibilities.filter(
    (assignment) => assignment.isCurrent && (!role || assignment.role === role),
  );
}

function getDistinctCurrentQuizBanks(edition: z.infer<typeof editionReferenceSchema>) {
  return new Set(
    edition.responsibilities
      .filter((assignment) => assignment.isCurrent && assignment.quizBankSlug)
      .map((assignment) => assignment.quizBankSlug as QuizBankSlug),
  );
}

function addEditionInvariantIssues(
  stage: OpportunityStage,
  edition: z.infer<typeof editionReferenceSchema>,
  context: z.RefinementCtx,
) {
  edition.responsibilities.forEach((assignment, index) => {
    if (assignment.editionId !== edition.id) {
      context.addIssue({
        code: "custom",
        path: ["edition", "responsibilities", index, "editionId"],
        message:
          "O responsável pertence a outra edição; responsáveis e bancas nunca são herdados de edição passada.",
      });
    }
  });

  const currentPrimary = getCurrentAssignments(edition, "primary_responsible");
  if (currentPrimary.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["edition", "responsibilities"],
      message: "Cada edição pode ter somente um responsável primário vigente.",
    });
  }

  const currentExaminationProviders = getCurrentAssignments(edition, "examination_provider");
  if (currentExaminationProviders.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["edition", "responsibilities"],
      message: "Cada edição pode ter somente um provedor de prova vigente.",
    });
  }

  if (stageRequiresCurrentPrimary(stage)) {
    if (currentPrimary.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["edition", "responsibilities"],
        message: "O estágio atual exige exatamente um responsável primário vigente.",
      });
    } else if (!currentPrimary[0].review) {
      context.addIssue({
        code: "custom",
        path: ["edition", "responsibilities"],
        message: "O responsável primário precisa de revisão humana neste estágio.",
      });
    }
  }

  if (getDistinctCurrentQuizBanks(edition).size > 1) {
    context.addIssue({
      code: "custom",
      path: ["edition", "responsibilities"],
      message: "Uma edição não pode derivar mais de uma banca canônica vigente.",
    });
  }
}

export const opportunityInputSchema = z
  .object({
    id: identifierSchema,
    slug: slugSchema,
    title: normalizedTextSchema(3, 300),
    categorySlug: slugSchema,
    specializationSlug: slugSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    jurisdictionCode: z
      .string()
      .transform((value) => value.trim().toUpperCase())
      .pipe(brazilianJurisdictionCodeSchema),
    stage: opportunityStageSchema,
    editorialStatus: editorialStatusSchema,
    edition: editionReferenceSchema,
    officialSource: officialSourceSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    humanReview: humanReviewSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    publishedAt: nullableInstantSchema("A data de publicação"),
  })
  .strict()
  .superRefine((opportunity, context) => {
    addEditionInvariantIssues(opportunity.stage, opportunity.edition, context);

    if (
      opportunity.editorialStatus === "reviewed" &&
      opportunity.humanReview?.decision !== "approved"
    ) {
      context.addIssue({
        code: "custom",
        path: ["humanReview"],
        message: "O estado editorial exige aprovação humana explícita.",
      });
    }

    if (opportunity.editorialStatus === "reviewed") {
      if (!opportunity.officialSource) {
        context.addIssue({
          code: "custom",
          path: ["officialSource"],
          message: "A publicação exige uma fonte oficial HTTPS conferida.",
        });
      }

      if (!opportunity.publishedAt) {
        context.addIssue({
          code: "custom",
          path: ["publishedAt"],
          message: "A publicação exige sua data de publicação.",
        });
      }

      if (
        opportunity.officialSource &&
        opportunity.humanReview &&
        new Date(opportunity.humanReview.reviewedAt).getTime() <
          new Date(opportunity.officialSource.checkedAt).getTime()
      ) {
        context.addIssue({
          code: "custom",
          path: ["humanReview", "reviewedAt"],
          message: "A revisão humana precisa ocorrer após a última conferência da fonte oficial.",
        });
      }
    } else if (opportunity.publishedAt && opportunity.editorialStatus !== "suspended") {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Somente oportunidades revisadas ou suspensas conservam data de publicação.",
      });
    }
  });

export type ReviewRecord = Readonly<z.infer<typeof reviewRecordSchema>>;
export type OfficialSource = Readonly<z.infer<typeof officialSourceSchema>>;
export type HumanReview = Readonly<z.infer<typeof humanReviewSchema>>;
export type ResponsibleAssignment = Readonly<
  Omit<z.infer<typeof responsibleAssignmentSchema>, "review"> & {
    review: ReviewRecord | null;
  }
>;
export type EditionReference = Readonly<{
  id: string;
  year: number;
  responsibilities: readonly ResponsibleAssignment[];
}>;
export type Opportunity = Readonly<{
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  specializationSlug: string | null;
  jurisdictionCode: BrazilianJurisdictionCode;
  stage: OpportunityStage;
  editorialStatus: EditorialStatus;
  edition: EditionReference;
  officialSource: OfficialSource | null;
  humanReview: HumanReview | null;
  publishedAt: string | null;
}>;

function freezeReview<T extends ReviewRecord | HumanReview | null>(review: T): T {
  return review ? (Object.freeze({ ...review }) as T) : review;
}

function freezeOpportunity(parsed: z.infer<typeof opportunityInputSchema>): Opportunity {
  const responsibilities = parsed.edition.responsibilities.map((assignment) =>
    Object.freeze({
      ...assignment,
      review: freezeReview(assignment.review),
    }),
  );

  return Object.freeze({
    ...parsed,
    edition: Object.freeze({
      ...parsed.edition,
      responsibilities: Object.freeze(responsibilities),
    }),
    officialSource: parsed.officialSource
      ? Object.freeze({ ...parsed.officialSource })
      : null,
    humanReview: freezeReview(parsed.humanReview),
  });
}

export function normalizeOpportunity(input: unknown): Opportunity {
  return freezeOpportunity(opportunityInputSchema.parse(input));
}

export function deriveCurrentPrimaryResponsible(
  opportunity: Opportunity,
): ResponsibleAssignment | null {
  return (
    opportunity.edition.responsibilities.find(
      (assignment) => assignment.isCurrent && assignment.role === "primary_responsible",
    ) ?? null
  );
}

/**
 * Derives the quiz bank solely from reviewed assignments in this exact edition.
 * There is intentionally no fallback by category, career, year or prior edition.
 */
export function deriveCurrentEditionQuizBank(opportunity: Opportunity): QuizBankSlug | null {
  const candidates = opportunity.edition.responsibilities.filter(
    (assignment) => assignment.isCurrent && assignment.review && assignment.quizBankSlug,
  );
  const banks = new Set(candidates.map((assignment) => assignment.quizBankSlug));

  if (banks.size > 1) {
    throw new OpportunityDomainError(
      "edition_bank_conflict",
      "A edição possui responsáveis vigentes vinculados a bancas diferentes.",
    );
  }

  const examinationProvider = candidates.find(
    (assignment) => assignment.role === "examination_provider",
  );
  const primary = candidates.find((assignment) => assignment.role === "primary_responsible");

  return examinationProvider?.quizBankSlug ?? primary?.quizBankSlug ?? null;
}

export class OpportunityDomainError extends Error {
  constructor(
    readonly code:
      | "invalid_stage_transition"
      | "invalid_editorial_transition"
      | "current_primary_required"
      | "primary_review_required"
      | "edition_bank_conflict"
      | "official_source_required"
      | "human_review_required"
      | "stale_human_review"
      | "invalid_transition_date",
    message: string,
  ) {
    super(message);
    this.name = "OpportunityDomainError";
  }
}

const allowedStageTransitions = {
  authorized: ["commission_formed", "organizer_selected", "pre_notice", "notice_published", "suspended", "canceled"],
  commission_formed: ["organizer_selected", "pre_notice", "notice_published", "suspended", "canceled"],
  organizer_selected: ["pre_notice", "notice_published", "suspended", "canceled"],
  pre_notice: ["organizer_selected", "notice_published", "suspended", "canceled"],
  notice_published: ["registration_open", "registration_closed", "exam_scheduled", "suspended", "canceled"],
  registration_open: ["registration_closed", "exam_scheduled", "suspended", "canceled"],
  registration_closed: ["registration_open", "exam_scheduled", "suspended", "canceled"],
  exam_scheduled: ["exam_held", "suspended", "canceled"],
  exam_held: ["result_published", "homologated", "closed"],
  result_published: ["homologated", "closed"],
  homologated: ["closed"],
  closed: [],
  suspended: ["authorized", "commission_formed", "organizer_selected", "pre_notice", "notice_published", "registration_open", "registration_closed", "exam_scheduled", "canceled"],
  canceled: [],
} as const satisfies Record<OpportunityStage, readonly OpportunityStage[]>;

const allowedEditorialTransitions = {
  draft: ["pending_review", "suspended"],
  pending_review: ["draft", "reviewed", "suspended"],
  reviewed: ["pending_review", "suspended"],
  suspended: ["draft", "pending_review"],
} as const satisfies Record<EditorialStatus, readonly EditorialStatus[]>;

export function canTransitionOpportunityStage(
  from: OpportunityStage,
  to: OpportunityStage,
) {
  return from === to || (allowedStageTransitions[from] as readonly OpportunityStage[]).includes(to);
}

export function canTransitionEditorialStatus(from: EditorialStatus, to: EditorialStatus) {
  return (
    from === to ||
    (allowedEditorialTransitions[from] as readonly EditorialStatus[]).includes(to)
  );
}

function assertStageHasRequiredResponsible(opportunity: Opportunity, stage: OpportunityStage) {
  if (!stageRequiresCurrentPrimary(stage)) return;

  const primary = deriveCurrentPrimaryResponsible(opportunity);
  if (!primary) {
    throw new OpportunityDomainError(
      "current_primary_required",
      "O novo estágio exige um responsável primário vigente nesta edição.",
    );
  }
  if (!primary.review) {
    throw new OpportunityDomainError(
      "primary_review_required",
      "O responsável primário precisa de revisão humana antes desta transição.",
    );
  }
}

export function assertOpportunityPublishable(opportunity: Opportunity) {
  if (!opportunity.officialSource) {
    throw new OpportunityDomainError(
      "official_source_required",
      "A oportunidade não pode ser publicada sem fonte oficial HTTPS conferida.",
    );
  }

  if (opportunity.humanReview?.decision !== "approved") {
    throw new OpportunityDomainError(
      "human_review_required",
      "A oportunidade não pode ser publicada sem aprovação humana.",
    );
  }

  if (
    new Date(opportunity.humanReview.reviewedAt).getTime() <
    new Date(opportunity.officialSource.checkedAt).getTime()
  ) {
    throw new OpportunityDomainError(
      "stale_human_review",
      "A revisão humana é anterior à última conferência da fonte oficial.",
    );
  }

  assertStageHasRequiredResponsible(opportunity, opportunity.stage);
}

export function transitionOpportunityStage(
  opportunity: Opportunity,
  nextStage: OpportunityStage,
): Opportunity {
  if (!canTransitionOpportunityStage(opportunity.stage, nextStage)) {
    throw new OpportunityDomainError(
      "invalid_stage_transition",
      `Transição operacional inválida: ${opportunity.stage} -> ${nextStage}.`,
    );
  }

  if (opportunity.stage === nextStage) return opportunity;
  assertStageHasRequiredResponsible(opportunity, nextStage);

  return normalizeOpportunity({ ...opportunity, stage: nextStage });
}

function parseTransitionInstant(input: string) {
  const parsed = normalizedInstantSchema("A data da transição").safeParse(input);
  if (!parsed.success) {
    throw new OpportunityDomainError(
      "invalid_transition_date",
      parsed.error.issues[0]?.message ?? "A data da transição é inválida.",
    );
  }
  return parsed.data;
}

export function transitionOpportunityEditorialStatus(
  opportunity: Opportunity,
  nextStatus: EditorialStatus,
  transitionedAt?: string,
): Opportunity {
  if (!canTransitionEditorialStatus(opportunity.editorialStatus, nextStatus)) {
    throw new OpportunityDomainError(
      "invalid_editorial_transition",
      `Transição editorial inválida: ${opportunity.editorialStatus} -> ${nextStatus}.`,
    );
  }

  if (opportunity.editorialStatus === nextStatus) return opportunity;

  if (nextStatus === "reviewed") {
    assertOpportunityPublishable(opportunity);
    const publishedAt = parseTransitionInstant(transitionedAt ?? new Date().toISOString());
    return normalizeOpportunity({
      ...opportunity,
      editorialStatus: nextStatus,
      publishedAt,
    });
  }

  return normalizeOpportunity({
    ...opportunity,
    editorialStatus: nextStatus,
    publishedAt: nextStatus === "suspended" ? opportunity.publishedAt : null,
  });
}
