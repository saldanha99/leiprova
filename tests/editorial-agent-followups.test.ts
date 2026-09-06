import {describe,it,expect,vi} from 'vitest';
import {prepareAgentWork} from '@/lib/editorial/agent-work-preparation';
import type {AgentDatabase} from '@/lib/editorial/agent-work-queue';
describe('confirmação leve da ponte',()=>{
  it('não reprocessa corpus, portais ou fontes após confirmar uma resposta',async()=>{
    const execute=vi.fn().mockResolvedValue([]);
    const result=await prepareAgentWork({execute} as unknown as AgentDatabase,new Date(),{followupsOnly:true});
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({mappings:0,authoring:0,discovery:0,legalChanges:0,humanReviewRequired:true,publicationAllowed:false});
  });
});
