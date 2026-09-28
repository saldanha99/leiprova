import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actions = readFileSync(
  new URL("../src/app/admin/provas-anteriores/actions.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../drizzle/0042_next_mother_askani.sql", import.meta.url),
  "utf8",
);
const grants = readFileSync(
  new URL("../deploy/grant-app-role.sql", import.meta.url),
  "utf8",
);

describe("governança da resposta de licenciamento", () => {
  it("exige evidência versionada e decisão registrada, aceitando a mesma conta", () => {
    expect(actions).toContain("recordExamLicenseDecisionAction");
    expect(actions).toContain("responseChecksumSha256");
    expect(actions).toContain('"granted_pending_review"');
    expect(actions).toContain("publicationAllowed: false");
    // Revisor diferente deixou de ser exigido por decisão do proprietário (27/09/2026).
    expect(actions).not.toContain("Outra conta editorial precisa revisar");
    expect(migration).toContain('DROP CONSTRAINT "exam_license_requests_independent_review_check"');
    expect(migration).toContain('"exam_license_requests"."reviewed_by_user_id" is not null');
  });

  it("concede ao aplicativo apenas as colunas necessárias ao fluxo auditado", () => {
    expect(grants).toContain("response_reference");
    expect(grants).toContain("response_checksum_sha256");
    expect(grants).toContain("reviewed_by_user_id");
    expect(grants).not.toMatch(/grant\s+delete\s+on\s+exam_license_requests/iu);
  });
});
