import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseDecreeSupplementaryApprovalArgs, validateExistingDecreeSupplementaryRows } from "../scripts/approve-procurement-supplementary-sources";
import { DECREE_ANNEX_NORMALIZED_SHA, DECREE_BODY_NORMALIZED_SHA, DECREE_COMPLEMENTARY_PARSER, DECREE_COMPLEMENTARY_POLICY, DECREE_METADATA_RAW_SHA, DECREE_METADATA_URL, DECREE_SOURCE_KEYS, parseDecreeBody, reconstructDecreeAnnexTable } from "@/lib/official-sources/decree-complementary";
import { attachApprovedDecreeSourceIds } from "@/lib/official-sources/decree-complementary-query";
import { PROCUREMENT_2026_AMOUNTS, PROCUREMENT_CONTEXT_SOURCE } from "@/lib/official-sources/procurement-context";
import { OFFICIAL_LAW_STANDING_REFERENCE } from "@/lib/official-sources/standing-law-review";
import type { legalComplementarySources } from "@/lib/db/schema-complementary";

// Only public decree articles and its 9-row table; no raw/private HTML or full DOU PDF.
const normalizedBodies = [
  "Art. 1º Ficam atualizados os valores estabelecidos na Lei nº 14.133, de 1º de abril de 2021, na forma do Anexo.\n\nArt. 2º A atualização dos valores de que trata o art. 1º será divulgada no Portal Nacional de Contratações Públicas- PNCP, conforme o disposto no art. 182 da Lei nº 14.133, de 1º de abril de 2021.\n\nArt. 3º Fica delegada à autoridade máxima do Ministério da Gestão e da Inovação em Serviços Públicos a competência para atualizar, nos exercícios subsequentes, os valores de que trata o art. 1º.\n\nArt. 4º Fica revogado o Decreto nº 12.343, de 30 de dezembro de 2024.\n\nArt. 5º Este Decreto entra em vigor em 1º de janeiro de 2026.",
  "ANEXO — Atualização dos valores estabelecidos na Lei nº 14.133, de 1º de abril de 2021\nArt. 6º, caput, inciso XXII R$ 261.968.421,04 (duzentos e sessenta e um milhões novecentos e sessenta e oito mil quatrocentos e vinte e um reais e quatro centavos)\nArt. 37, § 2º R$ 392.952,63 (trezentos e noventa e dois mil novecentos e cinquenta e dois reais e sessenta e três centavos)\nArt. 70, caput, inciso III R$ 392.952,63 (trezentos e noventa e dois mil novecentos e cinquenta e dois reais e sessenta e três centavos)\nArt. 75, caput, inciso I R$ 130.984,20 (cento e trinta mil novecentos e oitenta e quatro reais e vinte centavos)\nArt. 75, caput, inciso II R$ 65.492,11 (sessenta e cinco mil quatrocentos e noventa e dois reais e onze centavos)\nArt. 75, caput, inciso IV, alínea \"c\" R$ 392.952,63 (trezentos e noventa e dois mil novecentos e cinquenta e dois reais e sessenta e três centavos)\nArt. 75, § 7º R$ 10.478,74 (dez mil quatrocentos e setenta e oito reais e setenta e quatro centavos)\nArt. 95, § 2º R$ 13.098,41 (treze mil noventa e oito reais e quarenta e um centavos)\nArt. 184-A R$ 1.646.430,90 (um milhão seiscentos e quarenta e seis mil quatrocentos e trinta reais e noventa centavos)"
];
const now = new Date("2026-10-12T06:00:00.000Z");
function rows(): (typeof legalComplementarySources.$inferSelect)[] {
  return DECREE_SOURCE_KEYS.map((key,index)=>({ id:901+index, publicId:index===0?"77d5d582-238b-481e-921e-3f5c48aa4391":"b6c9c9dc-bf69-41ec-a6d6-af3c9d6c9c8c", legalActId:100, sourceKey:key, sourceKind:index===0?"annual_decree_body":"annual_decree_annex", sourceUrl:index===0?PROCUREMENT_CONTEXT_SOURCE.decree.url:PROCUREMENT_CONTEXT_SOURCE.annex.url, sourceActType:"decreto", sourceActNumber:"12.807", sourceActYear:2025, parserVersion:DECREE_COMPLEMENTARY_PARSER, rawChecksumSha256:index===0?PROCUREMENT_CONTEXT_SOURCE.decree.rawSha256:PROCUREMENT_CONTEXT_SOURCE.annex.rawSha256, normalizedChecksumSha256:index===0?DECREE_BODY_NORMALIZED_SHA:DECREE_ANNEX_NORMALIZED_SHA, normalizedBody:normalizedBodies[index], evidenceFingerprint:"a".repeat(64), facts:{policy:DECREE_COMPLEMENTARY_POLICY,amounts:PROCUREMENT_2026_AMOUNTS,statutoryNominalAmountsUnchanged:true,judicialRecontractingExcluded:true,coverageIsNotNormativeExpiry:true}, sourceValidityObservation:{metadataUrl:DECREE_METADATA_URL,metadataRawSha256:DECREE_METADATA_RAW_SHA,observedAt:now.toISOString(),expressRevocationReported:false,doesNotPromiseFutureValidity:true}, normativeEffectiveFrom:"2026-01-01",normativeValidUntil:null,editorialCoverageFrom:"2026-01-01",editorialCoverageThrough:"2026-12-31", status:"approved", approvalAuditId:300,approvalReference:OFFICIAL_LAW_STANDING_REFERENCE,approvalMode:"owner_standing_authorization",humanReview:false,reviewedByUserId:1,reviewedAt:now,lastVerifiedAt:now,fetchedAt:now,createdAt:now,updatedAt:now }));
}
const labels=["Art. 6º, caput, inciso XXII","Art. 37, § 2º","Art. 70, caput, inciso III","Art. 75, caput, inciso I","Art. 75, caput, inciso II",'Art. 75, caput, inciso IV, alínea "c"',"Art. 75, § 7º","Art. 95, § 2º","Art. 184-A"];
function tableItems() { return PROCUREMENT_2026_AMOUNTS.flatMap((amount,index)=>[{str:labels[index],x:90,y:266-index*22},{str:`R$ ${amount.brl} (valor por extenso de teste)`,x:197,y:266-index*22}]); }

