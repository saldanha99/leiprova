import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const grants = readFileSync(new URL("../deploy/grant-app-role.sql", import.meta.url), "utf8");

describe("privilégios do app em produção", () => {
  it("permite operar filtros e cadernos sem ampliar o acesso global", () => {
    expect(grants).toMatch(/grant select, insert, delete on saved_study_filters to :app_user;/);
    expect(grants).toMatch(/grant select, insert, update, delete on question_notebooks to :app_user;/);
    expect(grants).toMatch(/grant select, insert, delete on question_notebook_items to :app_user;/);
    expect(grants).toContain("saved_study_filters_id_seq");
    expect(grants).toContain("question_notebooks_id_seq");
  });
});
