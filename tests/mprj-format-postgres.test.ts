import { readFileSync } from "node:fs";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Opt-in only. The integrator provisions an EMPTY disposable DB; no creation/remote access here.
const url = process.env.MPRJ_FORMAT_ISOLATED_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.pathname !== "/leiprova_mprj_format_test")
    throw new Error("MPRJ SQL tests require an isolated loopback leiprova_mprj_format_test database.");
}
describe.skipIf(!url)("MPRJ0056 — PostgreSQL isolated, explicit opt-in", () => {
  it("FK/NULL/checks, source identity, SHA, status, expiry and role privileges", async () => {
    const client = postgres(url!, { max: 1, prepare: false, connect_timeout: 3 });
    const rollback = new Error("rollback successful isolated test");
    try {
      const [identity] = await client`select current_database() as name,current_user as role`;
      expect(identity).toMatchObject({ name: "leiprova_mprj_format_test", role: "leiprova_mprj_format_test_owner" });
      const [existing] = await client`select count(*)::int n from pg_tables where schemaname='public'`;
      expect(existing.n).toBe(0);
      await client.begin(async tx => {
        await tx.unsafe(`
          DO $$ BEGIN
            IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='leiprova_app') THEN
              CREATE ROLE leiprova_app NOLOGIN;
            END IF;
          END $$;
          CREATE TABLE users(id bigint PRIMARY KEY);
          CREATE TABLE quiz_banks(id bigint PRIMARY KEY,slug text,is_active boolean);
          CREATE TABLE exam_editions(id bigint PRIMARY KEY,public_id text,bank_id bigint,institution_acronym text,jurisdiction_code text,status text,updated_at timestamptz,career_track_id bigint,specialization_id bigint,source_policy text,source_content_stored boolean);
          CREATE TABLE contest_opportunities(id bigint PRIMARY KEY,public_id text,exam_edition_id bigint,role_name text,institution_acronym text,jurisdiction_code text,cycle_year int,official_notice_number text,specialization_id bigint,editorial_status text,updated_at timestamptz,career_track_id bigint);
          CREATE TABLE exam_edition_documents(id bigint PRIMARY KEY,exam_edition_id bigint,document_type text,public_id text,source_url text,status text,updated_at timestamptz,source_policy text,distribution_mode text,storage_key text,byte_length bigint,http_status int,content_type text,expected_question_count int,checksum_sha256 text,title text,source_host text,published_at timestamptz,UNIQUE(id,exam_edition_id,document_type));
        `);
        await tx.unsafe(readFileSync("drizzle/0056_official_question_format_evidence.sql", "utf8"));
        const [clock] = await tx`select (now() at time zone 'UTC')::date::text as day,now()::text as instant,((now() at time zone 'UTC')::date+2)::timestamp at time zone 'UTC' as expiry`;
        const sourceUrl = "https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns001-tipo-1.pdf";
        const uuid = "11111111-1111-4111-8111-111111111111", stamp = "2026-10-15 12:00:00.123456+00";
        await tx`insert into users values(1)`; await tx`insert into quiz_banks values(1,'fgv',true)`;
        await tx`insert into exam_editions values(41,'mprj-promotor-substituto-xxxix-2026-preambular',1,'MPRJ','RJ','completed',${stamp}::text::timestamptz,1,null,'metadata_only',false)`;
        await tx`insert into contest_opportunities values(20,'31739f51-3b4b-4984-a272-54fb549c034d',41,'Promotor de Justiça Substituto','MPRJ','RJ',2026,'XXXIX/2026',null,'reviewed',${stamp}::text::timestamptz,1)`;
        await tx`insert into exam_edition_documents values(10,41,'question_booklet',${uuid},${sourceUrl},'approved',${stamp}::text::timestamptz,'metadata_only','external_link',null,null,200,'application/pdf',100,null,'MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1','conhecimento.fgv.br','2026-06-01T00:00:00Z')`;
        const base = { id: "a".repeat(64), opportunity_id: 20, exam_edition_id: 41, bank_id: 1, role_name: "Promotor de Justiça Substituto", institution_acronym: "MPRJ", jurisdiction_code: "RJ",
          exam_edition_document_id: 10, document_type: "question_booklet", document_public_id: uuid, source_url: sourceUrl, document_updated_at: stamp,
          opportunity_updated_at: stamp, edition_updated_at: stamp, verification_date: clock.day, expires_at: clock.expiry,
          source_sha256: "b".repeat(64), robots_sha256: "c".repeat(64), page_number: 1, page_text_sha256: "d".repeat(64), parser_version: "mprj-type1-cover-mc5-v1",
          format: "multiple_choice", option_count: 5, single_correct: true, question_count: 100, status: "approved", approval_reference: "owner-standing-2026-10-12:official-sources-programs",
          approval_basis: "owner_standing_authorization", human_review: false, reviewed_by_user_id: 1, reviewed_at: clock.instant, created_at: clock.instant, updated_at: clock.instant };
        for (const patch of [{ document_type: null }, { exam_edition_document_id: null }, { exam_edition_document_id: 999 }, { exam_edition_id: 42 },
          { document_type: "answer_key" }, { source_sha256: null }, { single_correct: null }, { human_review: true }, { option_count: 4 }]) {
          await expect(tx.savepoint(async sp => sp`insert into official_question_format_evidence select (jsonb_populate_record(null::official_question_format_evidence,${sp.json({ ...base, ...patch })}::jsonb)).*`)).rejects.toMatchObject({ code: expect.stringMatching(/^235(?:02|03|14)$/u) });
        }
        await tx`insert into official_question_format_evidence select (jsonb_populate_record(null::official_question_format_evidence,${tx.json(base)}::jsonb)).*`;
        const payload = { formatEvidence: { evidenceId: base.id, documentPublicId: uuid, sourceUrl, sourceSha256: base.source_sha256,
          robotsSha256: base.robots_sha256, pageTextSha256: base.page_text_sha256, pageNumber: 1, parserVersion: base.parser_version,
          format: "multiple_choice", optionCount: 5, singleCorrect: true, questionCount: 100, verificationDate: clock.day } };
        const current = async (p = payload, opportunity = 20, edition = 41, bank = 1) => (await tx`select public.mprj_question_format_evidence_current(${tx.json(p)}::jsonb,${opportunity}::bigint,${edition}::bigint,${bank}::bigint) as valid`)[0].valid;
        expect(await current()).toBe(true);
        await tx`set local role leiprova_app`;
        expect(await current()).toBe(true);
        const [appAccess] = await tx`select has_table_privilege(current_user,'public.official_question_format_evidence','SELECT') as can_read,
          has_table_privilege(current_user,'public.official_question_format_evidence','INSERT') as can_write`;
        expect(appAccess).toEqual({ can_read: false, can_write: false });
        await tx`reset role`;
        expect(await current({} as never)).toBe(false);
        expect(await current(payload,21)).toBe(false);
        expect(await current(payload,20,42)).toBe(false);
        expect(await current(payload,20,41,2)).toBe(false);
        expect(await current({ formatEvidence: { ...payload.formatEvidence, sourceSha256: "e".repeat(64) } })).toBe(false);
        const invalidations = ["update exam_edition_documents set status='suspended'", "update exam_edition_documents set public_id='changed'",
          "update exam_edition_documents set updated_at=updated_at+interval '1 microsecond'", "update quiz_banks set slug='wrong'",
          "update exam_editions set bank_id=2", "update contest_opportunities set role_name='Outro cargo'", "update official_question_format_evidence set status='suspended'"];
        for (const change of invalidations) {
          await tx.savepoint(async sp => {
            await sp.unsafe(change); expect(await current()).toBe(false); throw rollback;
          }).catch(error => { if (error !== rollback) throw error; });
          expect(await current()).toBe(true);
        }
        await tx.savepoint(async sp => {
          const older = new Date(Date.parse(clock.day+"T00:00:00Z")-3*86_400_000);
          const oldDate=older.toISOString().slice(0,10), oldId="e".repeat(64);
          await sp`update official_question_format_evidence set status='superseded'`;
          await sp`insert into official_question_format_evidence select (jsonb_populate_record(null::official_question_format_evidence,${sp.json({ ...base, id:oldId,
            verification_date:oldDate, reviewed_at:older.toISOString(), expires_at:new Date(older.getTime()+2*86_400_000).toISOString() })}::jsonb)).*`;
          expect(await current({formatEvidence:{...payload.formatEvidence,evidenceId:oldId,verificationDate:oldDate}})).toBe(false);
          // Renewing identical facts keeps the original authorship payload valid.
          await sp`update official_question_format_evidence set status='superseded' where id=${oldId}`;
          await sp`insert into official_question_format_evidence select (jsonb_populate_record(null::official_question_format_evidence,${sp.json({ ...base, id: 'f'.repeat(64) })}::jsonb)).*`;
          const originalPayload={formatEvidence:{...payload.formatEvidence,evidenceId:oldId,verificationDate:oldDate}};
          expect(await current(originalPayload)).toBe(true);
          await sp`set local role leiprova_app`;
          expect(await current(originalPayload)).toBe(true);
          await sp`reset role`;
          await sp`update official_question_format_evidence set status='suspended' where id=${oldId}`;
          expect(await current(originalPayload)).toBe(false);
          throw rollback;
        }).catch(error => { if (error!==rollback) throw error; });
        const [acl] = await tx`select count(*)::int n from pg_proc p cross join lateral aclexplode(p.proacl) a where p.oid='public.mprj_question_format_evidence_current(jsonb,bigint,bigint,bigint)'::regprocedure and a.grantee=0`;
        expect(acl.n).toBe(0);
        throw rollback;
      }).catch(error => { if (error !== rollback) throw error; });
    } finally { await client.end(); }
  });
});
