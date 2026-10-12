import { officialQuestionContractSchema, type OfficialQuestionContract } from "@/lib/editorial/official-question-contract";
import { getStyleProfileSeed } from "@/lib/editorial/style-profiles";

export function syntheticQuestionContract(overrides:Partial<OfficialQuestionContract>={}) {
  const seed=getStyleProfileSeed('fgv')!;
  return officialQuestionContractSchema.parse({schemaVersion:1,opportunityId:1,examEditionId:1,bankId:1,organizerAssignmentId:1,
    roleName:'Cargo sintético',specializationId:null,cycleYear:2026,noticeNumber:'QA/2026',stageKey:'objective',scope:'single_role',
    sourceDocumentId:1,sourceSnapshotId:1,sourceSnapshotChecksum:'a'.repeat(64),
    sourceDocumentUrl:'https://example.invalid/synthetic',sourceDocumentChecksum:null,sourceUrl:'https://example.invalid/synthetic.pdf',
    sourcePage:1,sourceLocator:'Página sintética1',sourceQuote:'Prova fictícia sem validade: cinco alternativas distintas e uma resposta correta.',
    identityPage:1,identityQuote:'Cargo sintético de uma instituição exclusivamente fictícia para testes de software.',
    format:'multiple_choice',optionKeys:['A','B','C','D','E'],officialAnswerKeys:['A','B','C','D','E'],
    profile:{version:'synthetic-profile-v1',format:seed.format,commandStyle:seed.commandStyle,reasoningDemand:seed.reasoningDemand,
      authoringGuidelines:[...seed.authoringGuidelines],distractorGuidance:[...seed.distractorGuidance],
      prohibitedPatterns:[...seed.prohibitedPatterns],disclaimer:seed.disclaimer},...overrides});
}
