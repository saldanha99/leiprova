import { beforeEach, describe, expect, it, vi } from "vitest";

const isolated = vi.hoisted(()=>({connect:vi.fn(),verify:vi.fn()}));
vi.mock("postgres",()=>({default:isolated.connect}));
vi.mock("../src/lib/official-sources/fetch",()=>({verifyOfficialExamUrl:isolated.verify}));

import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { assertMpmtNoticeEvidence, assertMpmtOfficialAnchors, MPMT_OFFICIAL_PREVIOUS_EXAM as target, previewMpmtPreviousExam, registerMpmtPreviousExam } from "../src/lib/exams/mpmt-previous-exam-admission";
import { parsePreviousExamLinkCommand, previousExamApprovalBasis } from "../src/lib/exams/previous-exam-link-command";
import { parseMpmtPreviousExamArgs } from "../scripts/register-mpmt-previous-exam-links";

const html = `<h1>Concurso Público para o Ministério Público do Estado de Mato Grosso</h1><a href="${target.noticeUrl}">Edital nº01/2026 compilado até 20.07.2026</a>${target.documents.map(document=>`<div class="paragraph--type--texto-data"><time datetime="${document.publishedOn}T12:00:00Z"></time>Prova Preambular Promotor de Justiça Substituto <a href="${document.url}">${document.label}</a></div>`).join("")}`;
const fakeVerifier = vi.fn(async(_bank:string,url:string)=>({httpStatus:200,isPdf:true,finalUrl:url,checkedAt:new Date(),contentType:"application/pdf",pageTitle:null}));
const fetcher = vi.fn(async(url:Parameters<typeof fetch>[0])=>new Response(String(url).endsWith("robots.txt")?"User-agent: *\nDisallow: /search/":html,{status:200,headers:{"content-type":String(url).endsWith("robots.txt")?"text/plain":"text/html"}}));

