import { createHash } from "node:crypto";

import { CAMARA_PROCUREMENT_SOURCE } from "./camara-procurement-text";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export const PROCUREMENT_CONTEXT_POLICY = "procurement-supplementary-context-2026-v1";
export const PROCUREMENT_CONTEXT_SOURCE = {
  lawCorpusSha256: "e622788d8a7da96d4e77deb8a1ea458ca1014fc44a8dd8a86df310d02a598e8a",
  decree: { url: "https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-publicacaooriginal-177646-pe.html", rawSha256: "ba0e69a80dcee00a68793e9dd52ef323654b2b6921cddcb6610bd05bdf50b1c1", publicationDate: "2025-12-30", effectiveFrom: "2026-01-01" },
  annex: { url: "https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-anexo-pe.pdf", rawSha256: "6d12b7f6adb3d6b65ecf5da44ec54eb8b201c7c90a75499d21cbba38841b2fb9", publicationDate: "2025-12-30", page: 17 },
  transition: { url: "https://www2.camara.leg.br/legin/fed/leicom/2023/leicomplementar-198-28-junho-2023-794386-publicacaooriginal-168282-pl.html", rawSha256: "dd81ebbcbb09f5e328e53f793ed76dda64fb32e3b90f5769fc14758a1f30db73", publicationDate: "2023-06-28", provision: "Art. 3" },
  publicity: { url: "https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-promulgacaodevetos-162977-pl.html", rawSha256: "25fdd612587a58d486c87984be27b4ccb791d685e4b94053173e5660a45146d1", publicationDate: "2021-06-11", provision: "Art. 175 §2" },
} as const;

// Integers in centavos avoid floats and locale-dependent string parsing.
export const PROCUREMENT_2026_AMOUNTS = [
  { key: "art-6:xxii", articlePath: "art-6", provision: "XXII", cents: 26196842104, brl: "261.968.421,04" },
  { key: "art-37:p2", articlePath: "art-37", provision: "§2", cents: 39295263, brl: "392.952,63" },
  { key: "art-70:iii", articlePath: "art-70", provision: "III", cents: 39295263, brl: "392.952,63" },
  { key: "art-75:i", articlePath: "art-75", provision: "I", cents: 13098420, brl: "130.984,20" },
  { key: "art-75:ii", articlePath: "art-75", provision: "II", cents: 6549211, brl: "65.492,11" },
  { key: "art-75:iv-c", articlePath: "art-75", provision: "IV c", cents: 39295263, brl: "392.952,63" },
  { key: "art-75:p7", articlePath: "art-75", provision: "§7", cents: 1047874, brl: "10.478,74" },
  { key: "art-95:p2", articlePath: "art-95", provision: "§2", cents: 1309841, brl: "13.098,41" },
  { key: "art-184-a:caput", articlePath: "art-184-a", provision: "caput", cents: 164643090, brl: "1.646.430,90" },
] as const;

const LITERAL_HASHES: Record<string, string> = {
  "art-6": "90dbd974760ef45bd3d38fbd5fb11d37dde883d424a00f3c5e9b5ac31d3ec475",
  "art-37": "db14d27a22cd48f24dd9049a6455385e19f68f7977ccf957444360a4420aa496",
  "art-70": "4ed5b61205dde484e9b3cc89633c34e483aaa1131a94d56a5db7c4f0a3e31077",
  "art-75": "fde7ac6e7753ec775960d839ae1034872ba8dc68d11ed0a9587877b4344407df",
  "art-95": "8320bb0baf3f899125147f9c94c7ccd04344af880b972fd61edbf8e9a34249d2",
  "art-175": "8a1dcd4ff07f8fa5a8c10b6421a30ddafbc815160896c250302876e935c2aba9",
  "art-184-a": "c3c8eb0fe58523671e57541903db6331543ad4c3867c28376f793e2c895466bc",
  "art-191": "4d054c0704d122197e40aa7bc65c9a5680e6435372f1ee2cf6d5a4510b94acdf",
  "art-193": "dc3abab7b100efe4ba61d966488ac5e6e21f60455a1bd30e1babbc80e06501f1"
};

type Basis = { articlePath: string; literalText: string; corpusSha256: string; sourceUrl: string; parserVersion: string };
type MonetaryInput = Basis & { focus: "annual_amount"; demand: "applied_limit"; amountKey: string; referenceDate: string; judicialScope?: "emergency_recontracting" };
type TemporalInput = Basis & { focus: "temporal"; demand: "historical_case" | "current_transition_rule"; referenceDate: string; eventDate?: string };

function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Data civil ISO válida obrigatória.");
  return value;
}

function assertBasis(input: Basis) {
  if (input.sourceUrl !== CAMARA_PROCUREMENT_SOURCE.url || input.parserVersion !== CAMARA_PROCUREMENT_SOURCE.parserVersion || input.corpusSha256 !== PROCUREMENT_CONTEXT_SOURCE.lawCorpusSha256 || !LITERAL_HASHES[input.articlePath] || hash(input.literalText) !== LITERAL_HASHES[input.articlePath]) throw new Error("Artigo literal/origem/parser/corpus diverge da base delimitada.");
}

