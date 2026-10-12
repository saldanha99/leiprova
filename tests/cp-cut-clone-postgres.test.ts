import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { CAMARA_CP_CORRECTION, CP63_EXPECTED_HELD_IDS, parseCamaraCpCorrectionCapture } from "@/lib/official-sources/camara-cp-correction-parser";
import { applyCoordinatedCpCut, previewCoordinatedCpCut, verifyCompletedCpCut } from "@/lib/official-sources/cp-coordinated-cut-service";

function isolatedCloneUrl(value:string,approval:string|undefined) {
  const url=new URL(value);
  if(approval!=="isolated-cp-cut-clone" || !["postgres:","postgresql:"].includes(url.protocol) || !["localhost","127.0.0.1","[::1]"].includes(url.hostname) || url.port!=="55445" || url.pathname!=="/leiprova" || url.username!=="leiprova_owner" || url.search || url.hash) throw new Error("Teste exige clone isolado loopback:55445/leiprova, owner e confirmação isolated-cp-cut-clone; nunca produção.");
  return value;
}
const value=process.env.CP_CUT_TEST_DATABASE_URL;
const client=value?postgres(isolatedCloneUrl(value,process.env.CP_CUT_TEST_APPROVAL),{max:1,prepare:false}):null;
const db=client?drizzle(client,{schema}):null;
const fixtureDirectory=process.env.CP_CUT_TEST_CAPTURE_DIR??".local/editorial/lei12737-reconciliacao-20261012";
function capture() {
  const body=readFileSync(resolve(fixtureDirectory,"cp-current-camara.html")),amendment=readFileSync(resolve(fixtureDirectory,"15517-original-camara.html"));
  const fetchedAt=new Date();
  return {parsed:parseCamaraCpCorrectionCapture(body,CAMARA_CP_CORRECTION.url,"text/html"),body:{bytes:body,mime:"text/html",status:200,fetchedAt},amendment:{bytes:amendment,mime:"text/html",status:200,fetchedAt},robots:{bytes:new TextEncoder().encode("User-agent: *\nAllow: /\n# synthetic QA robots only, no official network claim"),mime:"text/plain",status:200,fetchedAt},publicationAllowed:false as const};
}
const rollback=new Error("intentional isolated-clone rollback");
async function expectCloneRollback(promise: Promise<unknown>) {
  try { await promise; }
  catch (error) {
    if (error === rollback) return;
    let cause: unknown = error;
    for (let depth=0; depth<8 && cause && typeof cause==="object" && "cause" in cause && cause.cause; depth++) cause=cause.cause;
    // Preserve the underlying failure without dumping full corpus/query parameters.
    const message=cause instanceof Error ? cause.message : "Falha inesperada no clone";
    throw new Error(`QA não chegou ao rollback intencional: ${message.slice(0,400)}`);
  }
  throw new Error("QA terminou sem rollback intencional; não aceitar aplicação persistida.");
}

async function actor() {
  const rows=await db!.execute<{id:number;publicId:string;role:string}>(sql`select id::int as id,public_id as "publicId",role from users where role='admin' order by id limit 2`);
  if(rows.length!==1) throw new Error("Clone deve preservar administrador único para teste."); return rows[0];
}
async function versionState() {
  const [row]=await db!.execute<{status:string;versions:number;held:number}>(sql`select status,(select count(*)::int from legal_versions where legal_act_id=17) as versions,(select count(*)::int from legal_articles where legal_version_id=63 and editorial_status='suspended') as held from legal_versions where id=63`);
  return row;
}

describe("alvo de QA do corte CP",()=> {
  it("refusa ausência de confirmação, porta/banco/papel/host de produção",()=> {
    expect(isolatedCloneUrl("postgres://leiprova_owner:fictional@127.0.0.1:55445/leiprova","isolated-cp-cut-clone")).toContain("55445");
    for(const url of ["postgres://leiprova_owner:fixture@production.invalid:55445/leiprova","postgres://leiprova_owner:fixture@127.0.0.1:5432/leiprova","postgres://leiprova_owner:fixture@127.0.0.1:55445/other","postgres://leiprova_app:fixture@127.0.0.1:55445/leiprova"]) expect(()=>isolatedCloneUrl(url,"isolated-cp-cut-clone")).toThrow();
    expect(()=>isolatedCloneUrl("postgres://leiprova_owner:fixture@127.0.0.1:55445/leiprova",undefined)).toThrow();
  });
});

