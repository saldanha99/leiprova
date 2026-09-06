import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { mkdir, open, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { agentWorkKindSchema, validateAgentWorkResult, workPayloadSchema, AGENT_FOR_WORK } from "../src/lib/editorial/agent-work-contract";
import { settleLocalAgentResults } from "../src/lib/editorial/local-agent-results";

const root=fileURLToPath(new URL("../",import.meta.url));
const queueRoot=path.join(root,".local/maestri/queue");
const claimSchema=z.object({state:z.literal("claimed"),agent:z.string(),job:z.object({
  jobKey:z.string().regex(/^[a-z0-9:._-]{1,220}$/),kind:agentWorkKindSchema,
  inputHash:z.string().regex(/^[a-f0-9]{64}$/),payload:workPayloadSchema,
  leaseToken:z.uuid(),leaseExpiresAt:z.string(),
})});

function remote(mode:"claim"|"complete"|"status",input?:unknown,agent?:string) {
  if(agent && !["Radar","Guardião","Autor"].includes(agent)) throw new Error("Papel incompatível.");
  const child=spawnSync("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=10","wisewolf-vps",
    `docker exec ${input===undefined?"":"-i "}leiprova-editorial-automation ./node_modules/.bin/tsx --env-file-if-exists=.env scripts/editorial-agent-work.ts --mode=${mode}${agent?` --agent=${agent}`:""}`],
  {encoding:"utf8",timeout:120000,maxBuffer:1048576,input:input===undefined?undefined:JSON.stringify(input)});
  if(child.status!==0) throw new Error("Ponte indisponível: verifique SSH e worker. Não fazer fallback pago.");
  return JSON.parse(child.stdout) as unknown;
}
async function readPrivateJson(file:string) {
  const resolved=await realpath(file);
  const allowed=await realpath(queueRoot);
  if(!resolved.startsWith(allowed+path.sep)) throw new Error("Arquivo fora da fila deste projeto.");
  const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const info=await handle.stat();
    if(!info.isFile() || info.size>524288) throw new Error("Arquivo inválido ou grande demais.");
    return JSON.parse(await handle.readFile("utf8")) as unknown;
  }finally{await handle.close();}
}
async function completePacket(packet:string) {
  if(path.basename(packet)!=="packet.json") throw new Error("Use o packet.json reservado.");
  const claim=claimSchema.parse(await readPrivateJson(packet));
  const result=validateAgentWorkResult(claim.job.kind,claim.job.payload,
    await readPrivateJson(path.join(path.dirname(packet),"response.json")));
  const receipt=remote("complete",{jobKey:claim.job.jobKey,inputHash:claim.job.inputHash,
    leaseToken:claim.job.leaseToken,result});
  await writeFile(path.join(path.dirname(packet),"receipt.json"),JSON.stringify(receipt,null,2),{mode:0o600});
  return receipt;
}
async function main() {
  const mode=process.argv[2];
  if(mode==="--mode=poll" && (process.argv.length===3 || (process.argv.length===4 && process.argv[3].startsWith("--agent=")))) {
    const response=remote("claim",undefined,process.argv[3]?.replace(/^--agent=/,""));
    const parsed=claimSchema.safeParse(response);
    if(!parsed.success) {
      const idle=z.object({state:z.enum(["idle","budget_exhausted"])}).parse(response);
      console.log(JSON.stringify(idle));process.exitCode=3;return;
    }
    const claim=parsed.data;
    if(claim.agent!==AGENT_FOR_WORK[claim.job.kind]) throw new Error("Papel incompatível.");
    const directory=path.join(queueRoot,claim.job.leaseToken);
    await mkdir(directory,{recursive:true,mode:0o700});
    const packet=path.join(directory,"packet.json");
    await writeFile(packet,JSON.stringify(claim,null,2),{mode:0o600,flag:"wx"});
    const responsePath=path.join(directory,"response.json");
    console.log(JSON.stringify({agent:claim.agent,jobKey:claim.job.jobKey,packet,responsePath,
      instruction:"Leia docs/MAESTRI-MOTORES-AUTOMATICOS.md. Execute somente esta tarefa e salve response.json no contrato indicado. Não publicar, não modificar banco, não compartilhar segredos."}));
  } else if(mode==="--mode=complete" && process.argv.length===4) {
    const packet=path.resolve(process.argv[3]);
    console.log(JSON.stringify(await completePacket(packet)));
  } else if(mode==="--mode=settle" && process.argv.length===4 && process.argv[3].startsWith("--agent=")) {
    console.log(JSON.stringify(await settleLocalAgentResults(queueRoot,process.argv[3].slice(8),completePacket)));
  } else if(mode==="--mode=status" && process.argv.length===3) console.log(JSON.stringify(remote("status")));
  else throw new Error("Use --mode=poll, --mode=status ou --mode=complete CAMINHO_PACKET.");
}
main().catch((error:unknown)=>{console.error(error instanceof Error && /^(Ponte indisponível|Use |Arquivo |Papel |Fundamento |Reserva )/.test(error.message)?error.message:"Falha segura na ponte editorial; nenhum conteúdo foi publicado.");process.exitCode=1;});
