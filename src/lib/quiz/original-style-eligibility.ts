/**
 * Elegibilidade das questões autorais (`original_style`) na montagem do simulado.
 *
 * Dois defeitos distintos são tratados aqui.
 *
 * 1. Lastro legal: a trilha autoral se apoiava apenas na banca e não exigia
 *    artigo revisado, versão vigente e ato ativo — exigências que o treino
 *    literal já fazia. Um item aprovado no passado seguia elegível depois de a
 *    fonte ficar obsoleta. O lastro passa a ser exigido em TODOS os recortes.
 *
 * 2. Cobertura de concurso: escolher uma edição não garantia que a questão
 *    pertencesse ao programa daquela oportunidade.
 *
 * Sobre o recorte por edição: uma versão anterior deste módulo identificava a
 * oportunidade por carreira, especialização e ano do ciclo. Isso estava errado —
 * essa tripla não identifica uma edição. Duas edições da mesma carreira e banca
 * podem coexistir no mesmo ano, e órgãos diferentes podem compartilhar carreira
 * e ciclo, de modo que a heurística casaria a oportunidade errada. O vínculo
 * agora é a identidade explícita `contest_opportunities.exam_edition_id`, que é
 * chave estrangeira única para `exam_editions.id`.
 *
 * Como a coluna é anulável e não há backfill inferido, uma oportunidade ainda
 * não mapeada simplesmente não casa: o recorte falha fechado em vez de servir
 * questão de outro concurso sob a aparência daquele edital.
 *
 * O treino geral por banca continua existindo: ele não alega cobertura de
 * concurso, então não exige programa — mas continua exigindo fonte legal válida
 * e revisão registrada.
 */

export type OriginalStyleSelection = {
  readonly bankId: number | null;
  /** Identificador da edição escolhida pelo aluno, quando houver. */
  readonly examEditionId: number | null;
};

export type OriginalStyleEligibilityDenial = "missing_bank";

export type OriginalStyleEligibility =
  | {
      readonly eligible: true;
      /** Treino geral da banca: sem alegação de cobertura de concurso. */
      readonly scope: "general_bank";
      readonly bankId: number;
    }
  | {
      readonly eligible: true;
      /** Recorte de concurso: exige programa da edição exata. */
      readonly scope: "edition_program";
      readonly bankId: number;
      readonly examEditionId: number;
    }
  | { readonly eligible: false; readonly reason: OriginalStyleEligibilityDenial };

export function resolveOriginalStyleEligibility(
  selection: OriginalStyleSelection,
): OriginalStyleEligibility {
  if (!selection.bankId) return { eligible: false, reason: "missing_bank" };

  if (!selection.examEditionId) {
    return { eligible: true, scope: "general_bank", bankId: selection.bankId };
  }

  return {
    eligible: true,
    scope: "edition_program",
    bankId: selection.bankId,
    examEditionId: selection.examEditionId,
  };
}

/** Estados de oportunidade cujo programa pode lastrear uma questão servida. */
export const ELIGIBLE_OPPORTUNITY_EDITORIAL_STATUSES = ["reviewed"] as const;
