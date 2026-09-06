import { describe,it,expect } from "vitest";
import { AGENT_WORK_VERSION,agentInputHash,validateAgentWorkResult,validateDiscoveryUrl,
  type AgentWorkPayload } from "@/lib/editorial/agent-work-contract";

const payload:AgentWorkPayload={version:AGENT_WORK_VERSION,title:"Concurso sintético",instructions:"Somente teste.",
  context:{requirement:"Regra sintética",sourceContextHash:"a".repeat(64)},requirementId:1,opportunityId:1,
  bank:"vunesp",role:"Cargo sintético",sourceUrls:["https://conhecimento.fgv.br/concursos/exemplo"],
  articles:[{id:1,act:"Regra sintética",articleRef:"Art. 1",versionId:1,checksum:"b".repeat(64),
    text:"No exercício fictício, a equipe deve organizar os cartões antes da atividade.",url:"https://www.planalto.gov.br/exemplo"}]};
const base={schemaVersion:1,publicationAllowed:false,outcome:"prepared",summary:"Proposta para revisão humana.",limitations:[],evidence:[]};
function question(){return {prompt:"No exercício inteiramente fictício, qual conduta deve preceder a atividade?",articleId:1,
  quote:payload.articles[0].text,explanation:"A regra sintética determina que os cartões sejam organizados antes da atividade.",difficulty:"easy",
  options:["Organizar cartões","Guardar a tarefa","Ignorar cartões","Começar sem preparo","Interromper todos"]
    .map((text,index)=>({key:"ABCDE"[index],text,correct:index===0,rationale:"Justificativa sintética para verificar o contrato."}))};}
describe("contrato da ponte editorial",()=>{
  it("hash estável apesar da ordem de propriedades",()=>{
    expect(agentInputHash(payload)).toBe(agentInputHash({...payload,context:{sourceContextHash:"a".repeat(64),requirement:"Regra sintética"}}));
    expect(agentInputHash(payload)).not.toBe(agentInputHash({...payload,role:"Outro cargo"}));
  });
  it("aceita proposta legal com citação presente no corpus",()=>{
    expect(validateAgentWorkResult("legal_mapping",payload,{...base,mappings:[{articleId:1,quote:payload.articles[0].text,rationale:"Vínculo proposto, sem revisão humana presumida."}]}).mappings).toHaveLength(1);
  });
  it.each(["fonte inventada com texto muito comprido", ""])("rejeita citação ausente %s",quote=>{
    expect(()=>validateAgentWorkResult("legal_mapping",payload,{...base,mappings:[{articleId:1,quote,rationale:"Exemplo."}]})).toThrow();
  });
  it("recusa artigo de outro pacote",()=>{
    expect(()=>validateAgentWorkResult("legal_mapping",payload,{...base,mappings:[{articleId:2,quote:payload.articles[0].text,rationale:"Exemplo."}]})).toThrow();
  });
  it("não aceita declaração de publicação nem campos de aprovação",()=>{
    expect(()=>validateAgentWorkResult("legal_change",payload,{...base,publicationAllowed:true})).toThrow();
    expect(()=>validateAgentWorkResult("legal_change",payload,{...base,humanApproved:true})).toThrow();
  });
  it("permite bloqueio explícito, sem propostas",()=>{
    expect(validateAgentWorkResult("authoring",payload,{...base,outcome:"blocked",limitations:["Falta fonte oficial."]}).outcome).toBe("blocked");
    expect(()=>validateAgentWorkResult("authoring",payload,{...base,outcome:"blocked",limitations:[]})).toThrow();
  });
  it("valida autoria sem publicar",()=>{
    expect(validateAgentWorkResult("authoring",payload,{...base,generatorModel:"synthetic-test",questions:[question()]}).questions).toHaveLength(1);
  });
  it("rejeita cargo, banco, modelo, resposta ou alternativas incorretos",()=>{
    const q=question();
    for(const modified of [{...payload,role:undefined},{...payload,bank:undefined}])
      expect(()=>validateAgentWorkResult("authoring",modified,{...base,generatorModel:"test",questions:[q]})).toThrow();
    expect(()=>validateAgentWorkResult("authoring",payload,{...base,questions:[q]})).toThrow();
    expect(()=>validateAgentWorkResult("authoring",payload,{...base,generatorModel:"test",questions:[{...q,options:q.options.map(x=>({...x,correct:true}))}]})).toThrow();
    expect(()=>validateAgentWorkResult("authoring",payload,{...base,generatorModel:"test",questions:[q,q]})).toThrow();
  });
  it("não transfere respostas entre papéis",()=>{
    expect(()=>validateAgentWorkResult("discovery",payload,{...base,generatorModel:"test",questions:[question()]})).toThrow();
  });
  it.each(["https://www.concursosfcc.com.br/concursos/exemplo/", "https://www.concursosfcc.com.br/edital.pdf", "https://conhecimento.fgv.br/search/teste", "http://www.vunesp.com.br/","https://www.vunesp.com.br.attacker.test/","https://user:password@www.vunesp.com.br/","https://www.vunesp.com.br:444/","https://www.vunesp.com.br/gabarito.pdf","https://127.0.0.1/"])("rejeita descoberta fora do escopo %s",url=>{
    expect(()=>validateDiscoveryUrl(url)).toThrow();
  });
  it("aceita somente portais e origens oficiais configuradas",()=>{
    expect(validateDiscoveryUrl("https://www.vunesp.com.br/?b=v")).toContain("vunesp.com.br");
    expect(validateDiscoveryUrl("https://www.cebraspe.org.br/concursos/")).toContain("cebraspe.org.br");
  });
});
