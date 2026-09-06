import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";
import * as schema from "../src/lib/db/schema";
import { agentWorkSummary, claimAgentWork, completeAgentWork } from "../src/lib/editorial/agent-work-queue";
import { prepareAgentWork } from "../src/lib/editorial/agent-work-preparation";

async function main() {
  const mode=process.argv[2]?.replace(/^--mode=/,"");
  const agent=process.argv[3]?.replace(/^--agent=/,"");
  if(!["prepare","claim","complete","status"].includes(mode??"") || process.argv.length>4 ||
    (agent && (mode!=="claim" || !["Radar","Guardião","Autor"].includes(agent) || !process.argv[3].startsWith("--agent=")))) throw new Error("Modo inválido.");
  if(process.env.EDITORIAL_AGENT_BRIDGE_ENABLED!=="true") throw new Error("Ponte editorial desativada.");
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error("Banco não configurado.");
  const client=postgres(url,{max:1,prepare:false,connect_timeout:10,idle_timeout:10});
  try {
    const db=drizzle(client,{schema});
    const [identity]=await db.execute<{name:string;role:string;superuser:boolean}>(sql`
      select current_database() name,current_user role,(select rolsuper from pg_roles where rolname=current_user) superuser
    `);
    if(identity.name!=="leiprova" || identity.role!=="leiprova_app" || identity.superuser) throw new Error("Destino/privilégios não autorizados.");
    let result:unknown;
    if(mode==="prepare") result=await prepareAgentWork(db);
    else if(mode==="claim") result=await claimAgentWork(db,new Date(),agent);
    else if(mode==="status") result=await agentWorkSummary(db);
    else {
      let text="";
      for await(const chunk of process.stdin) {
        text+=String(chunk);
        if(Buffer.byteLength(text)>262144) throw new Error("Resposta excede o limite.");
      }
      const request=z.object({jobKey:z.string().regex(/^[a-z0-9:._-]{1,220}$/),
        inputHash:z.string().regex(/^[a-f0-9]{64}$/),leaseToken:z.uuid(),result:z.unknown()}).strict().parse(JSON.parse(text));
      result=await completeAgentWork(db,request);
      // A saída do Guardião abastece automaticamente a próxima etapa, sem revisar/publicar.
      await prepareAgentWork(db);
    }
    console.log(JSON.stringify(result));
  } finally {await client.end();}
}
main().catch(()=>{console.error("Operação editorial não concluída. Confira destino, reserva, contrato e fontes; nenhum segredo é registrado.");process.exitCode=1;});
