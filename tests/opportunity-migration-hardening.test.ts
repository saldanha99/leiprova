import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = [
  "../drizzle/0019_oval_plazm.sql",
  "../drizzle/0020_rich_deathstrike.sql",
]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n");
const grants = readFileSync(new URL("../deploy/grant-app-role.sql", import.meta.url), "utf8");

describe("hardening persistente das oportunidades", () => {
  it("só publica uma oportunidade com fonte verificada e revisão humana independente", () => {
    expect(migration).toMatch(
      /CONSTRAINT "contest_opportunities_review_check" CHECK \([\s\S]*?"editorial_status" <> 'reviewed'[\s\S]*?"official_url" is not null[\s\S]*?"source_checked_at" is not null[\s\S]*?"reviewed_by_user_id" is not null[\s\S]*?"reviewed_at" is not null[\s\S]*?"published_at" is not null[\s\S]*?\)\),/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "contest_opportunities_independent_review_check" CHECK \([\s\S]*?"editorial_status" <> 'reviewed'[\s\S]*?"reviewed_by_user_id" <> "contest_opportunities"\."created_by_user_id"\)/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "opportunity_source_documents_independent_review_check" CHECK \([\s\S]*?"status" <> 'approved'[\s\S]*?"reviewed_by_user_id" <> "opportunity_source_documents"\."initiated_by_user_id"\)/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "opportunity_organizer_assignments_review_check" CHECK \([\s\S]*?"status" <> 'reviewed'[\s\S]*?"reviewed_by_user_id" is not null[\s\S]*?"reviewed_at" is not null/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "opportunity_requirements_review_check" CHECK \([\s\S]*?"editorial_status" <> 'reviewed'[\s\S]*?"reviewed_by_user_id" is not null[\s\S]*?"reviewed_at" is not null/,
    );
  });

  it("exige fonte aprovada e impede rebaixar a dependência de conteúdo já revisado", () => {
    expect(migration).toMatch(
      /IF NEW\."status" = 'reviewed' AND source_status <> 'approved' THEN[\s\S]*?responsável revisado exige uma fonte oficial aprovada/,
    );
    expect(migration).toMatch(
      /IF NEW\."editorial_status" = 'reviewed' THEN[\s\S]*?FROM "opportunity_source_documents" source[\s\S]*?source\."status" = 'approved'/,
    );
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER "opportunity_source_document_publication_guard"\s+AFTER UPDATE OR DELETE ON "opportunity_source_documents"\s+DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(migration).toMatch(
      /FROM "opportunity_organizer_assignments" assignment[\s\S]*?assignment\."source_document_id" = OLD\."id"[\s\S]*?assignment\."status" = 'reviewed'[\s\S]*?source\."status" <> 'approved'/,
    );
    expect(migration).toMatch(
      /opportunity\."editorial_status" = 'reviewed'[\s\S]*?NOT EXISTS \([\s\S]*?source\."opportunity_id" = affected_opportunity_id[\s\S]*?source\."status" = 'approved'/,
    );
  });

  it("mantém um único responsável primário ativo por edição pública", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "opportunity_organizer_assignments_primary_active_uidx"[\s\S]*?\("opportunity_id"\) WHERE[\s\S]*?"role" = 'primary_responsible'[\s\S]*?"status" = 'reviewed'[\s\S]*?"valid_until" is null/,
    );
    expect(migration).toMatch(
      /NEW\."lifecycle_status" IN \([\s\S]*?'organizer_selected'[\s\S]*?'notice_published'[\s\S]*?assignment\."role" = 'primary_responsible'[\s\S]*?assignment\."status" = 'reviewed'[\s\S]*?assignment\."valid_until" IS NULL/,
    );
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER "opportunity_organizer_assignment_publication_guard"\s+AFTER UPDATE OR DELETE ON "opportunity_organizer_assignments"\s+DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "opportunity_organizer_assignments_exam_provider_active_uidx"[\s\S]*?"role" = 'examination_provider'[\s\S]*?"status" = 'reviewed'[\s\S]*?"valid_until" is null/,
    );
    expect(migration).toMatch(/Uma edição não pode ter perfis de banca vigentes conflitantes/);
  });

  it("não revisa estatística de incidência sem corpus autorizado e referência de direitos", () => {
    expect(migration).toContain(
      'CONSTRAINT "opportunity_analysis_snapshots_lookback_check" CHECK ("opportunity_analysis_snapshots"."lookback_years" between 1 and 10)',
    );
    expect(migration).toMatch(
      /CONSTRAINT "opportunity_analysis_snapshots_question_rights_check" CHECK \([\s\S]*?"analysis_kind" <> 'question_incidence'[\s\S]*?"corpus_basis" in \('licensed_questions', 'mixed_authorized'\)\)/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "opportunity_analysis_snapshots_review_check" CHECK \([\s\S]*?"status" <> 'reviewed'[\s\S]*?"sample_size" > 0[\s\S]*?nullif\(btrim\("opportunity_analysis_snapshots"\."corpus_rights_reference"\), ''\) is not null[\s\S]*?"reviewed_by_user_id" is not null[\s\S]*?"reviewed_at" is not null/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "opportunity_analysis_snapshots_independent_review_check" CHECK \([\s\S]*?"reviewed_by_user_id" <> "opportunity_analysis_snapshots"\."created_by_user_id"\)/,
    );
  });

  it("impede referências cruzadas entre oportunidades, matérias e atos legais", () => {
    expect(migration).toContain(
      'CONSTRAINT "contest_opportunities_category_career_fk" FOREIGN KEY ("category_id","career_track_id")',
    );
    expect(migration).toMatch(
      /CREATE TRIGGER "opportunity_requirement_context_guard"\s+BEFORE INSERT OR UPDATE ON "opportunity_requirements"/,
    );
    expect(migration).toMatch(
      /source_opportunity_id <> NEW\."opportunity_id"[\s\S]*?topic_subject_id <> NEW\."subject_id"[\s\S]*?JOIN "legal_versions" version[\s\S]*?article_legal_act_id <> NEW\."legal_act_id"/,
    );
    expect(migration).toMatch(
      /CREATE TRIGGER "opportunity_analysis_context_guard"\s+BEFORE INSERT OR UPDATE ON "opportunity_analysis_snapshots"[\s\S]*?EXECUTE FUNCTION "validate_opportunity_analysis_context"/,
    );
    expect(migration).toMatch(
      /assignment_opportunity_id <> NEW\."opportunity_id"[\s\S]*?CREATE TRIGGER "opportunity_analysis_context_guard"/,
    );
    expect(migration).toMatch(
      /analysis_opportunity_id <> NEW\."opportunity_id"[\s\S]*?CREATE TRIGGER "question_opportunity_context_guard"\s+BEFORE INSERT OR UPDATE ON "question_opportunities"/,
    );
  });

  it("invalida revisão antiga após qualquer alteração material", () => {
    expect(migration).toContain('CREATE TRIGGER "contest_opportunity_reviewed_mutation_guard"');
    expect(migration).toContain('CREATE TRIGGER "opportunity_source_document_approved_mutation_guard"');
    expect(migration).toContain('CREATE TRIGGER "opportunity_organizer_assignment_reviewed_mutation_guard"');
    expect(migration).toContain('CREATE TRIGGER "opportunity_analysis_reviewed_mutation_guard"');
    expect(migration).toContain('CREATE TRIGGER "opportunity_requirement_reviewed_mutation_guard"');
    expect(migration).toMatch(
      /source\."status" = 'approved'[\s\S]*?source\."source_url" = NEW\."official_url"/,
    );
  });

  it("exige responsável vigente para análise e snapshot revisado para prioridade", () => {
    expect(migration).toMatch(
      /NEW\."status" = 'reviewed'[\s\S]*?assignment_status <> 'reviewed'[\s\S]*?assignment_role = 'logistics_provider'[\s\S]*?assignment_valid_until IS NOT NULL/,
    );
    expect(migration).toContain(
      'CONSTRAINT "question_opportunities_statistical_snapshot_check"',
    );
    expect(migration).toMatch(
      /NEW\."relationship" = 'statistical_priority' AND analysis_status <> 'reviewed'/,
    );
  });

  it("rebaixa conteúdo antigo sem revisor e muda defaults inseguros", () => {
    expect(migration).toContain(
      'ALTER TABLE "questions" ALTER COLUMN "editorial_status" SET DEFAULT \'draft\'',
    );
    expect(migration).toMatch(
      /UPDATE "questions"[\s\S]*?"editorial_status" = 'pending_review'[\s\S]*?"reviewed_by_user_id" IS NULL/,
    );
    expect(migration).toContain(
      'CHECK ("questions"."editorial_status" <> \'reviewed\' or "questions"."reviewed_by_user_id" is not null)',
    );
  });
});

describe("privilégios mínimos das oportunidades", () => {
  it("expõe leitura do domínio e apenas as sequências usadas nas inserções", () => {
    for (const table of [
      "contest_categories",
      "contest_category_careers",
      "contest_opportunities",
      "opportunity_source_documents",
      "opportunity_organizer_assignments",
      "opportunity_requirements",
      "opportunity_analysis_snapshots",
      "question_opportunities",
    ]) {
      expect(grants).toMatch(new RegExp(`grant select on[\\s\\S]*?\\b${table}\\b[\\s\\S]*?to :app_user;`));
    }

    for (const sequence of [
      "contest_opportunities_id_seq",
      "opportunity_source_documents_id_seq",
      "opportunity_organizer_assignments_id_seq",
      "opportunity_requirements_id_seq",
      "opportunity_analysis_snapshots_id_seq",
    ]) {
      expect(grants).toContain(sequence);
    }
  });

  it("mantém ingestão em rascunho e revisão em atualizações explícitas", () => {
    expect(grants).toMatch(
      /grant insert \(\s*public_id,[\s\S]*?is_featured\s*\) on contest_opportunities to :app_user;/,
    );
    expect(grants).not.toMatch(
      /grant insert \([^;]*\b(?:editorial_status|published_at|reviewed_by_user_id|reviewed_at)\b[^;]*\) on contest_opportunities to :app_user;/,
    );
    expect(grants).toMatch(
      /grant update \([\s\S]*?editorial_status,[\s\S]*?reviewed_by_user_id,[\s\S]*?reviewed_at,[\s\S]*?review_notes,[\s\S]*?\) on contest_opportunities to :app_user;/,
    );
    expect(grants).not.toMatch(
      /grant insert \([^;]*\b(?:status|reviewed_by_user_id|reviewed_at)\b[^;]*\) on opportunity_source_documents to :app_user;/,
    );
    expect(grants).not.toMatch(
      /grant insert \([^;]*\b(?:status|reviewed_by_user_id|reviewed_at)\b[^;]*\) on opportunity_analysis_snapshots to :app_user;/,
    );
  });

  it("não concede escrita irrestrita às tabelas editoriais", () => {
    for (const table of [
      "contest_opportunities",
      "opportunity_source_documents",
      "opportunity_organizer_assignments",
      "opportunity_requirements",
      "opportunity_analysis_snapshots",
    ]) {
      expect(grants).not.toMatch(
        new RegExp(`grant (?:all|select, insert, update(?:, delete)?) on ${table} to :app_user;`),
      );
    }

    expect(grants).toMatch(/grant insert, delete on question_opportunities to :app_user;/);
  });
});
