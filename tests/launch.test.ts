import { afterEach, describe, expect, it } from "vitest";

import { isCommerceOpen } from "@/lib/launch";

const FLAGS = ["REGISTRATION_ENABLED", "CHECKOUT_ENABLED", "TRANSACTIONAL_EMAIL_ENABLED"] as const;

afterEach(() => {
  for (const flag of FLAGS) delete process.env[flag];
});

describe("commercial launch flags", () => {
  it("só abre a jornada quando cadastro, checkout e e-mail estão habilitados", () => {
    for (const flag of FLAGS) process.env[flag] = "true";
    expect(isCommerceOpen()).toBe(true);

    for (const missing of FLAGS) {
      process.env[missing] = "false";
      expect(isCommerceOpen()).toBe(false);
      process.env[missing] = "true";
    }
  });
});