/** A preparation contract, never an approval receipt or authoring permission. */
export function prepareProcurementSupplementaryContext(input: MonetaryInput | TemporalInput) {
  if (!["annual_amount", "temporal"].includes(input.focus)) throw new Error("Foco de preparação desconhecido.");
  if (input.focus === "temporal" && !["historical_case", "current_transition_rule"].includes(input.demand)) throw new Error("Demanda temporal desconhecida.");
  assertBasis(input);
  const referenceDate = date(input.referenceDate);
  const base = { legislationBasis: "current_2026_not_reconstructed_historical_edition" as const, policy: PROCUREMENT_CONTEXT_POLICY, status: "prepared_for_automated_review" as const, publicationAllowed: false as const, humanReview: false as const, requiresApprovedSourceIds: true as const, sourceIds: [] as readonly number[], literalText: input.literalText, literalSha256: hash(input.literalText), articlePath: input.articlePath, sourceUrl: input.sourceUrl, parserVersion: input.parserVersion, corpusSha256: input.corpusSha256, referenceDate };
  if (input.focus === "annual_amount") {
    if (input.demand !== "applied_limit" || referenceDate < "2026-01-01" || referenceDate > "2026-12-31") throw new Error("Valores preparados somente para aplicação em 2026; não há cobertura de outro exercício ou transcrição nominal.");
    if (input.judicialScope === "emergency_recontracting") throw new Error("ADI 6890 permanece bloqueada; contexto monetário não autoriza recontratação emergencial.");
    const amount = PROCUREMENT_2026_AMOUNTS.find((candidate) => candidate.key === input.amountKey);
    if (!amount || amount.articlePath !== input.articlePath) throw new Error("Limite anual fora do dispositivo exato.");
    return { ...base, contextKind: "annual_amount" as const, demand: "applied_limit" as const, amount, complementarySources: [PROCUREMENT_CONTEXT_SOURCE.decree, PROCUREMENT_CONTEXT_SOURCE.annex], editorialCoverageWindow: { from: "2026-01-01", through: "2026-12-31", representsLegalExpiry: false as const }, authoringConstraints: ["Citar Lei 14.133 e Decreto 12.807/2025/anexo separadamente; declarar exercício de 2026.", "Manter o valor nominal no literal. O limite aplicado é um fato complementar, não nova redação da lei.", "Valor informado é a base da tabela. Conferir condições, agregação e eventual duplicação legal (inclusive art. 75 §3) antes de resolver caso concreto.", "Não extrapolar o contexto para ADI/recontratação nem afirmar ausência de atualizações futuras."], unresolvedDependencies: input.articlePath === "art-75" ? ["adi6890_complete_primary_decision_not_reviewed"] : [] };
  }
  if (referenceDate < "2026-01-01" || referenceDate > "2026-12-31") throw new Error("Base compilada atual conferida em 2026; não representa edição histórica da lei em outro ano.");
  if (!["art-175", "art-191", "art-193"].includes(input.articlePath)) throw new Error("Regra temporal fora dos três artigos delimitados.");
  const eventDate = input.eventDate ? date(input.eventDate) : null;
  if (eventDate && eventDate > referenceDate) throw new Error("Evento histórico posterior à data de referência.");
  if (input.demand === "historical_case" && eventDate && eventDate < "2021-04-01") throw new Error("Caso histórico anterior à janela preparada da Lei 14.133.");
  if (input.demand === "historical_case" && !eventDate) throw new Error("Caso histórico exige data explícita do edital/evento.");
  if (input.articlePath === "art-175") {
    if (input.demand === "historical_case" && (eventDate! < "2021-06-11" || eventDate! > "2023-12-31")) throw new Error("Caso do art. 175 §2 fora da janela expressa/parte promulgada conferida.");
    return { ...base, contextKind: "temporal" as const, demand: input.demand, eventDate, complementarySources: [PROCUREMENT_CONTEXT_SOURCE.publicity], facts: { provision: "§2", obligationWindowThrough: "2023-12-31", newWindowOpenAtReferenceDate: referenceDate >= "2021-06-11" && referenceDate <= "2023-12-31" }, authoringConstraints: ["Identificar Município e data. Não tratar divulgação complementar do §2 como nova obrigação temporal em 2026.", "O prazo encerrado do §2 não afasta outras obrigações de publicidade dos editais."], unresolvedDependencies: [] };
  }
  if (input.articlePath === "art-191" && input.demand === "historical_case" && (eventDate! < "2021-04-01" || eventDate! >= "2023-12-30")) throw new Error("Escolha histórica só preparada antes da revogação em 30/12/2023; fronteira/novo edital posterior exigem outra análise.");
  return { ...base, contextKind: "temporal" as const, demand: input.demand, eventDate, complementarySources: [PROCUREMENT_CONTEXT_SOURCE.transition], facts: { oldLawsRevocationDate: "2023-12-30", oldRegimeNewChoiceOpenAtReferenceDate: referenceDate >= "2021-04-01" && referenceDate < "2023-12-30", oldRegimeContractGovernanceCanSurvive: true, listedOldLaws: ["Lei8.666/1993", "Lei10.520/2002", "Lei12.462/2011 arts.1–47-A"] }, authoringConstraints: ["Indicar data do edital/contratação e regime expressamente escolhido. Não presumir validade do procedimento ou contrato apenas pela data.", "Art.191 parágrafo único conserva o regime do contrato durante sua vigência; isso não abre escolha de regime antigo para novo edital de 2026.", "Não aplicar combinadamente os regimes. Não reconstruir texto histórico das leis revogadas a partir de corpus atual.", "Casos de fronteira em 30/12/2023 exigem análise própria; este pacote não decide procedimentos desse dia."], unresolvedDependencies: [] };
}
