import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAMARA_PROCUREMENT_SOURCE } from "@/lib/official-sources/camara-procurement-text";
import { getOfficialLegalSource } from "@/lib/official-sources/legal-registry";
import { parseConsolidatedLegalArticles } from "@/lib/official-sources/legal-text";
import { OFFICIAL_LAW_STANDING_REFERENCE, PROCUREMENT_PARTIAL_POLICY, PROCUREMENT_PENDING_ARTICLES, PROCUREMENT_RECONCILIATION_DOSSIER, PROCUREMENT_RECONCILED_RAW_PDF, PROCUREMENT_VETO_EVIDENCE, parseStandingProcurementReviewArgs, partitionStandingProcurementArticles, standingProcurementFingerprint, validateFreshStandingProcurementCapture, validateProcurementCaptureFreshness, validateProcurementVetoReconciliation, validateStandingProcurementCorpus, validateStandingProcurementExistingArticles, validateStandingProcurementReceipt, type StandingProcurementContext } from "@/lib/official-sources/standing-procurement-review";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const now = new Date("2026-10-12T04:56:00.000Z");
const snapshot = "f11d3585-971f-47a2-841e-7f84aa2e2120";
// Only the 11 public statutory provisions compared against promulgations;
// neither a private PDF nor the integral 191-article corpus is distributed.
const promulgated: Record<string, string[]> = {
  "art-37": [
    "§ 2º Ressalvados os casos de inexigibilidade de licitação, na licitação para contratação dos serviços técnicos especializados de natureza predominantemente intelectual previstos nas alíneas \"a\", \"d\" e \"h\" do inciso XVIII do caput do art. 6º desta Lei cujo valor estimado da contratação seja superior a R$ 300.000,00 (trezentos mil reais), o julgamento será por:\nI - melhor técnica; ou\nII - técnica e preço, na proporção de 70% (setenta por cento) de valoração da proposta técnica."
  ],
  "art-54": [
    "§ 1º Sem prejuízo do disposto no caput, é obrigatória a publicação de extrato do edital no Diário Oficial da União, do Estado, do Distrito Federal ou do Município, ou, no caso de consórcio público, do ente de maior nível entre eles, bem como em jornal diário de grande circulação."
  ],
  "art-115": [
    "§ 4º Nas contratações de obras e serviços de engenharia, sempre que a responsabilidade pelo licenciamento ambiental for da Administração, a manifestação prévia ou licença prévia, quando cabíveis, deverão ser obtidas antes da divulgação do edital."
  ],
  "art-175": [
    "§ 2º Até 31 de dezembro de 2023, os Municípios deverão realizar divulgação complementar de suas contratações mediante publicação de extrato de edital de licitação em jornal diário de grande circulação local."
  ],
  "art-90": [
    "§ 8º Na situação de que trata o § 7º deste artigo, é autorizado o aproveitamento, em favor da nova contratada, de eventual saldo a liquidar inscrito em despesas empenhadas ou em restos a pagar não processados.",
    "§ 9º Se frustradas as providências dos §§ 2º e 4º, o saldo de que trata o § 8º deste artigo poderá ser computado como efetiva disponibilidade para nova licitação, desde que identificada vantajosidade para a administração pública e mantido o objeto programado."
  ],
  "art-105": [
    "Parágrafo único. Não serão objeto de cancelamento automático os restos a pagar vinculados a contratos de duração plurianual, senão depois de encerrada a vigência destes, nem os vinculados a contratos rescindidos, nos casos dos §§ 8º e 9º do art. 90 desta Lei."
  ],
  "art-184-a": [
    "III - a liberação dos recursos dar-se-á em parcela única.",
    "§ 2º Não haverá análise nem aceite de termo de referência, anteprojeto, projeto, orçamento, resultado do processo licitatório ou outro documento necessário para o início da execução do objeto, e caberá à concedente ou mandatária verificar o cumprimento do objeto pactuado ao final da execução do instrumento.",
    "§ 3º Quando exigidos, os registros dos projetos de engenharia, dos documentos de titularidade de área, do licenciamento ambiental e do processo licitatório pelo convenente no Transferegov constituirão condição para a liberação da parcela única dos recursos de que trata o inciso III do caput deste artigo."
  ],
  "art-184": [
    "§ 4º Os saldos remanescentes e os rendimentos financeiros auferidos na forma do § 1º deste artigo serão obrigatoriamente computados a crédito do convênio e aplicados no objeto de sua finalidade e na ampliação de meta, quando possível, sem prejuízo da funcionalidade do objeto pactuado, devendo constar de demonstrativo específico que integrará as prestações de contas do ajuste."
  ]
};

