import { describe, expect, it } from "vitest";
import { CAMARA_PROCUREMENT_SOURCE } from "@/lib/official-sources/camara-procurement-text";
import { PROCUREMENT_2026_AMOUNTS, PROCUREMENT_CONTEXT_SOURCE, prepareProcurementSupplementaryContext } from "@/lib/official-sources/procurement-context";

const literals: Record<string, string> = {
  "art-37": "Art. 37. O julgamento por melhor técnica ou por técnica e preço deverá ser realizado por:\nI - verificação da capacitação e da experiência do licitante, comprovadas por meio da apresentação de atestados de obras, produtos ou serviços previamente realizados;\nII - atribuição de notas a quesitos de natureza qualitativa por banca designada para esse fim, de acordo com orientações e limites definidos em edital, considerados a demonstração de conhecimento do objeto, a metodologia e o programa de trabalho, a qualificação das equipes técnicas e a relação dos produtos que serão entregues;\nIII - atribuição de notas por desempenho do licitante em contratações anteriores aferida nos documentos comprobatórios de que trata o § 3º do art. 88 desta Lei e em registro cadastral unificado disponível no Portal Nacional de Contratações Públicas (PNCP).\n§ 1º A banca referida no inciso II do caput deste artigo terá no mínimo 3 (três) membros e poderá ser composta de:\nI - servidores efetivos ou empregados públicos pertencentes aos quadros permanentes da Administração Pública;\nII - profissionais contratados por conhecimento técnico, experiência ou renome na avaliação dos quesitos especificados em edital, desde que seus trabalhos sejam supervisionados por profissionais designados conforme o disposto no art. 7º desta Lei.\n§ 2º Ressalvados os casos de inexigibilidade de licitação, na licitação para contratação dos serviços técnicos especializados de natureza predominantemente intelectual previstos nas alíneas \"a\", \"d\" e \"h\" do inciso XVIII do caput do art. 6º desta Lei cujo valor estimado da contratação seja superior a R$ 300.000,00 (trezentos mil reais), o julgamento será por:\nI - melhor técnica; ou\nII - técnica e preço, na proporção de 70% (setenta por cento) de valoração da proposta técnica.",
  "art-95": "Art. 95. O instrumento de contrato é obrigatório, salvo nas seguintes hipóteses, em que a Administração poderá substituí-lo por outro instrumento hábil, como carta-contrato, nota de empenho de despesa, autorização de compra ou ordem de execução de serviço:\nI - dispensa de licitação em razão de valor;\nII - compras com entrega imediata e integral dos bens adquiridos e dos quais não resultem obrigações futuras, inclusive quanto a assistência técnica, independentemente de seu valor.\n§ 1º Às hipóteses de substituição do instrumento de contrato, aplica-se, no que couber, o disposto no art. 92 desta Lei.\n§ 2º É nulo e de nenhum efeito o contrato verbal com a Administração, salvo o de pequenas compras ou o de prestação de serviços de pronto pagamento, assim entendidos aqueles de valor não superior a R$ 10.000,00 (dez mil reais).",
  "art-175": "Art. 175. Sem prejuízo do disposto no art. 174 desta Lei, os entes federativos poderão instituir sítio eletrônico oficial para divulgação complementar e realização das respectivas contratações.\n§ 1º Desde que mantida a integração com o PNCP, as contratações poderão ser realizadas por meio de sistema eletrônico fornecido por pessoa jurídica de direito público ou privado, na forma de regulamento do Poder Executivo federal.\n§ 2º Até 31 de dezembro de 2023, os Municípios deverão realizar divulgação complementar de suas contratações mediante publicação de extrato de edital de licitação em jornal diário de grande circulação local.",
  "art-191": "Art. 191. Até o decurso do prazo de que trata o inciso II do caput do art. 193, a Administração poderá optar por licitar ou contratar diretamente de acordo com esta Lei ou de acordo com as leis citadas no referido inciso, e a opção escolhida deverá ser indicada expressamente no edital ou no aviso ou instrumento de contratação direta, vedada a aplicação combinada desta Lei com as citadas no referido inciso.\nParágrafo único. Na hipótese do caput deste artigo, se a Administração optar por licitar de acordo com as leis citadas no inciso II do caput do art. 193 desta Lei, o contrato respectivo será regido pelas regras nelas previstas durante toda a sua vigência.",
  "art-193": "Art. 193. Revogam-se:\nI - os arts. 89 a 108 da Lei nº 8.666, de 21 de junho de 1993, na data de publicação desta Lei;\nII - em 30 de dezembro de 2023:\na) a Lei nº 8.666, de 21 de junho de 1993;\nb) a Lei nº 10.520, de 17 de julho de 2002; e\nc) os arts. 1º a 47-A da Lei nº 12.462, de 4 de agosto de 2011."
};
function basis(articlePath: string) { return { articlePath, literalText: literals[articlePath], corpusSha256: PROCUREMENT_CONTEXT_SOURCE.lawCorpusSha256, sourceUrl: CAMARA_PROCUREMENT_SOURCE.url, parserVersion: CAMARA_PROCUREMENT_SOURCE.parserVersion, referenceDate: "2026-10-12" }; }

