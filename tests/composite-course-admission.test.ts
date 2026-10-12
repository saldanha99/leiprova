import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("postgres", () => ({ default: db.connect }));
vi.mock("../src/lib/opportunities/source-metadata-check", () => ({ checkOpportunitySourceMetadata: vi.fn(async (input: {url:string; documentType:string}) => {
  if (input.documentType !== "official_announcement") throw new Error("HEAD contract drift");
  return { url:input.url, hostname:"conhecimento.fgv.br", observedAt:new Date().toISOString(), httpStatus:200, contentType:"application/pdf", contentLength:1234, sourceContentStored:false, sourcePolicy:"metadata_only" };
}) }));
vi.mock("../src/lib/official-sources/fetch", () => ({ verifyOfficialExamUrl: vi.fn(async (_bank:string,url:string) => ({ httpStatus:200, isPdf:true, finalUrl:url })) }));

import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { buildNextOfficialCoursePreview, NEXT_OFFICIAL_COURSE_RECIPES, type ProgrammeSection } from "../src/lib/editorial/official-course-preview-candidates";
import { admitCompositeOfficialCourse, assertCompositeFreshness, assertCompositeHashes, compositeCourseTarget, compositeProgrammeRequirements, COMPOSITE_ADMISSION_TARGETS } from "../src/lib/editorial/composite-course-admission";
import type { CapturedOfficialDocument } from "../src/lib/opportunities/official-document-fetch";
import { parseOfficialOpportunitySourceUrl } from "../src/lib/opportunities/source-monitor-policy";
import { parseCompositeCourseArgs } from "../scripts/admit-composite-official-course";

const hex = "a".repeat(64);
const recipe = NEXT_OFFICIAL_COURSE_RECIPES[0];
const hashes = () => new Map(recipe.documents.map((doc) => [doc.key, hex]));
const section = (documentKey: string, fragments: ProgrammeSection["fragments"]): ProgrammeSection => ({ subject: "Direito Civil", documentKey, sourceUrl: recipe.documents[1].url, checksumSha256: hex, fragments });

