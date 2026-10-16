import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe,it,expect } from "vitest";
import { syntheticQuestionContract } from "./fixtures/question-contract";
import { PC_MA_DELEGADO_MULTIPLE_CHOICE_PROFILE, officialQuestionContractSchema,questionContractFingerprint,validateQuestionAgainstContract,officialFormatEvidenceMatches } from "@/lib/editorial/official-question-contract";
import { getStyleProfileSeed } from "@/lib/editorial/style-profiles";
import { approvedProductQuestionExists } from "@/lib/commerce/product-binding-query";
import { evaluateOriginalQuestionApproval } from "@/lib/editorial/approval-eligibility";
import { originalStyleConditions } from "@/lib/quiz/original-style-query";
import { authorialStudyRightsConditions } from "@/lib/study/question-rights";
import { approvedBindingQuestionContractExists, currentQuestionContractExists, questionOptionsMatchContract } from "@/lib/editorial/question-contract-query";

const options=['A','B','C','D','E'].map((key,index)=>({key,text:`Alternativa sintética ${index}`,correct:index===0}));
describe('contrato oficial por cargo/edição/etapa',()=>{
  it('reconhece a instrução MC5 sem aceitar negação ou apenas palavras soltas',()=>{
    const clause='As questões objetivas têm 5 (cinco) opções de resposta (A, B, C, D e E) e somente uma delas está correta.';
    expect(officialFormatEvidenceMatches('multiple_choice',clause)).toBe(true);
    expect(officialFormatEvidenceMatches('multiple_choice',clause.replace('e somente','e não somente'))).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice','Não é verdade que '+clause)).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice',clause.replace('está correta','não está correta'))).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice','Cinco opções. Somente uma delas está correta.')).toBe(false);
  });
  it('só admite cláusula que confirma o formato, sem misturar objetiva e outra etapa',()=>{
    expect(officialFormatEvidenceMatches('multiple_choice','Cada questão terá cinco opções A, B, C, D e E. Marque um, e somente um campo.')).toBe(true);
    expect(officialFormatEvidenceMatches('multiple_choice','A prova contém 5 (cinco) alternativas e apenas uma resposta correta.')).toBe(true);
    expect(officialFormatEvidenceMatches('multiple_choice','A prova contém cinco alternativas, sem definição de resposta única.')).toBe(false);
    expect(officialFormatEvidenceMatches('true_false','O julgamento de cada item será CERTO ou ERRADO.')).toBe(true);
    expect(officialFormatEvidenceMatches('multiple_choice','O julgamento de cada item será CERTO ou ERRADO.')).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice','Uma etapa terá cinco opções; outra terá julgamento CERTO ou ERRADO.')).toBe(false);
  });
  it('PC-MA admite MC5 sem alterar o C/E global ou presumir o formato por banca',()=>{
    const c=syntheticQuestionContract({profile:PC_MA_DELEGADO_MULTIPLE_CHOICE_PROFILE});
    expect(validateQuestionAgainstContract(c,{type:'multiple_choice',options}).allowed).toBe(true);
    expect(validateQuestionAgainstContract(c,{type:'true_false',options:options.slice(0,2)}).allowed).toBe(false);
    expect(getStyleProfileSeed('cebraspe')?.format).toBe('true_false');
  });
  it('admite a redação do TJ-RS sem confundir quantidade de alternativas e respostas corretas',()=>{
    const clause='Cada questão com 5 (cinco) alternativas de resposta,\ndas quais apenas 1 (uma) será correta.';
    expect(officialFormatEvidenceMatches('multiple_choice',clause)).toBe(true);
    expect(officialFormatEvidenceMatches('true_false',clause)).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice',clause.replace('1 (uma)','2 (duas)'))).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice',clause.replace('será correta','não será correta'))).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice',clause+' Outra etapa terá julgamento CERTO ou ERRADO.')).toBe(false);
    expect(officialFormatEvidenceMatches('multiple_choice','Cada questão com 5 (cinco) alternativas de resposta, das quais apenas 1 (uma) será assinalada.')).toBe(false);
  });
  it('TC-DF exige C/E com códigos oficiais C/E e internos A/B explícitos',()=>{
    const base=syntheticQuestionContract(),c=syntheticQuestionContract({format:'true_false',optionKeys:['A','B'],officialAnswerKeys:['C','E'],profile:{...base.profile,format:'true_false'}});
    expect(validateQuestionAgainstContract(c,{type:'true_false',options:[{key:'A',text:'Certo',correct:true},{key:'B',text:'Errado',correct:false}]}).allowed).toBe(true);
    expect(validateQuestionAgainstContract(c,{type:'multiple_choice',options}).allowed).toBe(false);
    expect(validateQuestionAgainstContract(c,{type:'true_false',options:[{key:'A',text:'Errado',correct:true},{key:'B',text:'Certo',correct:false}]}).allowed).toBe(false);
  });
  it('contrato desconhecido e tipo mecânico legado não ganham formato inferido',()=>{
    expect(validateQuestionAgainstContract(undefined,{type:'multiple_choice',options}).allowed).toBe(false);
    expect(validateQuestionAgainstContract(syntheticQuestionContract(),{type:'literal_exact',options}).allowed).toBe(false);
  });
  it.each(['roleName','noticeNumber','sourceLocator','sourceQuote'] as const)('fingerprint muda ao editar %s',key=>{
    const c=syntheticQuestionContract();expect(questionContractFingerprint(c)).not.toBe(questionContractFingerprint({...c,[key]:c[key]+' alterado'}));
  });
  it('não aceita etapa/cargo genérico multitrilha ou quatro opções por fallback',()=>{
    expect(officialQuestionContractSchema.safeParse({...syntheticQuestionContract(),scope:'all_roles'}).success).toBe(false);
    expect(officialQuestionContractSchema.safeParse({...syntheticQuestionContract(),optionKeys:['A','B','C','D']}).success).toBe(false);
  });
  it('guarda comercial verifica formato/versão/fonte/hash também para dry_law',()=>{
    const q=new PgDialect().sqlToQuery(approvedProductQuestionExists(sql`product.slug`,sql`q.id`));
    expect(q.sql).toContain('question_contract_certifications verified_binding_contract_certificate');
    expect(q.sql).toContain('verified_binding_contract_certificate.question_content_hash=');
    expect(q.sql).toContain("current_scoped_contract.source_snapshot_checksum");
    expect(q.sql).toContain("format_contract.format=certified_contract_question.type");
    expect(q.sql).not.toContain("q.quiz_mode = 'dry_law' or exists");
    expect(q.sql).not.toContain('profile.format = q.type');
  });
  it.each(['binding','q','product','opportunity','requirement','source','snapshot','article','version','act','covered','option'])('o vínculo comercial preserva a correlação externa %s',alias=>{
    const query=new PgDialect().sqlToQuery(approvedProductQuestionExists(sql.raw(`${alias}.product_slug`),sql.raw(`${alias}.question_id`),sql.raw(`${alias}.opportunity_id`),sql.raw(`${alias}.id`))).sql;
    expect(query).toContain(`verified_product_binding.product_slug = ${alias}.product_slug`);
    expect(query).toContain(`verified_product_binding.question_id = ${alias}.question_id`);
    expect(query).toContain(`verified_product_binding.opportunity_id = ${alias}.opportunity_id`);
    expect(query).toContain(`verified_product_binding.id = ${alias}.id`);
    expect(query).not.toMatch(/\b(?:from|join) [a-z_]+ (?:binding|q|product|opportunity|requirement|source|snapshot|article|version|act|covered|option)\b/u);
  });
  it('certificação resolve a questão externa explicitamente sem depender de alias q do chamador',()=>{
    const query=new PgDialect().sqlToQuery(approvedBindingQuestionContractExists(sql`binding.id`,sql`outside_question.id`,sql`binding.opportunity_id`)).sql;
    expect(query).toContain('join questions certified_contract_question on certified_contract_question.id=outside_question.id');
    expect(query).toContain('verified_binding_contract_certificate.binding_id=binding.id');
    expect(query).toContain('current_scoped_contract.opportunity_id=binding.opportunity_id');
    expect(query).not.toMatch(/\bq\./u);
  });
  it('normaliza whitespace SQL sem transformar a letra s em separador',()=>{
    const query=new PgDialect().sqlToQuery(questionOptionsMatchContract(sql`external.id`,sql`external.type`,sql`external.contract_id`)).sql;
    expect(query).toContain("regexp_replace(btrim(qo.text),'[[:space:]]+',' ','g')");
    expect(query).not.toContain("regexp_replace(btrim(qo.text),'s+'");
  });
  it('quiz genérico e recorte de edição revalidam o contrato sem forçar C/E pela banca',()=>{
    const dialect=new PgDialect();
    const bank=dialect.sqlToQuery(originalStyleConditions({bankId:4},null)!).sql;
    const edition=dialect.sqlToQuery(originalStyleConditions({bankId:4},33)!);
    expect(bank).toContain('opportunity_question_contracts study_contract');
    expect(bank).toContain("current_scoped_contract.status='approved'");
    expect(bank).toContain('question_contract_certifications study_cert');
    expect(bank).not.toContain('question_style_profiles');
    expect(edition.sql).toContain('study_contract.exam_edition_id=');expect(edition.params).toContain(33);
    const study=dialect.sqlToQuery(authorialStudyRightsConditions()!).sql;
    expect(study).toContain('opportunity_question_contracts study_contract');
    expect(study).toContain('"questions"."quiz_mode" =');
  });
  it('a regra compartilhada de aprovação bloqueia um contrato suspenso',()=>{
    const c=syntheticQuestionContract();
    const candidate={publicId:'synthetic',status:'pending_review',creatorUserId:1,cleanRoomAttestedAt:new Date(),type:'multiple_choice',
      questionSourceRights:'original_authorial',originalityCheckedAt:new Date(),similarityMaxBps:0,articleStatus:'reviewed',articleSourceRights:'official_text',
      versionStatus:'current',sourceUrl:'https://example.invalid/synthetic',actIsActive:true,profileFormat:'true_false',profileIsActive:true,bankIsActive:true,
      optionTotal:5,optionCorrect:1,questionContractId:questionContractFingerprint(c),questionContract:c,questionContractIsCurrent:true,styleBankId:c.bankId,options};
    expect(evaluateOriginalQuestionApproval(candidate).allowed).toBe(true);
    expect(evaluateOriginalQuestionApproval({...candidate,questionContractIsCurrent:false}).allowed).toBe(false);
  });
  it.each(['qc','co','ce','cs','sn','ca','cb','examiner'])('a correlação externa %s não é ocultada por aliases internos',alias=>{
    const query=new PgDialect().sqlToQuery(currentQuestionContractExists(sql.raw(`${alias}.id`),sql.raw(`${alias}.opportunity_id`))).sql;
    expect(query).toContain(`current_scoped_contract.id=${alias}.id`);
    expect(query).toContain(`current_scoped_contract.opportunity_id=${alias}.opportunity_id`);
    expect(query).not.toMatch(/\b(?:from|join) [a-z_]+ (?:qc|co|ce|cs|sn|ca|cb|examiner)\b/u);
    expect(query).toContain("current_scoped_contract.status='approved'");
  });
});