function context(): StandingProcurementContext {
  const source = getOfficialLegalSource("lei-licitacoes-contratos-2021")!;
  const refs: string[] = [];
  for (let number = 1; number <= 194; number += 1) {
    if (![172, 177, 178, 179, 188].includes(number)) refs.push(String(number));
    if ([44, 184].includes(number)) refs.push(`${number}-A`);
  }
  const content = refs.map((ref) => [`Art. ${ref}. Disposição sintética para testar somente a estrutura do operador, sem publicação.`, ...(promulgated[`art-${ref.toLowerCase()}`] ?? [])].join("\n")).join("\n\n");
  const articles = parseConsolidatedLegalArticles(content);
  const canonical = articles.map((article) => [article.path, "", article.literalText].join("\n")).join("\n\n");
  const monitor = "Art. 1. Identidade sintética do monitor oficial. ".repeat(30);
  return {
    act: { id: 100, slug: source.slug, officialUrl: source.officialUrl, urn: source.lexmlUrn, isActive: true, actType: "lei", actNumber: "14.133", actYear: 2021, jurisdiction: "federal" },
    monitor: { id: 204, publicId: "771f273b-d5ef-4009-bd0e-c4a19aa8c48d", legalActId: 100, sourceUrl: source.monitorUrl, normalizedContent: monitor, checksumSha256: sha(monitor), fetchedAt: now, status: "pending_review" },
    text: { id: 502, publicId: snapshot, legalActId: 100, monitorSnapshotId: 204, sourceUrl: CAMARA_PROCUREMENT_SOURCE.url, parserVersion: CAMARA_PROCUREMENT_SOURCE.parserVersion, normalizedContent: content, contentLength: content.length, articleCount: 191, checksumSha256: sha([CAMARA_PROCUREMENT_SOURCE.url, CAMARA_PROCUREMENT_SOURCE.parserVersion, canonical].join("\n")), fetchedAt: now, status: "pending_review" },
  };
}
function fresh(c: StandingProcurementContext) { return { monitor: { ...c.monitor, fetchedAt: now }, text: { ...c.text, fetchedAt: now, rawPdfChecksumSha256: PROCUREMENT_RECONCILED_RAW_PDF, pageCount: 88 } }; }
function expected(c: StandingProcurementContext) { return { checksum: c.text.checksumSha256, fingerprint: standingProcurementFingerprint(c), rawpdf: PROCUREMENT_RECONCILED_RAW_PDF, dossier: PROCUREMENT_RECONCILIATION_DOSSIER }; }
function receipt(c: StandingProcurementContext) { return { ...expected(c), approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, approvalMode: "owner_standing_authorization", humanReview: false, partialApproval: true, policy: PROCUREMENT_PARTIAL_POLICY, capturedArticleCount: 191, reviewedArticleCount: 182, pendingArticleCount: 9, pendingArticles: PROCUREMENT_PENDING_ARTICLES, rawPdfChecksumSha256: PROCUREMENT_RECONCILED_RAW_PDF, dossierSha256: PROCUREMENT_RECONCILIATION_DOSSIER, vetoReconciliation: PROCUREMENT_VETO_EVIDENCE }; }

