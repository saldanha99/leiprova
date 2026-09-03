import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  canReviewEditorialSubmission,
  isEditorialOwnerApprover,
} from "@/lib/editorial/owner-approval";

describe("aprovação editorial do proprietário", () => {
  const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");

  it("aceita somente a conta configurada, normalizando caixa e espaços", () => {
    expect(isEditorialOwnerApprover(" Proprietario@Exemplo.com ", "proprietario@exemplo.com")).toBe(true);
    expect(isEditorialOwnerApprover("editor@exemplo.com", "proprietario@exemplo.com")).toBe(false);
  });

  it("permanece fechada quando não há proprietário configurado", () => {
    expect(isEditorialOwnerApprover("proprietario@exemplo.com", undefined)).toBe(false);
    expect(isEditorialOwnerApprover("proprietario@exemplo.com", "   ")).toBe(false);
  });

  it("permite que apenas a conta proprietária revise o que ela mesma iniciou", () => {
    expect(
      canReviewEditorialSubmission(
        { initiatorUserId: 7, reviewerUserId: 7, reviewerEmail: "proprietario@exemplo.com" },
        "proprietario@exemplo.com",
      ),
    ).toBe(true);
    expect(
      canReviewEditorialSubmission(
        { initiatorUserId: 7, reviewerUserId: 7, reviewerEmail: "editor@exemplo.com" },
        "proprietario@exemplo.com",
      ),
    ).toBe(false);
  });

  it("mantém a revisão por outra conta disponível", () => {
    expect(
      canReviewEditorialSubmission(
        { initiatorUserId: 7, reviewerUserId: 8, reviewerEmail: "editor@exemplo.com" },
        "proprietario@exemplo.com",
      ),
    ).toBe(true);
  });

  it("entrega a conta proprietária ao processo da aplicação", () => {
    const appService = compose.split("  app:")[1]?.split("\n  migrate:")[0];
    expect(appService).toContain(
      "EDITORIAL_OWNER_APPROVER_EMAIL: ${EDITORIAL_OWNER_APPROVER_EMAIL:-}",
    );
  });
});
