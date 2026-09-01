import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  organizerSlugForApproval,
  parseOpportunityApprovalCommand,
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "@/lib/opportunities/approval-command";
import {
  validateOfficialOpportunityApprovalBatch,
  validateOfficialOpportunityCandidateForApproval,
} from "@/lib/opportunities/approval-policy";
import {
  OFFICIAL_OPPORTUNITY_CANDIDATES,
  type InternalOpportunityCandidate,
} from "@/lib/opportunities/official-candidates";
import { classifyOpportunitySourceHttpStatus } from "@/lib/opportunities/source-metadata-check";

describe("aprovação explícita das oportunidades oficiais", () => {
  it("valida os seis candidatos atuais e confirma elegibilidade no catálogo", () => {
    const result = validateOfficialOpportunityApprovalBatch(
      OFFICIAL_OPPORTUNITY_CANDIDATES,
      "2026-09-01",
    );

    expect(result).toHaveLength(6);
    expect(result.every((candidate) => candidate.catalogEligible)).toBe(true);
    expect(result.reduce((total, candidate) => total + candidate.sourceUrls.length, 0)).toBe(9);
  });

  it("recusa datas incoerentes e etapa sem responsável primário", () => {
    const base = OFFICIAL_OPPORTUNITY_CANDIDATES[0];
    const invalidDates = {
      ...base,
      registrationEndsAt: "2026-08-20",
    } as InternalOpportunityCandidate;
    const noPrimary = {
      ...base,
      organizerSignals: base.organizerSignals.filter(
        (signal) => signal.role !== "primary_responsible",
      ),
    } as InternalOpportunityCandidate;

    expect(() =>
      validateOfficialOpportunityCandidateForApproval(invalidDates, "2026-09-01"),
    ).toThrow(/fim das inscrições/);
    expect(() =>
      validateOfficialOpportunityCandidateForApproval(noPrimary, "2026-09-01"),
    ).toThrow(/exatamente um responsável primário/);
  });

  it("recusa fonte principal fora das fontes oficiais registradas", () => {
    const base = OFFICIAL_OPPORTUNITY_CANDIDATES[0];
    const invalid = {
      ...base,
      officialUrl: "https://www.enfam.jus.br/enam/",
    } as InternalOpportunityCandidate;

    expect(() =>
      validateOfficialOpportunityCandidateForApproval(invalid, "2026-09-01"),
    ).toThrow(/corresponder exatamente/);
  });

  it("mantém o consentimento de escrita separado e recusa identidade livre na CLI", () => {
    expect(parseOpportunityApprovalCommand([])).toEqual({ approve: false });
    expect(parseOpportunityApprovalCommand(["--", "--approve"])).toEqual({ approve: true });
    expect(() => parseOpportunityApprovalCommand(["--reviewer-user-id", "4"])).toThrow(
      /não permitido/,
    );
    expect(() => parseOpportunityApprovalCommand(["--reviewer-user-id=4", "--approve"])).toThrow(
      /não permitido/,
    );
  });

  it("vincula a revisão ao único admin configurado e registra a proveniência", () => {
    expect(
      parseOpportunityApprovalReviewerIdentity({
        ADMIN_EMAILS: " Revisor@Exemplo.com.br ",
        OPPORTUNITY_APPROVAL_REFERENCE: "owner-chat-2026-09-01",
      }),
    ).toEqual({
      email: "revisor@exemplo.com.br",
      provenance: "admin_emails_unique",
      executionSource: "server_cli",
      approvalReference: "owner-chat-2026-09-01",
    });
    expect(
      parseOpportunityApprovalReviewerIdentity({
        OPPORTUNITY_APPROVAL_REFERENCE: "owner-chat-2026-09-01",
      }),
    ).toEqual({
      email: null,
      provenance: "database_admin_unique",
      executionSource: "server_cli",
      approvalReference: "owner-chat-2026-09-01",
    });
    expect(() => parseOpportunityApprovalReviewerIdentity({})).toThrow(/APPROVAL_REFERENCE/);
    expect(() =>
      parseOpportunityApprovalReviewerIdentity({
        ADMIN_EMAILS: "um@exemplo.com.br,dois@exemplo.com.br",
        OPPORTUNITY_APPROVAL_REFERENCE: "owner-chat-2026-09-01",
      }),
    ).toThrow(/exatamente um/);
    expect(() =>
      parseOpportunityApprovalReviewerIdentity({
        ADMIN_EMAILS: "nao-e-email",
        OPPORTUNITY_APPROVAL_REFERENCE: "owner-chat-2026-09-01",
      }),
    ).toThrow(/inválido/);
    expect(() =>
      parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: "revisor@exemplo.com.br" }),
    ).toThrow(/APPROVAL_REFERENCE/);
  });

  it("aceita exclusivamente MIGRATION_DATABASE_URL com conexão PostgreSQL completa", () => {
    expect(
      requireOpportunityApprovalDatabaseUrl({
        MIGRATION_DATABASE_URL: "postgresql://owner:secret@db:5432/leiprova",
      }),
    ).toBe("postgresql://owner:secret@db:5432/leiprova");
    expect(() =>
      requireOpportunityApprovalDatabaseUrl({
        DATABASE_URL: "postgresql://app:secret@pooler:5432/leiprova",
      }),
    ).toThrow(/DATABASE_URL não é aceito/);
    expect(() =>
      requireOpportunityApprovalDatabaseUrl({
        MIGRATION_DATABASE_URL: "postgresql://owner@db:5432/leiprova",
      }),
    ).toThrow(/credenciais/);
  });

  it("deriva slugs determinísticos sem herdar banca da categoria", () => {
    expect(
      organizerSlugForApproval({
        institutionAcronym: "ENFAM",
        organizationName: "Escola Nacional de Formação",
        responsibleType: "institutional_commission",
        role: "primary_responsible",
        quizBankSlug: null,
      }),
    ).toBe("enfam");
    expect(
      organizerSlugForApproval({
        institutionAcronym: "PC-PR",
        organizationName: "Fundação Getulio Vargas",
        responsibleType: "external_organizer",
        role: "primary_responsible",
        quizBankSlug: "fgv",
      }),
    ).toBe("fgv");
  });

  it("bloqueia respostas HEAD sem comprovação de disponibilidade", () => {
    expect(classifyOpportunitySourceHttpStatus(200)).toBe("verified");
    expect(classifyOpportunitySourceHttpStatus(301)).toBe("verified");
    expect(classifyOpportunitySourceHttpStatus(401)).toBe("failed");
    expect(classifyOpportunitySourceHttpStatus(403)).toBe("failed");
    expect(classifyOpportunitySourceHttpStatus(405)).toBe("failed");
    expect(classifyOpportunitySourceHttpStatus(429)).toBe("failed");
    expect(classifyOpportunitySourceHttpStatus(404)).toBe("failed");
    expect(classifyOpportunitySourceHttpStatus(500)).toBe("failed");
  });
});

