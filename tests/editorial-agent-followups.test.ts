import {describe,it,expect,vi} from 'vitest';
import {prepareAgentWork} from '@/lib/editorial/agent-work-preparation';
import type {AgentDatabase} from '@/lib/editorial/agent-work-queue';
describe('confirmação leve da ponte',()=>{
  it('não reprocessa corpus, portais ou fontes após confirmar uma resposta',async()=>{
    const execute=vi.fn().mockResolvedValue([]);
    // O lote de autoria roda numa transação de leitura com statement_timeout local (19/11/2026).
    const transaction=vi.fn(async(run:(tx:{execute:typeof execute})=>Promise<unknown>)=>run({execute}));
    const result=await prepareAgentWork({execute,transaction} as unknown as AgentDatabase,new Date(),{followupsOnly:true});
    expect(transaction).toHaveBeenCalledTimes(1);
    // Só o timeout local e a consulta do lote de autoria: nada de corpus, portais ou fontes.
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result).toEqual({mappings:0,authoring:0,discovery:0,legalChanges:0,batchSize:100,mappingExamined:0,authoringExamined:0,
      mappingHasMore:false,authoringHasMore:false,hasMore:false,humanReviewRequired:true,publicationAllowed:false});
  });
});
