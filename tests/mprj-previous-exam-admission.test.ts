import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("postgres", () => ({ default: state.connect }));

import {
  MPRJ_ANSWER_KEY_DECISION_BASIS,
  MPRJ_OFFICIAL_PREVIOUS_EXAM as target,
  MPRJ_QUESTION_COUNT_CORROBORATION,
  assertMprjAnswerKeyEvidence,
  assertMprjNoticeEvidence,
  assertMprjOfficialAnchors,
  assertMprjRegistrationRequest,
  previewMprjPreviousExam,
} from "@/lib/exams/mprj-previous-exam-admission";
import {
  MPRJ_PREVIOUS_EDITION_PUBLIC_ID,
  MPRJ_PREVIOUS_PRODUCT_SLUG,
  PGEAC_PREVIOUS_EDITION_PUBLIC_ID,
  PGEAC_PREVIOUS_PRODUCT_SLUG,
  mprjCompositeAnswerKeyEvidenceStands,
  parsePreviousExamLinkCommand,
} from "@/lib/exams/previous-exam-link-command";
import {
  MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE,
  reviewAnswerKeyEvidence,
  type AnswerKeyEvidenceDraft,
} from "@/lib/exams/answer-key-finality";
import { parseMprjPreviousExamArgs } from "../scripts/register-mprj-previous-exam-links";
import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";

const moduleSource = readFileSync(
  new URL("../src/lib/exams/mprj-previous-exam-admission.ts", import.meta.url),
  "utf8",
);

const H1_INGRESSO =
  "XXXIX Concurso para Ingresso na Classe Inicial da Carreira do Ministério Público do Estado do Rio de Janeiro";
/** h1 real da página de servidores do MPRJ (/concursos/mprj2025), que responde 200. */
const H1_SERVIDORES = "Concurso Público para o Ministério Público do Estado do Rio de Janeiro";
/** Caderno do XXXVIII/2025: difere do XXXIX por um hífen e o sufixo `_0`. */
const BOOKLET_XXXVIII =
  "https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substitutocns001-tipo-1_0.pdf";

function portalHtml(h1 = H1_INGRESSO) {
  const blocks = target.documents
    .map(
      (document) =>
        `<div class="paragraph--type--texto-data"><time datetime="${document.publishedOn}T12:00:00Z"></time>` +
        `Prova Preambular ${target.role} <a href="${document.url}">${document.label}</a></div>`,
    )
    .join("");
  return `<h1>${h1}</h1><a href="${target.noticeUrl}">Edital do XXXIX Concurso</a>${blocks}`;
}

const html = portalHtml();

const verifier = vi.fn(async (_bank: string, url: string) => ({
  httpStatus: 200,
  isPdf: true,
  finalUrl: url,
  checkedAt: new Date(),
  contentType: "application/pdf",
  pageTitle: null,
}));

const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
  const robots = String(url).endsWith("robots.txt");
  const response = new Response(
    robots ? "User-agent: *\nDisallow: /search/\nDisallow: /admin/" : html,
    { status: 200, headers: { "content-type": robots ? "text/plain" : "text/html" } },
  );
  Object.defineProperty(response, "url", { value: String(url) });
  return response;
});

function draft(): AnswerKeyEvidenceDraft {
  return structuredClone(MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE) as AnswerKeyEvidenceDraft;
}