describe("guardas estáticas do comando de aprovação", () => {
  const script = readFileSync(
    new URL("../scripts/approve-official-opportunities.ts", import.meta.url),
    "utf8",
  );
  const seed = readFileSync(new URL("../scripts/seed.ts", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");

  it("mantém aprovação fora do seed geral e sob flag explícita", () => {
    expect(seed).not.toContain("OFFICIAL_OPPORTUNITY_CANDIDATES");
    expect(packageJson).toContain(
      '"opportunities:approve": "tsx --env-file-if-exists=.env scripts/approve-official-opportunities.ts"',
    );
    expect(script).toContain("if (!command.approve)");
    expect(script).toContain("role !== \"admin\"");
    expect(script).toContain("where lower(email) = ${reviewerIdentity.email}");
    expect(script).toContain("where role = 'admin'");
    expect(script).not.toContain("command.reviewerUserId");
  });

  it("não aceita fallback para credencial de aplicação e audita a origem da identidade", () => {
    expect(script).toContain("requireOpportunityApprovalDatabaseUrl(approvalEnvironment)");
    expect(script).not.toMatch(
      /process\.env\.MIGRATION_DATABASE_URL\s*\?\?\s*process\.env\.DATABASE_URL/,
    );
    expect(script).toContain("reviewerIdentityProvenance");
  });

  it("usa transação, lock e não armazena o corpo das fontes", () => {
    expect(script).toContain("client.begin");
    expect(script).toContain("pg_advisory_xact_lock");
    expect(script).toContain("source_content_stored");
    expect(script).toContain("'metadata_only'");
    expect(script).toContain("last_seen_at = greatest");
    expect(script).toContain("opportunity.source_metadata_observed");
    expect(script).toContain("opportunity.source_metadata_failed");
    expect(script).not.toMatch(/method:\s*["']GET["']/);
  });

  it("reconcilia todos os estados e confirma o conjunto final de responsáveis", () => {
    expect(script).toContain("assertOrganizerAssignmentsReconcilable");
    expect(script).toContain("assertReviewedOrganizerAssignmentSet");
    expect(script).toMatch(
      /from opportunity_organizer_assignments[\s\S]*?where opportunity_id = \$\{opportunityId\}[\s\S]*?order by id[\s\S]*?for update/,
    );
    expect(script).not.toContain("status in ('pending_review', 'reviewed')");
  });

  it("executa em serviço efêmero com banco owner e egress, sem publicar porta", () => {
    expect(compose).toMatch(
      /opportunity-approver:[\s\S]*?profiles: \["tools"\][\s\S]*?MIGRATION_DATABASE_URL:[\s\S]*?ADMIN_EMAILS:[\s\S]*?OPPORTUNITY_APPROVE:[\s\S]*?OPPORTUNITY_APPROVAL_REFERENCE:/,
    );
    expect(compose).toMatch(
      /opportunity-approver:[\s\S]*?networks:[\s\S]*?- internal[\s\S]*?- edge/,
    );
    const service = compose.split("  opportunity-approver:")[1]?.split("\n  legal-monitor:")[0];
    expect(service).toContain("@leiprova-db:5432/");
    expect(service).not.toContain("ports:");
    expect(service).not.toContain("labels:");
    expect(service).not.toContain("OPPORTUNITY_REVIEWER_USER_ID");
    expect(service).toContain("cap_drop:");
    expect(service).toContain("no-new-privileges:true");
  });
});
