import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "drizzle", "0039_daily_study_plan.sql"), "utf8");
const grants = readFileSync(join(process.cwd(), "deploy", "grant-app-role.sql"), "utf8");

describe("persistência do plano diário", () => {
  it("mantém um único plano por usuário e dia com intervalo válido", () => {
    expect(migration).toContain('CREATE TABLE "user_daily_study_progress"');
    expect(migration).toContain('PRIMARY KEY("user_id","study_date")');
    expect(migration).toMatch(/article_end_order" >= "user_daily_study_progress"\."article_start_order/);
    expect(migration).toContain('ON DELETE cascade');
    expect(migration).toContain('ON DELETE restrict');
    expect(migration).toContain('CREATE INDEX "user_daily_study_progress_legal_act_idx"');
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
  });

  it("concede somente leitura e escrita necessárias ao papel da aplicação", () => {
    expect(grants).toMatch(/grant select, insert, update on[\s\S]*user_daily_study_progress,[\s\S]*to :app_user;/);
  });
});
