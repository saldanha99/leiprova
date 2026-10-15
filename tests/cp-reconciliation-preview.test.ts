import { describe, expect, it } from "vitest";
import {
  computeCpReconciliationFingerprint,
  validateCpReconciliationContext,
  CP_RECONCILIATION_POLICY,
  CP_RECONCILIATION_REFERENCE,
  CP_ACT_ID,
  CP_V63_ID,
  CP_V112_ID,
  CP_MONITOR_SNAPSHOT_ID,
  CP_TEXT_SNAPSHOT_ID,
  CP_RECEIPT_ID,
  CP_REQUIREMENT_ID,
  CP_V112_ARTICLE_351_ID,
  CP_CUT_INITIAL_AUDIT_ID,
  CP_SUSPENSION_AUDIT_ID,
  type CpObservedState,
  type FreshCpEvidence,
  type Executor,
} from "../src/lib/editorial/cp-reconciliation-preview";
import {
  parseCpReconciliationPreviewArgs,
  requireCpReconciliationPreviewDatabase,
} from "../scripts/preview-cp-reconciliation";
import {
  CAMARA_CP_CORRECTION,
  CP63_EXPECTED_HELD_IDS,
  parseCamaraCpCorrectionCapture,
} from "../src/lib/official-sources/camara-cp-correction-parser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CP_CUT_PRODUCT,
  CP_CUT_CONTRACT,
  CP_CUT_POLICY,
  CP_CUT_OPINION_HASH,
  CP_CUT_ITEMS,
} from "../src/lib/official-sources/cp-coordinated-cut";

// Publicação oficial da Lei nº 15.517/2026 capturada da Câmara dos Deputados:
// URL oficial: https://www2.camara.leg.br/legin/fed/lei/2026/lei-15517-22-setembro-2026-800012-publicacaooriginal-181458-pl.html
// SHA256 pin oficial: 44775d6c3fc157dfd63467295a6aa025285b304f762995577c8773eadc6ce596
const FIXTURE_15517_URL = new URL("./fixtures/cp-lei15517-original-camara.html", import.meta.url);
const CP_CURRENT_HTML_PATH = resolve(".local/editorial/lei12737-reconciliacao-20261012/cp-current-camara.html");

function createSyntheticFreshEvidence(): FreshCpEvidence {
  const bodyBytes = readFileSync(CP_CURRENT_HTML_PATH);
  const amendmentBytes = readFileSync(FIXTURE_15517_URL);
  const now = new Date();
  const parsed = parseCamaraCpCorrectionCapture(bodyBytes, CAMARA_CP_CORRECTION.url, "text/html; charset=UTF-8");

  return {
    parsed,
    body: {
      bytes: bodyBytes,
      mime: "text/html; charset=UTF-8",
      status: 200,
      fetchedAt: now,
    },
    amendment: {
      bytes: amendmentBytes,
      mime: "text/html; charset=UTF-8",
      status: 200,
      fetchedAt: now,
    },
    robots: {
      bytes: new TextEncoder().encode("User-agent: *\nAllow: /\n"),
      mime: "text/plain",
      status: 200,
      fetchedAt: now,
    },
    publicationAllowed: false,
  };
}

