import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { CAMARA_CP_CORRECTION, fetchCamaraCpCorrectionEvidence } from "../src/lib/official-sources/camara-cp-correction-parser";
import { CP_CUT_REFERENCE, CP_CUT_POLICY, assertCpCutFresh, requireCpCutDatabase } from "../src/lib/official-sources/cp-coordinated-cut";
import { parseOpportunityApprovalReviewerIdentity } from "../src/lib/opportunities/approval-command";

export function parseCpSourceVerificationArgs(args: readonly string[]) {
  const argv=args[0]==="--"?args.slice(1):[...args];
  const apply=argv.includes("--apply"), fingerprints=argv.filter(a=>/^fingerprint=[a-f0-9]{64}$/u.test(a));
  if(fingerprints.length!==1 || argv.length!==(apply?2:1) || (apply && argv.filter(a=>a==="--apply").length!==1)) throw new Error("Use fingerprint=<recibo real> [--apply]; verificador não ativa nem restaura fontes.");
  return {apply,fingerprint:fingerprints[0].slice(12)};
}

async function main() {
  const command=parseCpSourceVerificationArgs(process.argv.slice(2));
  const url=requireCpCutDatabase(process.env.MIGRATION_DATABASE_URL);
  if(process.env.LEGAL_STANDING_REVIEW_REFERENCE!==CP_CUT_REFERENCE) throw new Error("Autorização permanente exata ausente.");
  const identity=parseOpportunityApprovalReviewerIdentity({ADMIN_EMAILS:process.env.ADMIN_EMAILS,OPPORTUNITY_APPROVAL_REFERENCE:CP_CUT_REFERENCE});
  // Failure is recorded and can only suspend. No retries, fallback or bypass.
  let fresh:Awaited<ReturnType<typeof fetchCamaraCpCorrectionEvidence>>|null=null;
  try { fresh=await fetchCamaraCpCorrectionEvidence(); assertCpCutFresh(fresh.body.fetchedAt);assertCpCutFresh(fresh.amendment.fetchedAt); } catch { fresh=null; }
  const client=postgres(url,{max:1,prepare:false,connect_timeout:5,idle_timeout:10});
  const db=drizzle(client,{schema});
  try {
    const result=await db.transaction(async tx=> {
      await tx.execute(sql`set local lock_timeout='5s'`);await tx.execute(sql`set local statement_timeout='30s'`);
      const [target]=await tx.execute<{database:string;role:string}>(sql`select current_database() as database,current_user as role`);
      if(target?.database!=="leiprova" || target.role!=="leiprova_owner") throw new Error("Alvo efetivo divergente.");
      if(command.apply) {
        // Same owner fence as the coordinated cut, before act/version/source locks.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('leiprova:cp-owner-maintenance:v1',0))`);
        await tx.execute(sql`select id from legal_acts where id=17 for update`);
        await tx.execute(sql`select id from legal_versions where legal_act_id=17 order by id for update`);
      }
      const admins=await tx.execute<{id:number;role:string}>(sql`select id::int as id,role from users where ${identity.email?sql`lower(email)=${identity.email}`:sql`role='admin'`} order by id limit 2 ${command.apply?sql`for share`:sql``}`);
      if(admins.length!==1 || admins[0].role!=="admin") throw new Error("Administrador único não confirmado.");
      const [source]=await tx.execute<{id:number;versionId:number;monitorId:number;textId:number;valid:boolean}>(sql`select e.id::int as id,e.legal_version_id::int as "versionId",e.monitor_snapshot_id::int as "monitorId",e.text_snapshot_id::int as "textId",
        coalesce(e.status='approved' and v.status='current' and v.legal_act_id=17 and v.source_url=e.cp_url and v.checksum_sha256=e.canonical_sha256 and m.status='approved' and t.status='approved' and m.legal_act_id=17 and t.legal_act_id=17 and t.monitor_snapshot_id=m.id and m.checksum_sha256=e.canonical_sha256 and t.checksum_sha256=e.canonical_sha256 and e.metadata->>'policy'=${CP_CUT_POLICY} and e.metadata->'humanReview'='false'::jsonb and e.approval_reference=${CP_CUT_REFERENCE},false) as valid
        from legal_cp_correction_evidence e join legal_versions v on v.id=e.legal_version_id join legal_source_snapshots m on m.id=e.monitor_snapshot_id join legal_text_snapshots t on t.id=e.text_snapshot_id where e.fingerprint=${command.fingerprint}
        ${command.apply?sql`for update of e,m,t`:sql``}`);
      if(!source?.valid) throw new Error("Fonte não aprovada/atual ou recibo suspenso; verificador não restaura.");
      const articles=await tx.execute<{path:string;literal:string;status:string;rights:string}>(sql`select path,literal_text as literal,editorial_status as status,source_rights as rights from legal_articles where legal_version_id=${source.versionId} order by article_order`);
      const verified=Boolean(fresh && articles.length===402 && articles.every((a,i)=>a.path===fresh!.parsed.articles[i].path && a.literal===fresh!.parsed.articles[i].literalText && a.status==="reviewed" && a.rights==="official_text"));
      if(!command.apply) return {mode:"preview",fingerprint:command.fingerprint,sourceVerificationSucceeded:verified,wouldSuspend:!verified,databaseWrites:0,humanReview:false};
      const now=new Date();
      if(verified) {
        await tx.update(schema.legalVersions).set({verifiedAt:now}).where(sql`id=${source.versionId} and status='current'`);
        await tx.update(schema.legalSourceSnapshots).set({lastSeenAt:now}).where(sql`id=${source.monitorId} and status='approved'`);
        await tx.update(schema.legalTextSnapshots).set({lastSeenAt:now}).where(sql`id=${source.textId} and status='approved'`);
      } else {
        await tx.execute(sql`update legal_cp_correction_evidence set status='suspended' where id=${source.id} and status='approved'`);
        await tx.update(schema.legalVersions).set({status:"pending_review"}).where(sql`id=${source.versionId} and status='current'`);
        await tx.update(schema.legalSourceSnapshots).set({status:"rejected"}).where(sql`id=${source.monitorId} and status='approved'`);
        await tx.update(schema.legalTextSnapshots).set({status:"rejected",updatedAt:now}).where(sql`id=${source.textId} and status='approved'`);
      }
      const [audit]=await tx.insert(schema.auditLogs).values({actorUserId:admins[0].id,action:verified?"editorial.legal_cp.source_verified":"editorial.legal_cp.source_suspended",entityType:"legal_cp_correction_evidence",entityId:String(source.id),metadata:{policy:CP_CUT_POLICY,fingerprint:command.fingerprint,approvalReference:CP_CUT_REFERENCE,approvalMode:"owner_standing_authorization",humanReview:false,sourceVerificationSucceeded:verified,reason:verified?"fresh_exact_official_body_and_amendment":"official_capture_unavailable_changed_or_current_corpus_divergent",sourceUrl:CAMARA_CP_CORRECTION.url,rawSha256:fresh?.parsed.rawSha256??null,amendmentRawSha256:fresh?CAMARA_CP_CORRECTION.amendmentRawSha256:null,observedAt:now.toISOString(),versionId:source.versionId,monitorId:source.monitorId,textId:source.textId,restoredVersions:0,questionsModified:0,flagsChanged:0}}).returning({id:schema.auditLogs.id});
      return {mode:verified?"verified":"suspended",fingerprint:command.fingerprint,auditId:audit.id,sourceVerificationSucceeded:verified,versionId:source.versionId,humanReview:false};
    },command.apply?{isolationLevel:"serializable"}:{isolationLevel:"repeatable read",accessMode:"read only"});
    console.log(JSON.stringify(result,null,2));
  } finally {await client.end();}
}
if(process.argv[1]?.endsWith("verify-cp-correction-source.ts")) void main().catch((error:unknown)=> {
  const databaseError=error instanceof Error && (error.name==="PostgresError" || "cause" in error);
  const message=error instanceof Error && !databaseError?error.message.replace(/postgres(?:ql)?:\/\/\S+/giu,"[conexão removida]"):"Falha operacional; diagnóstico privado na VPS.";
  console.error("Verificação CP bloqueada.",message);process.exitCode=1;
});