function mutableDocuments(value: AnswerKeyEvidenceDraft) {
  return value.documents as unknown as Record<string, unknown>[];
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("cadastro MPRJ XXXIX/2026 por evidência final composta", () => {
  it("fixa a identidade exata do alvo, sem herdar MPMT/PGE-AC", () => {
    expect(target.institution).toBe("MPRJ");
    expect(target.jurisdiction).toBe("RJ");
    expect(target.role).toBe("Promotor de Justiça Substituto");
    expect(target.noticeNumber).toBe("XXXIX/2026");
    expect(target.examDate).toBe("2026-05-31");
    expect(target.bookletVersionLabel).toBe("Tipo 1");
    expect(target.expectedQuestionCount).toBe(100);
    expect(target.answerKeyFinality).toBe("preliminary_plus_maintenance_act");
    expect(target.productSlug).toBe(MPRJ_PREVIOUS_PRODUCT_SLUG);
    expect(target.editionPublicId).toBe(MPRJ_PREVIOUS_EDITION_PUBLIC_ID);
    expect(target.portalUrl).toBe("https://conhecimento.fgv.br/concursos/mprjpromotor2026");
    // Identidade institucional entra no SQL; copiar o molde sem trocar estes
    // valores seria o erro mais provável deste arquivo.
    expect(moduleSource).toContain("opportunity.institution_acronym='MPRJ'");
    expect(moduleSource).toContain("opportunity.jurisdiction_code='RJ'");
    expect(moduleSource).toContain("career.slug='promotor-justica'");
    expect(moduleSource).not.toMatch(/'PGEAC'|'MPMT'|'AC'|'MT'/u);
  });

  it("nunca apresenta o gabarito preliminar como definitivo", () => {
    const evidence = assertMprjAnswerKeyEvidence();
    expect(evidence.finality).toBe("preliminary_plus_maintenance_act");
    expect(evidence.definitiveAnswerKey).toBeUndefined();
    expect(evidence.preliminaryAnswerKey.title.toLowerCase()).toContain("preliminar");
    expect(evidence.preliminaryAnswerKey.title.toLowerCase()).not.toContain("definitiv");
    expect(evidence.maintenanceAct.title.toLowerCase()).not.toContain("definitiv");
    for (const document of target.documents) {
      if (document.documentType === "answer_key") {
        expect(document.label.toLowerCase()).toContain("preliminar");
        expect(document.label.toLowerCase()).not.toContain("definitiv");
        expect(document.title.toLowerCase()).not.toContain("definitiv");
      }
    }
    // Nenhum campo do operador declara gabarito definitivo para esta edição.
    expect(moduleSource).toContain("definitiveAnswerKeyDocument: null");
    expect(moduleSource).not.toMatch(/gabarito oficial definitivo/iu);
  });

  it("recusa relabelamento, mistura de edição e dupla utilização do mesmo documento", () => {
    const relabeled = draft();
    mutableDocuments(relabeled)[1].title =
      "MPRJ XXXIX/2026 — gabarito definitivo, provisório até o julgamento dos recursos";
    expect(reviewAnswerKeyEvidence(relabeled)).toMatchObject({
      valid: false,
      code: "title_role_contradiction",
    });

    const mixedEdition = draft();
    mutableDocuments(mixedEdition)[2].editionPublicId = "mprj-promotor-substituto-xxxviii-2025-preambular";
    expect(reviewAnswerKeyEvidence(mixedEdition)).toMatchObject({
      valid: false,
      code: "document_edition_mismatch",
    });

    const duplicated = draft();
    mutableDocuments(duplicated)[2].sourceUrl = mutableDocuments(duplicated)[1].sourceUrl;
    expect(reviewAnswerKeyEvidence(duplicated)).toMatchObject({
      valid: false,
      code: "document_duplicated",
    });
  });

  it("exige os três papéis: sem o ato, com dois atos ou com o ato tipado como gabarito, falha", () => {
    const withoutAct = draft();
    const twoDocuments = { ...withoutAct, documents: mutableDocuments(withoutAct).slice(0, 2) } as unknown as AnswerKeyEvidenceDraft;
    expect(reviewAnswerKeyEvidence(twoDocuments)).toMatchObject({
      valid: false,
      code: "roles_incomplete",
    });

    const twoActs = draft();
    const extra = { ...mutableDocuments(twoActs)[2] };
    extra.sourceUrl = "https://conhecimento.fgv.br/sites/default/files/concursos/26.06_resultado-dos-recursos.pdf";
    const withTwoActs = { ...twoActs, documents: [...mutableDocuments(twoActs), extra] } as unknown as AnswerKeyEvidenceDraft;
    expect(reviewAnswerKeyEvidence(withTwoActs).valid).toBe(false);

    const actAsAnswerKey = draft();
    mutableDocuments(actAsAnswerKey)[2].documentType = "answer_key";
    expect(reviewAnswerKeyEvidence(actAsAnswerKey)).toMatchObject({
      valid: false,
      code: "document_type_mismatch",
    });
  });

  it("aceita somente o efeito de manutenção de todos os gabaritos", () => {
    const evidence = assertMprjAnswerKeyEvidence();
    expect(evidence.maintenanceAct.decisionEffect).toBe("all_keys_maintained");
    expect(evidence.maintenanceAct.decisionLegalBasis).toBe(MPRJ_ANSWER_KEY_DECISION_BASIS);
    // Molde real do XXXVIII/2025: cinco anulações e alteração de gabarito.
    for (const effect of ["keys_changed", "questions_annulled", "keys_changed_and_questions_annulled"]) {
      const changed = draft();
      mutableDocuments(changed)[2].decisionEffect = effect;
      expect(reviewAnswerKeyEvidence(changed)).toMatchObject({
        valid: false,
        code: "decision_effect_unsupported",
      });
    }
    const unknown = draft();
    mutableDocuments(unknown)[2].decisionEffect = "recursos_parcialmente_providos";
    expect(reviewAnswerKeyEvidence(unknown)).toMatchObject({
      valid: false,
      code: "decision_effect_unknown",
    });
  });

  it("separa a data de aplicação das datas de publicação dos três documentos", () => {
    expect(target.examDate).toBe("2026-05-31");
    expect(target.documents.map((document) => document.publishedOn)).toEqual([
      "2026-06-01",
      "2026-06-01",
      "2026-06-22",
    ]);
    for (const document of target.documents) {
      expect(document.publishedOn > target.examDate).toBe(true);
    }
  });

  it("recusa portal de outro certame, caderno de outra edição e âncora duplicada ou com rótulo diferente", () => {
    expect(() => assertMprjOfficialAnchors(html)).not.toThrow();
    const variants = [
      // Página de servidores do MPRJ: mesmo órgão, outro certame.
      portalHtml(H1_SERVIDORES),
      // Caderno do XXXVIII/2025 em lugar do XXXIX.
      html.replace(target.documents[0].url, BOOKLET_XXXVIII),
      // Âncora duplicada e rótulo diferente.
      `${html}<a href="${target.documents[2].url}">${target.documents[2].label}</a>`,
      html.replace("Recursos gabarito preambular", "Recursos gabarito preambular (retificado)"),
      // <time datetime> divergente da data publicada.
      html.replace("2026-06-22T12:00:00Z", "2026-06-23T12:00:00Z"),
      // Caderno de outra etapa/cargo.
      html.replace("Prova Preambular", "Prova Discursiva"),
      html.replace(target.role, "Analista do Ministério Público"),
      // Edital ausente do portal.
      html.replace(`<a href="${target.noticeUrl}">Edital do XXXIX Concurso</a>`, ""),
      // Query string: a comparação é por URL literal.
      html.replace(target.documents[1].url, `${target.documents[1].url}?x=1`),
    ];
    for (const variant of variants) {
      expect(() => assertMprjOfficialAnchors(variant)).toThrow();
    }
  });

  it("canonicaliza somente as âncoras verificadas, ignorando nonce/template transitório", () => {
    const transient = `<div class="template-status" data-nonce="rotativo-1">atualizado</div>${html}`;
    const baselineEvidence = assertMprjOfficialAnchors(html);
    const transientEvidence = assertMprjOfficialAnchors(
      transient.replace('data-nonce="rotativo-1"', 'data-nonce="rotativo-2"'),
    );
    expect(transient).not.toBe(html);
    expect(transientEvidence).toEqual(baselineEvidence);
    expect(baselineEvidence).toMatchObject({
      h1: H1_INGRESSO,
      notice: { url: target.noticeUrl, label: "Edital do XXXIX Concurso" },
      documents: target.documents.map((document) => ({
        documentType: document.documentType,
        url: document.url,
        label: document.label,
        publishedOn: document.publishedOn,
      })),
      definitiveAnswerKeyDocument: null,
    });
  });

  it("bloqueia alteração de identidade, rótulo, documento ou data em vez de canonicalizá-la", () => {
    const changedIdentity = html.replace(H1_INGRESSO, `${H1_INGRESSO} — retificado`);
    const changedLabel = html.replace("Tipo 1", "Tipo 2");
    const changedDate = html.replace("2026-06-01T12:00:00Z", "2026-06-02T12:00:00Z");
    const changedDocument = html.replace(target.documents[1].url, target.documents[0].url);
    for (const changed of [changedIdentity, changedLabel, changedDate, changedDocument]) {
      expect(() => assertMprjOfficialAnchors(changed)).toThrow();
    }
  });

  it("recusa a evidência composta se o portal anunciar gabarito definitivo da preambular", () => {
    const withDefinitive =
      `${html}<div class="paragraph--type--texto-data"><time datetime="2026-07-01T12:00:00Z"></time>` +
      `<a href="https://conhecimento.fgv.br/sites/default/files/concursos/gabarito-definitivo-preambular.pdf">` +
      `Gabarito Oficial Definitivo da Prova Preambular</a></div>`;
    expect(() => assertMprjOfficialAnchors(withDefinitive)).toThrow(/definitivo da preambular/iu);
  });

  it("prévia pública lê robots, portal e assinatura dos links, sem banco e sem extrair PDF", async () => {
    const result = await previewMprjPreviousExam({ fetcher: fetcher as typeof fetch, verifier });
    expect(state.connect).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      mode: "preview",
      answerKeyFinality: "preliminary_plus_maintenance_act",
      definitiveAnswerKeyDocument: null,
      databaseWrites: 0,
      questionsImported: 0,
      productsReleased: 0,
      humanReview: false,
      publicationAllowed: false,
      admissionApplied: false,
    });
    expect(result.documents).toHaveLength(3);
    expect(result.documents.map((document) => document.documentType)).toEqual([
      "question_booklet",
      "answer_key",
      "answer_key_decision",
    ]);
    expect(
      result.documents.every(
        (document) =>
          document.sourceContentStored === false &&
          document.status === "pending_review" &&
          document.distributionMode === "external_link" &&
          document.sourcePolicy === "metadata_only",
      ),
    ).toBe(true);
    expect(result.answerKeyProvenance.decisionEffect).toBe("all_keys_maintained");
    expect(result.answerKeyProvenance.relabelProhibited).toBe(true);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "https://conhecimento.fgv.br/robots.txt",
      target.portalUrl,
    ]);
    expect(verifier.mock.calls.map((call) => call[1])).toEqual(
      target.documents.map((document) => document.url),
    );
  });

  it("robots proibitivo, redirecionamento, MIME errado e finalUrl diferente bloqueiam", async () => {
    const denied = vi.fn(
      async () =>
        new Response("User-agent: *\nDisallow: /concursos/", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    );
    await expect(
      previewMprjPreviousExam({ fetcher: denied as typeof fetch, verifier }),
    ).rejects.toThrow();
    expect(denied).toHaveBeenCalledTimes(1);
    expect(verifier).not.toHaveBeenCalled();

    for (const patch of [
      { httpStatus: 403 },
      { finalUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/outro.pdf" },
      { contentType: "text/html" },
      { isPdf: false },
    ]) {
      await expect(
        previewMprjPreviousExam({
          fetcher: fetcher as typeof fetch,
          verifier: async (bank, url) => ({ ...(await verifier(bank, url)), ...patch }),
        }),
      ).rejects.toThrow();
    }

    const redirected = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const response = new Response(html, { status: 200, headers: { "content-type": "text/html" } });
      Object.defineProperty(response, "url", { value: `${String(url)}#outro` });
      return response;
    });
    await expect(
      previewMprjPreviousExam({ fetcher: redirected as typeof fetch, verifier }),
    ).rejects.toThrow();
  });

  it("exige hash exato, 47 páginas e as cláusulas de identidade e data do edital aprovado", () => {
    const identityPage =
      "XXXIX CONCURSO PARA INGRESSO NA CLASSE INICIAL DA CARREIRA DO MINISTÉRIO PÚBLICO DO ESTADO DO RIO DE JANEIRO — Promotor de Justiça Substituto";
    const datePage =
      "11.1 A prova preambular, de caráter eliminatório, com aplicação prevista para o dia 31 de maio de 2026 (domingo).";
    const valid = { checksum: target.noticeSha256, pages: 47, identityPage, datePage };
    expect(() => assertMprjNoticeEvidence(valid)).not.toThrow();
    const patches = [
      { checksum: "a".repeat(64) },
      // Hash do edital XXXVIII/2025 retificado.
      { checksum: "1ed30e2f2e7a5be5038e4381594438ce30d6dc4844f3a03ad966a1c287f56e85" },
      { pages: 46 },
      { identityPage: identityPage.replace("XXXIX", "XXXVIII") },
      { identityPage: identityPage.replace("Promotor de Justiça Substituto", "Analista") },
      { identityPage: identityPage.replace("MINISTÉRIO PÚBLICO DO ESTADO DO RIO DE JANEIRO", "MINISTÉRIO PÚBLICO DE OUTRO ESTADO") },
      { datePage: datePage.replace("31 de maio", "03 de agosto") },
      { datePage: datePage.replace("11.1", "11.7") },
      { datePage: datePage.replace("prova preambular", "prova discursiva") },
    ];
    for (const patch of patches) {
      expect(() => assertMprjNoticeEvidence({ ...valid, ...patch })).toThrow();
    }
  });

  it("não extrai a quantidade de questões do edital: declara proveniência da capa do caderno", () => {
    expect(MPRJ_QUESTION_COUNT_CORROBORATION.reextractedInThisExecution).toBe(false);
    expect(MPRJ_QUESTION_COUNT_CORROBORATION.provenance).toBe(
      "primary_booklet_cover_observed_by_project_operator",
    );
    expect(MPRJ_QUESTION_COUNT_CORROBORATION.sourceUrl).toBe(target.documents[0].url);
    // A conferência do edital não afirma cláusula de quantidade de questões.
    const noticeAssertion = moduleSource.slice(
      moduleSource.indexOf("export function assertMprjNoticeEvidence"),
      moduleSource.indexOf("type MprjPreview"),
    );
    expect(noticeAssertion).not.toMatch(/100|questões de múltipla escolha|alternativas/u);
  });

  it("apply exige oportunidade, hash e fingerprint explícitos; prévia nunca implica aplicação", () => {
    expect(parseMprjPreviousExamArgs([])).toMatchObject({ apply: false, databasePreview: false });
    const identity = [
      `--opportunity=${target.opportunityPublicId}`,
      `--expected-notice-sha256=${target.noticeSha256}`,
    ];
    expect(parseMprjPreviousExamArgs(identity)).toMatchObject({ apply: false, databasePreview: true });
    for (const args of [
      ["--apply"],
      ["--apply", ...identity],
      ["--apply", ...identity, "--expected-fingerprint=errado"],
      ["--opportunity=outro"],
      ["--output=../../public"],
      ["--output=x", "--output=y"],
      [`--expected-fingerprint=${"a".repeat(64)}`],
      ["--standing"],
    ]) {
      expect(() => parseMprjPreviousExamArgs(args)).toThrow();
    }
    expect(
      parseMprjPreviousExamArgs(["--apply", ...identity, `--expected-fingerprint=${"a".repeat(64)}`]).apply,
    ).toBe(true);
    expect(() =>
      assertMprjRegistrationRequest({
        mode: "preview",
        opportunityPublicId: "f16c8847-9d0d-4c47-84f8-752f3a72562d",
        expectedNoticeSha256: target.noticeSha256,
      }),
    ).toThrow();
    expect(moduleSource).toContain(
      'if (request.expectedFingerprint !== fingerprint) {',
    );
  });

  it("amarra o fingerprint à finalidade, ao ato e à ausência de gabarito definitivo", () => {
    const fingerprintPayload = moduleSource.slice(
      moduleSource.indexOf("const fingerprint = createHash"),
      moduleSource.indexOf('if (request.mode === "preview")'),
    );
    for (const field of [
      "answerKeyFinality",
      "answerKeyProvenance",
      "definitiveAnswerKeyDocument",
      "questionCountCorroboration",
      "portalEvidence",
      "robotsSha256",
      "snapshots",
      "identity",
      "assignments",
    ]) {
      expect(fingerprintPayload).toContain(field);
    }
    expect(fingerprintPayload).toContain("documentType");
    expect(fingerprintPayload).toContain("publishedOn");
    expect(moduleSource).toContain("portalHtmlSha256: preview.portalHtmlSha256");
  });

  it("standing aceita o par MPRJ só com a evidência composta e preserva as recusas anteriores", () => {
    const mprj = `${MPRJ_PREVIOUS_PRODUCT_SLUG}=${MPRJ_PREVIOUS_EDITION_PUBLIC_ID}`;
    const pgeac = `${PGEAC_PREVIOUS_PRODUCT_SLUG}=${PGEAC_PREVIOUS_EDITION_PUBLIC_ID}`;
    expect(mprjCompositeAnswerKeyEvidenceStands()).toBe(true);
    expect(parsePreviousExamLinkCommand(["--standing", mprj]).standing).toBe(true);
    for (const pair of [
      // O identificador antigo `…-objetiva` nunca foi criado e segue recusado.
      `${MPRJ_PREVIOUS_PRODUCT_SLUG}=mprj-promotor-substituto-xxxix-2026-objetiva`,
      `${mprj}-preliminar`,
      // XXXVIII/2025 não serve como prova anterior do XXXIX.
      `${MPRJ_PREVIOUS_PRODUCT_SLUG}=mprj-promotor-substituto-xxxviii-2025-preambular`,
      // Mistura de produto e edição de alvos diferentes.
      `${MPRJ_PREVIOUS_PRODUCT_SLUG}=${PGEAC_PREVIOUS_EDITION_PUBLIC_ID}`,
      `${PGEAC_PREVIOUS_PRODUCT_SLUG}=${MPRJ_PREVIOUS_EDITION_PUBLIC_ID}`,
    ]) {
      expect(() => parsePreviousExamLinkCommand(["--standing", pair])).toThrow();
    }
    // Uma edição por execução continua valendo.
    expect(() => parsePreviousExamLinkCommand(["--standing", mprj, pgeac])).toThrow();
  });

  it("todas as URLs do alvo ficam no host oficial da FGV e são comparadas literalmente", () => {
    for (const url of [target.portalUrl, target.noticeUrl, ...target.documents.map((d) => d.url)]) {
      expect(isOfficialExamUrl("fgv", url)).toBe(true);
      expect(new URL(url).hostname).toBe("conhecimento.fgv.br");
      expect(new URL(url).search).toBe("");
    }
    for (const url of [
      target.noticeUrl.replace("conhecimento.fgv.br", "fgv.br.evil"),
      target.noticeUrl.replace("https://", "http://"),
      // Hosts vizinhos da FGV que não estão na allowlist da banca.
      target.noticeUrl.replace("conhecimento.fgv.br", "portal.conhecimento.fgv.br"),
    ]) {
      expect(isOfficialExamUrl("fgv", url)).toBe(false);
    }
    // O SQL compara a URL literal do edital aprovado, não um prefixo de diretório.
    expect(moduleSource).toContain("source.source_url=${target.noticeUrl}");
    expect(moduleSource).toContain("snapshot.document_url=${target.noticeUrl}");
    expect(moduleSource).toContain("encode(sha256(snapshot.document_bytes),'hex')=${expectedNoticeSha256}");
  });

  it("não grava vínculo, não libera produto, não guarda conteúdo e não menciona licença", () => {
    expect(moduleSource).toContain("tx.json(metadata");
    expect(moduleSource).toContain("exam_edition_id is null");
    expect(moduleSource).toContain("preparation_opportunity_updated_at=(select updated_at");
    expect(moduleSource).toContain("'pending_review'");
    expect(moduleSource).toContain("source_content_stored");
    expect(moduleSource).not.toContain("insert into contest_product_exam_references");
    expect(moduleSource).not.toContain("set status='released'");
    expect(moduleSource).not.toMatch(/licensed_content|hosted_copy|storage_key|storageKey|licenseBasis/u);
    expect(moduleSource).not.toMatch(/humanReview:\s*true|human_review=true/u);
    expect(moduleSource).toContain("publicationAllowed: false");
    expect(moduleSource).toContain("productsReleased: 0");
    expect(moduleSource).toContain("questionsImported: 0");
    expect(moduleSource).toContain("referencesApproved: 0");
    expect(moduleSource).toContain("owner_standing_authorization");
    // A edição nasce com a finalidade declarada e sem conteúdo armazenado.
    expect(moduleSource).toContain("answer_key_finality");
    expect(moduleSource).toContain("'held','metadata_only',false,${target.answerKeyFinality}");
  });
});
