import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseNoticeApprovalArgs } from "../scripts/approve-notice-snapshots";

const script = readFileSync(new URL("../scripts/approve-notice-snapshots.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

const consolidated = "0d8008d8-4fbf-4b92-8898-50b0c0f935a3";
const original = "d2cf25cc-5f05-4ee9-9ace-fd6888d5197b";

describe("aprovação dos editais capturados", () => {
  it("lê aprovações e substituições e roda em prévia por padrão", () => {
    expect(parseNoticeApprovalArgs(["--", `aprovar=${consolidated}`, `substituir=${original}`])).toEqual({
      apply: false,
      decisions: [
        { action: "approve", snapshotPublicId: consolidated },
        { action: "supersede", snapshotPublicId: original },
      ],
    });
    expect(parseNoticeApprovalArgs(["--apply", `aprovar=${consolidated}`]).apply).toBe(true);
  });

  it("recusa comando sem aprovação, repetido ou com identificador estranho", () => {
    expect(() => parseNoticeApprovalArgs([`substituir=${original}`])).toThrow(/ao menos um aprovar/u);
    expect(() => parseNoticeApprovalArgs([`aprovar=${consolidated}`, `substituir=${consolidated}`])).toThrow(/mais de uma vez/u);
    expect(() => parseNoticeApprovalArgs(["aprovar=../x"])).toThrow(/Decisão inválida/u);
    expect(() => parseNoticeApprovalArgs([`rejeitar=${consolidated}`])).toThrow(/Decisão inválida/u);
  });

  it("decide só capturas pendentes de fonte e edital revisados, auditando a base", () => {
    expect(script).toContain('if (row.status !== "pending_review")');
    expect(script).toContain('row.sourceStatus !== "approved" || row.opportunityStatus !== "reviewed"');
    expect(script).toContain('.for("update", { of: opportunityDocumentSnapshots })');
    expect(script).toContain('approvalBasis: "owner_override"');
    expect(script).toContain('"editorial.notice_document.approved"');
    // Substituir exige uma versão aprovada do mesmo edital no mesmo comando.
    expect(script).toContain("Nenhuma versão aprovada substitui");
    expect(script).toContain("if (!apply) throw new PreviewRollback");
    expect(script).toContain('isolationLevel: "serializable"');
    // Só a captura muda; requisitos, questões e produtos ficam intocados.
    expect(script.match(/\.update\(\w+\)/gu)).toEqual([".update(opportunityDocumentSnapshots)"]);
    expect(script.match(/\.insert\(\w+\)/gu)).toEqual([".insert(auditLogs)"]);
    expect(script).not.toMatch(/\b(update|insert into|delete from)\s+(opportunity_requirements|questions|contest_store_products)\b/iu);
    expect(packageJson).toContain(
      '"editorial:notices:approve": "tsx --env-file-if-exists=.env scripts/approve-notice-snapshots.ts"',
    );
  });
});