describe("revisão permanente parcial delimitada da Lei 14.133", () => {
  it("isola inspect e exige UUID/hash/standing/provas exatas em preview", () => {
    const c = context(); const args = ["--standing", `snapshot=${snapshot}`, `checksum=${c.text.checksumSha256}`, `fingerprint=${standingProcurementFingerprint(c)}`, `rawpdf=${PROCUREMENT_RECONCILED_RAW_PDF}`, `dossier=${PROCUREMENT_RECONCILIATION_DOSSIER}`];
    expect(parseStandingProcurementReviewArgs(args).apply).toBe(false);
    expect(parseStandingProcurementReviewArgs(["--inspect", `snapshot=${snapshot}`])).toEqual({ inspect: true, apply: false, snapshot });
    for (const argv of [args.filter((arg) => !arg.startsWith("rawpdf=")), [...args, "--standing"], [...args, `dossier=${PROCUREMENT_RECONCILIATION_DOSSIER}`], [...args, "anything=true"], ["--inspect", "--apply", `snapshot=${snapshot}`], ["--inspect", `snapshot=${snapshot}`, `rawpdf=${PROCUREMENT_RECONCILED_RAW_PDF}`]]) expect(() => parseStandingProcurementReviewArgs(argv)).toThrow();
  });

  it("valida sequência integral e particiona exatamente 182/9 sem remover o literal pendente", () => {
    const articles = validateStandingProcurementCorpus(context());
    const partition = partitionStandingProcurementArticles(articles);
    expect(articles).toHaveLength(191); expect(partition.reviewed).toHaveLength(182); expect(partition.deferred).toHaveLength(9);
    expect(new Set(partition.deferred.map((article) => article.path))).toEqual(new Set(PROCUREMENT_PENDING_ARTICLES.map((article) => article.path)));
    expect(partition.deferred.find((article) => article.path === "art-37")?.literalText).toContain("300.000,00");
  });

  it("bloqueia outra lei, outra URL/parser, rejeição e vínculo divergente", () => {
    for (const mutate of [(c: StandingProcurementContext) => { c.act.slug = "lei-geral-protecao-dados-2018"; }, (c: StandingProcurementContext) => { c.text.sourceUrl += "?download=1"; }, (c: StandingProcurementContext) => { c.text.parserVersion += "-changed"; }, (c: StandingProcurementContext) => { c.monitor.status = "rejected"; }, (c: StandingProcurementContext) => { c.text.monitorSnapshotId = 999; }]) { const c = context(); mutate(c); expect(() => validateStandingProcurementCorpus(c)).toThrow(); }
  });

  it("rejeita artigo faltante, artigo estrangeiro, conteúdo/checksum e monitor adulterados", () => {
    const count = context(); count.text.articleCount = 190; expect(() => validateStandingProcurementCorpus(count)).toThrow(/191/u);
    const text = context(); text.text.normalizedContent += "\nArt. 178. Bloco estrangeiro."; text.text.contentLength = text.text.normalizedContent.length; expect(() => validateStandingProcurementCorpus(text)).toThrow(/191/u);
    const monitor = context(); monitor.monitor.normalizedContent += "mudou"; expect(() => validateStandingProcurementCorpus(monitor)).toThrow(/Integridade/u);
    const checksum = context(); checksum.text.checksumSha256 = "f".repeat(64); expect(() => validateStandingProcurementCorpus(checksum)).toThrow(/Checksum/u);
  });

  it("confronta as 11 partes promulgadas sem confundir o rótulo ambíguo de veto", () => {
    const articles = validateStandingProcurementCorpus(context());
    expect(validateProcurementVetoReconciliation(articles).literalMatches).toBe(11);
    const altered = articles.map((article) => article.path === "art-54" ? { ...article, literalText: article.literalText.replace("é obrigatória", "é facultativa") } : article);
    expect(() => validateProcurementVetoReconciliation(altered)).toThrow(/promulgação/u);
    const referenceOnly = articles.map((article) => article.path === "art-54" ? { ...article, literalText: article.literalText.replace("\n§ 1º", "\nI - Referência ao § 1º") } : article);
    expect(() => validateProcurementVetoReconciliation(referenceOnly)).toThrow(/ausente/u);
  });

  it("confere frescor e igualdade exata das duas fontes, sem trocar Senado por alternativa", () => {
    const c = context(); expect(() => validateProcurementCaptureFreshness(c, fresh(c), now)).not.toThrow();
    const old = fresh(c); old.text.fetchedAt = new Date(now.getTime() - 300_001); expect(() => validateProcurementCaptureFreshness(c, old, now)).toThrow(/frescor/u);
    const future = fresh(c); future.monitor.fetchedAt = new Date(now.getTime() + 30_001); expect(() => validateProcurementCaptureFreshness(c, future, now)).toThrow(/frescor/u);
    const changed = fresh(c); changed.monitor.sourceUrl = "https://legis.senado.leg.br/norma/27457334"; expect(() => validateProcurementCaptureFreshness(c, changed, now)).toThrow(/diverge/u);
    const body = fresh(c); body.text.normalizedContent += "mudou"; expect(() => validateProcurementCaptureFreshness(c, body, now)).toThrow(/diverge/u);
  });

  it("não permite promover uma estrutura sintética que não é o corpus/PDF do dossiê", () => {
    const c = context(); expect(() => validateFreshStandingProcurementCapture(c, expected(c), fresh(c), now)).toThrow(/PDF bruto/u);
    expect(() => validateFreshStandingProcurementCapture(c, { ...expected(c), fingerprint: "f".repeat(64) }, fresh(c), now)).toThrow(/fingerprint/u);
  });

  it("idempotência exige exatamente 182 reviewed/9 pending sem restauração silenciosa", () => {
    const articles = validateStandingProcurementCorpus(context()); const pending = new Set<string>(PROCUREMENT_PENDING_ARTICLES.map((article) => article.path));
    const rows = articles.map((article) => ({ ...article, status: pending.has(article.path) ? "pending_review" : "reviewed", rights: "official_text" }));
    expect(validateStandingProcurementExistingArticles(articles, rows)).toEqual({ reviewedArticleCount: 182, pendingArticleCount: 9 });
    const upgraded = rows.map((row) => row.path === "art-75" ? { ...row, status: "reviewed" } : row); expect(() => validateStandingProcurementExistingArticles(articles, upgraded)).toThrow(/não restaurar/u);
    const suspended = rows.map((row) => row.path === "art-1" ? { ...row, status: "suspended" } : row); expect(() => validateStandingProcurementExistingArticles(articles, suspended)).toThrow(/não restaurar/u);
    expect(() => validateStandingProcurementExistingArticles(articles, rows.slice(1))).toThrow();
  });

  it("recibo JSONB independe da ordem das chaves, mas exige motivos/provas/contagens reais", () => {
    const c = context(); const original = receipt(c);
    const serialized = JSON.parse(JSON.stringify(original), (_key, value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value) as Record<string, unknown>;
    expect(() => validateStandingProcurementReceipt(serialized, c.text.checksumSha256, standingProcurementFingerprint(c))).not.toThrow();
    for (const change of [{ humanReview: true }, { pendingArticleCount: 0 }, { pendingArticles: [] }, { vetoReconciliation: null }, { dossierSha256: "f".repeat(64) }]) expect(() => validateStandingProcurementReceipt({ ...original, ...change }, c.text.checksumSha256, standingProcurementFingerprint(c))).toThrow();
  });

  it("operador mantém preview/default, transação curta, pendências e auditoria parcial sem ampliar outro escopo", () => {
    const script = readFileSync(new URL("../scripts/review-standing-procurement-law.ts", import.meta.url), "utf8");
    expect(script).toContain("if (!command.apply)"); expect(script).toContain('isolationLevel: "serializable"'); expect(script).toContain("validateFreshStandingProcurementCapture(locked, command, fresh)");
    expect(script).toContain('editorial.legal_text.partially_approved'); expect(script).toContain('pendingPaths.has(article.path) ? "pending_review"');
    expect(script).toContain('humanReview: false'); expect(script).toContain('redirect: "manual"'); expect(script).toContain('rawPdfChecksumSha256: freshText.rawPdfChecksumSha256');
    expect(script).not.toMatch(/\.(?:update|insert|delete)\((?:questions|contestStoreProducts|contestProductQuestionBindings)\)/u);
    expect(script).not.toMatch(/(?:grant|revoke|create role)\s/iu);
  });
});
