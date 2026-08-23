import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/utils";

describe("safeRedirectPath", () => {
  it("preserva caminho interno, consulta e fragmento", () => {
    expect(safeRedirectPath("/app/revisoes?filtro=hoje#fila")).toBe(
      "/app/revisoes?filtro=hoje#fila",
    );
  });

  it.each([
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/app\nLocation: https://example.com",
    "app/revisoes",
    "",
  ])("recusa destino não confiável: %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/app");
  });
});