describe("fontes complementares delimitadas: persistência/IDs",()=>{
 it("default preview e apply exigem fingerprint sem flags extras",()=>{
  expect(parseDecreeSupplementaryApprovalArgs([])).toEqual({apply:false,fingerprint:undefined});
  expect(parseDecreeSupplementaryApprovalArgs(["--apply",`fingerprint=${"a".repeat(64)}`]).apply).toBe(true);
  for(const args of [["--apply"],["--apply","--apply"],["fingerprint=wrong"],["--standing"],[`fingerprint=${"a".repeat(64)}`,`fingerprint=${"a".repeat(64)}`]])expect(()=>parseDecreeSupplementaryApprovalArgs(args)).toThrow();
 });
 it("segrega tabela DOU de outros decretos/rodapés e rejeita valor ou linha alterada",()=>{
  expect(reconstructDecreeAnnexTable([...tableItems(),{str:"DECRETO12.808",x:420,y:180},{str:"rodapé",x:80,y:20}])).toContain("130.984,20");
  expect(()=>reconstructDecreeAnnexTable(tableItems().slice(2))).toThrow();
  expect(()=>reconstructDecreeAnnexTable(tableItems().map((item)=>item.str.includes("65.492,11")?{...item,str:item.str.replace("65.492,11","50.000,00")}:item))).toThrow();
 });
 it("bloqueia erroHTTP200 ou novo bruto sem reconciliar",()=>{
  for(const text of ["<html>504 Gateway Time-out</html>","<html>DECRETO12.807: texto arbitrário</html>"])expect(()=>parseDecreeBody(new TextEncoder().encode(text))).toThrow(/Fonte bruta/u);
  expect(createHash("sha256").update(normalizedBodies[0]).digest("hex")).toBe(DECREE_BODY_NORMALIZED_SHA);
  expect(createHash("sha256").update(normalizedBodies[1]).digest("hex")).toBe(DECREE_ANNEX_NORMALIZED_SHA);
 });
 it("recibo existente verifica par deIDs e não restaura suspensão/prova diferente",()=>{
  const existing=rows(); const common={normativeValidUntil:null,facts:{policy:DECREE_COMPLEMENTARY_POLICY,amounts:PROCUREMENT_2026_AMOUNTS,statutoryNominalAmountsUnchanged:true,judicialRecontractingExcluded:true,coverageIsNotNormativeExpiry:true},sourceValidityObservation:{metadataUrl:DECREE_METADATA_URL,metadataRawSha256:DECREE_METADATA_RAW_SHA,observedAt:new Date(now.getTime()+1000).toISOString(),expressRevocationReported:false,doesNotPromiseFutureValidity:true}}; const parts: Parameters<typeof validateExistingDecreeSupplementaryRows>[1]["parts"]=[{...existing[0],...common,sourceKey:DECREE_SOURCE_KEYS[0],sourceUrl:PROCUREMENT_CONTEXT_SOURCE.decree.url},{...existing[1],...common,sourceKey:DECREE_SOURCE_KEYS[1],sourceUrl:PROCUREMENT_CONTEXT_SOURCE.annex.url}];
  const prepared={fingerprint:"a".repeat(64),parts,publicationAllowed:false as const,humanReview:false as const};
  expect(validateExistingDecreeSupplementaryRows(existing,prepared,"a".repeat(64))?.sourceIds).toHaveLength(2);
  expect(()=>validateExistingDecreeSupplementaryRows(existing.map((row,index)=>index===0?{...row,status:"suspended"}:row),prepared,"a".repeat(64))).toThrow(/restaurar/u);
  expect(()=>validateExistingDecreeSupplementaryRows(existing.slice(1),prepared,"a".repeat(64))).toThrow(/incompleto/u);
  expect(()=>validateExistingDecreeSupplementaryRows(existing.map((row)=>({...row,normativeValidUntil:"2026-12-31"})),prepared,"a".repeat(64))).toThrow();
 });
 it("schema não mistura vigência com cobertura e APP recebe apenas fontes approved",()=>{
  const migration=readFileSync(new URL("../drizzle/0053_legal_complementary_sources.sql",import.meta.url),"utf8");
  expect(migration).toContain("normative_valid_until IS NULL");expect(migration).toContain("editorial_coverage_through='2026-12-31'");expect(migration).toContain("ENABLE ROW LEVEL SECURITY");expect(migration).toContain("USING(status='approved' AND");expect(migration).toContain("approval_audit_id IS NOT NULL");expect(migration).toContain("last_verified_at>=now()-interval '6 hours'");expect(migration).toContain("Não restaurar fonte complementar encerrada");
  expect(migration.replace(/^--.*$/gmu,"")).not.toMatch(/ALTER TABLE (?:legal_articles|legal_versions|questions)|SECURITY DEFINER/u);
 });
});