function syntheticAdmission() {
  const subjects = [...recipe.overlays.flatMap(overlay => overlay.subjects), ...Array.from({length:9},(_,i)=>`Disciplina ${i+5}`)];
  const captures = new Map<string,CapturedOfficialDocument>();
  for(const doc of recipe.documents) {
    const pageTexts=Array.from({length:doc.pages},()=>"");
    for(const claim of recipe.identityClaims.filter(claim=>claim.document===doc.key)) pageTexts[claim.page-1]+=claim.contains.join(" ")+"\n";
    if(doc.programmePages) {
      const overlay=recipe.overlays.find(overlay=>overlay.key===doc.key);
      pageTexts[doc.programmePages[0]-1]+=(overlay?.subjects??subjects).map((subject,i)=>`${(i%9)+1}.${Math.floor(i/9)+1} – ${subject}\nPonto nº 1\na) Tema ${doc.key} ${subject}.`).join("\n");
    }
    const documentBytes=Buffer.from(`%PDF-synthetic-${doc.key}`);
    const extractedText=pageTexts.join("\n\n");
    captures.set(doc.key,{documentUrl:doc.url, sourceHost:"conhecimento.fgv.br",fileName:`${doc.key}.pdf`,mimeType:"application/pdf", documentBytes,
      checksumSha256:createHash("sha256").update(documentBytes).digest("hex"),byteLength:documentBytes.length,pageCount:doc.pages,pageTexts,extractedText,textLength:extractedText.length,parserVersion:"synthetic"});
  }
  const preview=buildNextOfficialCoursePreview(recipe,captures,new Date().toISOString(),[]);
  return { productSlug:recipe.productSlug,captures,capturedAt:new Map(recipe.documents.map(doc=>[doc.key,new Date().toISOString()])),
    expectedHashes:new Map([...captures].map(([key,capture])=>[key,capture.checksumSha256])),expectedProgrammeHash:preview.programme.checksumSha256 };
}
function syntheticTransaction(returnProduct=true) {
  const queries:string[]=[];
  let committed=false;
  const tx=(first:TemplateStringsArray|Record<string,unknown>[],...values:unknown[])=>{
    if(!("raw" in first)) return {rows:first};
    const query=first.join("?").replace(/\s+/g," ").trim(); queries.push(query);
    let rows:Record<string,unknown>[]=[];
    if(query.includes("select id::text, role from users")) rows=[{id:"1",role:"admin"}];
    else if(query.includes("select opportunity_id")) rows=[{opportunityId:null,status:"draft"}];
    else if(query.includes("from contest_categories")) rows=[{categoryId:"1",careerId:"1",bankId:"1"}];
    else if(query.startsWith("insert into opportunity_requirements")) rows=(values[0] as {rows:Record<string,unknown>[]}).rows.map((_,i)=>({id:`${i+1}`}));
    else if(query.startsWith("insert into")) rows=[{id:`${queries.length}`}];
    else if(query.startsWith("update contest_store_products")&&returnProduct) rows=[{slug:recipe.productSlug}];
    return Promise.resolve(rows);
  };
  const json=vi.fn((value:unknown)=>({json:value}));
  Object.assign(tx,{json});
  db.connect.mockReturnValue({ begin:async(_isolation:string,callback:(tx:unknown)=>Promise<unknown>)=>{const result=await callback(tx); committed=true; return result;},end:vi.fn(async()=>{}) });
  return { queries, json, committed:()=>committed };
}
describe("bounded MPRJ/PGEAC composite admission", () => {
  beforeEach(()=>db.connect.mockReset());
  it("defaults to preview without selecting a database and refuses unrelated targets", () => {
    expect(parseCompositeCourseArgs([])).toMatchObject({ apply: false, products: COMPOSITE_ADMISSION_TARGETS.map((target) => target.productSlug) });
    expect(db.connect).not.toHaveBeenCalled();
    expect(() => compositeCourseTarget("mpe-mt-promotor-de-justica-2026")).toThrow();
    expect(() => parseCompositeCourseArgs(["--product=other"])).toThrow();
    expect(() => parseCompositeCourseArgs(["--output=public"])).toThrow();
    expect(() => parseCompositeCourseArgs(["--apply"])).toThrow();
  });
  it("requires every documentary hash, programme hash, exact unique product and explicit apply", () => {
    const args = ["--apply", `--product=${recipe.productSlug}`, `--expected-programme-sha256=${hex}`, ...recipe.documents.map((doc) => `--expected-document=${doc.key}:${hex}`)];
    expect(parseCompositeCourseArgs(args).expectedHashes.size).toBe(4);
    expect(() => parseCompositeCourseArgs(args.slice(0, -1))).toThrow();
    expect(() => parseCompositeCourseArgs([...args, args.at(-1)!])).toThrow();
    expect(() => parseCompositeCourseArgs([...args, `--product=${NEXT_OFFICIAL_COURSE_RECIPES[1].productSlug}`])).toThrow();
    expect(() => parseCompositeCourseArgs(args.filter((arg) => arg !== "--apply"))).toThrow();
    expect(() => assertCompositeHashes(recipe, new Map([...hashes(), ["foreign", hex]]), hex)).toThrow();
    expect(() => assertCompositeHashes(recipe, hashes(), "bad")).toThrow();
  });
  it("rejects stale/future timestamps so historic local receipts cannot authorize current apply", () => {
    const now = Date.parse("2026-10-12T06:00:00Z");
    expect(() => assertCompositeFreshness("2026-10-12T05:46:00Z", now)).not.toThrow();
    expect(() => assertCompositeFreshness("2026-10-12T05:44:59Z", now)).toThrow();
    expect(() => assertCompositeFreshness("2026-10-12T06:02:00Z", now)).toThrow();
    expect(() => assertCompositeFreshness("not-a-date", now)).toThrow();
  });
  it("keeps literal continuations and numbered topics bound to their effective document/pages", () => {
    const items = compositeProgrammeRequirements([section("correction", [{ page: 2, text: "1. Primeiro tema." }, { page: 3, text: "Continuação literal." }, { page: 3, text: "2. Segundo tema." }]), section("base", [{ page: 4, text: "Ponto 1. Tema de outra fonte." }])]);
    expect(items.map((item) => [item.documentKey, item.requirementText, item.sourceLocator])).toEqual([
      ["correction", "1. Primeiro tema. Continuação literal.", "correction · Direito Civil · p. 2–3"],
      ["correction", "2. Segundo tema.", "correction · Direito Civil · p. 3"],
      ["base", "Ponto 1. Tema de outra fonte.", "base · Direito Civil · p. 4"],
    ]);
    expect(items.every((item) => !("legalArticleId" in item))).toBe(true);
    expect(() => compositeProgrammeRequirements([])).toThrow();
    expect(() => compositeProgrammeRequirements([section("base", [{ page: 1, text: "1. A" }, { page: 2, text: "1. A" }])])).toThrow();
  });
  it("preserves MPRJ numbered point context when separating lettered subitems", () => {
    const items = compositeProgrammeRequirements([section("mprj-programme", [
      { page: 1, text: "Ponto nº 1" }, { page: 1, text: "a) Primeira demanda." }, { page: 2, text: "Continuação literal." },
      { page: 2, text: "b) Segunda demanda." }, { page: 2, text: "Ponto nº 2" }, { page: 2, text: "a) Primeira demanda." },
    ])]);
    expect(items.map((item) => item.requirementText)).toEqual(["Ponto nº 1 a) Primeira demanda. Continuação literal.", "Ponto nº 1 b) Segunda demanda.", "Ponto nº 2 a) Primeira demanda."]);
    expect(items).toHaveLength(3);
  });
  it("allows only the three exact metadata result paths, not directory-wide candidate lists", () => {
    for (const target of COMPOSITE_ADMISSION_TARGETS) for (const stage of target.stages) {
      expect(parseOfficialOpportunitySourceUrl(stage.url, "fgv-conhecimento").url).toBe(stage.url);
      expect(() => parseOfficialOpportunitySourceUrl(stage.url.replace(".pdf", "-different.pdf"), "fgv-conhecimento")).toThrow();
      expect(() => parseOfficialOpportunitySourceUrl(stage.url.replace("conhecimento.fgv.br", "foreign.example"), "fgv-conhecimento")).toThrow();
    }
  });
  it("creates sources and organizers before reviewed transition and leaves product draft with zero mappings/questions", async()=>{
    vi.stubEnv("OPPORTUNITY_APPROVAL_REFERENCE",OFFICIAL_COURSE_STANDING_REFERENCE);
    vi.stubEnv("MIGRATION_DATABASE_URL","postgres://leiprova_owner:synthetic@localhost/leiprova");
    const transaction=syntheticTransaction();
    try {
      const result=await admitCompositeOfficialCourse(syntheticAdmission());
      expect(result).toMatchObject({productStatus:"draft",legalMappingsApproved:0,questionsApproved:0,productsReleased:0,humanReview:false,requirements:13});
      expect(transaction.committed()).toBe(true);
      const reviewed=transaction.queries.findIndex(q=>q.startsWith("update contest_opportunities"));
      expect(transaction.queries.findIndex(q=>q.startsWith("insert into opportunity_source_documents"))).toBeLessThan(reviewed);
      expect(transaction.queries.findIndex(q=>q.startsWith("insert into opportunity_organizer_assignments"))).toBeLessThan(reviewed);
      expect(transaction.queries.find(q=>q.startsWith("update contest_store_products"))).not.toContain("set status");
      expect(result.previousExam.approvedForProduct).toBe(false);
      // Driver helper must receive arrays/objects, never pre-encoded JSON strings.
      expect(transaction.json).toHaveBeenCalledTimes(recipe.documents.length+1);
      expect(transaction.json.mock.calls.slice(0,recipe.documents.length).every(([value])=>Array.isArray(value))).toBe(true);
      expect(transaction.json.mock.calls.at(-1)?.[0]).toMatchObject({approvalBasis:"owner_standing_authorization",humanReview:false});
    } finally {vi.unstubAllEnvs();}
  });
  it("fails transaction before audit when the expected draft product was not updated", async()=>{
    vi.stubEnv("OPPORTUNITY_APPROVAL_REFERENCE",OFFICIAL_COURSE_STANDING_REFERENCE);
    vi.stubEnv("MIGRATION_DATABASE_URL","postgres://leiprova_owner:synthetic@localhost/leiprova");
    const transaction=syntheticTransaction(false);
    try {
      await expect(admitCompositeOfficialCourse(syntheticAdmission())).rejects.toThrow("Vínculo do produto");
      expect(transaction.committed()).toBe(false);
      expect(transaction.queries.some(q=>q.startsWith("insert into audit_logs"))).toBe(false);
    } finally {vi.unstubAllEnvs();}
  });
  it("blocks changed capture bytes before any metadata fetch or database connection", async () => {
    vi.stubEnv("OPPORTUNITY_APPROVAL_REFERENCE", OFFICIAL_COURSE_STANDING_REFERENCE);
    vi.stubEnv("MIGRATION_DATABASE_URL", "postgres://leiprova_owner:synthetic@localhost/leiprova");
    const bytes = Buffer.from("%PDF-synthetic");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const captures = new Map(recipe.documents.map((doc) => [doc.key, { documentUrl: doc.url, sourceHost: "conhecimento.fgv.br", documentBytes: bytes, checksumSha256: hash } as CapturedOfficialDocument]));
    const input = { productSlug: recipe.productSlug, captures, capturedAt: new Map(recipe.documents.map((doc) => [doc.key, new Date().toISOString()])), expectedHashes: hashes(), expectedProgrammeHash: hex };
    try {
      await expect(admitCompositeOfficialCourse(input)).rejects.toThrow("Fonte mudou");
      expect(db.connect).not.toHaveBeenCalled();
      vi.stubEnv("MIGRATION_DATABASE_URL", "postgres://leiprova_owner:synthetic@localhost/everglades");
      await expect(admitCompositeOfficialCourse(input)).rejects.toThrow("banco leiprova");
      vi.stubEnv("OPPORTUNITY_APPROVAL_REFERENCE", "unrelated");
      await expect(admitCompositeOfficialCourse(input)).rejects.toThrow("Referência exata");
    } finally { vi.unstubAllEnvs(); }
  });
});
