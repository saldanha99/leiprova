import {describe,it,expect} from 'vitest';
import {ADDITIONAL_PROGRAMME_SUBJECTS,subjectAdmissionInputSchema,assertSubjectLabelProof} from '@/lib/editorial/programme-subject-admission';
const proof={opportunityId:7,roleName:'Juiz Federal Substituto',examEditionId:25,sourceDocumentId:10,snapshotId:356,url:'https://conhecimento.fgv.br/sites/default/files/synthetic.pdf',checksum:'a'.repeat(64),headingPage:1,headingQuote:'DIREITO PREVIDENCIÁRIO'};
const input={schemaVersion:1,subjects:[{slug:'direito-previdenciario',name:'Direito Previdenciário',proofs:[proof]}]};
describe('rótulos oficiais e admissão da taxonomia',()=>{
 it('aceita somente nomes e cargos expressamente delimitados',()=>{expect(subjectAdmissionInputSchema.parse(input).subjects).toHaveLength(1);expect(Object.keys(ADDITIONAL_PROGRAMME_SUBJECTS)).toHaveLength(20);});
 it('não cria sinônimos, combinações genéricas ou cargos de outra preparação',()=>{
  for(const value of [{...input,subjects:[{...input.subjects[0],name:'Legislação Especial'}]},{...input,subjects:[{...input.subjects[0],proofs:[{...proof,roleName:'Delegado'}]}]}])expect(()=>subjectAdmissionInputSchema.parse(value)).toThrow();
 });
 it('exige linha literal completa e preserva acentos',()=>{
  expect(()=>assertSubjectLabelProof('direito-previdenciario',proof.headingQuote,'Cabeçalho\nDireito Previdenciário\n1. Conteúdo.')).not.toThrow();
  expect(()=>assertSubjectLabelProof('direito-previdenciario',proof.headingQuote,'Este texto menciona Direito Previdenciário no corpo.')).toThrow();
  expect(()=>assertSubjectLabelProof('direito-previdenciario','Direito Previdenciario','Direito Previdenciario')).toThrow();
 });
 it('remove prefixo de seção somente no nome de catálogo, conservando a prova exata',()=>{
  expect(()=>assertSubjectLabelProof('direito-digital','F) DIREITO DIGITAL','F) Direito Digital')).not.toThrow();
  expect(()=>assertSubjectLabelProof('direito-digital','DIREITO DIGITAL','Direito Digital')).toThrow();
  expect(()=>assertSubjectLabelProof('direito-da-antidiscriminacao','H) DIREITO DA ANTIDISCRIMINAÇÃO','H) Direito da Antidiscriminação')).not.toThrow();
 });
 it('mantém disciplinas compostas distintas e não as reparte',()=>{
  expect(()=>assertSubjectLabelProof('direito-civil-e-empresarial','Direito Civil','Direito Civil')).toThrow();
  expect(()=>assertSubjectLabelProof('direito-civil-e-empresarial','Direito Civil e Empresarial','Direito Civil e Direito Empresarial')).toThrow();
 });
 it('rejeita duplicidade e campos externos ao contrato',()=>{
  expect(()=>subjectAdmissionInputSchema.parse({...input,subjects:[...input.subjects,...input.subjects]})).toThrow();
  expect(()=>subjectAdmissionInputSchema.parse({...input,questionsApproved:20})).toThrow();
 });
});