describe("consumidor não autoriza publicação sem artigo exato",()=>{
 it("recusa dados nominais falsos mesmo com IDs sintéticos aprovados",()=>{
  expect(()=>attachApprovedDecreeSourceIds({articlePath:"art-37",literalText:"Art.37. Valor adulterado",sourceUrl:"wrong",parserVersion:"wrong",corpusSha256:"a".repeat(64),referenceDate:"2026-10-12",focus:"annual_amount",demand:"applied_limit",amountKey:"art-37:p2"},rows(),100,now)).toThrow(/diverge/u);
 });
  it("conecta dois IDs aprovados ao contexto do Autor e preserva gate de artigo/questão",()=>{
    const input={articlePath:"art-95",literalText:"Art. 95. O instrumento de contrato é obrigatório, salvo nas seguintes hipóteses, em que a Administração poderá substituí-lo por outro instrumento hábil, como carta-contrato, nota de empenho de despesa, autorização de compra ou ordem de execução de serviço:\nI - dispensa de licitação em razão de valor;\nII - compras com entrega imediata e integral dos bens adquiridos e dos quais não resultem obrigações futuras, inclusive quanto a assistência técnica, independentemente de seu valor.\n§ 1º Às hipóteses de substituição do instrumento de contrato, aplica-se, no que couber, o disposto no art. 92 desta Lei.\n§ 2º É nulo e de nenhum efeito o contrato verbal com a Administração, salvo o de pequenas compras ou o de prestação de serviços de pronto pagamento, assim entendidos aqueles de valor não superior a R$ 10.000,00 (dez mil reais).",sourceUrl:"https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-normaatualizada-pl.pdf",parserVersion:"camara-procurement-pdf-unpdf1.8.1-v1.0.0",corpusSha256:"e622788d8a7da96d4e77deb8a1ea458ca1014fc44a8dd8a86df310d02a598e8a",referenceDate:"2026-10-12",focus:"annual_amount" as const,demand:"applied_limit" as const,amountKey:"art-95:p2"};
    const result=attachApprovedDecreeSourceIds(input,rows(),100,now);
    expect(result.sourceIds).toEqual([901,902]);expect(result.contentFingerprint).toMatch(/^[a-f0-9]{64}$/u);expect(attachApprovedDecreeSourceIds(input,[...rows()].reverse(),100,now).contentFingerprint).toBe(result.contentFingerprint);expect(attachApprovedDecreeSourceIds(input,rows().map((row)=>({...row,lastVerifiedAt:new Date(now.getTime()+1000)})),100,new Date(now.getTime()+1000)).contentFingerprint).toBe(result.contentFingerprint);expect(result.status).toBe("approved_dependency_context");expect(result.publicationAllowed).toBe(false);expect(result.lawArticleReviewStillRequired).toBe(true);expect(result.questionApprovalStillRequired).toBe(true);expect(result.literalText).toBe(input.literalText);
    for(const changed of [rows().slice(1),rows().map((row,index)=>index===1?{...row,status:"pending_review"}:row),rows().map((row,index)=>index===1?{...row,approvalAuditId:301}:row),rows().map((row)=>({...row,rawChecksumSha256:"f".repeat(64)})),rows().map((row)=>({...row,lastVerifiedAt:new Date(now.getTime()-21_600_001)}))]) expect(()=>attachApprovedDecreeSourceIds(input,changed,100,now)).toThrow();
    expect(()=>attachApprovedDecreeSourceIds({...input,referenceDate:"2027-01-01"},rows(),100,now)).toThrow(/2026/u);
  });

 it("monitor recaptura antes de locks, suspende inconsistência e nunca reativa",()=>{
  const monitor=readFileSync(new URL("../scripts/verify-procurement-supplementary-sources.ts",import.meta.url),"utf8");
  expect(monitor).toContain("await fetchDecreeComplementaryEvidence()");expect(monitor).toContain('status: "suspended"');expect(monitor).toContain("lastVerifiedAt: now");expect(monitor).toContain("if (!apply)");expect(monitor).toContain('isolationLevel: "serializable"');expect(monitor).not.toContain('status: "approved"');expect(monitor).toContain("official_dependency_verification_failed_not_claim_of_revocation");
 });

});
