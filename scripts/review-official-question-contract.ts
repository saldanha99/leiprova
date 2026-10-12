import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { reviewOfficialQuestionContract } from "../src/lib/editorial/official-question-contract-review";

async function main() {
  const args=new Map<string,string>();let apply=false;
  for(const item of process.argv.slice(2)) {
    if(item==='--apply'&&!apply){apply=true;continue;}
    const match=/^--(input|actor|fingerprint)=(.+)$/u.exec(item);
    if(!match || args.has(match[1])) throw new Error("Use --input=ARQUIVO --actor=UUID; --apply exige --fingerprint=SHA256 do preview.");
    args.set(match[1],match[2]);
  }
  const path=args.get('input');if(!path || !args.get('actor')) throw new Error("Arquivo privado e administrador explícito obrigatórios.");
  const raw=await readFile(path,'utf8');if(Buffer.byteLength(raw)>65536) throw new Error("Dossiê excede o limite permitido.");
  const databaseUrl=requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:5,idle_timeout:10});
  try {
    const [identity]=await client`select current_database() as name,current_user as username`;
    if(identity.name!=='leiprova'||identity.username!=='leiprova_owner') throw new Error("Identidade do banco não corresponde ao projeto.");
    const result=await reviewOfficialQuestionContract(drizzle(client,{schema}),{input:JSON.parse(raw),actorPublicId:args.get('actor')!,
      approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE,mode:apply?'apply':'preview',expectedFingerprint:args.get('fingerprint')});
    console.log(JSON.stringify(result,null,2));
  }finally{await client.end();}
}
main().catch(()=>{console.error("Contrato não aplicado. Confira identidade, fonte/página/trechos, formatos e fingerprint da prévia; dados de conexão foram omitidos.");process.exitCode=1;});