function registrationTransaction(options: { baselineEditionId?: string | null; opportunityRows?: {id:string}[]; productRows?: {slug:string}[] } = {}) {
  const queries:{sql:string;values:unknown[]}[]=[];
  let committed=false;
  const tx=async(parts:TemplateStringsArray,...values:unknown[])=>{
    const query=parts.join("?").replace(/\s+/gu," ").trim();queries.push({sql:query,values});
    if(query.includes("select id::text, role from users")) return [{id:"1",role:"admin"}];
    if(query.includes('as "opportunityId"')) return [{opportunityId:"1",careerId:"4",bankId:"1",baselineEditionId:options.baselineEditionId??null,opportunityUpdatedAt:"2026-10-12T01:23:00.000Z"}];
    if(query.includes("select snapshot.checksum_sha256")) return [{checksum:target.noticeSha256,pages:66,countPage:"100 questões de múltipla escolha",datePage:"Promotor de Justiça Substituto 14 de junho de 2026"}];
    if(query.startsWith("insert into exam_editions(")) return [{id:"77"}];
    if(query.startsWith("update contest_opportunities")) return options.opportunityRows??[{id:"1"}];
    if(query.startsWith("update contest_store_products")) return options.productRows??[{slug:target.productSlug}];
    if(query.startsWith("insert into audit_logs")) return [{id:"999"}];
    return [];
  };
  const json=vi.fn((value:unknown)=>({json:value}));Object.assign(tx,{json});
  isolated.connect.mockReturnValue({begin:async(_level:string,callback:(transaction:unknown)=>Promise<unknown>)=>{const result=await callback(tx);committed=true;return result;},end:vi.fn(async()=>{})});
  return {queries,json,committed:()=>committed};
}
async function withRegistrationEnvironment<T>(run:()=>Promise<T>) {
  vi.stubEnv("OPPORTUNITY_APPROVAL_REFERENCE",OFFICIAL_COURSE_STANDING_REFERENCE);
  vi.stubEnv("MIGRATION_DATABASE_URL","postgres://leiprova_owner:synthetic@localhost/leiprova");
  vi.stubEnv("ADMIN_EMAILS","");vi.stubGlobal("fetch",fetcher);isolated.verify.mockImplementation(fakeVerifier);
  try {return await run();} finally {vi.unstubAllEnvs();vi.unstubAllGlobals();}
}
describe("MPMT previous exam official metadata only",()=>{
  beforeEach(()=>{isolated.connect.mockReset();isolated.verify.mockReset();fakeVerifier.mockClear();fetcher.mockClear();});
  it("selects exact Tipo1 and DEFINITIVE key publication anchors, not application dates or preliminary keys",()=>{
    expect(()=>assertMpmtOfficialAnchors(html)).not.toThrow();
    for(const changed of [html.replace("Definitivo","Preliminar"),html.replace("2026-07-20","2026-06-15"),html.replace(target.documents[0].url,target.documents[0].url+"?other"),html.replace("Prova Preambular","Prova Discursiva"),html.replace("Mato Grosso","Maranhão")]) expect(()=>assertMpmtOfficialAnchors(changed)).toThrow();
  });
  it("previews without any database or persisted PDF body and uses the bounded verifier",async()=>{
    const result=await previewMpmtPreviousExam({fetcher:fetcher as typeof fetch,verifier:fakeVerifier});
    expect(result).toMatchObject({databaseWrites:0,questionsImported:0,admissionApplied:false,latestEditionVerifiedInDatabase:false,examDate:"2026-06-14",humanReview:false});
    expect(result.documents).toHaveLength(2);
    expect(result.documents.every(document=>document.sourceContentStored===false&&document.status==="pending_review")).toBe(true);
    expect(fakeVerifier.mock.calls.map(call=>call[1])).toEqual(target.documents.map(document=>document.url));
    expect(fetcher.mock.calls.every(call=>String(call[0]).endsWith("robots.txt")||String(call[0])===target.portalUrl)).toBe(true);
  });
  it("blocks robots refusal, redirected PDF, HTML MIME and inaccessible origin",async()=>{
    const blocked=async()=>new Response("User-agent: *\nDisallow: /concursos/",{status:200,headers:{"content-type":"text/plain"}});
    await expect(previewMpmtPreviousExam({fetcher:blocked as typeof fetch,verifier:fakeVerifier})).rejects.toThrow();
    for(const patch of [{httpStatus:403},{finalUrl:"https://foreign.invalid/document.pdf"},{contentType:"text/html"},{isPdf:false}]) {
      const verifier=async(_bank:string,url:string)=>({...await fakeVerifier(_bank,url),...patch});
      await expect(previewMpmtPreviousExam({fetcher:fetcher as typeof fetch,verifier})).rejects.toThrow();
    }
  });
  it("requires the exact approved notice hash and its application/count locators",()=>{
    const evidence={checksum:target.noticeSha256,pages:66,countPage:"9.1 composta por 100 questões de múltipla escolha",datePage:"Promotor de Justiça Substituto 14 de junho de 2026"};
    expect(()=>assertMpmtNoticeEvidence(evidence)).not.toThrow();
    for(const patch of [{checksum:"b".repeat(64)},{pages:47},{countPage:"120 questões"},{datePage:"Promotor de Justiça Substituto 15 de junho de 2026"}]) expect(()=>assertMpmtNoticeEvidence({...evidence,...patch})).toThrow();
  });
  it("defaults registration to no-DB preview and requires concrete opportunity/hash for apply",()=>{
    expect(parseMpmtPreviousExamArgs([]).apply).toBe(false);
    expect(()=>parseMpmtPreviousExamArgs(["--apply"])).toThrow();
    expect(()=>parseMpmtPreviousExamArgs(["--output=public"])).toThrow();
    expect(()=>parseMpmtPreviousExamArgs(["--opportunity=unknown"])).toThrow();
    expect(parseMpmtPreviousExamArgs(["--apply","--opportunity=0f7ba2b8-797e-4939-a86f-57077eea58a5",`--expected-notice-sha256=${target.noticeSha256}`]).apply).toBe(true);
  });
  it("writes no edition/documents when the concrete MPMT admission is not present",async()=>{
    vi.stubEnv("OPPORTUNITY_APPROVAL_REFERENCE",OFFICIAL_COURSE_STANDING_REFERENCE);
    vi.stubEnv("MIGRATION_DATABASE_URL","postgres://leiprova_owner:synthetic@localhost/leiprova");
    vi.stubEnv("ADMIN_EMAILS","");
    vi.stubGlobal("fetch",fetcher);
    isolated.verify.mockImplementation(fakeVerifier);
    const queries:string[]=[];
    const tx=async(parts:TemplateStringsArray)=>{
      const query=parts.join("?").replace(/\s+/gu," ");queries.push(query);
      return query.includes("select id::text, role from users")?[{id:"1",role:"admin"}]:[];
    };
    const end=vi.fn(async()=>{});
    isolated.connect.mockReturnValue({begin:async(_level:string,callback:(transaction:unknown)=>Promise<unknown>)=>callback(tx),end});
    try {
      await expect(registerMpmtPreviousExam("0f7ba2b8-797e-4939-a86f-57077eea58a5",target.noticeSha256)).rejects.toThrow("Admissão MPMT ainda não aplicada");
      expect(queries.some(query=>query.includes("insert into"))).toBe(false);
      expect(queries.some(query=>query.includes("product.preparation_mode='historical_training'"))).toBe(true);
      expect(end).toHaveBeenCalledTimes(1);
    } finally {vi.unstubAllEnvs();vi.unstubAllGlobals();}
  });
  it("assigns the exact new baseline and synchronizes the preparation fingerprint in one transaction",async()=>{
    const transaction=registrationTransaction();
    await withRegistrationEnvironment(async()=>{
      const result=await registerMpmtPreviousExam("0f7ba2b8-797e-4939-a86f-57077eea58a5",target.noticeSha256);
      expect(result).toMatchObject({assignedBaselineEdition:true,assignedBaselineEditionId:"77",referencesApproved:0,questionsImported:0,productsReleased:0,documentStatus:"pending_review",humanReview:false});
      expect(transaction.committed()).toBe(true);
      const op=transaction.queries.find(query=>query.sql.startsWith("update contest_opportunities"))!;
      const product=transaction.queries.find(query=>query.sql.startsWith("update contest_store_products"))!;
      expect(op.values[0]).toBe("77");expect(op.values[1]).toBe(product.values[1]);
      expect(op.sql).toContain("exam_edition_id is null");
      expect(op.sql).toContain("institution_acronym='MPMT'");expect(op.sql).toContain("jurisdiction_code='MT'");
      expect(product.sql).toContain("preparation_opportunity_updated_at=(select updated_at from contest_opportunities");
      expect(transaction.queries.filter(query=>query.sql.startsWith("insert into exam_edition_documents"))).toHaveLength(2);
      expect(transaction.queries.some(query=>query.sql.includes("insert into contest_product_exam_references"))).toBe(false);
      expect(transaction.json.mock.calls.at(-1)?.[0]).toMatchObject({assignedBaselineEditionId:"77",referencesApproved:0,humanReview:false});
    });
  });
  it("refuses a pre-existing baseline without inserting another edition",async()=>{
    const transaction=registrationTransaction({baselineEditionId:"99"});
    await withRegistrationEnvironment(async()=>{
      await expect(registerMpmtPreviousExam("0f7ba2b8-797e-4939-a86f-57077eea58a5",target.noticeSha256)).rejects.toThrow("já possui edição-base");
      expect(transaction.queries.some(query=>query.sql.startsWith("insert into"))).toBe(false);
      expect(transaction.committed()).toBe(false);
    });
  });
  it.each([
    {opportunityRows:[]},{opportunityRows:[{id:"other"}]},{opportunityRows:[{id:"1"},{id:"1"}]},
    {productRows:[]},{productRows:[{slug:"other"}]},{productRows:[{slug:target.productSlug},{slug:target.productSlug}]},
  ])("rolls back when assignment/fingerprint update did not affect exactly the expected record: %j",async(options)=>{
    const transaction=registrationTransaction(options);
    await withRegistrationEnvironment(async()=>{
      await expect(registerMpmtPreviousExam("0f7ba2b8-797e-4939-a86f-57077eea58a5",target.noticeSha256)).rejects.toThrow("transação cancelada");
      expect(transaction.committed()).toBe(false);
      expect(transaction.queries.some(query=>query.sql.startsWith("insert into audit_logs"))).toBe(false);
    });
  });
  it("uses an operational reference that satisfies the actual lower-case SQL constraint",()=>{
    const preparationApprovalReference=/^[a-z0-9][a-z0-9._:/-]{0,159}$/u;
    expect(OFFICIAL_COURSE_STANDING_REFERENCE).toBe("owner-standing-2026-10-12:official-sources-programs");
    expect(OFFICIAL_COURSE_STANDING_REFERENCE).toMatch(preparationApprovalReference);
    expect("docs/AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md").not.toMatch(preparationApprovalReference);
    expect(()=>previousExamApprovalBasis(true,"docs/AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md")).toThrow();
  });
  it("bounds standing approval to the exact MPMT edition/decision and declares absent human review",()=>{
    const pair=`${target.productSlug}=${target.editionPublicId}`;
    expect(parsePreviousExamLinkCommand(["--standing",pair])).toMatchObject({standing:true,apply:false});
    expect(()=>parsePreviousExamLinkCommand(["--standing","other=other"])).toThrow();
    expect(()=>parsePreviousExamLinkCommand(["--standing",pair,pair])).toThrow();
    expect(()=>parsePreviousExamLinkCommand(["--apply","--apply",pair])).toThrow();
    expect(()=>previousExamApprovalBasis(true,"unrelated")).toThrow();
    expect(previousExamApprovalBasis(true,OFFICIAL_COURSE_STANDING_REFERENCE)).toMatchObject({humanReview:false,reviewBasis:"owner_standing_authorization"});
    expect(previousExamApprovalBasis(false,"historic-authorization")).not.toHaveProperty("humanReview");
  });
});
