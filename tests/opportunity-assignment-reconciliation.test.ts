import { describe, expect, it } from "vitest";

import {
  assertOrganizerAssignmentsReconcilable,
  assertReviewedOrganizerAssignmentSet,
} from "@/lib/opportunities/assignment-reconciliation";

const fgv = {
  role: "primary_responsible" as const,
  organizerSlug: "fgv",
};

describe("reconciliação dos responsáveis da oportunidade", () => {
  it("aceita conjunto vazio ou atribuição vigente exatamente igual ao catálogo", () => {
    expect(() => assertOrganizerAssignmentsReconcilable("pc-ba-2026", [], [])).not.toThrow();
    expect(() =>
      assertOrganizerAssignmentsReconcilable("pc-pr-2026", [fgv], [
        { ...fgv, status: "reviewed", validUntil: null },
      ]),
    ).not.toThrow();
  });

  it("bloqueia reaprovação de uma banca rejeitada", () => {
    expect(() =>
      assertOrganizerAssignmentsReconcilable("pc-pr-2026", [fgv], [
        { ...fgv, status: "rejected", validUntil: null },
      ]),
    ).toThrow(/reaprovação exige supersessão editorial explícita/);
    expect(() =>
      assertOrganizerAssignmentsReconcilable("pc-pr-2026", [fgv], [
        { ...fgv, status: "rejected", validUntil: "2026-08-31" },
      ]),
    ).toThrow(/reaprovação exige supersessão editorial explícita/);
  });

  it("bloqueia atribuição vigente obsoleta ou supersedida sem término", () => {
    expect(() =>
      assertOrganizerAssignmentsReconcilable("pc-pr-2026", [fgv], [
        {
          role: "primary_responsible",
          organizerSlug: "cespe",
          status: "reviewed",
          validUntil: null,
        },
      ]),
    ).toThrow(/fora do catálogo aprovado/);

    expect(() =>
      assertOrganizerAssignmentsReconcilable("pc-pr-2026", [fgv], [
        { ...fgv, status: "superseded", validUntil: null },
      ]),
    ).toThrow(/continua sem data final/);
    expect(() =>
      assertOrganizerAssignmentsReconcilable("pc-pr-2026", [fgv], [
        { ...fgv, status: "superseded", validUntil: "2026-08-31" },
      ]),
    ).not.toThrow();
  });

  it("confirma igualdade exata do conjunto publicado, inclusive quando vazio", () => {
    expect(() => assertReviewedOrganizerAssignmentSet("pc-ba-2026", [], [])).not.toThrow();
    expect(() => assertReviewedOrganizerAssignmentSet("pc-pr-2026", [fgv], [fgv])).not.toThrow();
    expect(() =>
      assertReviewedOrganizerAssignmentSet("pc-pr-2026", [fgv], [
        { role: "primary_responsible", organizerSlug: "cespe" },
      ]),
    ).toThrow(/diverge do catálogo aprovado/);
  });
});
