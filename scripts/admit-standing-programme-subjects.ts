import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import * as schema from '../src/lib/db/schema';
import {requireStandingCourseMaintenanceDatabaseUrl} from '../src/lib/editorial/official-course-admission';
import {OFFICIAL_COURSE_STANDING_REFERENCE} from '../src/lib/editorial/official-course-dossier';
import {admitProgrammeSubjects} from '../src/lib/editorial/programme-subject-admission';
async function main(){
 const args=new Map<string,string>();let apply=false;
 for(const arg of process.argv.slice(2)){if(arg==='--apply'&&!apply){apply=true;continue;}const match=/^--(input|actor|fingerprint)=(.+)$/u.exec(arg);if(!match||args.has(match[1]))throw Error('Argumento inválido/repetido');args.set(match[1],match[2]);}
 if(!args.get('input')||!args.get('actor'))throw Error('Input privado e administrador explícito obrigatórios');
 const raw=await readFile(args.get('input')!,'utf8');if(Buffer.byteLength(raw)>100000)throw Error('Input excede limite');
 const client=postgres(requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL),{max:1,prepare:false,connect_timeout:5});
 try{const [target]=await client`select current_user role,current_database() db`;if(target.role!=='leiprova_owner'||target.db!=='leiprova')throw Error('Alvo incorreto');
 console.log(JSON.stringify(await admitProgrammeSubjects(drizzle(client,{schema}),{input:JSON.parse(raw),actorPublicId:args.get('actor')!,approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE,mode:apply?'apply':'preview',expectedFingerprint:args.get('fingerprint')}),null,2));
 }finally{await client.end();}
}
main().catch(()=>{console.error('Catálogo não admitido: confira identidade, fontes/bytes/páginas/rótulos e fingerprint; conexão omitida.');process.exitCode=1;});
