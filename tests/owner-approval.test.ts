import { describe, expect, it } from "vitest";

import { isEditorialOwnerApprover } from "@/lib/editorial/owner-approval";

describe("aprovação editorial do proprietário", () => {
  it("aceita somente a conta configurada, normalizando caixa e espaços", () => {
    expect(isEditorialOwnerApprover(" Proprietario@Exemplo.com ", "proprietario@exemplo.com")).toBe(true);
    expect(isEditorialOwnerApprover("editor@exemplo.com", "proprietario@exemplo.com")).toBe(false);
  });

  it("permanece fechada quando não há proprietário configurado", () => {
    expect(isEditorialOwnerApprover("proprietario@exemplo.com", undefined)).toBe(false);
    expect(isEditorialOwnerApprover("proprietario@exemplo.com", "   ")).toBe(false);
  });
});
