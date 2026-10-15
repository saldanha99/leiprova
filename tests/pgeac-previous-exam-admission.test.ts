import { readFileSync } from "node:fs";
import { describe,it,expect,vi,afterEach } from "vitest";
const state=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock("postgres",()=>({default:state.connect}));
import { PGEAC_OFFICIAL_PREVIOUS_EXAM as target,assertPgeacOfficialAnchors,assertPgeacNoticeEvidence,assertPgeacRegistrationRequest,previewPgeacPreviousExam } from "@/lib/exams/pgeac-previous-exam-admission";
import { parsePgeacPreviousExamArgs } from "../scripts/register-pgeac-previous-exam-links";
import { parsePreviousExamLinkCommand } from "@/lib/exams/previous-exam-link-command";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";
const html=`<h1>Concurso Público para a Procuradoria-Geral do Estado do Acre</h1><a href="${target.portalNoticeUrl}">Edital (retificado em 23/03/2026)</a>${target.documents.map(doc=>`<div class="paragraph--type--texto-data"><time datetime="${doc.publishedOn}T12:00:00Z"></time>Prova Objetiva Procurador do Estado do Acre <a href="${doc.url}">${doc.label}</a></div>`).join('')}`;
const verifier=vi.fn(async(_bank:string,url:string)=>({httpStatus:200,isPdf:true,finalUrl:url,checkedAt:new Date(),contentType:'application/pdf',pageTitle:null}));
const fetcher=vi.fn(async(url:Parameters<typeof fetch>[0])=>{const robots=String(url).endsWith('robots.txt');const response=new Response(robots?'User-agent: *\nDisallow: /search/':html,{status:200,headers:{'content-type':robots?'text/plain':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response;});
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
describe('cadastro delimitado PGE-AC VIII/2026',()=>{
  it('separa data de aplicação das datas de publicação do caderno e gabarito DEFINITIVO',()=>{
    expect(()=>assertPgeacOfficialAnchors(html)).not.toThrow();
    expect(target.examDate).toBe('2026-05-24');
    for(const changed of [html.replace('Definitivo','Preliminar'),html.replace('2026-05-27','2026-05-24'),html.replace('2026-06-29','2026-05-27'),html.replace('Prova Objetiva','Prova Discursiva'),html.replace('Procuradoria-Geral do Estado do Acre','Procuradoria-Geral de outro Estado'),html.replace(target.documents[0].url,target.documents[0].url+'?x=1'),html+`<a href="${target.documents[1].url}">${target.documents[1].label}</a>`])expect(()=>assertPgeacOfficialAnchors(changed)).toThrow();
  });
  it('prévia pública consulta somente robots/HTML e verificador de assinatura limitada, sem banco',async()=>{
    const result=await previewPgeacPreviousExam({fetcher:fetcher as typeof fetch,verifier});
    expect(state.connect).not.toHaveBeenCalled();
    expect(result).toMatchObject({questionsImported:0,databaseWrites:0,productsReleased:0,humanReview:false,publicationAllowed:false,admissionApplied:false});
    expect(result.documents).toHaveLength(2);expect(result.documents.every(doc=>doc.sourceContentStored===false&&doc.status==='pending_review'&&doc.distributionMode==='external_link')).toBe(true);
    expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['https://conhecimento.fgv.br/robots.txt',target.portalUrl]);
    expect(verifier.mock.calls.map(call=>call[1])).toEqual(target.documents.map(doc=>doc.url));
  });
  it('robots proibitivo bloqueia o corpo e redirects/HTML/PDF indisponível bloqueiam cadastro',async()=>{
    const denied=vi.fn(async()=>new Response('User-agent: *\nDisallow: /concursos/',{status:200,headers:{'content-type':'text/plain'}}));
    await expect(previewPgeacPreviousExam({fetcher:denied as typeof fetch,verifier})).rejects.toThrow();expect(denied).toHaveBeenCalledTimes(1);expect(verifier).not.toHaveBeenCalled();
    for(const patch of [{httpStatus:403},{finalUrl:'https://foreign.invalid/booklet.pdf'},{contentType:'text/html'},{isPdf:false}]){
      await expect(previewPgeacPreviousExam({fetcher:fetcher as typeof fetch,verifier:async(bank,url)=>({...await verifier(bank,url),...patch})})).rejects.toThrow();
    }
  });
  it('exige SHA40p e cláusulas explícitas de cargo/data/100MC5 na página14',()=>{
    const countPage='10.1 A Prova Objetiva será composta por 100 questões de múltipla escolha, numeradas sequencialmente, com cinco alternativas e apenas uma resposta correta.';
    const datePage='9.1 Prova Objetiva para Procurador do Estado – Classe I será realizada em 24 de maio de 2026.';
    const valid={checksum:target.noticeSha256,pages:40,countPage,datePage};expect(()=>assertPgeacNoticeEvidence(valid)).not.toThrow();
    for(const patch of [{checksum:'a'.repeat(64)},{pages:39},{countPage:countPage.replace('100','80')},{countPage:countPage.replace('cinco','quatro')},{countPage:countPage.replace('apenas uma resposta correta','duas respostas')},{datePage:datePage.replace('Classe I','Classe II')},{datePage:datePage.replace('24 de maio','27 de maio')}])expect(()=>assertPgeacNoticeEvidence({...valid,...patch})).toThrow();
  });
  it('apply exige oportunidade concreta/hash/fingerprint, e preview nunca implica aplicação',()=>{
    expect(parsePgeacPreviousExamArgs([])).toMatchObject({apply:false,databasePreview:false});
    const identity=[`--opportunity=${target.opportunityPublicId}`,`--expected-notice-sha256=${target.noticeSha256}`];
    expect(parsePgeacPreviousExamArgs(identity)).toMatchObject({apply:false,databasePreview:true});
    for(const args of [['--apply'],['--apply',...identity],['--apply',...identity,'--expected-fingerprint=wrong'],['--opportunity=other'],['--output=../../public'],['--output=x','--output=y'],['--expected-fingerprint='+'a'.repeat(64)]])expect(()=>parsePgeacPreviousExamArgs(args)).toThrow();
    expect(parsePgeacPreviousExamArgs(['--apply',...identity,'--expected-fingerprint='+'a'.repeat(64)]).apply).toBe(true);
    expect(()=>assertPgeacRegistrationRequest({mode:'preview',opportunityPublicId:'0f7ba2b8-797e-4939-a86f-57077eea58a5',expectedNoticeSha256:target.noticeSha256})).toThrow();
  });
  it('standing aceita só pares oficiais exatos; MPRJ-objetiva, preliminar e mistura continuam recusados',()=>{
    const pge=`${target.productSlug}=${target.editionPublicId}`,mp='mpe-mt-promotor-de-justica-2026=mpmt-promotor-substituto-2026-objetiva';
    expect(parsePreviousExamLinkCommand(['--standing',pge]).standing).toBe(true);expect(parsePreviousExamLinkCommand(['--standing',mp]).standing).toBe(true);
    for(const pairs of [pge.replace('viii-2026','vii-2025'),'mpe-rj-promotor-de-justica-2026=mprj-promotor-substituto-xxxix-2026-objetiva',pge+'-preliminar'])expect(()=>parsePreviousExamLinkCommand(['--standing',pairs])).toThrow();
    expect(()=>parsePreviousExamLinkCommand(['--standing',pge,mp])).toThrow();
    // O par MPRJ só passou a valer com a evidência composta e o identificador
    // `…-preambular`; a asserção acima continua provando que `…-objetiva` lança.
    expect(parsePreviousExamLinkCommand(['--standing','mpe-rj-promotor-de-justica-2026=mprj-promotor-substituto-xxxix-2026-preambular']).standing).toBe(true);
  });
  it('fonte primária admite exatamente o notice aprovado sem abrir diretório FGV inteiro',()=>{
    expect(parseOfficialOpportunitySourceUrl(target.noticeUrl).sourceId).toBe('fgv-conhecimento');
    // A política compartilhada seleciona caminhos; o operador compara a URL literal exata no SQL.
    expect(parseOfficialOpportunitySourceUrl(target.noticeUrl+'?other=1').url).not.toBe(target.noticeUrl);
    for(const url of [target.noticeUrl.replace('final_.pdf','other.pdf'),target.noticeUrl.replace('conhecimento.fgv.br','fgv.br.evil')])expect(()=>parseOfficialOpportunitySourceUrl(url)).toThrow();
  });
  it('operador mantém rawJSONB via tx.json, docs pending e sincroniza timestamp exato, sem liberar produto',()=>{
    const code=readFileSync(new URL('../src/lib/exams/pgeac-previous-exam-admission.ts',import.meta.url),'utf8');
    expect(code).toContain('tx.json(metadata');expect(code).toContain('exam_edition_id is null');expect(code).toContain('preparation_opportunity_updated_at=(select updated_at');
    expect(code).not.toContain('insert into contest_product_exam_references');expect(code).not.toContain("set status='released'");
  });
});