function createMockExecutor(overrides: Partial<Record<string, unknown[]>> = {}): Executor {
  return {
    async execute<T extends Record<string, unknown> = Record<string, unknown>>(query: unknown): Promise<T[]> {
      const sqlText =
        query && typeof query === "object" && "queryChunks" in query && Array.isArray((query as { queryChunks: unknown[] }).queryChunks)
          ? (query as { queryChunks: Array<{ value?: unknown }> }).queryChunks
              .map(c => (Array.isArray(c?.value) ? c.value.join("") : (c?.value ?? String(c))))
              .join(" ")
          : String(query);

      if (sqlText.includes("current_database()")) {
        return (overrides["session"] ?? [
          { database: "leiprova", role: "leiprova_owner", readOnly: "on" },
        ]) as T[];
      }
      if (sqlText.includes("from legal_acts where id =")) {
        return (overrides["act"] ?? [
          {
            id: CP_ACT_ID,
            slug: "codigo-penal",
            urn: "urn:lex:br:federal:decreto.lei:1940-12-07;2848",
            active: true,
            actType: "decreto-lei",
            actNumber: "2.848",
            actYear: 1940,
          },
        ]) as T[];
      }
      if (sqlText.includes("from legal_versions where legal_act_id =")) {
        return (overrides["versions"] ?? [
          {
            id: CP_V63_ID,
            legalActId: CP_ACT_ID,
            status: "superseded",
            checksum: CAMARA_CP_CORRECTION.oldVersionChecksum,
            sourceUrl: "https://legis.senado.leg.br/norma/527942/publicacao/39870011",
          },
          {
            id: CP_V112_ID,
            legalActId: CP_ACT_ID,
            status: "pending_review",
            checksum: CAMARA_CP_CORRECTION.canonicalSha256,
            sourceUrl: CAMARA_CP_CORRECTION.url,
          },
        ]) as T[];
      }
      if (sqlText.includes("where legal_version_id =") && sqlText.includes("editorial_status = 'suspended'")) {
        return (overrides["heldArticles"] ??
          [...CP63_EXPECTED_HELD_IDS].sort((a, b) => a - b).map(id => ({ id }))) as T[];
      }
      if (sqlText.includes("count(*)::int as total from legal_articles")) {
        return (overrides["v63Count"] ?? [{ total: 423 }]) as T[];
      }
      if (sqlText.includes("from legal_articles") && (sqlText.includes("112") || sqlText.includes("article_order"))) {
        const fresh = createSyntheticFreshEvidence();
        return (overrides["v112Articles"] ??
          fresh.parsed.articles.map((a, i) => ({
            id: a.path === "art-351" ? CP_V112_ARTICLE_351_ID : 10000 + i,
            path: a.path,
            articleRef: a.articleRef,
            articleOrder: i + 1,
            literalText: a.literalText,
            editorialStatus: "reviewed",
            sourceRights: "official_text",
          }))) as T[];
      }
      if (sqlText.includes("from legal_cp_correction_evidence where id =")) {
        return (overrides["receipt1"] ?? [
          {
            id: CP_RECEIPT_ID,
            status: "suspended",
            fingerprint: "9731686a9d6a3f08fc0e16bff44c9645a0f3a4e4684923c303d249f713f70031",
            legalVersionId: CP_V112_ID,
            approvalReference: CP_RECONCILIATION_REFERENCE,
            humanReview: false,
            approvalAuditId: CP_CUT_INITIAL_AUDIT_ID,
          },
        ]) as T[];
      }
      if (sqlText.includes("from legal_source_snapshots where id =")) {
        return (overrides["monitorSnapshot"] ?? [
          {
            id: CP_MONITOR_SNAPSHOT_ID,
            legalActId: CP_ACT_ID,
            status: "rejected",
            checksum: CAMARA_CP_CORRECTION.canonicalSha256,
            articleMarkerCount: 402,
          },
        ]) as T[];
      }
      if (sqlText.includes("from legal_text_snapshots where id =")) {
        return (overrides["textSnapshot"] ?? [
          {
            id: CP_TEXT_SNAPSHOT_ID,
            legalActId: CP_ACT_ID,
            monitorSnapshotId: CP_MONITOR_SNAPSHOT_ID,
            status: "rejected",
            checksum: CAMARA_CP_CORRECTION.canonicalSha256,
            articleCount: 402,
            parserVersion: "camara-cp-correction-preview-v1.0.0",
          },
        ]) as T[];
      }
      if (sqlText.includes("from audit_logs") && sqlText.includes(String(CP_CUT_INITIAL_AUDIT_ID))) {
        return (overrides["cutAudit"] ?? [{ id: CP_CUT_INITIAL_AUDIT_ID, action: "editorial.legal_cp.coordinated_cut" }]) as T[];
      }
      if (sqlText.includes("from audit_logs") && sqlText.includes(String(CP_SUSPENSION_AUDIT_ID))) {
        return (overrides["suspensionAudit"] ?? [
          {
            id: CP_SUSPENSION_AUDIT_ID,
            action: "editorial.legal_cp.source_suspended",
            reason: "official_capture_unavailable_changed_or_current_corpus_divergent",
            rawSha: null,
          },
        ]) as T[];
      }
      if (sqlText.includes("from opportunity_requirements where id =")) {
        return (overrides["requirement"] ?? [
          {
            id: CP_REQUIREMENT_ID,
            opportunityId: 2,
            legalActId: CP_ACT_ID,
            legalArticleId: CP_V112_ARTICLE_351_ID,
            editorialStatus: "reviewed",
          },
        ]) as T[];
      }
      if (sqlText.includes("from opportunity_requirement_articles where requirement_id =")) {
        return (overrides["extraReqArticles"] ?? [{ count: 0 }]) as T[];
      }
      if (sqlText.includes("join contest_product_question_bindings b on b.question_id = q.id")) {
        return (overrides["questionRows"] ??
          CP_CUT_ITEMS.map((item, index) => {
            const id = item[0];
            const answer = item[1];
            const contentHash = item[4];
            return {
              id,
              editorialStatus: "reviewed",
              legalArticleId: CP_V112_ARTICLE_351_ID,
              type: "multiple_choice",
              sourceRights: "original_authorial",
              quizMode: "original_style",
              styleBankId: 2,
              contentHash,
              articleRef: "Art. 351",
              bindingId: `binding-v112-${index}`,
              productSlug: CP_CUT_PRODUCT,
              opportunityId: 2,
              requirementId: CP_REQUIREMENT_ID,
              sourceDocumentId: 4,
              sourceSnapshotId: 5,
              sourceSnapshotChecksum: "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1",
              legalVersionId: CP_V112_ID,
              bindingLegalArticleId: CP_V112_ARTICLE_351_ID,
              legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
              bindingStatus: "approved",
              correctionPolicy: CP_CUT_POLICY,
              correctionOpinionHash: CP_CUT_OPINION_HASH,
              bindingApprovalReference: CP_RECONCILIATION_REFERENCE,
              bindingHumanReview: false,
              certStatus: "approved",
              contractId: CP_CUT_CONTRACT,
              certHumanReview: false,
              certApprovalReference: CP_RECONCILIATION_REFERENCE,
              certQuestionContentHash: contentHash,
              options: [0, 1, 2, 3, 4].map(optIdx => ({
                option_key: "ABCDE"[optIdx],
                text: `Alternativa ${"ABCDE"[optIdx]}`,
                is_correct: "ABCDE"[optIdx] === answer,
                sort_order: optIdx,
              })),
            };
          })) as T[];
      }
      if (sqlText.includes("with legal_versions as not materialized") && sqlText.includes("from contest_store_products p")) {
        if (overrides["projectedProducts"]) {
          return overrides["projectedProducts"] as T[];
        }
        const store = (overrides["storeProducts"] ?? [
          { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 65, projectedValidCount: 70 },
          { slug: "enam-exame-nacional-da-magistratura-2026-2", status: "released", currentValidCount: 146, projectedValidCount: 146 },
          { slug: "tc-df-analista-2026", status: "released", currentValidCount: 72, projectedValidCount: 72 },
          { slug: "tj-rs-juiz-de-direito-2026", status: "released", currentValidCount: 146, projectedValidCount: 146 },
          { slug: "trf-5-juiz-federal-5-regiao", status: "released", currentValidCount: 115, projectedValidCount: 115 },
          { slug: "pc-ma-oficial-investigador-2026", status: "released", currentValidCount: 156, projectedValidCount: 156 },
          { slug: "pp-ma-inspetor-2026", status: "released", currentValidCount: 132, projectedValidCount: 132 },
          { slug: "sefaz-al-auditor-fiscal-2026", status: "released", currentValidCount: 80, projectedValidCount: 80 },
          { slug: "mpe-mt-promotor-de-justica-2026", status: "released", currentValidCount: 90, projectedValidCount: 90 },
        ]) as Array<{ slug: string; opportunityId?: number; status: string; currentValidCount: number; projectedValidCount: number }>;
        return store.map(p => ({
          slug: p.slug,
          projectedValidCount: p.projectedValidCount,
        })) as unknown as T[];
      }
      if (sqlText.includes("from contest_store_products p")) {
        const store = (overrides["storeProducts"] ?? [
          { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 65, projectedValidCount: 70 },
          { slug: "enam-exame-nacional-da-magistratura-2026-2", status: "released", currentValidCount: 146, projectedValidCount: 146 },
          { slug: "tc-df-analista-2026", status: "released", currentValidCount: 72, projectedValidCount: 72 },
          { slug: "tj-rs-juiz-de-direito-2026", status: "released", currentValidCount: 146, projectedValidCount: 146 },
          { slug: "trf-5-juiz-federal-5-regiao", status: "released", currentValidCount: 115, projectedValidCount: 115 },
          { slug: "pc-ma-oficial-investigador-2026", status: "released", currentValidCount: 156, projectedValidCount: 156 },
          { slug: "pp-ma-inspetor-2026", status: "released", currentValidCount: 132, projectedValidCount: 132 },
          { slug: "sefaz-al-auditor-fiscal-2026", status: "released", currentValidCount: 80, projectedValidCount: 80 },
          { slug: "mpe-mt-promotor-de-justica-2026", status: "released", currentValidCount: 90, projectedValidCount: 90 },
        ]) as Array<{ slug: string; opportunityId?: number; status: string; currentValidCount: number; projectedValidCount: number }>;
        return store.map(p => ({
          slug: p.slug,
          status: p.status,
          opportunityId: p.opportunityId ?? (p.slug === CP_CUT_PRODUCT ? 2 : 1),
          currentValidCount: p.currentValidCount,
        })) as unknown as T[];
      }

      return [] as T[];
    },
  };
}

