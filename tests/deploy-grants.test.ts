import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const grants = readFileSync(new URL("../deploy/grant-app-role.sql", import.meta.url), "utf8");

describe("privilégios do app em produção", () => {
  it("reaplica revogações e concessões de forma atômica", () => {
    expect(grants).toMatch(/\\set ON_ERROR_STOP on\s+begin;/);
    expect(grants.trimEnd()).toMatch(/commit;$/);
  });

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
    expect(grants).toMatch(
      /grant update \(\s*editorial_status,\s*created_by_user_id,\s*reviewed_by_user_id,\s*clean_room_attested_at,\s*submitted_at,\s*review_notes,\s*similarity_max_bps,\s*similarity_reference_public_id,\s*originality_checked_at,[\s\S]*?\) on questions to :app_user;/,
    );
    expect(grants).toMatch(/grant insert \([\s\S]*question_id,[\s\S]*\) on question_options to :app_user;/);
    expect(grants).toContain("questions_id_seq");
    expect(grants).toContain("question_options_id_seq");
  });

  it("permite monitorar fontes com listas explícitas de colunas", () => {
    expect(grants).toMatch(/legal_source_snapshots,/);
    expect(grants).toMatch(/exam_source_portals,/);
    expect(grants).toMatch(/grant insert \([\s\S]*normalized_content,[\s\S]*\) on legal_source_snapshots to :app_user;/);
    expect(grants).toMatch(/grant update \([\s\S]*last_checked_at,[\s\S]*\) on exam_source_portals to :app_user;/);
    expect(grants).toMatch(
      /grant insert \([\s\S]*source_external_id,[\s\S]*source_content_stored,[\s\S]*\) on exam_editions to :app_user;/,
    );
    expect(grants).toMatch(
      /grant update \(\s*title,\s*organizer,\s*jurisdiction,\s*official_url,\s*exam_date,\s*duration_minutes,\s*source_checked_at,\s*updated_at\s*\) on exam_editions to :app_user;/,
    );
    expect(grants).not.toMatch(
      /grant insert \([^;]*\b(?:published_at|status)\b[^;]*\) on exam_editions to :app_user;/,
    );
    expect(grants).toContain("legal_source_snapshots_id_seq");
    expect(grants).toContain("exam_editions_id_seq");
  });

  it("limita a captura e ativação do corpus legal às colunas auditadas", () => {
    expect(grants).toMatch(/legal_text_snapshots,/);
    expect(grants).toMatch(
      /grant insert \(\s*public_id,\s*legal_act_id,\s*monitor_snapshot_id,[\s\S]*?\) on legal_text_snapshots to :app_user;/,
    );
    expect(grants).toMatch(
      /grant update \(\s*status,\s*reviewed_by_user_id,\s*review_notes,\s*last_seen_at,\s*reviewed_at,\s*updated_at\s*\) on legal_text_snapshots to :app_user;/,
    );
    expect(grants).toMatch(
      /grant insert \(\s*legal_act_id,\s*source_url,\s*checksum_sha256,\s*verified_at,\s*status\s*\) on legal_versions to :app_user;/,
    );
    expect(grants).toContain("legal_text_snapshots_id_seq");
    expect(grants).toContain("legal_versions_id_seq");
    expect(grants).toContain("legal_articles_id_seq");
  });

  it("isola o PDF bruto e limita a captura oficial a colunas editoriais", () => {
    expect(grants).toMatch(/grant select \([\s\S]*page_texts,[\s\S]*\) on opportunity_document_snapshots/);
    expect(grants).toMatch(/grant insert \([\s\S]*document_bytes,[\s\S]*authorization_scope,[\s\S]*\) on opportunity_document_snapshots/);
    expect(grants).toMatch(/grant update \(\s*status,\s*approval_basis,\s*authorized_by_user_id,\s*reviewed_by_user_id,\s*reviewed_at,\s*review_notes,\s*updated_at\s*\) on opportunity_document_snapshots/);
    const broadSelect = grants.match(/grant select on[\s\S]*?to :app_user;/)?.[0] ?? "";
    expect(broadSelect).not.toContain("opportunity_document_snapshots");
    expect(grants).toContain("opportunity_document_snapshots_id_seq");
  });

  it("permite emitir e consumir o convite de acesso sem elevar o papel do comprador", () => {
    expect(grants).toMatch(/grant select, insert, update on account_access_tokens to :app_user;/);
    expect(grants).toMatch(
      /grant update \(\s*password_hash,\s*email_verified_at,\s*stripe_customer_id,\s*last_seen_at,\s*updated_at\s*\) on users to :app_user;/,
    );
    expect(grants).not.toMatch(/grant (?:select, insert, update, delete|all).*users to :app_user;/);
  });
});
