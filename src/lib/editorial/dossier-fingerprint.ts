import { createHash } from "node:crypto";

/**
 * Impressão digital do dossiê que o revisor efetivamente viu.
 *
 * Prender a aprovação apenas aos identificadores não basta: entre a renderização
 * da tela e o clique, o enunciado, uma alternativa, o gabarito, uma justificativa
 * ou a fonte legal podem mudar. Nesse caso o revisor teria examinado um conteúdo
 * e aprovado outro, com o mesmo `publicId`.
 *
 * A impressão cobre tudo o que é exibido no dossiê e é sempre calculada no
 * servidor — na renderização e de novo dentro da transação de aprovação, sob
 * lock da linha. Diferença entre as duas leituras aborta a operação.
 *
 * O cliente nunca calcula nem escolhe a impressão: ele apenas devolve a que
 * recebeu, e ela só vale acompanhada da marcação explícita do item.
 */

export type DossierOption = {
  readonly optionKey: string;
  readonly text: string;
  readonly isCorrect: boolean;
  readonly rationale: string | null;
};

export type QuestionDossier = {
  readonly publicId: string;
  readonly type: string;
  readonly prompt: string;
  readonly explanation: string;
  readonly learningObjective: string | null;
  readonly difficulty: number;
  readonly articleRef: string | null;
  readonly literalText: string | null;
  readonly sourceUrl: string | null;
  readonly sourceVerifiedAt: Date | string | null;
  readonly options: readonly DossierOption[];
};

function normalizeInstant(value: Date | string | null) {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

/**
 * Serialização canônica: ordem estável de campos e de alternativas, para que a
 * mesma questão produza sempre a mesma impressão, e qualquer alteração de
 * conteúdo produza outra.
 */
export function canonicalDossier(dossier: QuestionDossier) {
  return JSON.stringify([
    dossier.publicId,
    dossier.type,
    dossier.prompt.trim(),
    dossier.explanation.trim(),
    (dossier.learningObjective ?? "").trim(),
    dossier.difficulty,
    (dossier.articleRef ?? "").trim(),
    (dossier.literalText ?? "").trim(),
    (dossier.sourceUrl ?? "").trim(),
    normalizeInstant(dossier.sourceVerifiedAt),
    [...dossier.options]
      .sort((left, right) => left.optionKey.localeCompare(right.optionKey))
      .map((option) => [
        option.optionKey.trim(),
        option.text.trim(),
        option.isCorrect,
        (option.rationale ?? "").trim(),
      ]),
  ]);
}

export function buildDossierFingerprint(dossier: QuestionDossier) {
  return createHash("sha256").update(canonicalDossier(dossier)).digest("hex").slice(0, 32);
}