describe("CLI parser e validação de URL do preview CP", () => {
  it("recusa estritamente a flag --apply", () => {
    expect(() => parseCpReconciliationPreviewArgs(["--apply"])).toThrow(/--apply não é suportado/);
    expect(() => parseCpReconciliationPreviewArgs(["output=teste", "--apply"])).toThrow(/--apply não é suportado/);
  });

  it("aceita output válido ou vazio", () => {
    expect(parseCpReconciliationPreviewArgs([])).toEqual({ outputName: undefined });
    expect(parseCpReconciliationPreviewArgs(["output=previa-1"])).toEqual({ outputName: "previa-1" });
  });

  it("recusa argumentos estranhos ou nomes de saída inválidos", () => {
    expect(() => parseCpReconciliationPreviewArgs(["foo=bar"])).toThrow(/Argumento desconhecido/);
    expect(() => parseCpReconciliationPreviewArgs(["output=Nome Invalido"])).toThrow(/Nome de saída privada inválido/);
    expect(() => parseCpReconciliationPreviewArgs(["output=a", "output=b"])).toThrow(/duplicada/);
  });

  it("valida rigorosamente MIGRATION_DATABASE_URL", () => {
    expect(() => requireCpReconciliationPreviewDatabase(undefined)).toThrow(/Defina MIGRATION_DATABASE_URL/);
    expect(() => requireCpReconciliationPreviewDatabase("http://localhost/leiprova")).toThrow(/leiprova_owner/);
    expect(() => requireCpReconciliationPreviewDatabase("postgres://leiprova_app:pass@localhost:5432/leiprova")).toThrow(
      /leiprova_owner/
    );
    expect(() => requireCpReconciliationPreviewDatabase("postgres://leiprova_owner:pass@localhost:5432/other_db")).toThrow(
      /banco leiprova/
    );
    expect(
      requireCpReconciliationPreviewDatabase("postgres://leiprova_owner:pass@localhost:5432/leiprova")
    ).toBe("postgres://leiprova_owner:pass@localhost:5432/leiprova");
  });
});

