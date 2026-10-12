import { describe, expect, it } from "vitest";
import { CP_CUT_ITEMS, CP_CUT_PRODUCT, assertCpCutFloors, assertCpCutFresh, assertCpCutImpact, cpCutFingerprint, cpCutReplacement, parseCpCutArgs, requireCpCutDatabase } from "@/lib/official-sources/cp-coordinated-cut";
import { parseCpSourceVerificationArgs } from "../scripts/verify-cp-correction-source";
import type { StoredCpCorrectionArticle } from "@/lib/official-sources/camara-cp-correction-parser";

const synthetic351="Art. 351. Regra sintética para testar limites.\nPena - hipótese sintética.\n§ 1º Primeira regra sintética.\n§ 2º Segunda regra sintética.\n§ 3º Terceira regra sintética.\n§ 4º Quarta regra sintética.";
const oldExplanation="Fundamento próprio sintético que deve ser preservado.\nFonte: Código Penal, art. 351, corpus ID 3733, versão 63.";
const counts=[{slug:"enam-exame-nacional-da-magistratura-2026-2",count:146,ready:true},{slug:CP_CUT_PRODUCT,count:70,ready:true},{slug:"tc-df-analista-2026",count:69,ready:true},{slug:"pc-ma-delegado-2026",count:0,ready:false}];

describe("corte CP402/ENAC5 delimitado",()=> {
  it("altera somente rodapé e usa a citação da regra correspondente, preservando cada gabarito",()=> {
    for(const [id,answer,,,hash] of CP_CUT_ITEMS) {
      const replacement=cpCutReplacement(id,oldExplanation,synthetic351);
      expect(replacement.explanation.split("\n")[0]).toBe(oldExplanation.split("\n")[0]);
      expect(replacement.explanation).not.toContain("corpus ID");expect(replacement.answer).toBe(answer);expect(replacement.expectedContentHash).toBe(hash);
      expect(synthetic351).toContain(replacement.legalQuote);
      if(id===1285) expect(replacement.legalQuote).toBe(synthetic351.split("\n").slice(0,2).join("\n"));
      else expect(replacement.legalQuote).toBe(synthetic351.split("\n")[id-1285+1]);
    }
  });
  it("recusa outros itens, footer duplicado/ausente, literal truncada ou título estranho",()=> {
    for(const [id,explanation,literal] of [[100,oldExplanation,synthetic351],[1285,"sem fonte",synthetic351],[1285,oldExplanation+oldExplanation,synthetic351],[1285,oldExplanation,synthetic351+"\nTítulo352"],[1285,oldExplanation,synthetic351.split("\n").slice(0,5).join("\n")]] as const) expect(()=>cpCutReplacement(id,explanation,literal)).toThrow();
  });
  it("exige piso individual e catálogo exatos; crescimento/mudança requer outra prévia delimitada",()=> {
    expect(assertCpCutFloors(counts)).toHaveLength(3);
    for(const candidates of [counts.slice(1),counts.map(r=>({...r,count:r.slug===CP_CUT_PRODUCT?65:r.count})),counts.map(r=>({...r,count:r.count+1})),counts.map(r=>({...r,slug:r.count===69?"outro-cargo":r.slug})),[...counts,{slug:"extra",count:68,ready:true}]]) expect(()=>assertCpCutFloors(candidates)).toThrow();
  });
  it("nenhuma dependência extra/normativa é remapeada silenciosamente",()=> {
    const row:StoredCpCorrectionArticle={id:3733,path:"art-351",versionId:63,articleOrder:1,heading:null,literalText:synthetic351,sourceRights:"official_text",editorialStatus:"reviewed",questionCount:5,bindingCount:5,primaryRequirementCount:1,additionalRequirementCount:0};
    expect(()=>assertCpCutImpact([row])).not.toThrow();
    for(const patch of [{questionCount:6},{bindingCount:4},{primaryRequirementCount:2},{additionalRequirementCount:1},{id:3507,path:"art-155"}]) expect(()=>assertCpCutImpact([{...row,...patch}])).toThrow();
    expect(()=>assertCpCutImpact([])).toThrow();
  });
  it("fingerprint inclui mudanças no conteúdo, contexto e ator; frescor tem limite e tolerância explícitos",()=> {
    expect(cpCutFingerprint({actor:1,hash:"a"})).not.toBe(cpCutFingerprint({actor:2,hash:"a"}));
    expect(cpCutFingerprint({actor:1,hash:"a"})).not.toBe(cpCutFingerprint({actor:1,hash:"b"}));
    const now=new Date("2026-10-12T08:00:00Z");
    expect(()=>assertCpCutFresh(new Date(now.getTime()-300000),now)).not.toThrow();
    expect(()=>assertCpCutFresh(new Date(now.getTime()-300001),now)).toThrow();
    expect(()=>assertCpCutFresh(new Date(now.getTime()+30001),now)).toThrow();
  });
  it("preview e apply têm entradas distintas, sem permissões implícitas ou outro destino",()=> {
    expect(parseCpCutArgs(["output=cp-cut-a"])).toEqual({apply:false,output:"cp-cut-a",fingerprint:undefined});
    expect(parseCpCutArgs(["--apply","fingerprint="+"a".repeat(64),"output=cp-cut-b"])).toMatchObject({apply:true});
    for(const args of [[],["output=../x"],["output=a","--apply"],["output=a","fingerprint="+"a".repeat(64)],["output=a","--apply","--apply","fingerprint="+"a".repeat(64)],["output=a","product=other"]]) expect(()=>parseCpCutArgs(args)).toThrow();
    expect(requireCpCutDatabase("postgres://leiprova_owner:fixture@db/leiprova")).toContain("owner");
    for(const url of [undefined,"postgres://leiprova_app:fixture@db/leiprova","postgres://leiprova_owner:fixture@db/other","postgres://leiprova_owner:fixture@db/leiprova?x=1"]) expect(()=>requireCpCutDatabase(url)).toThrow();
  });
  it("verificador exige recibo real; não oferece restore, ativação ou fallback",()=> {
    expect(parseCpSourceVerificationArgs(["fingerprint="+"a".repeat(64)])).toEqual({apply:false,fingerprint:"a".repeat(64)});
    expect(parseCpSourceVerificationArgs(["--apply","fingerprint="+"a".repeat(64)])).toMatchObject({apply:true});
    for(const args of [[],["--apply"],["--restore","fingerprint="+"a".repeat(64)],["fingerprint="+"a".repeat(64),"--fallback"]]) expect(()=>parseCpSourceVerificationArgs(args)).toThrow();
  });
});
