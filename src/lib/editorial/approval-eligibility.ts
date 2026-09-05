import { validateHumanReview } from "@/lib/editorial/clean-room";
import { ORIGINALITY_REJECTION_THRESHOLD_BPS } from "@/lib/editorial/originality";

/**
 * Critério único de aprovação editorial de questão autoral.
 *
 * Antes existiam dois critérios para o mesmo conteúdo: a aprovação individual
 * conferia apenas estado, responsável e atestação de sala limpa, enquanto a
 * aprovação em lote revalidava fonte legal, perfil, alternativas e
 * originalidade. O caminho mais frouxo publicava o mesmo tipo de item.
 *
 * Esta função é a regra única. Ambas as ações passam a chamá-la, de modo que
 * aprovar um item sozinho exige exatamente o que aprová-lo em lote exige.
 */

export type OriginalQuestionApprovalCandidate = {
  readonly publicId: string;
  readonly status: string;
  readonly creatorUserId: number | null;
  readonly cleanRoomAttestedAt: Date | null;
  readonly type: string;
  readonly questionSourceRights: string;
  readonly originalityCheckedAt: Date | null;
  readonly similarityMaxBps: number;
  readonly articleStatus: string | null;
  readonly articleSourceRights: string | null;
  readonly versionStatus: string | null;
  readonly sourceUrl: string | null;
  readonly actIsActive: boolean | null;
  readonly profileFormat: string | null;
  readonly profileIsActive: boolean | null;
  readonly bankIsActive: boolean | null;
  readonly optionTotal: number;
  readonly optionCorrect: number;
};

export type ApprovalEvaluation =
  | { readonly allowed: true; readonly reason: null }
  | { readonly allowed: false; readonly reason: string };

export function expectedOptionCount(type: string) {
  return type === "true_false" ? 2 : 5;
}

