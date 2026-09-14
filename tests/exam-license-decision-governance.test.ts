import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actions = readFileSync(
  new URL("../src/app/admin/provas-anteriores/actions.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../drizzle/0041_conscious_mother_askani.sql", import.meta.url),
  "utf8",
);
const grants = readFileSync(
  new URL("../deploy/grant-app-role.sql", import.meta.url),
  "utf8",
);

describe("governança da resposta de licenciamento", () => {
  it("exige evidência versionada, decisão editorial e conta independente", () => {
    expect(actions).toContain("recordExamLicenseDecisionAction");
    expect(actions).toContain("responseChecksumSha256");
    expect(actions).toContain("Outra conta editorial precisa revisar");
    expect(actions).toContain('"granted_pending_review"');
    expect(actions).toContain("publicationAllowed: false");
    expect(migration).toContain(
      '"reviewed_by_user_id" <> "exam_license_requests"."initiated_by_user_id"',
    );
  });

  it("concede ao aplicativo apenas as colunas necessárias ao fluxo auditado", () => {
    expect(grants).toContain("response_reference");
    expect(grants).toContain("response_checksum_sha256");
    expect(grants).toContain("reviewed_by_user_id");
    expect(grants).not.toMatch(/grant\s+delete\s+on\s+exam_license_requests/iu);
  });
});
