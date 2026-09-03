import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle", "0025_smart_expediter.sql"),
  "utf8",
);

describe("migração da revisão jurídica pela conta proprietária", () => {
  it("remove somente as duas travas de separação de contas", () => {
    expect(migration).toContain(
      'ALTER TABLE "legal_source_snapshots" DROP CONSTRAINT "legal_source_snapshots_independent_review_check"',
    );
    expect(migration).toContain(
      'ALTER TABLE "legal_text_snapshots" DROP CONSTRAINT "legal_text_snapshots_independent_review_check"',
    );
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
  });
});