describe.skipIf(!db)("0054/corte402/5/285 em clone privado real, sempre rollback",()=> {
  beforeAll(async()=> {
    const [identity]=await db!.execute<{database:string;role:string;table:string|null}>(sql`select current_database() as database,current_user as role,to_regclass('public.legal_cp_correction_evidence')::text as table`);
    expect(identity).toEqual({database:"leiprova",role:"leiprova_owner",table:"legal_cp_correction_evidence"});
    expect((await versionState()).status).toBe("current");expect((await versionState()).held).toBe(27);
  });
  afterAll(async()=>client?.end());
  it("preview projeta o mesmo acesso e cinco hashes, sem inserir snapshots/versões/vínculos",async()=> {
    const before=await versionState(),operator=await actor();
    const result=await db!.transaction(async tx=>previewCoordinatedCpCut(tx,capture(),operator),{isolationLevel:"repeatable read",accessMode:"read only"});
    expect(result.projected.filter(r=>r.ready).map(r=>r.count).sort((a,b)=>a-b)).toEqual([69,70,146]);expect(result.checks).toHaveLength(5);expect(result.checks.every(q=>q.eligible)).toBe(true);
    expect(await versionState()).toEqual(before);
  },30000);
  it("corte integral e repetição preservam27 históricos; APP lê somente recibo aprovado/current e não pode mutar CP",async()=> {
    const operator=await actor(),fresh=capture();const before=await versionState();
    await expectCloneRollback(db!.transaction(async tx=> {
      const [oldRequirement]=await tx.execute<{state:Record<string,unknown>}>(sql`select to_jsonb(r) as state from opportunity_requirements r where id=667`);
      // Prove the old reviewed->reviewed shortcut remains blocked by0020.
      await expect(tx.transaction(async nested=>nested.execute(sql`update opportunity_requirements set legal_article_id=(select id from legal_articles where legal_version_id=63 and path='art-1') where id=667`))).rejects.toThrow();
      const preview=await previewCoordinatedCpCut(tx,fresh,operator);
      const result=await applyCoordinatedCpCut(tx,fresh,operator,preview.fingerprint);
      const [newRequirement]=await tx.execute<{state:Record<string,unknown>}>(sql`select to_jsonb(r) as state from opportunity_requirements r where id=667`);
      expect(newRequirement.state.editorial_status).toBe("reviewed");expect(newRequirement.state.reviewed_by_user_id).toBe(operator.id);expect(newRequirement.state.reviewed_at).not.toBe(oldRequirement.state.reviewed_at);
      const mutable=new Set(["editorial_status","legal_article_id","reviewed_by_user_id","reviewed_at","review_notes","updated_at"]);
      for(const [key,value] of Object.entries(oldRequirement.state)) if(!mutable.has(key)) expect(newRequirement.state[key]).toEqual(value);
      const requirementAudits=await tx.execute<{action:string;before:string;after:string;human:boolean}>(sql`select action,metadata->>'statusBefore' as before,metadata->>'statusAfter' as after,(metadata->>'humanReview')::boolean as human from audit_logs where entity_type='opportunity_requirement' and entity_id='667' and metadata->>'fingerprint'=${preview.fingerprint} order by id`);
      expect(requirementAudits).toEqual([{action:"editorial.notice_requirement.reopened_for_cp_correction",before:"reviewed",after:"pending_review",human:false},{action:"editorial.notice_requirement.reviewed",before:"pending_review",after:"reviewed",human:false}]);
      expect(result.articles).toBe(402);expect(result.questionsCorrected).toBe(5);expect(result.after.map(r=>r.count).sort((a,b)=>a-b)).toEqual([69,70,146]);
      const repeated=await verifyCompletedCpCut(tx,fresh,preview.fingerprint);expect(repeated?.mode).toBe("unchanged");
      const [types]=await tx.execute<{metadataType:string;human:boolean}>(sql`select jsonb_typeof(metadata) as "metadataType",human_review as human from legal_cp_correction_evidence where fingerprint=${preview.fingerprint}`);
      expect(types).toEqual({metadataType:"object",human:false});
      // A draft receipt cannot turn approved using another operation's audit.
      const pendingFingerprint="f".repeat(64);
      await tx.execute(sql`insert into legal_cp_correction_evidence(public_id,legal_act_id,monitor_snapshot_id,text_snapshot_id,legal_version_id,cp_url,cp_raw_sha256,canonical_sha256,parser_version,amendment_url,amendment_raw_sha256,amendment_html,fetched_at,amendment_fetched_at,robots_sha256,fingerprint,status,reviewed_by_user_id,reviewed_at,approval_audit_id,approval_reference,human_review,metadata)
        select ${randomUUID()},legal_act_id,monitor_snapshot_id,text_snapshot_id,legal_version_id,cp_url,cp_raw_sha256,canonical_sha256,parser_version,amendment_url,amendment_raw_sha256,amendment_html,fetched_at,amendment_fetched_at,robots_sha256,${pendingFingerprint},'pending_review',reviewed_by_user_id,reviewed_at,approval_audit_id,approval_reference,human_review,jsonb_set(metadata,'{fingerprint}',to_jsonb(${pendingFingerprint}::text))
        from legal_cp_correction_evidence where fingerprint=${preview.fingerprint}`);
      let rejected: unknown;
      try { await tx.transaction(async nested=>nested.execute(sql`update legal_cp_correction_evidence set status='approved' where fingerprint=${pendingFingerprint}`)); }
      catch (error) { rejected=error; }
      for (let depth=0; depth<8 && rejected && typeof rejected==='object' && 'cause' in rejected && rejected.cause; depth++) rejected=rejected.cause;
      expect(rejected).toBeInstanceOf(Error);
      expect((rejected as Error).message).toMatch(/Recibo CP sem/);

      const held=await tx.execute<{id:number}>(sql`select id::int as id from legal_articles where legal_version_id=63 and editorial_status='suspended' order by id`);
      expect(held.map(a=>a.id)).toEqual([...CP63_EXPECTED_HELD_IDS].sort((a,b)=>a-b));
      await tx.execute(sql`set local role leiprova_app`);
      const shown=await tx.execute<{fingerprint:string}>(sql`select fingerprint from legal_cp_correction_evidence where fingerprint=${preview.fingerprint}`);expect(shown).toHaveLength(1);
      await expect(tx.transaction(async nested=>nested.execute(sql`update legal_versions set verified_at=now() where id=${result.versionId}`))).rejects.toThrow();
      await tx.execute(sql`reset role`);
      await tx.execute(sql`update legal_cp_correction_evidence set status='suspended' where fingerprint=${preview.fingerprint}`);
      await tx.execute(sql`set local role leiprova_app`);
      expect(await tx.execute(sql`select id from legal_cp_correction_evidence where fingerprint=${preview.fingerprint}`)).toHaveLength(0);
      await tx.execute(sql`reset role`);
      await expect(tx.transaction(async nested=>nested.execute(sql`update legal_cp_correction_evidence set status='approved' where fingerprint=${preview.fingerprint}`))).rejects.toThrow();
      throw rollback;
    },{isolationLevel:"serializable"}));
    expect(await versionState()).toEqual(before);
  },30000);
  it("mudança do conteúdo original após parecer impede corte e mantém63/27",async()=> {
    const before=await versionState(),operator=await actor();
    await expectCloneRollback(db!.transaction(async tx=> {
      await tx.execute(sql`update questions set prompt='QA synthetic mutation, never published' where id=1285`);
      await expect(previewCoordinatedCpCut(tx,capture(),operator)).rejects.toThrow();
      throw rollback;
    },{isolationLevel:"serializable"}));
    expect(await versionState()).toEqual(before);
  },30000);
});
