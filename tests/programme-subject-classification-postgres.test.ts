import { createHash, randomUUID } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import { classifyStandingProgrammeSubjects, programmeRequirementFingerprint, PROGRAMME_SUBJECT_CLASSIFICATION_ACTION,
  type ProgrammeRequirementState } from "@/lib/editorial/programme-subject-classification";

const url = process.env.LEIPROVA_TEST_DATABASE_URL;
if (url) { const parsed = new URL(url); if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.pathname !== "/leiprova_automation_test") throw new Error("Somente PostgreSQL sintético isolado em loopback."); }
const client = url ? postgres(url, { max: 2, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let actor: typeof schema.users.$inferSelect, source: typeof schema.opportunitySourceDocuments.$inferSelect,
  snapshot: typeof schema.opportunityDocumentSnapshots.$inferSelect, requirement: typeof schema.opportunityRequirements.$inferSelect,
  opportunity: typeof schema.contestOpportunities.$inferSelect, subject: typeof schema.quizSubjects.$inferSelect;
async function input() {
  const [row] = await db!.execute<ProgrammeRequirementState>(sql`select id::int id,opportunity_id::int as "opportunityId",source_document_id::int as "sourceDocumentId",
    source_snapshot_id::int as "snapshotId",subject_id::int as "subjectId",topic_id::int as "topicId",legal_act_id::int as "actId",legal_article_id::int as "articleId",
    requirement_text text,source_locator locator,editorial_status status,reviewed_by_user_id::int as "reviewedBy",reviewed_at::text as "reviewedAt",review_notes as "reviewNotes",updated_at::text as "updatedAt"
    from opportunity_requirements where id=${requirement.id}`);
  return { opportunityId: opportunity.id, opportunitySlug: opportunity.slug, roleName: opportunity.roleName, cycleYear: opportunity.cycleYear, examEditionId: null,
    requirements: [{ requirementId: requirement.id, expectedRequirementFingerprint: programmeRequirementFingerprint(row), subjectId: subject.id,
      subjectName: subject.name, heading: "DIREITO CONSTITUCIONAL", headingQuote: "DIREITO CONSTITUCIONAL", headingPage: 1, pages: [1], snapshotChecksum: snapshot.checksumSha256 }] };
}
const request = () => ({ actorPublicId: actor.publicId, approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE, mode: "preview" as const });
describe.skipIf(!url)("classificador de programa — PostgreSQL sintético", () => {
  beforeAll(async () => {
    const tag = randomUUID();
    [actor] = await db!.insert(schema.users).values({ publicId: randomUUID(), name: "Administrador sintético", email: `${tag}@example.invalid`, passwordHash: "not-a-password", role: "admin" }).returning();
    const [category] = await db!.select().from(schema.contestCategoryCareers).limit(1);
    [subject] = await db!.select().from(schema.quizSubjects).where(eq(schema.quizSubjects.name, "Direito Constitucional"));
    const landing = `https://conhecimento.fgv.br/concursos/qa-synthetic-programme-${tag}`;
    [opportunity] = await db!.insert(schema.contestOpportunities).values({ publicId: randomUUID(), slug: "mpmt-promotor-substituto-2026-historico-objetiva",
      categoryId: category.categoryId, careerTrackId: category.careerTrackId, jurisdictionCode: "MT", scope: "state", cycleYear: 2026,
      institutionAcronym: "MPMT", institutionName: "Instituição fictícia para teste", roleName: "Promotor de Justiça Substituto", officialNoticeNumber: "QA/2026",
      title: "Fixture sintética sem validade jurídica", summary: "Não representa edital real.", statusAsOf: "2026-10-12", editorialStatus: "draft", officialUrl: landing, sourceCheckedAt: new Date() }).returning();
    [source] = await db!.insert(schema.opportunitySourceDocuments).values({ publicId: randomUUID(), opportunityId: opportunity.id,
      documentType: "notice", title: "Fonte fictícia sem fetch", sourceUrl: landing, sourceHost: "conhecimento.fgv.br", observedAt: new Date(), lastSeenAt: new Date(),
      httpStatus: 200, contentType: "application/pdf", sourcePolicy: "metadata_only", sourceContentStored: false, status: "approved", reviewedByUserId: actor.id, reviewedAt: new Date() }).returning();
    const bytes = "%PDF-synthetic-programme-no-legal-validity", text = "Fonte sintética exclusiva de teste, sem validade jurídica e sem fetch externo.\nDIREITO CONSTITUCIONAL\nConstituição e princípios fundamentais.";
    [snapshot] = await db!.insert(schema.opportunityDocumentSnapshots).values({ publicId: randomUUID(), sourceDocumentId: source.id,
      documentUrl: `https://conhecimento.fgv.br/sites/default/files/qa-synthetic-programme-${tag}.pdf`, sourceHost: "conhecimento.fgv.br", fileName: "synthetic.pdf", mimeType: "application/pdf",
      documentBytes: Buffer.from(bytes), checksumSha256: hash(bytes), byteLength: Buffer.byteLength(bytes), pageCount: 1,
      extractedText: text, pageTexts: [text], textLength: text.length, parserVersion: "synthetic-test", sourcePolicy: "official_document",
      authorizationScope: "owner-approval-2026-09-01", authorizedAt: new Date(), status: "approved", reviewedByUserId: actor.id, reviewedAt: new Date(), reviewNotes: "Fixture sem validade jurídica." }).returning();
    await db!.update(schema.contestOpportunities).set({ editorialStatus: "reviewed", reviewedByUserId: actor.id, reviewedAt: new Date(), publishedAt: new Date() }).where(eq(schema.contestOpportunities.id, opportunity.id));
    [requirement] = await db!.insert(schema.opportunityRequirements).values({ opportunityId: opportunity.id, sourceDocumentId: source.id, sourceSnapshotId: snapshot.id,
      requirementText: "Constituição e princípios fundamentais.", sourceLocator: "Conteúdo programático, p. 1 · DIREITO CONSTITUCIONAL",
      editorialStatus: "reviewed", reviewedByUserId: actor.id, reviewedAt: new Date(), reviewNotes: "Extração sintética admitida; mapas não aprovados." }).returning();
  });
  beforeEach(async () => {
    await db!.execute(sql`delete from editorial_agent_work where job_key=${`mapping:${requirement.id}`}`);
    await db!.update(schema.opportunityRequirements).set({ editorialStatus: "draft" }).where(eq(schema.opportunityRequirements.id, requirement.id));
    await db!.update(schema.opportunityRequirements).set({ subjectId: null, topicId: null, legalActId: null, legalArticleId: null, editorialStatus: "reviewed",
      reviewedByUserId: actor.id, reviewedAt: new Date(), reviewNotes: "Extração sintética admitida; mapas não aprovados.", updatedAt: new Date() }).where(eq(schema.opportunityRequirements.id, requirement.id));
  });
  afterAll(async () => { await client?.end(); });
  it("preview é read only; apply preserva extração no JSONB e exige revisão material posterior", async () => {
    const evidence = await input(), preview = await classifyStandingProgrammeSubjects(db!, { ...request(), input: evidence });
    expect(preview.changed).toBe(1);
    expect((await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id, requirement.id)))[0].editorialStatus).toBe("reviewed");
    const [receipt] = await db!.insert(schema.auditLogs).values({ action: "synthetic.source.programme.admitted", entityType: "contest_opportunity", entityId: String(opportunity.id), metadata: { humanReview: false, sourceOnly: true } }).returning();
    const result = await classifyStandingProgrammeSubjects(db!, { ...request(), input: evidence, mode: "apply", expectedFingerprint: preview.fingerprint });
    expect(result).toMatchObject({ legalMappingsApproved: 0, questionsApproved: 0, productsReleased: 0 });
    expect((await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id, requirement.id)))[0]).toMatchObject({ subjectId: subject.id, editorialStatus: "draft", reviewedByUserId: null, reviewedAt: null, legalActId: null, legalArticleId: null, topicId: null });
    const [audit] = await db!.execute<{ kind: string; metadata: { before: { status: string; reviewNotes: string }; humanReview: boolean } }>(sql`select jsonb_typeof(metadata) kind,metadata from audit_logs where action=${PROGRAMME_SUBJECT_CLASSIFICATION_ACTION} and entity_id=${String(requirement.id)} order by id desc limit 1`);
    expect(audit.kind).toBe("object"); expect(audit.metadata).toMatchObject({ humanReview: false, before: { status: "reviewed", reviewNotes: "Extração sintética admitida; mapas não aprovados." } });
    expect((await db!.select().from(schema.auditLogs).where(eq(schema.auditLogs.id, receipt.id)))[0].metadata).toEqual(receipt.metadata);
    await expect(classifyStandingProgrammeSubjects(db!, { ...request(), input: evidence, mode: "apply", expectedFingerprint: preview.fingerprint })).rejects.toThrow(/mudou/);
  });
  it("aceita portal metadata_only com PDF oficial aprovado, sem fingir corpo armazenado no portal", async () => {
    const evidence=await input(),preview=await classifyStandingProgrammeSubjects(db!,{...request(),input:evidence});
    await classifyStandingProgrammeSubjects(db!,{...request(),input:evidence,mode:"apply",expectedFingerprint:preview.fingerprint});
    expect((await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id,requirement.id)))[0].subjectId).toBe(subject.id);
    expect((await db!.select().from(schema.opportunitySourceDocuments).where(eq(schema.opportunitySourceDocuments.id,source.id)))[0])
      .toMatchObject({sourcePolicy:"metadata_only",sourceContentStored:false,status:"approved"});
    expect((await db!.select().from(schema.opportunityDocumentSnapshots).where(eq(schema.opportunityDocumentSnapshots.id,snapshot.id)))[0])
      .toMatchObject({sourcePolicy:"official_document",status:"approved"});
  });
  it("recusa lease ativa sem substituição nem perda de resposta", async () => {
    const evidence = await input(), lease = randomUUID();
    await db!.execute(sql`insert into editorial_agent_work(job_key,kind,input_hash,payload,status,lease_token,lease_expires_at)
      values(${`mapping:${requirement.id}`},'legal_mapping',${hash("synthetic")},'{}'::jsonb,'running',${lease}::uuid,now()+interval '1 hour')`);
    await expect(classifyStandingProgrammeSubjects(db!, { ...request(), input: evidence })).rejects.toThrow(/reserva ativa/);
    const [work] = await db!.execute<{ token: string; status: string }>(sql`select lease_token::text token,status from editorial_agent_work where job_key=${`mapping:${requirement.id}`}`);
    expect(work).toEqual({ token: lease, status: "running" });
  });
  it("fingerprint invalida alteração material sem modificar texto do requisito", async () => {
    const evidence = await input(), preview = await classifyStandingProgrammeSubjects(db!, { ...request(), input: evidence });
    await db!.update(schema.opportunityRequirements).set({ reviewNotes: "Recibo sintético alterado." }).where(eq(schema.opportunityRequirements.id, requirement.id));
    await expect(classifyStandingProgrammeSubjects(db!, { ...request(), input: evidence, mode: "apply", expectedFingerprint: preview.fingerprint })).rejects.toThrow(/mudou/);
    expect((await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id, requirement.id)))[0].subjectId).toBeNull();
  });
});
