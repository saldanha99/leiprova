import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";

export const MPMT_PREVIOUS_EDITION_PUBLIC_ID = "mpmt-promotor-substituto-2026-objetiva";
export const MPMT_PREVIOUS_PRODUCT_SLUG = "mpe-mt-promotor-de-justica-2026";

export const PGEAC_PREVIOUS_EDITION_PUBLIC_ID = "pgeac-procurador-classe-i-viii-2026-objetiva";
export const PGEAC_PREVIOUS_PRODUCT_SLUG = "pge-ac-procurador-do-estado-reta-final";

type Pair = Readonly<{ productSlug: string; editionPublicId: string }>;
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
  if (standing && (pairs.length !== 1 || !((pairs[0].productSlug === MPMT_PREVIOUS_PRODUCT_SLUG && pairs[0].editionPublicId === MPMT_PREVIOUS_EDITION_PUBLIC_ID)
    || (pairs[0].productSlug === PGEAC_PREVIOUS_PRODUCT_SLUG && pairs[0].editionPublicId === PGEAC_PREVIOUS_EDITION_PUBLIC_ID)))) throw new Error("Standing delimitado aos pares exatos MPMT 01/2026 e PGE-AC VIII/2026; uma edição por execução.");
  return { apply, standing, pairs };
}

export function previousExamApprovalBasis(standing: boolean, reference: string) {
  if (standing && reference !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Standing exige referência exata da decisão de fontes/programas de 12/10/2026.");
  return standing ? { reviewBasis: "owner_standing_authorization", humanReview: false, approvalReference: reference }
    : { reviewBasis: "owner_authorization", approvalReference: reference };
}
