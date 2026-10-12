import { mkdir, lstat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { fetchCamaraCpCorrectionEvidence } from "../src/lib/official-sources/camara-cp-correction-parser";
import { applyCoordinatedCpCut, previewCoordinatedCpCut, verifyCompletedCpCut } from "../src/lib/official-sources/cp-coordinated-cut-service";
import { CP_CUT_REFERENCE, parseCpCutArgs, requireCpCutDatabase } from "../src/lib/official-sources/cp-coordinated-cut";
import { parseOpportunityApprovalReviewerIdentity } from "../src/lib/opportunities/approval-command";

export async function cpCutPrivateOutput(name: string) {
  for (const path of [".local", ".local/editorial", ".local/editorial/cp-coordinated-cut"]) {
    try { const stat = await lstat(resolve(path)); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Pasta privada inválida/symlink."); }
    catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error; await mkdir(resolve(path), { mode:0o700 }); }
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(name)) throw new Error("Nome privado inválido.");
  const directory = resolve(".local/editorial/cp-coordinated-cut", name);
  await mkdir(directory, { mode:0o700 }); // Fail before any DB mutation if a receipt would be overwritten.
  return directory;
}

async function main() {
  const command = parseCpCutArgs(process.argv.slice(2));
  const url = requireCpCutDatabase(process.env.MIGRATION_DATABASE_URL);
  if (process.env.LEGAL_STANDING_REVIEW_REFERENCE !== CP_CUT_REFERENCE) throw new Error("Referência exata da autorização permanente ausente.");
  const identity = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS:process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE:CP_CUT_REFERENCE });
  const directory = await cpCutPrivateOutput(command.output);
  const fresh = await fetchCamaraCpCorrectionEvidence(); // All network outside locking TX, never cached-source approval.
  await writeFile(resolve(directory,"cp-current.html"),fresh.body.bytes,{mode:0o600,flag:"wx"});
  await writeFile(resolve(directory,"law-15517-original.html"),fresh.amendment.bytes,{mode:0o600,flag:"wx"});
  const client = postgres(url, { max:1,prepare:false,connect_timeout:5,idle_timeout:10 });
  const db = drizzle(client,{schema});
  try {
    const admins = await db.execute<{id:number;publicId:string;role:string}>(sql`select id::int as id,public_id as "publicId",role from users where ${identity.email ? sql`lower(email)=${identity.email}` : sql`role='admin'`} order by id limit 2`);
    if (admins.length!==1 || admins[0].role!=="admin") throw new Error("Exige administrador único identificado.");
    const actor = admins[0];
    const result = await db.transaction(async tx=> {
      await tx.execute(sql`set local statement_timeout='30s'`);
      await tx.execute(sql`set local lock_timeout='5s'`);
      const currentAdmins=await tx.execute<{id:number;publicId:string;role:string}>(sql`select id::int as id,public_id as "publicId",role from users where ${identity.email ? sql`lower(email)=${identity.email}` : sql`role='admin'`} order by id limit 2 ${command.apply ? sql`for share` : sql``}`);
      if(currentAdmins.length!==1 || currentAdmins[0].id!==actor.id || currentAdmins[0].publicId!==actor.publicId || currentAdmins[0].role!=="admin") throw new Error("Identidade/seleção única do administrador mudou.");

      if (command.apply) {
        const complete = await verifyCompletedCpCut(tx,fresh,command.fingerprint);
        if (complete) return { receipt:complete, private:null };
        return { receipt:await applyCoordinatedCpCut(tx,fresh,actor,command.fingerprint), private:null };
      }
      const preview = await previewCoordinatedCpCut(tx,fresh,actor);
      return { receipt:{mode:"preview",fingerprint:preview.fingerprint,articles:402,questionsWouldCorrect:5,bindingsWouldCreate:5,before:preview.current.floors.filter(f=>f.ready),after:preview.projected.filter(f=>f.ready),humanReview:false,databaseWrites:0,publicationAllowed:false,approvalReference:CP_CUT_REFERENCE},private:preview };
    },command.apply ? {isolationLevel:"serializable"} : {isolationLevel:"repeatable read",accessMode:"read only"});
    // Private full dossier never printed or sent to any model provider.
    await writeFile(resolve(directory,"result.json"),JSON.stringify(result,null,2)+"\n",{mode:0o600,flag:"wx"});
    console.log(JSON.stringify({...result.receipt,outputDirectory:directory},null,2));
  } finally { await client.end(); }
}
if(process.argv[1]?.endsWith("review-standing-cp-correction.ts")) void main().catch((error:unknown)=> {
  const databaseError=error instanceof Error && (error.name==="PostgresError" || "cause" in error);
  const detail=error instanceof Error && !databaseError ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu,"[conexão removida]") : "Falha operacional; conferir diagnóstico privado na VPS.";
  console.error("Corte coordenado CP bloqueado.",detail);process.exitCode=1;
});
