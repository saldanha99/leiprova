import { describe, expect, it } from "vitest";
import { buildRoleScopePlan, ROLE_SCOPE_RECIPES, type RoleScopeRecipe, type RoleScopeState } from "@/lib/editorial/official-role-scope-maintenance";
import { requireStandingCourseMaintenanceDatabaseUrl } from "@/lib/editorial/official-course-admission";

function fixture(recipe: RoleScopeRecipe = "pp-ma-inspetor-2026"): RoleScopeState {
  const r = ROLE_SCOPE_RECIPES[recipe], pp = recipe === "pp-ma-inspetor-2026";
  const pages = Array<string>(73).fill("");
  pages[0] = "CONCURSO PÚBLICO PARA O PROVIMENTO DE VAGAS E A FORMAÇÃO DE CADASTRO DE RESERVA NO CARGO DE OFICIAL INVESTIGADOR DE POLÍCIA\nEDITAL Nº 1 – PCMA – INVESTIGADOR, DE 13 DE JULHO DE 2026";
  pages[1] = "CARGO 1: INSPETOR DE POLÍCIA PENAL";
  pages[67] = "22.2.3 CONHECIMENTOS GERAIS PARA TODOS OS CARGOS";
  const requirements = Array.from({length:pp ? 84 : 71},(_,i)=>({id:1321+i,opportunityId:r.opportunityId,
    documentId:r.documentId,snapshotId:r.snapshotId,text:`Requisito sintético número ${i}.`,
    locator:`Conteúdo programático, p. ${i<60 ? 69 : 71} · item ${i}`,status:"draft",data:{id:1321+i}}));
  pages[68] = "CARGO 1: INSPETOR DE POLÍCIA PENAL\n"+requirements.slice(0,60).map(r=>r.text).join(" ");
  pages[70] = "CARGO 2: MONITOR DE RESSOCIALIZAÇÃO\n"+requirements.slice(60).map(r=>r.text).join(" ");
  return {source:{...r,editionId:r.editionId,assignmentId:r.assignmentId,bankId:4,year:2026,notice:"1/2026",specializationId:null,
    opportunityStatus:"reviewed",documentStatus:"approved",snapshotStatus:"approved",assignmentStatus:"reviewed",
    bankCurrent:true,newerApproved:false,bytesSha:r.sha,pages,data:{}},requirements,jobs:[],dependencies:{contracts:0,questions:0,bindings:0}};
}

describe("bounded official role scope maintenance",()=>{
  it("isolates 24 Monitor rows and preserves all 60 Inspetor rows",()=>{
    const plan=buildRoleScopePlan("pp-ma-inspetor-2026",fixture());
    expect(plan.blockers).toEqual([]);expect(plan.suspend).toHaveLength(24);expect(plan.preserve).toHaveLength(60);
    expect(plan.suspend[0]).toBe(1381);expect(plan.preserve.at(-1)).toBe(1380);
  });
  it("rejects Monitor text on the same page if it is mislabeled as an Inspetor row",()=>{
    const s=fixture();s.requirements[59].text=s.requirements[60].text;s.requirements[59].locator="Conteúdo programático, p. 71";
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toContain("programme_scope_unproved:1380");
  });
  it("accepts a literal requirement spanning pages without admitting the next cargo",()=>{
    const s=fixture();s.requirements[0].text="Parte inicial e continuação literal.";
    s.source!.pages[68]+=" Parte inicial";s.source!.pages[69]="e continuação literal.";
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toEqual([]);
    s.source!.pages[69]="continuação diferente.";
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toContain("programme_scope_unproved:1321");
  });
  it("requires exactly the inspected IDs, not just a count",()=>{
    const s=fixture();s.requirements[0].id=9999;
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toContain("unexpected_programme_rows");
  });
  it.each(["bytesSha","sha","documentUrl","role","institution"] as const)("refuses altered %s",key=>{
    const s=fixture();s.source![key]+=" changed";
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toContain("source_identity_or_bytes_changed");
  });
  it.each(["documentStatus","snapshotStatus","assignmentStatus","opportunityStatus"] as const)("refuses unapproved %s",key=>{
    const s=fixture();s.source![key]="pending_review";
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toContain("source_identity_or_bytes_changed");
  });
  it("refuses new source, stale bank, missing role boundaries and reviewed programme",()=>{
    const s=fixture();s.source!.newerApproved=true;s.source!.bankCurrent=false;s.source!.pages[70]="";s.requirements[0].status="reviewed";
    const p=buildRoleScopePlan("pp-ma-inspetor-2026",s);
    expect(p.blockers).toContain("source_identity_or_bytes_changed");expect(p.blockers).toContain("official_role_boundaries_missing");
    expect(p.blockers).toContain("programme_not_unreviewed_exact_source");
  });
  it.each(["contracts","questions","bindings"] as const)("refuses dependent %s",key=>{
    const s=fixture();s.dependencies[key]=1;
    expect(buildRoleScopePlan("pp-ma-inspetor-2026",s).blockers).toContain("dependent_contract_question_or_binding");
  });
  it("does not cancel a running reservation and supersedes only pending foreign-role work",()=>{
    const s=fixture();s.jobs=[{key:"mapping:1381",status:"pending",requirementId:"1381",data:{}},
      {key:"mapping:1321",status:"pending",requirementId:"1321",data:{}},{key:"author:1382",status:"running",requirementId:"1382",data:{}}];
    const p=buildRoleScopePlan("pp-ma-inspetor-2026",s);
    expect(p.blockers).toContain("existing_reservation");expect(p.supersede).toEqual(["mapping:1381"]);
  });
  it("corrects the PC-MA label only on exact official identity and unreviewed single-role input",()=>{
    const s=fixture("pc-ma-investigador-2026");
    const p=buildRoleScopePlan("pc-ma-investigador-2026",s);
    expect(p.blockers).toEqual([]);expect(p.renamedRole).toBe("Oficial Investigador de Polícia");expect(p.suspend).toEqual([]);
    s.source!.pages[0]=s.source!.pages[0].replace("OFICIAL INVESTIGADOR","INVESTIGADOR");
    expect(buildRoleScopePlan("pc-ma-investigador-2026",s).blockers).toContain("official_exact_role_identity_missing");
  });
  it("keeps credentials restricted to the project owner database",()=>{
    expect(()=>requireStandingCourseMaintenanceDatabaseUrl("postgres://worker:fake@127.0.0.1/leiprova")).toThrow();
    expect(()=>requireStandingCourseMaintenanceDatabaseUrl("postgres://leiprova_owner:fake@127.0.0.1/other_project")).toThrow();
  });
});
