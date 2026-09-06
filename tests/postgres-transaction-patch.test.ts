import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

describe("patch de segurança do driver PostgreSQL usado em runtime", () => {
  it.each([
    ["ESM", new URL(import.meta.resolve("postgres"))],
    ["CommonJS", createRequire(import.meta.url).resolve("postgres")],
  ])("%s contém barreira de fechamento antes das consultas e finalização", (_label, file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("closedError = error");
    expect(source).toContain("return q.reject(closedError)");
    expect(source).toMatch(/catch \(e\) \{[\s\S]*?if \(closedError\)[\s\S]*?throw closedError[\s\S]*?await \(name/);
  });
});
