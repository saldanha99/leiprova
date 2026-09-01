export type OrganizerAssignmentIdentity = Readonly<{
  role: "primary_responsible" | "examination_provider" | "logistics_provider";
  organizerSlug: string;
}>;

export type ExistingOrganizerAssignment = OrganizerAssignmentIdentity &
  Readonly<{
    status: "pending_review" | "reviewed" | "superseded" | "rejected";
    validUntil: string | null;
  }>;

function assignmentKey(assignment: OrganizerAssignmentIdentity) {
  return `${assignment.role}:${assignment.organizerSlug}`;
}

export function assertOrganizerAssignmentsReconcilable(
  opportunitySlug: string,
  expectedAssignments: readonly OrganizerAssignmentIdentity[],
  existingAssignments: readonly ExistingOrganizerAssignment[],
) {
  const expectedKeys = new Set<string>();
  for (const assignment of expectedAssignments) {
    const key = assignmentKey(assignment);
    if (expectedKeys.has(key)) {
      throw new Error(
        `[${opportunitySlug}] o catálogo repete o responsável ${assignment.organizerSlug} para ${assignment.role}.`,
      );
    }
    expectedKeys.add(key);
  }

  for (const assignment of existingAssignments) {
    const key = assignmentKey(assignment);
    if (assignment.status === "rejected" && expectedKeys.has(key)) {
      throw new Error(
        `[${opportunitySlug}] o responsável ${assignment.organizerSlug} para ${assignment.role} foi rejeitado; reaprovação exige supersessão editorial explícita.`,
      );
    }

    if (assignment.validUntil !== null) continue;

    if (assignment.status === "superseded") {
      throw new Error(
        `[${opportunitySlug}] o responsável supersedido ${assignment.organizerSlug} continua sem data final.`,
      );
    }

    if (
      assignment.status !== "rejected" &&
      !expectedKeys.has(key)
    ) {
      throw new Error(
        `[${opportunitySlug}] existe responsável vigente fora do catálogo aprovado: ${assignment.organizerSlug} (${assignment.role}).`,
      );
    }
  }

  for (const key of expectedKeys) {
    const active = existingAssignments.filter(
      (assignment) => assignment.validUntil === null && assignmentKey(assignment) === key,
    );
    if (active.length > 1) {
      throw new Error(
        `[${opportunitySlug}] há mais de uma atribuição vigente para ${key}; reconciliação automática bloqueada.`,
      );
    }
  }
}

export function assertReviewedOrganizerAssignmentSet(
  opportunitySlug: string,
  expectedAssignments: readonly OrganizerAssignmentIdentity[],
  reviewedAssignments: readonly OrganizerAssignmentIdentity[],
) {
  const expectedKeys = [...new Set(expectedAssignments.map(assignmentKey))].sort();
  const reviewedKeys = [...new Set(reviewedAssignments.map(assignmentKey))].sort();

  if (
    expectedKeys.length !== reviewedAssignments.length ||
    expectedKeys.length !== reviewedKeys.length ||
    expectedKeys.some((key, index) => key !== reviewedKeys[index])
  ) {
    throw new Error(
      `[${opportunitySlug}] o conjunto vigente de responsáveis revisados diverge do catálogo aprovado.`,
    );
  }
}
