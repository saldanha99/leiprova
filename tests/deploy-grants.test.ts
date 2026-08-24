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

  it("permite o fluxo autoral apenas nas colunas editoriais necessárias", () => {
    expect(grants).toMatch(/question_style_profiles,/);
    expect(grants).toMatch(/grant insert \([\s\S]*clean_room_attested_at,[\s\S]*\) on questions to :app_user;/);
    expect(grants).toMatch(/grant update \([\s\S]*reviewed_by_user_id,[\s\S]*\) on questions to :app_user;/);
    expect(grants).toMatch(/grant insert \([\s\S]*question_id,[\s\S]*\) on question_options to :app_user;/);
    expect(grants).toContain("questions_id_seq");
    expect(grants).toContain("question_options_id_seq");
  });

  it("permite monitorar fontes com listas explícitas de colunas", () => {
    expect(grants).toMatch(/legal_source_snapshots,/);
    expect(grants).toMatch(/exam_source_portals,/);
    expect(grants).toMatch(/grant insert \([\s\S]*normalized_content,[\s\S]*\) on legal_source_snapshots to :app_user;/);
    expect(grants).toMatch(/grant update \([\s\S]*last_checked_at,[\s\S]*\) on exam_source_portals to :app_user;/);
    expect(grants).toMatch(/grant insert \([\s\S]*source_content_stored,[\s\S]*\) on exam_editions to :app_user;/);
    expect(grants).toContain("legal_source_snapshots_id_seq");
    expect(grants).toContain("exam_editions_id_seq");
  });
});