describe("Fingerprint de reconciliação pós-suspensão (R7: estado observado completo)", () => {
  function createSampleObservedState(): CpObservedState {
    return {
      policy: CP_RECONCILIATION_POLICY,
      approvalReference: CP_RECONCILIATION_REFERENCE,
      session: { database: "leiprova", role: "leiprova_owner", readOnly: "on" },
      source: {
        robotsStatus: 200,
        robotsSha256: "robots-fp-sample",
        rawSha256: CAMARA_CP_CORRECTION.rawSha256,
        canonicalSha256: CAMARA_CP_CORRECTION.canonicalSha256,
        amendmentRawSha256: CAMARA_CP_CORRECTION.amendmentRawSha256,
        articleCount: 402,
        corpusFingerprint: "corpus-fp-sample",
      },
      act: {
        id: CP_ACT_ID,
        slug: "codigo-penal",
        urn: "urn:lex:br:federal:decreto.lei:1940-12-07;2848",
        active: true,
        actType: "decreto-lei",
        actNumber: "2.848",
        actYear: 1940,
      },
      versions: {
        v63: {
          id: CP_V63_ID,
          status: "superseded",
          checksum: CAMARA_CP_CORRECTION.oldVersionChecksum,
          sourceUrl: "https://legis.senado.leg.br/norma/527942/publicacao/39870011",
          totalArticles: 423,
          heldArticleIds: [...CP63_EXPECTED_HELD_IDS],
        },
        v112: {
          id: CP_V112_ID,
          status: "pending_review",
          checksum: CAMARA_CP_CORRECTION.canonicalSha256,
          sourceUrl: CAMARA_CP_CORRECTION.url,
          totalArticles: 402,
          articlesDigest: "v112-articles-digest",
        },
      },
      receipt1: {
        id: CP_RECEIPT_ID,
        status: "suspended",
        fingerprint: "9731686a9d6a3f08fc0e16bff44c9645a0f3a4e4684923c303d249f713f70031",
        legalVersionId: CP_V112_ID,
        approvalReference: CP_RECONCILIATION_REFERENCE,
        humanReview: false,
        approvalAuditId: CP_CUT_INITIAL_AUDIT_ID,
      },
      snapshots: {
        monitor2757: {
          id: CP_MONITOR_SNAPSHOT_ID,
          status: "rejected",
          checksum: CAMARA_CP_CORRECTION.canonicalSha256,
          articleMarkerCount: 402,
        },
        text1660: {
          id: CP_TEXT_SNAPSHOT_ID,
          status: "rejected",
          checksum: CAMARA_CP_CORRECTION.canonicalSha256,
          articleCount: 402,
          parserVersion: "camara-cp-correction-preview-v1.0.0",
        },
      },
      auditTrail: {
        initialCutAuditId: CP_CUT_INITIAL_AUDIT_ID,
        suspensionAuditId: CP_SUSPENSION_AUDIT_ID,
        suspensionReason: "official_capture_unavailable_changed_or_current_corpus_divergent",
      },
      requirement: {
        id: CP_REQUIREMENT_ID,
        opportunityId: 2,
        legalActId: CP_ACT_ID,
        legalArticleId: CP_V112_ARTICLE_351_ID,
        editorialStatus: "reviewed",
      },
      dependencies: CP_CUT_ITEMS.map((item, index) => ({
        id: item[0],
        editorialStatus: "reviewed",
        legalArticleId: CP_V112_ARTICLE_351_ID,
        contentHash: item[4],
        bindingId: `binding-v112-${index}`,
        productSlug: CP_CUT_PRODUCT,
        opportunityId: 2,
        requirementId: CP_REQUIREMENT_ID,
        sourceDocumentId: 4,
        sourceSnapshotId: 5,
        sourceSnapshotChecksum: "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1",
        legalVersionId: CP_V112_ID,
        bindingLegalArticleId: CP_V112_ARTICLE_351_ID,
        legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
        bindingStatus: "approved",
        correctionPolicy: CP_CUT_POLICY,
        correctionOpinionHash: CP_CUT_OPINION_HASH,
        certStatus: "approved",
        contractId: CP_CUT_CONTRACT,
        certQuestionContentHash: item[4],
        options: [0, 1, 2, 3, 4].map(optIdx => ({
          option_key: "ABCDE"[optIdx],
          text: `Alternativa ${"ABCDE"[optIdx]}`,
          is_correct: "ABCDE"[optIdx] === item[1],
          sort_order: optIdx,
        })),
      })),
      offers: [
        {
          slug: CP_CUT_PRODUCT,
          opportunityId: 2,
          status: "released",
          currentValidCount: 65,
          projectedValidCount: 70,
          netDifference: 5,
          floorMetCurrent: false,
          floorMetProjected: true,
        },
      ],
    };
  }

  it("é determinístico e sensível a qualquer alteração no estado observado", () => {
    const baseState = createSampleObservedState();
    const fp1 = computeCpReconciliationFingerprint(baseState);
    const fp2 = computeCpReconciliationFingerprint(baseState);
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);

    // R7: Alteração em bindingId de uma questão altera o fingerprint
    const stateAlteredBinding = createSampleObservedState();
    stateAlteredBinding.dependencies[0].bindingId = "binding-tampered";
    expect(computeCpReconciliationFingerprint(stateAlteredBinding)).not.toBe(fp1);

    // R7: Alteração em approvalAuditId altera o fingerprint
    const stateAlteredAudit = createSampleObservedState();
    stateAlteredAudit.receipt1.approvalAuditId = 9999;
    expect(computeCpReconciliationFingerprint(stateAlteredAudit)).not.toBe(fp1);

    // R7: Alteração em question contentHash altera o fingerprint
    const stateAlteredContentHash = createSampleObservedState();
    stateAlteredContentHash.dependencies[0].contentHash = "tampered-hash";
    expect(computeCpReconciliationFingerprint(stateAlteredContentHash)).not.toBe(fp1);

    // R7: Alteração em offers summary altera o fingerprint
    const stateAlteredOffers = createSampleObservedState();
    stateAlteredOffers.offers[0].projectedValidCount = 71;
    expect(computeCpReconciliationFingerprint(stateAlteredOffers)).not.toBe(fp1);

    // R7: Alteração em texto de alternativa de questão altera o fingerprint
    const stateAlteredOption = createSampleObservedState();
    stateAlteredOption.dependencies[0].options[0].text = "Texto modificado";
    expect(computeCpReconciliationFingerprint(stateAlteredOption)).not.toBe(fp1);
  });
});

