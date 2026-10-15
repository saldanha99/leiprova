import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import {
  MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE,
  reviewAnswerKeyEvidence,
} from "@/lib/exams/answer-key-finality";

export const MPMT_PREVIOUS_EDITION_PUBLIC_ID = "mpmt-promotor-substituto-2026-objetiva";
export const MPMT_PREVIOUS_PRODUCT_SLUG = "mpe-mt-promotor-de-justica-2026";

export const PGEAC_PREVIOUS_EDITION_PUBLIC_ID = "pgeac-procurador-classe-i-viii-2026-objetiva";
export const PGEAC_PREVIOUS_PRODUCT_SLUG = "pge-ac-procurador-do-estado-reta-final";

/** Prova preambular do XXXIX, com evidência final composta. O identificador diz
 * `preambular`: `…-objetiva` nunca foi criado e continua recusado. */
export const MPRJ_PREVIOUS_EDITION_PUBLIC_ID = "mprj-promotor-substituto-xxxix-2026-preambular";
export const MPRJ_PREVIOUS_PRODUCT_SLUG = "mpe-rj-promotor-de-justica-2026";

/** O par MPRJ só entra no standing enquanto a evidência composta se sustenta na
 * política pura: gabarito preliminar + ato que mantém todos os gabaritos, na
 * edição exata. Sem isso, o standing recusa o MPRJ como antes de 0055. */
export function mprjCompositeAnswerKeyEvidenceStands() {
  const review = reviewAnswerKeyEvidence(MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE);
  return (
    review.valid &&
    review.evidence.finality === "preliminary_plus_maintenance_act" &&
    review.evidence.edition.publicId === MPRJ_PREVIOUS_EDITION_PUBLIC_ID &&
    review.evidence.maintenanceAct.decisionEffect === "all_keys_maintained"
  );
}

type Pair = Readonly<{ productSlug: string; editionPublicId: string }>;

function standingPairAllowed(pair: Pair) {
  if (pair.productSlug === MPMT_PREVIOUS_PRODUCT_SLUG) return pair.editionPublicId === MPMT_PREVIOUS_EDITION_PUBLIC_ID;
  if (pair.productSlug === PGEAC_PREVIOUS_PRODUCT_SLUG) return pair.editionPublicId === PGEAC_PREVIOUS_EDITION_PUBLIC_ID;
  if (pair.productSlug === MPRJ_PREVIOUS_PRODUCT_SLUG) {
    return pair.editionPublicId === MPRJ_PREVIOUS_EDITION_PUBLIC_ID && mprjCompositeAnswerKeyEvidenceStands();
  }
  return false;
}
export function parsePreviousExamLinkCommand(argv: readonly string[]) {
  let apply = false;
  let standing = false;
  const pairs: Pair[] = [];
  for (const [index, arg] of argv.entries()) {
    if (arg === "--" && index === 0) continue;
    if (arg === "--apply" && !apply) { apply = true; continue; }
    if (arg === "--standing" && !standing) { standing = true; continue; }
    const parts = arg.split("=");
    if (parts.length !== 2 || !parts.every((part) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(part))) throw new Error("Argumento/par inválido; use produto=edição, --apply e --standing explícitos.");
    pairs.push({ productSlug: parts[0], editionPublicId: parts[1] });
  }
  if (!pairs.length || new Set(pairs.map((pair) => pair.productSlug)).size !== pairs.length) throw new Error("Informe pares únicos de produto/edição.");
  if (standing && (pairs.length !== 1 || !standingPairAllowed(pairs[0]))) throw new Error("Standing delimitado aos pares exatos MPMT 01/2026, PGE-AC VIII/2026 e MPRJ XXXIX/2026 preambular com evidência composta; uma edição por execução.");
  return { apply, standing, pairs };
}

export function previousExamApprovalBasis(standing: boolean, reference: string) {
  if (standing && reference !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Standing exige referência exata da decisão de fontes/programas de 12/10/2026.");
  return standing ? { reviewBasis: "owner_standing_authorization", humanReview: false, approvalReference: reference }
    : { reviewBasis: "owner_authorization", approvalReference: reference };
}
