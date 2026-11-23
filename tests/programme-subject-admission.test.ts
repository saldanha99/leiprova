import {describe,it,expect} from 'vitest';
import {ADDITIONAL_PROGRAMME_SUBJECTS,subjectAdmissionInputSchema,assertSubjectLabelProof,assertApprovedProgrammeSourceUrls} from '@/lib/editorial/programme-subject-admission';
const proof={opportunityId:7,roleName:'Juiz Federal Substituto',examEditionId:25,sourceDocumentId:10,snapshotId:356,url:'https://conhecimento.fgv.br/sites/default/files/synthetic.pdf',checksum:'a'.repeat(64),headingPage:1,headingQuote:'DIREITO PREVIDENCIÁRIO'};
const input={schemaVersion:1,subjects:[{slug:'direito-previdenciario',name:'Direito Previdenciário',proofs:[proof]}]};
describe('rótulos oficiais e admissão da taxonomia',()=>{
 it('aceita somente nomes e cargos expressamente delimitados',()=>{expect(subjectAdmissionInputSchema.parse(input).subjects).toHaveLength(1);expect(Object.keys(ADDITIONAL_PROGRAMME_SUBJECTS)).toHaveLength(35);});
 it('PCPR: título numerado inline; outro texto depois do título é recusado',()=>{
  expect(()=>assertSubjectLabelProof('direito-penal-aplicado','7. DIREITO PENAL APLICADO: 7.1 Princípios básicos','7. DIREITO PENAL APLICADO: 7.1 Princípios básicos')).not.toThrow();
  expect(()=>assertSubjectLabelProof('direito-processual-penal-e-legislacao-processual-penal-extravagante','7. DIREITO PROCESSUAL PENAL E LEGISLAÇÃO PROCESSUAL PENAL EXTRAVAGANTE:','7. DIREITO PROCESSUAL PENAL E LEGISLAÇÃO PROCESSUAL PENAL EXTRAVAGANTE:')).not.toThrow();
  expect(()=>assertSubjectLabelProof('direito-penal-aplicado','7. DIREITO PENAL APLICADO: prosa qualquer','7. DIREITO PENAL APLICADO: prosa qualquer')).toThrow();
 });
 it('PCDF: título inline abre o item 1; menção em prosa ou título sem item continuam recusados',()=>{
  expect(()=>assertSubjectLabelProof('medicina-legal','MEDICINA LEGAL: 1 Perícia e peritos.','x\nMEDICINA LEGAL: 1 Perícia e peritos.\ny')).not.toThrow();
  expect(()=>assertSubjectLabelProof('direito-penal-e-legislacao-complementar','DIREITO PENAL E LEGISLAÇÃO COMPLEMENTAR: 1 Princípios.','DIREITO PENAL E LEGISLAÇÃO COMPLEMENTAR: 1 Princípios.')).not.toThrow();
  expect(()=>assertSubjectLabelProof('medicina-legal','MEDICINA LEGAL: 1 ','MEDICINA LEGAL: 1 ')).toThrow();
  expect(()=>assertSubjectLabelProof('direito-civil-e-legislacao-complementar','DIREITO CIVIL E LEGISLAÇÃO COMPLEMENTAR: I DIREITO CIVIL: 1 Lei','DIREITO CIVIL E LEGISLAÇÃO COMPLEMENTAR: I DIREITO CIVIL: 1 Lei')).not.toThrow();
  expect(()=>assertSubjectLabelProof('direito-do-consumidor','DIREITO DO CONSUMIDOR: 1 Teoria.','DIREITO DO CONSUMIDOR: 1 Teoria.')).toThrow();
  expect(()=>assertSubjectLabelProof('direito-do-consumidor','DIREITO DO CONSUMIDOR','DIREITO DO CONSUMIDOR')).not.toThrow();
 });
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
 it.each([
  ['etica-e-estatuto-juridico-da-magistratura-nacional','C) ÉTICA E ESTATUTO JURÍDICO DA MAGISTRATURA NACIONAL'],
  ['direito-da-infancia-e-juventude','4.1 – Direito da Infância e Juventude'],
  ['tutela-coletiva','4.2 – Tutela Coletiva'],
  ['principios-institucionais-do-ministerio-publico','4.3 – Princípios Institucionais do Ministério Público'],
  ['legislacao-penal-extravagante','1.3 – Legislação Penal Extravagante'],
  ['legislacao-tributaria-estadual','LEGISLAÇÃO TRIBUTÁRIA ESTADUAL: 1 Lei Estadual nº 5.900/1996 (ICMS), e suas alterações. 2 Lei'],
  ['reforma-tributaria','REFORMA TRIBUTÁRIA: 1 Emenda Constitucional nº 132/2023. 2 Lei Complementar nº 214/2025. 3 Lei'],
  ['direito-civil-e-direito-empresarial','DIREITO CIVIL E DIREITO EMPRESARIAL - Ponto 1. Lei de Introdução às Normas do Direito Brasileiro (Decreto'],
 ] as const)('prova a linha integral com sintaxe delimitada de %s',(slug,line)=>{
  expect(()=>assertSubjectLabelProof(slug,line,`Cabeçalho\n${line}\nOutra linha`)).not.toThrow();
  expect(()=>assertSubjectLabelProof(slug,line,`Esta prosa menciona ${line}`)).toThrow();
  expect(()=>assertSubjectLabelProof(slug,line,`${line} texto adicional omitido da prova`)).toThrow();
 });
 it('não aceita número de seção diferente, título parcial ou menção genérica',()=>{
  for(const [slug,line] of [
   ['tutela-coletiva','4.3 – Tutela Coletiva'],
   ['etica-e-estatuto-juridico-da-magistratura-nacional','F) Ética e Estatuto Jurídico da Magistratura Nacional'],
   ['reforma-tributaria','Reforma Tributária: assunto citado no texto'],
   ['direito-civil-e-direito-empresarial','Direito Civil e Direito Empresarial e Direito Penal - Ponto 1. Exemplo'],
  ] as const)expect(()=>assertSubjectLabelProof(slug,line,line)).toThrow();
 });
 it('distingue portal permitido e PDF oficial direto aprovado, recusando origens ou correlações falsas',()=>{
  const pdf='https://conhecimento.fgv.br/sites/default/files/concursos/aviso-conteudo-programatico-concurso-xxxix.pdf';
  expect(()=>assertApprovedProgrammeSourceUrls(pdf,pdf,'official_document','fgv-conhecimento')).not.toThrow();
  expect(()=>assertApprovedProgrammeSourceUrls('https://conhecimento.fgv.br/concursos/pgeac',pdf,'metadata_only','fgv-conhecimento')).not.toThrow();
  expect(()=>assertApprovedProgrammeSourceUrls(pdf,pdf,'metadata_only','fgv-conhecimento')).toThrow();
  expect(()=>assertApprovedProgrammeSourceUrls(pdf,pdf+'x','official_document','fgv-conhecimento')).toThrow();
  expect(()=>assertApprovedProgrammeSourceUrls('https://untrusted.invalid/a.pdf','https://untrusted.invalid/a.pdf','official_document','fgv-conhecimento')).toThrow();
  expect(()=>assertApprovedProgrammeSourceUrls(pdf,pdf,'official_document','cebraspe')).toThrow();
 });
 it('rejeita duplicidade e campos externos ao contrato',()=>{
  expect(()=>subjectAdmissionInputSchema.parse({...input,subjects:[...input.subjects,...input.subjects]})).toThrow();
  expect(()=>subjectAdmissionInputSchema.parse({...input,questionsApproved:20})).toThrow();
 });
});