describe("validateCpReconciliationContext (somente leitura)", () => {
  it("valida com sucesso estado pós-suspensão e projeta reabilitação sem autoria nova", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor();
    const result = await validateCpReconciliationContext(tx, fresh);

    expect(result.mode).toBe("preview_only");
    expect(result.humanReview).toBe(false);
    expect(result.disclaimer).toBe("prepared não é aprovação e nenhuma revisão humana é presumida");
    expect(result.versions.v63.status).toBe("superseded");
    expect(result.versions.v63.suspendedArticles).toBe(27);
    expect(result.versions.v112.status).toBe("pending_review");
    expect(result.versions.v112.totalArticles).toBe(402);
    expect(result.receipt1.status).toBe("suspended");
    expect(result.receipt1.isImmutable).toBe(true);
    expect(result.snapshots.monitor2757.status).toBe("rejected");
    expect(result.snapshots.text1660.status).toBe("rejected");
    expect(result.auditTrail.initialCutAuditId).toBe(8308);
    expect(result.auditTrail.suspensionAuditId).toBe(10902);
    expect(result.auditTrail.suspensionHypothesisNote).toContain("Hipótese técnica");
    expect(result.dependencies.requirement667.legalArticleId).toBe(CP_V112_ARTICLE_351_ID);
    expect(result.dependencies.questions).toHaveLength(5);

    // Ofertas dinâmicas (9 ofertas na lista mock)
    expect(result.offers.totalReleased).toBe(9);
    // ENAC pós-suspensão real: 65 atual (abaixo do piso), 70 projetado (acima do piso)
    expect(result.offers.enacDetail.currentValidCount).toBe(65);
    expect(result.offers.enacDetail.projectedValidCount).toBe(70);
    expect(result.offers.enacDetail.floorMetCurrent).toBe(false);
    expect(result.offers.enacDetail.floorMetProjected).toBe(true);
    expect(result.offers.enacDetail.netRehabilitated).toBe(5);

    // Projeção estrita
    expect(result.projection.newAuthorialQuestions).toBe(0);
    expect(result.projection.rehabilitatedLegacyQuestions).toBe(5);
    expect(result.projection.databaseWrites).toBe(0);
    expect(result.projection.currentVersionsModified).toBe(0);
    expect(result.projection.receiptsCreated).toBe(0);
    expect(result.projection.pinsUpdated).toBe(0);
    expect(result.projection.transactionReadOnly).toBe(true);
  });

  it("muda fingerprint quando robots muda mantendo ambas as rotas permitidas", async () => {
    const fresh = createSyntheticFreshEvidence();
    const first = await validateCpReconciliationContext(createMockExecutor(), fresh);
    const changed = await validateCpReconciliationContext(createMockExecutor(), {
      ...fresh,
      robots: {
        ...fresh.robots,
        bytes: Buffer.concat([fresh.robots.bytes, Buffer.from("\n# nova política observada\n")]),
      },
    });
    expect(changed.offers).toEqual(first.offers);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it("muda fingerprint quando identidade do produto muda sem alterar contagens", async () => {
    const fresh = createSyntheticFreshEvidence();
    const products = [
      { slug: CP_CUT_PRODUCT, opportunityId: 2, status: "released", currentValidCount: 65, projectedValidCount: 70 },
      { slug: "outro-produto", opportunityId: 3, status: "released", currentValidCount: 80, projectedValidCount: 80 },
    ];
    const first = await validateCpReconciliationContext(createMockExecutor({ storeProducts: products }), fresh);
    const changed = await validateCpReconciliationContext(createMockExecutor({
      storeProducts: products.map(p => p.slug === "outro-produto" ? { ...p, opportunityId: 4 } : p),
    }), fresh);
    expect(changed.offers).toEqual(first.offers);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it("recusa transação quando transaction_read_only não é 'on'", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      session: [{ database: "leiprova", role: "leiprova_owner", readOnly: "off" }],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Transação somente leitura não confirmada/
    );
  });

  it("recusa quando a versão 112 não está em pending_review", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      versions: [
        {
          id: CP_V63_ID,
          legalActId: CP_ACT_ID,
          status: "superseded",
          checksum: CAMARA_CP_CORRECTION.oldVersionChecksum,
          sourceUrl: "https://legis.senado.leg.br/norma/527942/publicacao/39870011",
        },
        {
          id: CP_V112_ID,
          legalActId: CP_ACT_ID,
          status: "current", // Deve falhar: prévia pós-suspensão exige pending_review
          checksum: CAMARA_CP_CORRECTION.canonicalSha256,
          sourceUrl: CAMARA_CP_CORRECTION.url,
        },
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Versão 112 .* exige status 'pending_review'/
    );
  });

  it("recusa quando o recibo 1 não está suspenso", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      receipt1: [
        {
          id: CP_RECEIPT_ID,
          status: "approved", // Divergência indevida
          fingerprint: "9731686a9d6a3f08fc0e16bff44c9645a0f3a4e4684923c303d249f713f70031",
          legalVersionId: CP_V112_ID,
          approvalReference: CP_RECONCILIATION_REFERENCE,
          humanReview: false,
          approvalAuditId: CP_CUT_INITIAL_AUDIT_ID,
        },
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Recibo 1 suspenso não confirmado ou alterado/
    );
  });

  // R6: Exigir receipt1.approvalAuditId === 8308
  it("recusa quando o recibo 1 possui approval_audit_id divergente de 8308 (R6)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      receipt1: [
        {
          id: CP_RECEIPT_ID,
          status: "suspended",
          fingerprint: "9731686a9d6a3f08fc0e16bff44c9645a0f3a4e4684923c303d249f713f70031",
          legalVersionId: CP_V112_ID,
          approvalReference: CP_RECONCILIATION_REFERENCE,
          humanReview: false,
          approvalAuditId: 999999, // R6: Divergência
        },
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Recibo 1 suspenso não confirmado ou alterado/
    );
  });

  // R5: Recomputar parsing dos bytes reais fresh.body
  it("recusa quando fresh.body.bytes contém bytes arbitrários ou alterados mesmo com fresh.parsed pinado (R5)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tamperedFresh: FreshCpEvidence = {
      ...fresh,
      body: {
        ...fresh.body,
        bytes: new TextEncoder().encode("<html><body>Arbitrary tampered body</body></html>"),
      },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, tamperedFresh)).rejects.toThrow(
      /Perfil\/hash bruto desconhecido; exige reconciliação nova\./
    );
  });

  it("recusa quando fresh.body tem status HTTP divergente de 200 (R5/R8)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tamperedFresh: FreshCpEvidence = {
      ...fresh,
      body: {
        ...fresh.body,
        status: 500,
      },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, tamperedFresh)).rejects.toThrow(
      /Corpo oficial do CP com status HTTP 500 ou MIME inválido\./
    );
  });

  // R8: Robots de corpo e emenda
  it("recusa quando robots.txt da Câmara responde com erro de servidor (R8)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tamperedFresh: FreshCpEvidence = {
      ...fresh,
      robots: {
        ...fresh.robots,
        status: 500,
      },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, tamperedFresh)).rejects.toThrow(
      /robots\.txt da Câmara respondeu com status HTTP 500; captura bloqueada\./
    );
  });

  it("recusa quando robots.txt da Câmara não é text/plain (R8)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tamperedFresh: FreshCpEvidence = {
      ...fresh,
      robots: {
        ...fresh.robots,
        mime: "text/html",
      },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, tamperedFresh)).rejects.toThrow(
      /robots\.txt da Câmara não respondeu como política textual; captura bloqueada\./
    );
  });

  it("recusa quando robots.txt da Câmara proíbe o caminho do Código Penal (R8)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tamperedFresh: FreshCpEvidence = {
      ...fresh,
      robots: {
        ...fresh.robots,
        bytes: new TextEncoder().encode("User-agent: *\nDisallow: /legin/\n"),
      },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, tamperedFresh)).rejects.toThrow(
      /O robots\.txt da fonte oficial proíbe esta compilação\./
    );
  });

  it("aceita quando robots.txt responde 404 (ausência de restrição oficial) (R8)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const freshWith404Robots: FreshCpEvidence = {
      ...fresh,
      robots: {
        ...fresh.robots,
        status: 404,
      },
    };
    const tx = createMockExecutor();
    const result = await validateCpReconciliationContext(tx, freshWith404Robots);
    expect(result.mode).toBe("preview_only");
  });

  it("recusa se qualquer produto além do ENAC tiver variação projetada", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      storeProducts: [
        { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 65, projectedValidCount: 70 },
        { slug: "enam-exame-nacional-da-magistratura-2026-2", status: "released", currentValidCount: 146, projectedValidCount: 147 }, // Variação indevida
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /teve variação indevida de 1 na projeção CP/
    );
  });

  it("rejeita alteração de 1 byte no HTML oficial da Lei 15.517", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tamperedAmendmentBytes = new Uint8Array(fresh.amendment.bytes);
    tamperedAmendmentBytes[0] ^= 0x01; // Inverte 1 bit / altera exatamente 1 byte
    const tamperedFresh: FreshCpEvidence = {
      ...fresh,
      amendment: {
        ...fresh.amendment,
        bytes: tamperedAmendmentBytes,
      },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, tamperedFresh)).rejects.toThrow(
      /Lei 15\.517 mudou; hash bruto diverge do pin oficial homologado\./
    );
  });

  // Achado 4 do Maestro: article_order consultado e validado ordinalmente
  it("recusa quando a ordem dos artigos da versão 112 (article_order) estiver alterada mesmo preservando a sequência", async () => {
    const fresh = createSyntheticFreshEvidence();
    const shiftedArticles = fresh.parsed.articles.map((a, i) => ({
      id: a.path === "art-351" ? CP_V112_ARTICLE_351_ID : 10000 + i,
      path: a.path,
      articleRef: a.articleRef,
      articleOrder: i + 11, // Deslocamento ordinal de +10
      literalText: a.literalText,
      editorialStatus: "reviewed",
      sourceRights: "official_text",
    }));
    const tx = createMockExecutor({ v112Articles: shiftedArticles });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Artigo 1 .* da versão 112 diverge da redação oficial fresca\./
    );
  });

  // Achado 3 do Maestro: assertCpCutFresh obrigatório sem skipTimeCheck
  it("recusa captura com data expirada (assertCpCutFresh obrigatório sem skipTimeCheck)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const expiredDate = new Date(Date.now() - 48 * 3600 * 1000); // 48 horas atrás
    const expiredFresh: FreshCpEvidence = {
      ...fresh,
      body: { ...fresh.body, fetchedAt: expiredDate },
    };
    const tx = createMockExecutor();
    await expect(validateCpReconciliationContext(tx, expiredFresh)).rejects.toThrow(
      /Captura oficial perdeu frescor/
    );
  });

  // Achado 2 do Maestro: identificação uma a uma das 5 dependências
  it("recusa quando as dependências têm identificadores duplicados (ex.: 5 linhas do mesmo questionId)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const duplicateRows = Array.from({ length: 5 }, (_, i) => ({
      id: 1285,
      editorialStatus: "reviewed",
      legalArticleId: CP_V112_ARTICLE_351_ID,
      type: "multiple_choice",
      sourceRights: "original_authorial",
      quizMode: "original_style",
      styleBankId: 2,
      contentHash: CP_CUT_ITEMS[0][4],
      articleRef: "Art. 351",
      bindingId: `binding-dup-${i}`,
      productSlug: CP_CUT_PRODUCT,
      opportunityId: 2,
      requirementId: CP_REQUIREMENT_ID,
      sourceDocumentId: 4,
      sourceSnapshotId: 5,
      sourceSnapshotChecksum: "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1",
      legalVersionId: CP_V112_ID,
      bindingLegalArticleId: CP_V112_ARTICLE_351_ID,
      legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
      bindingStatus: "approved",
      correctionPolicy: CP_CUT_POLICY,
      correctionOpinionHash: CP_CUT_OPINION_HASH,
      bindingApprovalReference: CP_RECONCILIATION_REFERENCE,
      bindingHumanReview: false,
      certStatus: "approved",
      contractId: CP_CUT_CONTRACT,
      certHumanReview: false,
      certApprovalReference: CP_RECONCILIATION_REFERENCE,
      certQuestionContentHash: CP_CUT_ITEMS[0][4],
      options: [0, 1, 2, 3, 4].map(optIdx => ({
        option_key: "ABCDE"[optIdx],
        text: `Alternativa ${"ABCDE"[optIdx]}`,
        is_correct: "ABCDE"[optIdx] === CP_CUT_ITEMS[0][1],
        sort_order: optIdx,
      })),
    }));
    const tx = createMockExecutor({ questionRows: duplicateRows });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Identificadores de questões duplicados ou incompletos na checagem das 5 dependências\./
    );
  });

  it("recusa quando vínculo de questão aponta para outro produto", async () => {
    const fresh = createSyntheticFreshEvidence();
    const rows = CP_CUT_ITEMS.map((item, index) => ({
      id: item[0],
      editorialStatus: "reviewed",
      legalArticleId: CP_V112_ARTICLE_351_ID,
      type: "multiple_choice",
      sourceRights: "original_authorial",
      quizMode: "original_style",
      styleBankId: 2,
      contentHash: item[4],
      articleRef: "Art. 351",
      bindingId: `binding-v112-${index}`,
      productSlug: index === 0 ? "outro-produto" : CP_CUT_PRODUCT,
      opportunityId: 2,
      requirementId: CP_REQUIREMENT_ID,
      sourceDocumentId: 4,
      sourceSnapshotId: 5,
      sourceSnapshotChecksum: "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1",
      legalVersionId: CP_V112_ID,
      bindingLegalArticleId: CP_V112_ARTICLE_351_ID,
      legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
      bindingStatus: "approved",
      correctionPolicy: CP_CUT_POLICY,
      correctionOpinionHash: CP_CUT_OPINION_HASH,
      bindingApprovalReference: CP_RECONCILIATION_REFERENCE,
      bindingHumanReview: false,
      certStatus: "approved",
      contractId: CP_CUT_CONTRACT,
      certHumanReview: false,
      certApprovalReference: CP_RECONCILIATION_REFERENCE,
      certQuestionContentHash: item[4],
      options: [0, 1, 2, 3, 4].map(optIdx => ({
        option_key: "ABCDE"[optIdx],
        text: `Alternativa ${"ABCDE"[optIdx]}`,
        is_correct: "ABCDE"[optIdx] === item[1],
        sort_order: optIdx,
      })),
    }));
    const tx = createMockExecutor({ questionRows: rows });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Vínculo da questão 1285 fora do produto ENAC/
    );
  });

  it("recusa quando hash de conteúdo da questão ou do certificado divergir do parecer técnico", async () => {
    const fresh = createSyntheticFreshEvidence();
    const divergentContentRows = CP_CUT_ITEMS.map((item, index) => ({
      id: item[0],
      editorialStatus: "reviewed",
      legalArticleId: CP_V112_ARTICLE_351_ID,
      type: "multiple_choice",
      sourceRights: "original_authorial",
      quizMode: "original_style",
      styleBankId: 2,
      contentHash: index === 0 ? "divergent-hash" : item[4],
      articleRef: "Art. 351",
      bindingId: `binding-v112-${index}`,
      productSlug: CP_CUT_PRODUCT,
      opportunityId: 2,
      requirementId: CP_REQUIREMENT_ID,
      sourceDocumentId: 4,
      sourceSnapshotId: 5,
      sourceSnapshotChecksum: "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1",
      legalVersionId: CP_V112_ID,
      bindingLegalArticleId: CP_V112_ARTICLE_351_ID,
      legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
      bindingStatus: "approved",
      correctionPolicy: CP_CUT_POLICY,
      correctionOpinionHash: CP_CUT_OPINION_HASH,
      bindingApprovalReference: CP_RECONCILIATION_REFERENCE,
      bindingHumanReview: false,
      certStatus: "approved",
      contractId: CP_CUT_CONTRACT,
      certHumanReview: false,
      certApprovalReference: CP_RECONCILIATION_REFERENCE,
      certQuestionContentHash: item[4],
      options: [0, 1, 2, 3, 4].map(optIdx => ({
        option_key: "ABCDE"[optIdx],
        text: `Alternativa ${"ABCDE"[optIdx]}`,
        is_correct: "ABCDE"[optIdx] === item[1],
        sort_order: optIdx,
      })),
    }));
    const tx = createMockExecutor({ questionRows: divergentContentRows });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Hash do conteúdo da questão 1285 diverge do parecer técnico/
    );
  });

  it("recusa quando o gabarito das alternativas divergir do gabarito oficial de corte", async () => {
    const fresh = createSyntheticFreshEvidence();
    const wrongAnswerRows = CP_CUT_ITEMS.map((item, index) => ({
      id: item[0],
      editorialStatus: "reviewed",
      legalArticleId: CP_V112_ARTICLE_351_ID,
      type: "multiple_choice",
      sourceRights: "original_authorial",
      quizMode: "original_style",
      styleBankId: 2,
      contentHash: item[4],
      articleRef: "Art. 351",
      bindingId: `binding-v112-${index}`,
      productSlug: CP_CUT_PRODUCT,
      opportunityId: 2,
      requirementId: CP_REQUIREMENT_ID,
      sourceDocumentId: 4,
      sourceSnapshotId: 5,
      sourceSnapshotChecksum: "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1",
      legalVersionId: CP_V112_ID,
      bindingLegalArticleId: CP_V112_ARTICLE_351_ID,
      legalVersionChecksum: CAMARA_CP_CORRECTION.canonicalSha256,
      bindingStatus: "approved",
      correctionPolicy: CP_CUT_POLICY,
      correctionOpinionHash: CP_CUT_OPINION_HASH,
      bindingApprovalReference: CP_RECONCILIATION_REFERENCE,
      bindingHumanReview: false,
      certStatus: "approved",
      contractId: CP_CUT_CONTRACT,
      certHumanReview: false,
      certApprovalReference: CP_RECONCILIATION_REFERENCE,
      certQuestionContentHash: item[4],
      options: [0, 1, 2, 3, 4].map(optIdx => ({
        option_key: "ABCDE"[optIdx],
        text: `Alternativa ${"ABCDE"[optIdx]}`,
        // Troca gabarito da primeira questão de 'C' para 'A'
        is_correct: "ABCDE"[optIdx] === (index === 0 ? "A" : item[1]),
        sort_order: optIdx,
      })),
    }));
    const tx = createMockExecutor({ questionRows: wrongAnswerRows });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Gabarito da questão 1285 diverge: esperado C, observado A\./
    );
  });

  // Achado 1 do Maestro: predicado de piso comercial completo e projeção exata
  it("recusa se a projeção no ENAC não alcançar o acréscimo de exatamente 5 questões (ex.: predicado comercial rejeitou 1 vínculo)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      storeProducts: [
        { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 65, projectedValidCount: 69 }, // Apenas +4 em vez de +5
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Projeção no ENAC divergente: esperado acréscimo exato de \+5 de reabilitação, observado 4\./
    );
  });

  it("permite ENAC com currentValidCount < 68 (ex.: 65 pós-suspensão) se projectedValidCount >= 68 (ex.: 70)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      storeProducts: [
        { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 65, projectedValidCount: 70 },
      ],
    });
    const result = await validateCpReconciliationContext(tx, fresh);
    expect(result.offers.enacDetail.currentValidCount).toBe(65);
    expect(result.offers.enacDetail.projectedValidCount).toBe(70);
    expect(result.offers.enacDetail.floorMetCurrent).toBe(false);
    expect(result.offers.enacDetail.floorMetProjected).toBe(true);
  });

  it("recusa se a projeção no ENAC ficar abaixo do piso de 68 questões (ex.: 62 -> 67)", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      storeProducts: [
        { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 62, projectedValidCount: 67 }, // 67 < 68
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Produto projetado enac-exame-nacional-dos-cartorios-2026-2 abaixo do piso legal de 68 questões \(projetado 67\)\./
    );
  });

  it("recusa se algum outro produto liberado ficar abaixo do piso de 68 questões", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      storeProducts: [
        { slug: CP_CUT_PRODUCT, status: "released", currentValidCount: 65, projectedValidCount: 70 },
        { slug: "enam-exame-nacional-da-magistratura-2026-2", status: "released", currentValidCount: 67, projectedValidCount: 67 }, // 67 < 68
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Produto liberado enam-exame-nacional-da-magistratura-2026-2 abaixo do piso legal de 68 questões\./
    );
  });

  it("recusa quando a ordem dos slugs entre as consultas atual e projetada for divergente", async () => {
    const fresh = createSyntheticFreshEvidence();
    const tx = createMockExecutor({
      storeProducts: [
        { slug: "a-produto", status: "released", currentValidCount: 70, projectedValidCount: 70 },
        { slug: "b-produto", status: "released", currentValidCount: 65, projectedValidCount: 70 },
      ],
      projectedProducts: [
        { slug: "b-produto", projectedValidCount: 70 },
        { slug: "a-produto", projectedValidCount: 70 },
      ],
    });
    await expect(validateCpReconciliationContext(tx, fresh)).rejects.toThrow(
      /Ordem ou chave de produto divergente na projeção: atual a-produto, projetado b-produto\./
    );
  });
});