describe("contexto complementar de licitações, sem aprovação", () => {
  it("contém nove valores do anexo em centavos exatos", () => {
    expect(PROCUREMENT_2026_AMOUNTS).toHaveLength(9);
    expect(PROCUREMENT_2026_AMOUNTS.find((row) => row.key === "art-75:ii")?.cents).toBe(6549211);
    expect(PROCUREMENT_2026_AMOUNTS.find((row) => row.key === "art-6:xxii")?.cents).toBe(26196842104);
    for (const amount of PROCUREMENT_2026_AMOUNTS) expect(Number(amount.brl.replaceAll(".", "").replace(",", ""))).toBe(amount.cents);
  });
  it("mantém nominal literal e apresenta limite aplicado como fato separado", () => {
    const result = prepareProcurementSupplementaryContext({ ...basis("art-37"), focus: "annual_amount", demand: "applied_limit", amountKey: "art-37:p2" });
    expect(result.literalText).toBe(literals["art-37"]); expect(result.literalText).toContain("300.000,00");
    expect(result.contextKind).toBe("annual_amount"); if (result.contextKind === "annual_amount") { expect(result.amount.brl).toBe("392.952,63"); expect(result.editorialCoverageWindow.representsLegalExpiry).toBe(false); }
    expect(result.publicationAllowed).toBe(false); expect(result.humanReview).toBe(false); expect(result.requiresApprovedSourceIds).toBe(true); expect(result.sourceIds).toEqual([]);
  });
  it("bloqueia outro exercício, dispositivo incorreto, ADI e literal adulterado", () => {
    const input = { ...basis("art-37"), focus: "annual_amount" as const, demand: "applied_limit" as const, amountKey: "art-37:p2" };
    for (const change of [{ referenceDate: "2025-12-31" }, { referenceDate: "2027-01-01" }, { amountKey: "art-75:i" }, { judicialScope: "emergency_recontracting" as const }, { literalText: input.literalText + "alterado" }, { referenceDate: "2026-02-30" }]) expect(() => prepareProcurementSupplementaryContext({ ...input, ...change })).toThrow();
  });
  it("marca175§2 encerrado sem apagar demais regras de publicidade", () => {
    const result = prepareProcurementSupplementaryContext({ ...basis("art-175"), focus: "temporal", demand: "current_transition_rule" });
    if (result.contextKind !== "temporal") throw new Error("contexto errado");
    expect(result.facts).toMatchObject({ obligationWindowThrough: "2023-12-31", newWindowOpenAtReferenceDate: false });
    expect(result.authoringConstraints.join(" ")).toContain("não afasta");
    expect(() => prepareProcurementSupplementaryContext({ ...basis("art-175"), focus: "temporal", demand: "historical_case", eventDate: "2024-01-01" })).toThrow();
  });
  it("exige caso datado, trata fronteira de revogação separadamente e conserva regime contratual", () => {
    const input = { ...basis("art-191"), focus: "temporal" as const, demand: "historical_case" as const };
    const result = prepareProcurementSupplementaryContext({ ...input, eventDate: "2023-12-29" });
    if (result.contextKind !== "temporal") throw new Error("contexto errado");
    expect(result.facts).toMatchObject({ oldLawsRevocationDate: "2023-12-30", oldRegimeNewChoiceOpenAtReferenceDate: false, oldRegimeContractGovernanceCanSurvive: true });
    expect(result.legislationBasis).toBe("current_2026_not_reconstructed_historical_edition");
    for (const eventDate of [undefined, "2023-12-30", "2026-10-13", "2020-01-01"]) expect(() => prepareProcurementSupplementaryContext({ ...input, eventDate })).toThrow();
    expect(() => prepareProcurementSupplementaryContext({ ...input, eventDate: "2023-01-01", referenceDate: "2023-10-01" })).toThrow(/edição histórica/u);
  });
});
