import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";

/**
 * Edições do Exame de Ordem Unificado (OAB), aplicadas pela FGV, para o passo
 * "Ano, edição e banca" do montador do quiz. Só metadados: nenhum PDF é guardado.
 *
 * Evidência coletada em 26/11/2026 no portal oficial oab.fgv.br (página da edição,
 * seccional SP): o edital de abertura fixa a data provável da prova objetiva
 * (item 3.1.1) e o gabarito preliminar da 1ª fase, publicado na mesma data,
 * confirma a aplicação. O 48º (prova objetiva prevista para 10/01/2027) fica fora:
 * prova agendada só aparece no quiz com programa revisado e questões vinculadas.
 */
export const OAB_EXAM_EDITIONS_REFERENCE = "owner-standing-2026-10-12:official-sources-programs";
export const OAB_EXAM_EDITIONS_AUDIT_ACTION = "editorial.exam_edition.oab_registered";
export const OAB_EXAM_EDITIONS_OBSERVED_AT = "2026-11-26T13:15:00.000Z";

export type OabExamEdition = Readonly<{
  number: number;
  publicId: string;
  sourceExternalId: string;
  title: string;
  examDate: string;
  status: "held" | "published";
  officialUrl: string;
  noticeUrl: string;
  noticeSha256: string;
  noticeDateExcerpt: string;
  answerKeyEvidence: string;
}>;

function edition(
  number: number,
  key: number,
  examDate: string,
  status: OabExamEdition["status"],
  noticeFile: string,
  noticeSha256: string,
  noticeDateExcerpt: string,
  answerKeyEvidence: string,
): OabExamEdition {
  return {
    number,
    publicId: `oab-exame-de-ordem-${number}-objetiva`,
    sourceExternalId: `fgv-oab-${number}-exame-objetiva`,
    title: `${number}º Exame de Ordem Unificado (OAB) — prova objetiva (1ª fase)`,
    examDate,
    status,
    officialUrl: `https://oab.fgv.br/home.aspx?key=${key}`,
    noticeUrl: `https://oab.fgv.br/arq/${key}/${noticeFile}`,
    noticeSha256,
    noticeDateExcerpt,
    answerKeyEvidence,
  };
}

export const OAB_EXAM_EDITIONS: readonly OabExamEdition[] = [
  edition(47, 650, "2026-09-06", "held",
    "580490_47%c2%ba%20eou.%20edital%20de%20abertura.%20ponto%20para%20publicar.%20(2).pdf",
    "cdb2a78a644edc361b1d7ae42b3154a7ea253e3870af0458e1d10b5f59c54ace",
    "será aplicada na data provável de 6 de setembro de 2026",
    "06/09/2026: Gabaritos Preliminares da Prova Objetiva (1ª Fase) - atualizado em 07.09.2026"),
  edition(46, 649, "2026-05-03", "published",
    "604111_46%20eou.%20edital%20de%20abertura..pdf",
    "83519862d626fc5d5f4ed567748dfc05f7b8331e362cc557cbba912983194d7a",
    "será aplicada na data provável de 3 de maio de 2026",
    "03/05/2026: Gabaritos Preliminares da Prova Objetiva (1ª Fase) - Atualizado em 04.05.2026"),
  edition(45, 648, "2025-12-21", "published",
    "604589_45%20eou.%20edital%20de%20abertura.%20arquivo%20limpo.%20atualizado..pdf",
    "a782ed0a3ebeba4a19668b10a623a07d1b0d70091c0098ee06ac81e29c23cf41",
    "será aplicada na data provável de 21 de dezembro de 2025",
    "21/12/2025: Gabaritos Preliminares da Prova Objetiva (1ª Fase) - Atualizado em 22.12.2025"),
  edition(44, 647, "2025-08-17", "published",
    "541777_44%20eou.%20edital%20de%20abertura.%20publicacao%20dia%2030.04.25.%20(1).pdf",
    "8d092c761ff0172e5eab7c0992811523131a76f21ab236f6c95888b92be55db1",
    "será aplicada na data provável de 17 de agosto de 2025",
    "17/08/2025: Gabaritos Preliminares da Prova Objetiva (1ª fase)"),
  edition(43, 646, "2025-04-27", "published",
    "538132_43%20eou.%20edital%20de%20abertura.%20.pdf",
    "d1cc6b3079400c11abb6507a10a83d13c481230b9d28322c756c677bd7ec7533",
    "será aplicada na data provável de 27 de abril de 2025",
    "27/04/2025: Gabaritos Preliminares da Prova Objetiva (1ª fase) - atualizado em 30/04/2025"),
];

/** Garante identidade única, URL oficial da FGV e data coerente antes de gravar. */
export function assertOabExamEditions(editions: readonly OabExamEdition[], todayIso: string) {
  const ids = new Set<string>();
  for (const item of editions) {
    if (ids.has(item.publicId) || ids.has(item.sourceExternalId)) throw new Error(`Edição OAB repetida: ${item.publicId}.`);
    ids.add(item.publicId).add(item.sourceExternalId);
    if (!isOfficialExamUrl("fgv", item.officialUrl) || !isOfficialExamUrl("fgv", item.noticeUrl)) {
      throw new Error(`URL fora do portal oficial da FGV: ${item.publicId}.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.examDate) || item.examDate > todayIso) {
      throw new Error(`Edição OAB ainda não aplicada ou com data inválida: ${item.publicId}.`);
    }
    if (!/^[a-f0-9]{64}$/.test(item.noticeSha256)) throw new Error(`Hash do edital inválido: ${item.publicId}.`);
  }
}
