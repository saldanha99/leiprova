import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewOfficialQuestionContract } from "@/lib/editorial/official-question-contract-review";
import { observeMprjMc5Cover } from "@/lib/editorial/mprj-format-evidence";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import { syntheticQuestionContract } from "./fixtures/question-contract";
import { questionContractFingerprint, type OfficialQuestionContract } from "@/lib/editorial/official-question-contract";
import { contract, document, observation } from "./fixtures/mprj-format";
vi.mock("@/lib/editorial/mprj-format-evidence", async original => ({ ...await original<object>(), observeMprjMc5Cover: vi.fn() }));
const actorPublicId = "11111111-1111-4111-8111-111111111111";
const request = () => ({ input: { contract: contract() }, actorPublicId, approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE, mode: "preview" as const });
function database(overrides: { contract?: OfficialQuestionContract; actor?: string; source?: Record<string, unknown>; documents?: unknown[]; evidence?: unknown[]; other?: unknown[]; existing?: {status:string}[]; identity?: string } = {}) {
  const c = overrides.contract ?? contract(), writes: unknown[] = [], statements: string[] = [];
  const tx = { execute: vi.fn(async (query: SQL) => {
    const text = new PgDialect().sqlToQuery(query).sql; statements.push(text);
    if (text.includes("from users where")) return [{ id: 7, role: overrides.actor ?? "admin" }];
    if (text.includes("current_database()")) return [{ name: "leiprova", username: overrides.identity ?? "leiprova_owner" }];
    if (text.includes("from contest_opportunities o join opportunity_source_documents")) return [{ role: c.roleName, specializationId: null,
      editionId: c.examEditionId, cycleYear: c.cycleYear, notice: c.noticeNumber, institution: "MPRJ", opportunityStatus: "reviewed", sourceStatus: "approved", snapshotStatus: "approved",
      sourceUrl: c.sourceDocumentUrl, documentUrl: c.sourceUrl, snapshotChecksum: c.sourceSnapshotChecksum, sourceDocumentChecksum: c.sourceDocumentChecksum,
      bytesChecksum: c.sourceSnapshotChecksum, pageText: c.sourceQuote, identityText: c.identityQuote, bankId: c.bankId, assignmentStatus: "reviewed", assignmentRole: "examination_provider",
      validUntil: null, bankActive: true, preferred: true, opportunityUpdatedAt: document.opportunityUpdatedAt, snapshotUpdatedAt: "2026-10-15", ...overrides.source }];
    if (text.includes("from exam_edition_documents d join")) return overrides.documents ?? [document];
    if (text.includes("from official_question_format_evidence where")) return overrides.evidence ?? [];
    if (text.includes("select id,payload from opportunity_question_contracts")) return overrides.other ?? [];
    if (text.includes("select status from opportunity_question_contracts")) return overrides.existing ?? [];
    if (text.includes("select id from opportunity_question_contracts c")) return [{ id: "current" }];
    if (text.startsWith("update ")) writes.push(text);
    return [];
  }), insert: vi.fn(() => ({ values: vi.fn(async (values: unknown) => { writes.push({ values }); }) })) };
  const db = { transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
  return { db: db as never, tx, writes, statements };
}
afterEach(() => vi.clearAllMocks());
describe("revisor MPRJ: orchestration tests, not PostgreSQL proof", () => {
  it("preview read-only e fingerprint cobre SHA atual sem persistir capa", async () => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const f = database(), result = await reviewOfficialQuestionContract(f.db, request());
    expect(f.writes).toEqual([]); expect(result.contract.sourceQuote).toBe(contract().sourceQuote);
    expect(result.contract.formatEvidence?.sourceSha256).toBe(observation.sourceSha256);
    vi.mocked(observeMprjMc5Cover).mockResolvedValue({ ...observation, sourceSha256: "d".repeat(64) });
    const next = await reviewOfficialQuestionContract(database().db, request()); expect(next.fingerprint).not.toBe(result.fingerprint);
  });
  it("apply stale recusa antes de qualquer escrita", async () => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const f = database(); await expect(reviewOfficialQuestionContract(f.db, { ...request(), mode: "apply", expectedFingerprint: "0".repeat(64) })).rejects.toThrow("mudaram");
    expect(f.writes).toEqual([]);
  });
  it.each([{ actor: "editor" }, { identity: "leiprova_app" }, { source: { snapshotStatus: "suspended" } }, { source: { bytesChecksum: "d".repeat(64) } },
    { documents: [] }, { documents: [document, document] }, { documents: [{ ...document, status: "suspended" }] },
  ])("fail closed antes de escrita: %j", async overrides => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const f = database(overrides); await expect(reviewOfficialQuestionContract(f.db, request())).rejects.toThrow(); expect(f.writes).toEqual([]);
  });
  it("wrong actor UUID/autorização/escopo não chama fonte nem banco", async () => {
    for (const patch of [{ actorPublicId: "wrong" }, { approvalReference: "wrong" }, { mode: "wrong" },
      { input: { contract: { ...contract(), examEditionId: 42 } } },
      { input: { contract: { ...contract(), profile: { ...contract().profile, version: "other-role-profile" } } } }]) {
      const f = database(); await expect(reviewOfficialQuestionContract(f.db, { ...request(), ...patch } as never)).rejects.toThrow(); expect(f.statements).toEqual([]);
    }
    expect(observeMprjMc5Cover).not.toHaveBeenCalled();
  });
  it("apply de mesma prévia insere fatos e contrato/audit, nunca corpus; micros permanecem SQL", async () => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const preview = await reviewOfficialQuestionContract(database().db, request());
    const f = database(), result = await reviewOfficialQuestionContract(f.db, { ...request(), mode: "apply", expectedFingerprint: preview.fingerprint });
    expect(result.humanReview).toBe(false); expect(f.writes).toHaveLength(4);
    const serialized = JSON.stringify(f.writes); expect(serialized).not.toContain("documentBytes"); expect(serialized).not.toContain("extractedText");
    expect(serialized).toContain("123456");
  });
  it("contratos legados não consultam nem recebem evidência MPRJ", async () => {
    const legacy=syntheticQuestionContract({sourceQuote:"Prova sintética de cinco alternativas e apenas uma resposta correta.",
      sourceDocumentUrl:contract().sourceDocumentUrl,sourceUrl:contract().sourceUrl});
    const result=await reviewOfficialQuestionContract(database({contract:legacy}).db,{...request(),input:{contract:legacy}});
    expect(result.contract).toEqual(legacy); expect(result.evidencePlan).toBeNull(); expect(observeMprjMc5Cover).not.toHaveBeenCalled();
  });
  it("refresh exige nova prévia e afeta somente MPRJ20/41", async () => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const oldId="e".repeat(64), evidenceId="f".repeat(64);
    const options={other:[{id:oldId,payload:{...contract(),formatEvidence:{evidenceId}}}],evidence:[{id:evidenceId,status:"approved",expired:true}]};
    await expect(reviewOfficialQuestionContract(database(options).db,request())).rejects.toThrow();
    const preview=await reviewOfficialQuestionContract(database(options).db,{...request(),refreshMprjEvidence:true});
    const f=database(options);
    await reviewOfficialQuestionContract(f.db,{...request(),mode:"apply",refreshMprjEvidence:true,expectedFingerprint:preview.fingerprint});
    const updates=f.statements.filter(text=>text.startsWith("update "));
    expect(updates).toHaveLength(2);
    expect(updates[0]).toContain("opportunity_id=20 and exam_edition_id=41"); expect(updates[1]).toContain("opportunity_id=20");
  });
  it("contrato existente diferente exige refresh explícito e origem na evidência aprovada", async () => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const f = database({ other: [{ id: "old", payload: { ...contract(), formatEvidence: { evidenceId: "old" } } }], evidence: [{ id: "old", status: "suspended" }] });
    await expect(reviewOfficialQuestionContract(f.db, { ...request(), refreshMprjEvidence: true })).rejects.toThrow("outro contrato");
    expect(f.writes).toEqual([]);
  });
  it("refresh de fatos idênticos preserva contrato e certificados, inclusive na segunda renovação", async () => {
    vi.mocked(observeMprjMc5Cover).mockResolvedValue(observation);
    const initial=await reviewOfficialQuestionContract(database().db,request());
    const admitted={...initial.contract,formatEvidence:{...initial.contract.formatEvidence!,evidenceId:'e'.repeat(64),verificationDate:'2026-10-12'}};
    const originalId=questionContractFingerprint(admitted);
    const options={existing:[{status:'approved'}],other:[{id:originalId,payload:admitted}],evidence:[{id:'e'.repeat(64),status:'superseded',expired:true}]};
    const preview=await reviewOfficialQuestionContract(database(options).db,{...request(),refreshMprjEvidence:true});
    expect(preview.contractId).toBe(originalId);
    expect(preview.contract).toEqual(admitted);
    expect(preview.evidencePlan?.evidence.evidenceId).not.toBe(admitted.formatEvidence.evidenceId);
    const f=database(options);
    await reviewOfficialQuestionContract(f.db,{...request(),mode:'apply',refreshMprjEvidence:true,expectedFingerprint:preview.fingerprint});
    expect(f.statements.some(text=>text.startsWith('update opportunity_question_contracts'))).toBe(false);
  });
});
