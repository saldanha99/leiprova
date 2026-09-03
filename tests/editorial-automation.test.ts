import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const script = readFileSync(
  new URL("../scripts/run-editorial-automation.ts", import.meta.url),
  "utf8",
);
const legalMonitor = readFileSync(
  new URL("../scripts/check-official-sources.ts", import.meta.url),
  "utf8",
);
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");

describe("automação editorial segura", () => {
  it("executa periodicamente com conta proprietária e recursos limitados", () => {
    expect(packageJson).toContain(
      '"editorial:automation": "tsx --env-file-if-exists=.env scripts/run-editorial-automation.ts"',
    );
    const service = compose.split("  editorial-automation:")[1]?.split("\nvolumes:")[0] ?? "";
    expect(service).toContain("sleep 21600");
    expect(service).toContain(
      "EDITORIAL_OWNER_APPROVER_EMAIL: ${EDITORIAL_OWNER_APPROVER_EMAIL:-}",
    );
    expect(service).toContain("cpus: 0.5");
    expect(service).toContain("mem_limit: 768m");
    expect(compose).toMatch(
      /editorial-automation:[\s\S]*?cap_drop:[\s\S]*?- ALL[\s\S]*?no-new-privileges:true/,
    );
  });

  it("automatiza apenas captura oficial e criação de rascunhos", () => {
    expect(script).toContain("discoverOfficialDocumentCandidates");
    expect(script).toContain("captureOfficialPdf");
    expect(script).toContain("extractOfficialSyllabusCandidates");
    expect(script).toContain("generateNoticeQuestionDraftForRequirement");
    expect(script).toContain('eq(opportunitySourceDocuments.status, "approved")');
    expect(script).toContain('eq(opportunityDocumentSnapshots.status, "approved")');
    expect(script).toContain("approvalsAutomated: 0");
    expect(script).toContain("publicationsAutomated: 0");
    expect(script).not.toContain("publishedAt");
  });

  it("limita downloads por execução e audita o resultado", () => {
    expect(script).toContain("MAX_DOCUMENT_ATTEMPTS_PER_RUN = 12");
    expect(script).toContain("MAX_NEW_DOCUMENTS_PER_RUN = 6");
    expect(script).toContain("MAX_DRAFT_ATTEMPTS_PER_RUN = 50");
    expect(script).toContain("MAX_NEW_DRAFTS_PER_RUN = 25");
    expect(script).toContain('"automation.notice_document.captured"');
    expect(script).toContain('"automation.notice_syllabus.extracted"');
    expect(script).toContain('"automation.editorial.completed"');
  });

  it("captura o corpus somente após a fotografia vigente ter sido aprovada", () => {
    expect(legalMonitor).toContain('if (saved.status !== "approved")');
    expect(legalMonitor).toContain("fetchOfficialConsolidatedLegalText");
    expect(legalMonitor).toContain('"automation.legal_text.captured"');
    expect(legalMonitor).toContain('status: "pending_review"');
  });
});