export function evaluateOriginalQuestionApproval(
  candidate: OriginalQuestionApprovalCandidate,
): ApprovalEvaluation {
  const humanReview = validateHumanReview({
    status: candidate.status,
    creatorUserId: candidate.creatorUserId,
    cleanRoomAttestedAt: candidate.cleanRoomAttestedAt,
  });
  if (!humanReview.allowed) return { allowed: false, reason: humanReview.reason };

  if (
    candidate.questionSourceRights !== "original_authorial" ||
    candidate.articleStatus !== "reviewed" ||
    candidate.articleSourceRights !== "official_text" ||
    candidate.versionStatus !== "current" ||
    !candidate.sourceUrl ||
    !candidate.actIsActive
  ) {
    return {
      allowed: false,
      reason: `A fonte oficial da questão ${candidate.publicId} precisa ser revisada.`,
    };
  }

  if (
    !candidate.profileIsActive ||
    !candidate.bankIsActive ||
    candidate.profileFormat !== candidate.type
  ) {
    return {
      allowed: false,
      reason: `O perfil editorial da questão ${candidate.publicId} não está elegível.`,
    };
  }

  if (
    !candidate.originalityCheckedAt ||
    candidate.similarityMaxBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS
  ) {
    return {
      allowed: false,
      reason: `A questão ${candidate.publicId} não possui verificação de originalidade válida.`,
    };
  }

  const expected = expectedOptionCount(candidate.type);
  if (candidate.optionTotal !== expected || candidate.optionCorrect !== 1) {
    return {
      allowed: false,
      reason: `A questão ${candidate.publicId} possui alternativas ou gabarito inválidos.`,
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Vínculo da aprovação aos itens efetivamente revisados.
 *
 * Antes o revisor confirmava uma atestação genérica e o servidor escolhia
 * sozinho até 250 pendentes: o revisor nunca declarava o que examinou, e nada
 * garantia que o conteúdo aprovado fosse o conteúdo exibido.
 *
 * Agora cada item aprovado precisa de duas coisas independentes: a marcação
 * explícita daquele item pelo revisor e a impressão digital do dossiê que lhe
 * foi mostrado. A impressão é recalculada no servidor sob transação; se o
 * enunciado, uma alternativa, o gabarito, uma justificativa ou a fonte mudarem
 * depois da leitura, a aprovação é recusada.
 */
export type ConfirmedDossier = {
  readonly publicId: string;
  readonly fingerprint: string;
};

export type ReviewerConfirmation =
  | { readonly mode: "reviewer_confirmed"; readonly items: readonly ConfirmedDossier[] }
  | { readonly mode: "missing" }
  | { readonly mode: "invalid"; readonly reason: string };

export const MISSING_REVIEWER_CONFIRMATION_REASON =
  "Marque cada questão que você conferiu antes de aprovar. Nenhum item foi selecionado.";

export const MISSING_ATTESTATION_REASON =
  "Confirme a declaração de revisão humana antes de aprovar.";

/**
 * `publicIds` vem das caixas marcadas pelo revisor; `fingerprintEntries` vem
 * dos campos `publicId:impressão` renderizados junto de cada dossiê. Um item só
 * é aceito quando aparece nas duas listas: marcar sem impressão, ou enviar
 * impressão sem marcar, não aprova nada.
 */
export function parseReviewerConfirmation(
  publicIds: readonly FormDataEntryValue[],
  fingerprintEntries: readonly FormDataEntryValue[],
): ReviewerConfirmation {
  const selected = publicIds
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!selected.length) return { mode: "missing" };

  if (new Set(selected).size !== selected.length) {
    return { mode: "invalid", reason: "A seleção possui itens repetidos." };
  }

  const fingerprints = new Map<string, string>();
  for (const entry of fingerprintEntries) {
    if (typeof entry !== "string") continue;
    const separator = entry.indexOf(":");
    if (separator <= 0) continue;
    const publicId = entry.slice(0, separator).trim();
    const fingerprint = entry.slice(separator + 1).trim();
    if (!publicId || !fingerprint) continue;
    if (fingerprints.has(publicId) && fingerprints.get(publicId) !== fingerprint) {
      return { mode: "invalid", reason: "A conferência recebeu dados inconsistentes. Recarregue a tela." };
    }
    fingerprints.set(publicId, fingerprint);
  }

  const items: ConfirmedDossier[] = [];
  for (const publicId of selected) {
    const fingerprint = fingerprints.get(publicId);
    if (!fingerprint) {
      return {
        mode: "invalid",
        reason: "A conferência de um item selecionado não veio completa. Recarregue a tela e revise novamente.",
      };
    }
    items.push({ publicId, fingerprint });
  }

  return { mode: "reviewer_confirmed", items };
}

/**
 * Compara o que o revisor declarou com o que o banco contém agora. Recebe as
 * impressões recalculadas sob transação.
 */
export function matchConfirmedDossiers(
  confirmation: ReviewerConfirmation,
  currentFingerprints: ReadonlyMap<string, string>,
): ApprovalEvaluation {
  if (confirmation.mode === "missing") {
    return { allowed: false, reason: MISSING_REVIEWER_CONFIRMATION_REASON };
  }
  if (confirmation.mode === "invalid") {
    return { allowed: false, reason: confirmation.reason };
  }

  for (const item of confirmation.items) {
    const current = currentFingerprints.get(item.publicId);
    if (!current) {
      return {
        allowed: false,
        reason: `A questão ${item.publicId} não está mais pendente de revisão. Recarregue a tela.`,
      };
    }
    if (current !== item.fingerprint) {
      return {
        allowed: false,
        reason: `A questão ${item.publicId} mudou depois da sua conferência (enunciado, alternativas, gabarito ou fonte). Revise novamente antes de aprovar.`,
      };
    }
  }

  if (currentFingerprints.size !== confirmation.items.length) {
    return {
      allowed: false,
      reason: "A lista mudou entre a conferência e a aprovação. Recarregue a tela e revise novamente.",
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Mensagem pública de falha inesperada.
 *
 * Erros de banco chegavam à tela do revisor com o texto original, o que podia
 * expor detalhes de SQL, nomes de restrição e estrutura interna. O detalhe vai
 * para o log do servidor; a tela recebe uma frase acionável.
 */
export const UNEXPECTED_APPROVAL_FAILURE_REASON =
  "Não foi possível concluir a operação. Recarregue a tela e tente novamente.";

export function publicFailureReason(error: unknown, knownReasons: readonly string[]) {
  const message = error instanceof Error ? error.message : "";
  return knownReasons.includes(message) ? message : UNEXPECTED_APPROVAL_FAILURE_REASON;
}
