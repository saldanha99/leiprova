import { describe, expect, it } from "vitest";

import {
  fixedRateLimitWindow,
  hashRateLimitSubject,
  normalizeRateLimitSubject,
  retryAfterSeconds,
} from "@/lib/rate-limit-core";

describe("rate limit", () => {
  const secret = "a".repeat(64);

  it("normaliza e-mails sem persistir o valor original no hash", () => {
    const first = hashRateLimitSubject({ kind: "email", value: " Aluno@Exemplo.COM " }, secret);
    const second = hashRateLimitSubject({ kind: "email", value: "aluno@exemplo.com" }, secret);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("aluno");
  });

  it("separa identidades de tipos diferentes", () => {
    expect(normalizeRateLimitSubject({ kind: "ip", value: "127.0.0.1" })).not.toBe(
      normalizeRateLimitSubject({ kind: "user", value: "127.0.0.1" }),
    );
  });

  it("calcula uma janela fixa e o Retry-After", () => {
    const now = new Date("2026-08-16T12:07:30.250Z");
    const window = fixedRateLimitWindow(now, 15 * 60);

    expect(window.startedAt.toISOString()).toBe("2026-08-16T12:00:00.000Z");
    expect(window.resetAt.toISOString()).toBe("2026-08-16T12:15:00.000Z");
    expect(retryAfterSeconds(window.resetAt, now)).toBe(450);
  });

  it("rejeita segredos curtos", () => {
    expect(() => hashRateLimitSubject({ kind: "ip", value: "127.0.0.1" }, "curto")).toThrow(
      "pelo menos 32 caracteres",
    );
  });
});
