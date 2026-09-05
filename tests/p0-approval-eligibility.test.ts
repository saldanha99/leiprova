import { describe, expect, it } from "vitest";

import {
  evaluateOriginalQuestionApproval,
  matchConfirmedDossiers,
  parseReviewerConfirmation,
  publicFailureReason,
  UNEXPECTED_APPROVAL_FAILURE_REASON,
  type OriginalQuestionApprovalCandidate,
} from "@/lib/editorial/approval-eligibility";

const validCandidate: OriginalQuestionApprovalCandidate = {
  publicId: "q-1",
  status: "pending_review",
  creatorUserId: 42,
  cleanRoomAttestedAt: new Date("2026-09-01T10:00:00Z"),
  type: "multiple_choice",
  questionSourceRights: "original_authorial",
  originalityCheckedAt: new Date("2026-09-01T10:05:00Z"),
  similarityMaxBps: 1200,
  articleStatus: "reviewed",
  articleSourceRights: "official_text",
  versionStatus: "current",
  sourceUrl: "https://www.planalto.gov.br/exemplo",
  actIsActive: true,
  profileFormat: "multiple_choice",
  profileIsActive: true,
  bankIsActive: true,
  optionTotal: 5,
  optionCorrect: 1,
};

describe("critério único de aprovação editorial", () => {
  it("aprova um candidato completo", () => {
    expect(evaluateOriginalQuestionApproval(validCandidate).allowed).toBe(true);
  });

  it("recusa quando a versão legal deixou de ser a vigente", () => {
    const result = evaluateOriginalQuestionApproval({ ...validCandidate, versionStatus: "superseded" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("fonte oficial");
  });

  it("recusa quando o ato legal foi desativado", () => {
    expect(
      evaluateOriginalQuestionApproval({ ...validCandidate, actIsActive: false }).allowed,
    ).toBe(false);
  });

  it("recusa quando o formato do perfil não corresponde ao tipo da questão", () => {
    const result = evaluateOriginalQuestionApproval({ ...validCandidate, profileFormat: "true_false" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("perfil editorial");
  });

  it("recusa quando não há verificação de originalidade registrada", () => {
    const result = evaluateOriginalQuestionApproval({ ...validCandidate, originalityCheckedAt: null });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("originalidade");
  });

  it("recusa quando a similaridade registrada atinge o limiar de rejeição", () => {
    expect(
      evaluateOriginalQuestionApproval({ ...validCandidate, similarityMaxBps: 8_500 }).allowed,
    ).toBe(false);
  });

  it("exige duas alternativas em certo ou errado e cinco em múltipla escolha", () => {
    const trueFalse = {
      ...validCandidate,
      type: "true_false",
      profileFormat: "true_false",
      optionTotal: 5,
    };
    expect(evaluateOriginalQuestionApproval(trueFalse).allowed).toBe(false);
    expect(
      evaluateOriginalQuestionApproval({ ...trueFalse, optionTotal: 2 }).allowed,
    ).toBe(true);
  });

  it("recusa quando há mais de um gabarito correto", () => {
    const result = evaluateOriginalQuestionApproval({ ...validCandidate, optionCorrect: 2 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("gabarito");
  });

  it("recusa item que não está pendente de revisão", () => {
    expect(
      evaluateOriginalQuestionApproval({ ...validCandidate, status: "reviewed" }).allowed,
    ).toBe(false);
  });

  it("recusa item sem autoria limpa registrada", () => {
    expect(
      evaluateOriginalQuestionApproval({ ...validCandidate, cleanRoomAttestedAt: null }).allowed,
    ).toBe(false);
  });
});

describe("conferência item a item", () => {
  it("recusa quando nenhum item foi marcado", () => {
    const confirmation = parseReviewerConfirmation([], ["q-1:aaa"]);
    expect(confirmation.mode).toBe("missing");
    expect(matchConfirmedDossiers(confirmation, new Map([["q-1", "aaa"]])).allowed).toBe(false);
  });

  it("não aceita item marcado sem a impressão do dossiê", () => {
    const confirmation = parseReviewerConfirmation(["q-1"], []);
    expect(confirmation.mode).toBe("invalid");
    expect(matchConfirmedDossiers(confirmation, new Map([["q-1", "aaa"]])).allowed).toBe(false);
  });

  it("ignora impressões de itens não marcados", () => {
    const confirmation = parseReviewerConfirmation(["q-1"], ["q-1:aaa", "q-2:bbb"]);
    expect(confirmation.mode === "reviewer_confirmed" && confirmation.items).toEqual([
      { publicId: "q-1", fingerprint: "aaa" },
    ]);
  });

  it("recusa seleção com itens repetidos", () => {
    expect(parseReviewerConfirmation(["q-1", "q-1"], ["q-1:aaa"]).mode).toBe("invalid");
  });

  it("recusa impressões conflitantes para o mesmo item", () => {
    expect(parseReviewerConfirmation(["q-1"], ["q-1:aaa", "q-1:bbb"]).mode).toBe("invalid");
  });

  it("aprova quando marcação e impressões conferem com o estado atual", () => {
    const confirmation = parseReviewerConfirmation(["q-1", "q-2"], ["q-1:aaa", "q-2:bbb"]);
    const atual = new Map([
      ["q-1", "aaa"],
      ["q-2", "bbb"],
    ]);
    expect(matchConfirmedDossiers(confirmation, atual).allowed).toBe(true);
  });

  it("bloqueia quando o conteúdo mudou depois da conferência", () => {
    const confirmation = parseReviewerConfirmation(["q-1"], ["q-1:aaa"]);
    const result = matchConfirmedDossiers(confirmation, new Map([["q-1", "CONTEUDO-NOVO"]]));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("mudou depois da sua conferência");
  });

  it("bloqueia quando o item deixou de estar pendente", () => {
    const confirmation = parseReviewerConfirmation(["q-1"], ["q-1:aaa"]);
    const result = matchConfirmedDossiers(confirmation, new Map());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("não está mais pendente");
  });

  it("bloqueia quando o servidor traz item além dos conferidos", () => {
    const confirmation = parseReviewerConfirmation(["q-1"], ["q-1:aaa"]);
    const result = matchConfirmedDossiers(
      confirmation,
      new Map([
        ["q-1", "aaa"],
        ["q-9", "zzz"],
      ]),
    );
    expect(result.allowed).toBe(false);
  });
});

describe("mensagem pública de falha", () => {
  it("preserva motivos conhecidos", () => {
    expect(publicFailureReason(new Error("motivo conhecido"), ["motivo conhecido"])).toBe(
      "motivo conhecido",
    );
  });

  it("não expõe erro interno de banco ao revisor", () => {
    const interno = new Error(
      'duplicate key value violates unique constraint "questions_public_id_key"',
    );
    const publico = publicFailureReason(interno, ["motivo conhecido"]);
    expect(publico).toBe(UNEXPECTED_APPROVAL_FAILURE_REASON);
    expect(publico).not.toContain("constraint");
    expect(publico).not.toContain("duplicate key");
  });
});
