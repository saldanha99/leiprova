import { createHash } from "node:crypto";

import type { CapturedOfficialDocument } from "@/lib/opportunities/official-document-fetch";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import {
  requiredAnswerKeyDocumentTypes,
  type AnswerKeyDocumentType,
  type AnswerKeyFinality,
} from "@/lib/exams/answer-key-finality";

const FGV_FILES = "https://conhecimento.fgv.br/sites/default/files/concursos/";
/** Leitura explícita do anexo: cada título de disciplina é uma linha literal do PDF
 * (com eventual linha de continuação) e as linhas repetidas de cabeçalho/rodapé são
 * descartadas por padrões ancorados. Título ausente, repetido ou fora de ordem bloqueia. */
export type ProgrammeLayout = Readonly<{
  headings: readonly Readonly<{ line: string; subject: string; continuation?: string }>[];
  ignoreLines: readonly string[];
  /** Programa em prosa corrida ("1. … 2. …" na mesma linha): cada item numerado vira um fragmento. */
  splitInlineItems?: boolean;
}>;
export type PreviewDocumentRecipe = Readonly<{ key: string; url: string; title: string; pages: number; programmePages: readonly [number, number] | null; layout?: ProgrammeLayout }>;
export type NextOfficialCourseRecipe = Readonly<{
  productSlug: string; institution: string; role: string; jurisdiction: string; cycle: string; bankScope: string;
  portalUrl: string; examDate: string; examDateEvidence: Readonly<{ documentKey: string; page: number; item: string; quote: string; actualDayIndependentlyVerified: boolean; corroboratingUrl: string | null; limitation: string | null }>; stage: string; stageObservedOn: string; proposedMode: "historical_training";
  documents: readonly PreviewDocumentRecipe[];
  expectedSubjects: number;
  overlays: readonly Readonly<{ key: string; subjects: readonly string[] }>[];
  identityClaims: readonly Readonly<{ document: string; page: number; contains: readonly string[] }>[];
  previousExam: Readonly<{ cycle: string; role: string; portalUrl: string; examDate: string; answerKeyFinality: AnswerKeyFinality; documents: readonly Readonly<{ type: AnswerKeyDocumentType; title: string; url: string }>[] }>;
  limitations: readonly string[];
  repeatableRequirements?: readonly string[];
}>;

/** A evidência final do gabarito precisa estar completa: um documento definitivo
 * autônomo, ou o par preliminar + ato de manutenção. Faltando um papel, a admissão
 * fica bloqueada e o motivo é declarado. */
export function previousExamAdmissionBlocker(
  previousExam: NextOfficialCourseRecipe["previousExam"],
) {
  const required = requiredAnswerKeyDocumentTypes(previousExam.answerKeyFinality);
  const present = new Set(previousExam.documents.map((document) => document.type));
  const missing = required.filter((type) => !present.has(type));
  if (missing.length) {
    return `Answer key evidence incomplete for ${previousExam.answerKeyFinality}: missing ${missing.join(", ")}`;
  }
  if (previousExam.documents.length !== required.length) {
    return `Answer key evidence has unexpected documents for ${previousExam.answerKeyFinality}`;
  }
  return null;
}

export const NEXT_OFFICIAL_COURSE_RECIPES: readonly NextOfficialCourseRecipe[] = [
  {
    productSlug: "mpe-rj-promotor-de-justica-2026", institution: "Ministério Público do Estado do Rio de Janeiro", role: "Promotor de Justiça Substituto",
    jurisdiction: "RJ", cycle: "XXXIX — 2026", bankScope: "FGV: inscrições provisórias/elaboração/aplicação da preambular; MPRJ: discursivas em diante, com apoio logístico FGV",
    portalUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2026", examDate: "2026-05-31", examDateEvidence: { documentKey: "mprj-notice", page: 21, item: "11.1", quote: "com aplicação prevista para o dia 31 de maio de 2026 (domingo)", actualDayIndependentlyVerified: true, corroboratingUrl: "https://www.mprj.mp.br/visualizar?noticiaId=224001", limitation: null }, stage: "Discursivas com resultado em02/10/2026; inscrição definitiva, exame de higidez e fases posteriores em andamento",
    stageObservedOn: "2026-10-12", proposedMode: "historical_training", expectedSubjects: 13,
    documents: [
      { key: "mprj-notice", url: `${FGV_FILES}edital-xxxix-concurso.pdf`, title: "Edital do XXXIX Concurso MPRJ", pages: 47, programmePages: null },
      { key: "mprj-programme", url: `${FGV_FILES}aviso-conteudo-programatico-concurso-xxxix.pdf`, title: "Aviso Conteúdo Programático MPRJ XXXIX", pages: 51, programmePages: [1, 51] },
      { key: "mprj-inclusion", url: `${FGV_FILES}aviso_conteudo_programatico-concurso_xxxix_republicacao_parcial_inclusao.pdf`, title: "Aviso Conteúdo Programático MPRJ XXXIX republicação parcial inclusão", pages: 13, programmePages: [1, 13] },
      { key: "mprj-civil-correction", url: `${FGV_FILES}aviso_conteudo_programatico-concurso_xxxix_republicacao_direito_proc_civil_incorrecao.pdf`, title: "Aviso Conteúdo Programático MPRJ XXXIX republicação Direito Processual Civil", pages: 5, programmePages: [1, 5] },
    ],
    overlays: [
      { key: "mprj-inclusion", subjects: ["Direito Penal", "Direito Processual Penal", "Legislação Penal Extravagante"] },
      { key: "mprj-civil-correction", subjects: ["Direito Processual Civil"] },
    ],
    identityClaims: [
      { document: "mprj-notice", page: 1, contains: ["XXXIX", "ESTADO DO RIO DE JANEIRO", "Promotor de Justiça Substituto", "2026"] },
      { document: "mprj-notice", page: 21, contains: ["11.1", "31 de maio de 2026", "prova preambular"] },
      { document: "mprj-notice", page: 2, contains: ["responsabilidade da Fundação Getulio Vargas", "executado pelo próprio Ministério Público"] },
      { document: "mprj-inclusion", page: 1, contains: ["15.358", "XXXIX", "Direito Penal"] },
      { document: "mprj-civil-correction", page: 1, contains: ["por incorreção", "Direito Processual Civil", "17.03.26"] },
    ],
    // Sem gabarito definitivo autônomo: o Edital XXXIX não tem o subitem 11.7.3 do
    // XXXVIII. A finalidade é composta (preliminar + ato de 22/06 que mantém todos
    // os gabaritos); ver docs/ADMISSAO-COMPOSTA-MPRJ-PGEAC-2026-10-12.md.
    previousExam: { cycle: "XXXIX — 2026, preambular já realizada", role: "Promotor de Justiça Substituto — prova preambular", portalUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2026", examDate: "2026-05-31", answerKeyFinality: "preliminary_plus_maintenance_act", documents: [
      { type: "question_booklet", title: "MPRJ XXXIX — caderno Tipo1", url: `${FGV_FILES}promotor-de-justica-substituto-cns001-tipo-1.pdf` },
      { type: "answer_key", title: "MPRJ XXXIX — gabarito oficial preliminar da prova preambular", url: `${FGV_FILES}mprj-promotor-2026-gabaritos-para-publicacao.pdf` },
      { type: "answer_key_decision", title: "MPRJ XXXIX — aviso de 22/06/2026: julgados os recursos, mantidos os gabaritos", url: `${FGV_FILES}22.06-recursos-gabarito-preambular.pdf` },
    ] },
    limitations: ["O programa não está no edital47p: AnexoI é aviso de privacidade.", "Última preambular é XXXIX2026; portal publicou apenas gabarito preliminar, definitivo público não localizado. Não usar XXXVIII2025 como última prova nem aprovar referência incompleta.", "Quatro disciplinas do aviso17/03 foram substituídas em09/04; não usar versão original isolada.", "Treino histórico preambular com legislação atual; não simulado oral, discursivo ou edição futura.", "Não inferir número de alternativas a partir do edital; perfil específico precisa análise própria.", "Lei15.358/2026 e demais normas citadas exigem comparação com texto oficial atual antes de vínculos/questões."],
  },
  {
    productSlug: "pge-ac-procurador-do-estado-reta-final", institution: "Procuradoria-Geral do Estado do Acre", role: "Procurador do Estado — Classe I",
    jurisdiction: "AC", cycle: "VIII — 2026", bankScope: "Fundação Getulio Vargas, sob comissão do VIII Concurso PGE-AC",
    portalUrl: "https://conhecimento.fgv.br/concursos/pgeac", examDate: "2026-05-24", examDateEvidence: { documentKey: "pgeac-notice", page: 14, item: "9.1", quote: "de 24 de maio de 2026, das 8h às 13h", actualDayIndependentlyVerified: false, corroboratingUrl: null, limitation: "Data constante do edital; fase objetiva realizada confirmada por resultado posterior. Dia efetivo não confirmado por anúncio independente nesta conferência." }, stage: "Objetiva com resultado definitivo15/07/2026; resultado preliminar prova escrita subjetiva05/10/2026",
    stageObservedOn: "2026-10-12", proposedMode: "historical_training", expectedSubjects: 10,
    documents: [
      { key: "pgeac-notice", url: `${FGV_FILES}pge-ac-edital-26.02.v.final_.pdf`, title: "Edital PGE-AC publicado26/02/2026", pages: 40, programmePages: [31, 38] },
      { key: "pgeac-correction-1", url: `${FGV_FILES}retificacao-02.03.versao-enviada-15-40.docx_.pdf`, title: "1ª Retificação do Edital PGE-AC", pages: 10, programmePages: [1, 10] },
      { key: "pgeac-correction-2", url: `${FGV_FILES}retificacao-23.03.pdf`, title: "2ª Retificação do Edital PGE-AC", pages: 4, programmePages: [1, 4] },
    ],
    overlays: [
      { key: "pgeac-correction-1", subjects: ["Direito Administrativo", "Direito Ambiental", "Direito Constitucional", "Direito Tributário e Processo Tributário", "Direito Financeiro", "Direito do Trabalho", "Direito Processual do Trabalho", "Direito de Pessoal e Direito Previdenciário Público"] },
      { key: "pgeac-correction-2", subjects: ["Direito Ambiental", "Direito Constitucional", "Direito do Trabalho"] },
    ],
    identityClaims: [
      { document: "pgeac-notice", page: 1, contains: ["VIII", "ESTADO DO ACRE", "10 vagas", "Fundação Getulio Vargas"] },
      { document: "pgeac-notice", page: 2, contains: ["Classe I"] },
      { document: "pgeac-notice", page: 14, contains: ["9.1", "24 de maio de 2026", "Procurador do Estado", "Classe I"] },
      { document: "pgeac-notice", page: 31, contains: ["ANEXO I", "CONTEÚDO PROGRAMÁTICO"] },
      { document: "pgeac-correction-1", page: 1, contains: ["1ª RETIFICAÇÃO", "Conteúdo Programático", "DIREITO ADMINISTRATIVO"] },
      { document: "pgeac-correction-2", page: 1, contains: ["2ª RETIFICAÇÃO", "Conteúdo Programático", "15.190/2025"] },
    ],
    previousExam: { cycle: "VIII — 2026, objetiva já realizada", role: "Procurador do Estado do Acre — Classe I", portalUrl: "https://conhecimento.fgv.br/concursos/pgeac", examDate: "2026-05-24", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PGE-AC VIII — caderno Tipo1", url: `${FGV_FILES}procurador-do-estado-do-acre-cns001-tipo-1.pdf` },
      { type: "answer_key", title: "PGE-AC VIII — gabarito oficial definitivo", url: `${FGV_FILES}gabarito-definitivo-pge-ac.pdf` },
    ] },
    limitations: ["Reta Final é rótulo comercial, não edição oficial.", "Embora portal rotule edital retificado23/03, texto do AnexoI conserva versões anteriores em várias disciplinas; aplicar retificações por disciplina.", "Preambular histórica e legislação atual; não transformar exercícios objetivos em peça processual/parecer.", "Legislação estadual e normas novas ambientais/tributárias precisam fontes atuais próprias; menção em programa não comprova redação vigente."],
  },
  {
    productSlug: "tj-pr-juiz-de-direito-2025-2026", institution: "Tribunal de Justiça do Estado do Paraná", role: "Juiz Substituto",
    jurisdiction: "PR", cycle: "Edital 001/2025 — execução 2025/2026", bankScope: "Poder Judiciário do Paraná, por sua Comissão do Concurso, em conjunto com a FGV; FGV com apoio técnico para elaboração e correção da prova objetiva seletiva",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjpr25", examDate: "2026-02-22", examDateEvidence: { documentKey: "tjpr-notice", page: 33, item: "10.1", quote: "está prevista para o dia 22 de fevereiro de 2026", actualDayIndependentlyVerified: true, corroboratingUrl: `${FGV_FILES}resultado-definitivo-da-prova-objetiva.pdf`, limitation: null },
    stage: "Objetiva com gabarito definitivo em27/03/2026 e resultado definitivo em13/04/2026; prova oral convocada pelo Edital052/2025 de28/10/2026",
    stageObservedOn: "2026-10-29", proposedMode: "historical_training", expectedSubjects: 18,
    documents: [
      { key: "tjpr-notice", url: `${FGV_FILES}tjpr-minuta-edital-de-abertura-cnper-ccicm-fgv-12.12.pdf`, title: "Edital001/2025 TJPR — Juiz Substituto, retificado em12/12/2025", pages: 118, programmePages: [75, 110], layout: {
        headings: [
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO DO CONSUMIDOR", subject: "Direito do Consumidor" }, { line: "DIREITO DA CRIANÇA E DO ADOLESCENTE", subject: "Direito da Criança e do Adolescente" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ELEITORAL", subject: "Direito Eleitoral" },
          { line: "JUIZADOS ESPECIAIS", subject: "Juizados Especiais" },
          { line: "CÓDIGO DE NORMAS DA CORREGEDORIA-GERAL DA JUSTIÇA", subject: "Código de Normas da Corregedoria-Geral da Justiça" },
          { line: "CÓDIGO DE ORGANIZAÇÃO E DIVISÃO JUDICIÁRIAS DO ESTADO DO PARANÁ (LEI", continuation: "ESTADUAL Nº 14.277/2003)", subject: "Código de Organização e Divisão Judiciárias do Estado do Paraná" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" }, { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário" },
          { line: "NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA", subject: "Noções Gerais de Direito e Formação Humanística" },
          { line: "DIREITOS HUMANOS", subject: "Direitos Humanos" },
        ],
        ignoreLines: ["TRIBUNAL DE JUSTIÇA DO ESTADO DO PARANÁ \\| CONCURSO PÚBLICO 2025 \\d+", "ANEXO IV - CONTEÚDO PROGRAMÁTICO", "BLOCO (?:I|II|III)",
          "JUIZADOS ESPECIAIS, CÓDIGO DE NORMAS DA CORREGEDORIA-GERAL DA", "JUSTIÇA E CÓDIGO DE ORGANIZAÇÃO E DIVISÃO JUDICIÁRIAS DO ESTADO DO", "PARANÁ"],
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjpr-notice", page: 1, contains: ["EDITAL Nº 001/2025", "MAGISTRATURA DO ESTADO DO PARANÁ", "Juiz Substituto", "Fundação Getulio Vargas"] },
      { document: "tjpr-notice", page: 33, contains: ["10.1", "22 de fevereiro de 2026", "5 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "tjpr-notice", page: 75, contains: ["ANEXO IV - CONTEÚDO PROGRAMÁTICO", "DIREITO CIVIL"] },
    ],
    previousExam: { cycle: "Edital 001/2025 — objetiva já realizada em22/02/2026", role: "Juiz Substituto — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/concursos/tjpr25", examDate: "2026-02-22", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJPR 001/2025 — caderno Tipo1 da prova objetiva", url: `${FGV_FILES}juiz-substituto-cns001-tipo-1_0.pdf` },
      { type: "answer_key", title: "TJPR 001/2025 — Edital028/2025, gabarito oficial definitivo da prova objetiva", url: `${FGV_FILES}edital-gabarito-definitivo.pdf` },
    ] },
    limitations: ["O nome do arquivo contém 'minuta', mas o cabeçalho diz 'RETIFICADO EM 12/12/2025' e o portal o rotula como edital retificado; as retificações 002/2025 e 003/2025 já constam do texto e não alteram o AnexoIV.", "Treino histórico da objetiva com legislação atual; não simula sentença, oral ou edição futura.", "Código de Normas e Código de Organização Judiciária do Paraná exigem fonte estadual própria antes de vínculos."],
  },
  {
    productSlug: "tj-ba-juiz-de-direito-2026", institution: "Tribunal de Justiça do Estado da Bahia", role: "Juiz Substituto",
    jurisdiction: "BA", cycle: "Edital 01/2026", bankScope: "Fundação Getulio Vargas, responsável pela execução do concurso, sob a Comissão do Concurso do TJBA",
    portalUrl: "https://conhecimento.fgv.br/juiztjba", examDate: "2026-05-24", examDateEvidence: { documentKey: "tjba-notice", page: 21, item: "9.1", quote: "está prevista para o dia 24 de maio de 2026", actualDayIndependentlyVerified: true, corroboratingUrl: `${FGV_FILES}gabarito-definitivo-tjba-juiz-substituto.pdf`, limitation: null },
    stage: "Objetiva com gabarito e resultado definitivos; segunda etapa (provas escritas) convocada em08/07/2026",
    stageObservedOn: "2026-10-29", proposedMode: "historical_training", expectedSubjects: 14,
    documents: [
      { key: "tjba-notice", url: `${FGV_FILES}edital-concurso-juiz-substituto-tjba-retificado-2.pdf`, title: "Edital01/2026 TJBA — Juiz Substituto, retificado em07/04/2026", pages: 76, programmePages: [50, 66], layout: {
        headings: [
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO DO CONSUMIDOR", subject: "Direito do Consumidor" }, { line: "DIREITO DA CRIANÇA E DO ADOLESCENTE", subject: "Direito da Criança e do Adolescente" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ELEITORAL", subject: "Direito Eleitoral" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" }, { line: "DIREITO FINANCEIRO E TRIBUTÁRIO", subject: "Direito Financeiro e Tributário" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA", subject: "Noções Gerais de Direito e Formação Humanística" },
          { line: "DIREITOS HUMANOS", subject: "Direitos Humanos" },
        ],
        ignoreLines: ["TRIBUNAL DE JUSTIÇA DO ESTADO DA BAHIA \\| CONCURSO PÚBLICO JUIZ SUBSTITUTO \\d+", "ANEXO I - CONTEÚDO PROGRAMÁTICO", "CARGO: JUIZ SUBSTITUTO", "BLOCO (?:I|II|III)",
          "EDITAL Nº 01/2026 – ABERTURA DE", "CONCURSO PÚBLICO PARA", "PROVIMENTO DE CARGO DE", "JUIZ SUBSTITUTO"],
        splitInlineItems: true,
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjba-notice", page: 1, contains: ["EDITAL Nº 01/2026", "JUIZ SUBSTITUTO", "TRIBUNAL DE JUSTIÇA DO ESTADO DA BAHIA", "100 (cem) vagas"] },
      { document: "tjba-notice", page: 1, contains: ["1.1 O Concurso será executado sob a responsabilidade da Fundação Getúlio Vargas"] },
      { document: "tjba-notice", page: 21, contains: ["24 de maio de 2026", "05 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "tjba-notice", page: 50, contains: ["ANEXO I - CONTEÚDO PROGRAMÁTICO", "DIREITO CIVIL"] },
    ],
    previousExam: { cycle: "Edital 01/2026 — objetiva já realizada em24/05/2026", role: "Juiz Substituto — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/juiztjba", examDate: "2026-05-24", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJBA 01/2026 — caderno Tipo1 da prova objetiva", url: `${FGV_FILES}tjba-2026-juiz-substituto-tipo-1.pdf` },
      { type: "answer_key", title: "TJBA 01/2026 — gabarito oficial definitivo da prova objetiva", url: `${FGV_FILES}gabarito-definitivo-tjba-juiz-substituto.pdf` },
    ] },
    limitations: ["As retificações citam 'Edital de Abertura nº 05/2025' para o edital publicado como01/2026; a 2ª retificação exclui o processo administrativo disciplinar da LCE491/2010, já ausente do texto consolidado usado.", "Não confundir com Juiz Leigo.", "Treino histórico da objetiva com legislação atual; não simula provas escritas, sentença ou oral.", "Legislação estadual da Bahia exige fonte oficial própria antes de vínculos."],
  },
  {
    productSlug: "tj-pe-juiz-de-direito-2026", institution: "Tribunal de Justiça do Estado de Pernambuco", role: "Juiz Substituto",
    jurisdiction: "PE", cycle: "Edital 01/2026", bankScope: "Fundação Getulio Vargas, responsável pela execução do concurso, sob a Comissão do Concurso do TJPE",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjpe26", examDate: "2026-09-27", examDateEvidence: { documentKey: "tjpe-notice", page: 23, item: "10.1", quote: "está prevista para o dia 27 de setembro de 2026", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}tjpe-juiz-comunicado.pdf`, limitation: "Comunicado de21/09 confirma a aplicação em27/09 e o portal publicou gabarito preliminar em29/09; gabarito definitivo ainda não publicado nesta conferência." },
    stage: "Objetiva aplicada, gabarito preliminar em29/09/2026 e recursos encerrados; gabarito definitivo pendente",
    stageObservedOn: "2026-10-29", proposedMode: "historical_training", expectedSubjects: 14,
    documents: [
      { key: "tjpe-notice", url: `${FGV_FILES}tjpe_edital-31.07.2026-retificado.pdf`, title: "Edital01/2026 TJPE — Juiz Substituto, retificado em31/07/2026", pages: 72, programmePages: [52, 68], layout: {
        headings: [
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO DO CONSUMIDOR", subject: "Direito do Consumidor" }, { line: "DIREITO DA CRIANÇA E DO ADOLESCENTE", subject: "Direito da Criança e do Adolescente" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ELEITORAL", subject: "Direito Eleitoral" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" }, { line: "DIREITO FINANCEIRO E TRIBUTÁRIO", subject: "Direito Financeiro e Tributário" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA", subject: "Noções Gerais de Direito e Formação Humanística" },
          { line: "DIREITOS HUMANOS", subject: "Direitos Humanos" },
        ],
        ignoreLines: ["TRIBUNAL DE JUSTIÇA DO ESTADO DE PERNAMBUCO \\| CONCURSO PÚBLICO 2026 \\d+", "ANEXO I – CONTEÚDO PROGRAMÁTICO", "CARGO: JUIZ SUBSTITUTO", "BLOCO (?:I|II|III)"],
        splitInlineItems: true,
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjpe-notice", page: 1, contains: ["EDITAL Nº 01/2026", "JUIZ SUBSTITUTO", "Tribunal de Justiça do Estado de Pernambuco", "RETIFICADO EM 31 DE JULHO 2026", "Fundação Getulio Vargas"] },
      { document: "tjpe-notice", page: 23, contains: ["10.1", "27 de setembro de 2026", "5 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "tjpe-notice", page: 52, contains: ["ANEXO I – CONTEÚDO PROGRAMÁTICO", "DIREITO CIVIL"] },
    ],
    // Sem gabarito definitivo publicado: a referência fica incompleta e bloqueada.
    previousExam: { cycle: "Edital 01/2026 — objetiva aplicada em27/09/2026", role: "Juiz Substituto — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/concursos/tjpe26", examDate: "2026-09-27", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJPE 01/2026 — caderno Tipo1 da prova objetiva", url: `${FGV_FILES}tjpe-jsub-t1.pdf` },
    ] },
    limitations: ["Gabarito definitivo ainda não publicado; não aprovar referência de prova anterior nem liberar venda antes dele.", "A 1ª retificação altera idade, prazo de recurso e títulos, sem mudar o AnexoI.", "Treino histórico da objetiva com legislação atual; não simula fases seguintes.", "Legislação estadual de Pernambuco exige fonte oficial própria antes de vínculos."],
  },
  {
    productSlug: "mpe-go-promotor-de-justica-2025", institution: "Ministério Público do Estado de Goiás", role: "Promotora e Promotor de Justiça Substituto",
    jurisdiction: "GO", cycle: "63º Concurso — Edital 182/2025-CSMP", bankScope: "FGV: inscrições provisórias e prova preambular; MPGO: fases subsequentes",
    portalUrl: "https://conhecimento.fgv.br/concursos/mpgo25", examDate: "2026-02-01", examDateEvidence: { documentKey: "mpgo-notice", page: 3, item: "1.13", quote: "O concurso realizar-se-á segundo cronograma provisório a ser publicado pela", actualDayIndependentlyVerified: true, corroboratingUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/comissaodeconcurso_comunicado-n-09.pdf", limitation: "O edital remete ao cronograma; a aplicação em01/02/2026 consta dos Comunicados08 e09 da Comissão de Concurso." },
    stage: "Preambular aplicada em01/02/2026, gabarito definitivo (Comunicado09) e resultado (Comunicado10); demais fases a definir",
    stageObservedOn: "2026-10-29", proposedMode: "historical_training", expectedSubjects: 10,
    documents: [
      { key: "mpgo-notice", url: `${FGV_FILES}edital-retificado-publicado.pdf`, title: "Edital182/2025-CSMP MPGO — 63º Concurso, retificado em26/09/2025", pages: 69, programmePages: [49, 63], layout: {
        headings: [
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "LEGISLAÇÃO PENAL E PROCESSUAL PENAL ESPECIAL", subject: "Legislação Penal e Processual Penal Especial" },
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "TUTELA DOS INTERESSES DIFUSOS, COLETIVOS E INDIVIDUAIS HOMOGÊNEOS", subject: "Tutela dos Interesses Difusos, Coletivos e Individuais Homogêneos" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "DIREITO ELEITORAL", subject: "Direito Eleitoral" }, { line: "LEGISLAÇÃO DO MINISTÉRIO PÚBLICO", subject: "Legislação do Ministério Público" },
        ],
        ignoreLines: ["Página \\d+ de 69", "GRUPO (?:I|II|III)", "Publicado na edição n\\. 4013 do Diário Oficial do Ministério Público de 26/09/2025\\.",
          "Movimento 3 - Edital 2025010331885 - Assinado eletronicamente por .+", "Autos 202500547987 - Csmp/procurador-geral\\. Documento gerado por .+"],
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "mpgo-notice", page: 1, contains: ["63º CONCURSO", "MINISTÉRIO PÚBLICO DO ESTADO DE GOIÁS", "EDITAL N. 182/2025-CSMP", "Fundação Getulio Vargas"] },
      { document: "mpgo-notice", page: 31, contains: ["5 (cinco) alternativas, com somente uma opção correta"] },
      { document: "mpgo-notice", page: 49, contains: ["PROGRAMA/CONTEÚDO POR GRUPO DE DISCIPLINAS", "DIREITO PENAL"] },
    ],
    previousExam: { cycle: "63º Concurso — preambular já realizada em01/02/2026", role: "Promotora e Promotor de Justiça Substituto — prova preambular", portalUrl: "https://conhecimento.fgv.br/concursos/mpgo25", examDate: "2026-02-01", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "MPGO 63º — caderno Tipo1 da prova preambular", url: `${FGV_FILES}promotor-de-justica-substituto-cns100-tipo-1_0.pdf` },
      { type: "answer_key", title: "MPGO 63º — Comunicado09, gabarito oficial definitivo da prova preambular", url: `${FGV_FILES}comissaodeconcurso_comunicado-n-09.pdf` },
    ] },
    repeatableRequirements: ["17. Súmulas, jurisprudência dos Tribunais Superiores e legislação relacionada com os temas."],
    limitations: ["A p.1 cita aprovação na 14ª Sessão Ordinária 'realizada no dia 15 de outubro de 2025', posterior à assinatura (22/09/2025) e à publicação (DOMP4013, 26/09/2025); nenhum ato oficial explica a divergência. A data da sessão não é usada; identidade, banca e programa não dependem dela.", "O edital não liga literalmente cada grupo do programa às disciplinas do item12.1; o vínculo por disciplina é do programa, não da distribuição de questões.", "Preambular histórica com legislação atual; não simula fases subjetivas.", "Legislação estadual de Goiás (LCE25/1998 e outras) exige fonte oficial própria antes de vínculos."],
  },
];

function normalized(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim(); }
export type ProgrammeSection = Readonly<{ subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: readonly Readonly<{ page: number; text: string }>[] }>;

function extractLayoutSections(recipe: PreviewDocumentRecipe, layout: ProgrammeLayout, capture: Pick<CapturedOfficialDocument, "documentUrl" | "checksumSha256" | "pageTexts">): readonly ProgrammeSection[] {
  const ignore = layout.ignoreLines.map((source) => new RegExp(`^(?:${source})$`, "u"));
  const headings = layout.headings.map((heading) => ({ ...heading, key: normalized(heading.line) }));
  if (new Set(headings.map((heading) => heading.key)).size !== headings.length) throw new Error("Títulos de disciplina repetidos no layout.");
  const sections: { subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: { page: number; text: string }[] }[] = [];
  let current: (typeof sections)[number] | null = null;
  let expectedContinuation: string | null = null;
  const [start, end] = recipe.programmePages!;
  for (let index = start - 1; index < end; index += 1) {
    for (const raw of capture.pageTexts[index].split(/\n+/u)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      if (expectedContinuation !== null) {
        if (normalized(line) !== expectedContinuation) throw new Error("Continuação do título de disciplina diverge do layout.");
        expectedContinuation = null;
        continue;
      }
      if (ignore.some((pattern) => pattern.test(line))) continue;
      const heading = headings.find((item) => item.key === normalized(line));
      if (heading) {
        if (sections.length !== headings.indexOf(heading)) throw new Error("Título de disciplina fora da ordem do layout.");
        current = { subject: heading.subject, documentKey: recipe.key, checksumSha256: capture.checksumSha256, sourceUrl: capture.documentUrl, fragments: [] };
        sections.push(current);
        expectedContinuation = heading.continuation ? normalized(heading.continuation) : null;
        continue;
      }
      if (!current) continue;
      const parts = layout.splitInlineItems ? line.split(/\s+(?=\d{1,2}\.(?:\s+[A-ZÀ-Ö]|$))/u) : [line];
      for (const part of parts) {
        // Número de item isolado no fim da linha ("3.") abre o item da linha seguinte.
        const last = current.fragments.at(-1);
        if (layout.splitInlineItems && last && /^\d{1,2}\.$/u.test(last.text)) last.text = `${last.text} ${part}`;
        else current.fragments.push({ page: index + 1, text: part });
      }
    }
  }
  if (sections.length !== headings.length) throw new Error("Título de disciplina ausente no anexo; composição bloqueada.");
  if (sections.some((section) => !section.fragments.length)) throw new Error("Disciplina sem conteúdo; composição bloqueada.");
  return sections;
}

export function extractDossierSubjectSections(recipe: PreviewDocumentRecipe, capture: Pick<CapturedOfficialDocument, "documentUrl" | "checksumSha256" | "pageTexts">): readonly ProgrammeSection[] {
  if (!recipe.programmePages) return [];
  if (recipe.layout) return extractLayoutSections(recipe, recipe.layout, capture);
  const sections: { subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: { page: number; text: string }[] }[] = [];
  let current: (typeof sections)[number] | null = null;
  const [start, end] = recipe.programmePages;
  for (let index = start - 1; index < end; index += 1) {
    for (const raw of capture.pageTexts[index].split(/\n+/u)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line || /^(?:MINISTÉRIO PÚBLICO|PROCURADORIA GERAL DO ESTADO DO ACRE \d+$)/u.test(line)) continue;
      if (/^Rio Branco, \d+ de .+ de \d{4}\.$/u.test(line)) { current = null; continue; }
      if (/^\d\s*[–-]\s*Banca /u.test(line)) { current = null; continue; }
      const mprj = /^\d\.\d\s*[–-]\s*(.+)$/u.exec(line);
      const pge = /^(DIREITO [A-ZÀ-ÖØ-Þ ]+)(?:\s+-\s+(.*))?$/u.exec(line);
      if (mprj || pge) {
        const subject = (mprj?.[1] ?? pge![1]).trim();
        current = { subject, documentKey: recipe.key, checksumSha256: capture.checksumSha256, sourceUrl: capture.documentUrl, fragments: [] };
        sections.push(current);
        if (pge?.[2]) current.fragments.push({ page: index + 1, text: pge[2] });
        continue;
      }
      if (current) current.fragments.push({ page: index + 1, text: line });
    }
  }
  if (sections.some((section) => !section.fragments.length)) throw new Error("Disciplina sem conteúdo; composição bloqueada.");
  return sections;
}

export function composeDossierProgramme(base: readonly ProgrammeSection[], overlays: readonly Readonly<{ sections: readonly ProgrammeSection[]; expectedSubjects: readonly string[] }>[]) {
  const selected = new Map(base.map((section) => [normalized(section.subject), section]));
  if (selected.size !== base.length) throw new Error("Disciplinas duplicadas no programa base.");
  const superseded: { subject: string; from: string; to: string }[] = [];
  for (const overlay of overlays) {
    const expected = new Set(overlay.expectedSubjects.map(normalized));
    if (overlay.sections.length !== expected.size || overlay.sections.some((section) => !expected.has(normalized(section.subject)))) throw new Error("Retificação contém disciplinas inesperadas ou ausentes.");
    for (const section of overlay.sections) {
      const key = normalized(section.subject);
      const prior = selected.get(key);
      if (!prior) throw new Error("Retificação sem disciplina correspondente no programa base.");
      superseded.push({ subject: section.subject, from: prior.documentKey, to: section.documentKey });
      selected.set(key, section);
    }
  }
  return { sections: [...selected.values()], superseded };
}

export function buildNextOfficialCoursePreview(recipe: NextOfficialCourseRecipe, captures: ReadonlyMap<string, CapturedOfficialDocument>, observedAt: string, previousMetadata: readonly Record<string, unknown>[]) {
  for (const doc of recipe.documents) {
    const capture = captures.get(doc.key);
    if (!capture || capture.documentUrl !== doc.url || capture.pageCount !== doc.pages || capture.pageTexts.length !== doc.pages || createHash("sha256").update(capture.documentBytes).digest("hex") !== capture.checksumSha256) throw new Error(`Captura alterada ou ausente: ${doc.key}.`);
  }
  for (const claim of recipe.identityClaims) {
    const page = normalized(captures.get(claim.document)!.pageTexts[claim.page - 1]);
    if (!claim.contains.every((token) => page.includes(normalized(token)))) throw new Error(`Identidade diverge: ${claim.document}, p.${claim.page}.`);
  }
  const programDocs = recipe.documents.filter((doc) => doc.programmePages);
  const base = extractDossierSubjectSections(programDocs[0], captures.get(programDocs[0].key)!);
  const programme = composeDossierProgramme(base, recipe.overlays.map((overlay) => ({ sections: extractDossierSubjectSections(recipe.documents.find((doc) => doc.key === overlay.key)!, captures.get(overlay.key)!), expectedSubjects: overlay.subjects })));
  if (programme.sections.length !== recipe.expectedSubjects) throw new Error("Programa incompleto; número de disciplinas diverge.");
  return {
    schemaVersion: 1, mode: "preview", productSlug: recipe.productSlug, observedAt,
    identity: { institution: recipe.institution, role: recipe.role, jurisdiction: recipe.jurisdiction, cycle: recipe.cycle, examDate: recipe.examDate, examDateEvidence: recipe.examDateEvidence, bankScope: recipe.bankScope },
    officialPortal: recipe.portalUrl, status: { description: recipe.stage, observedOn: recipe.stageObservedOn, officialPortalLabel: "Em Andamento", objectiveStageAlreadyHeld: true },
    proposedPreparationMode: recipe.proposedMode, proposedScope: "objective_training_current_legislation", legislationUpdatedAndMapped: false,
    captures: recipe.documents.map((doc) => { const capture = captures.get(doc.key)!; return { key: doc.key, sourceUrl: capture.documentUrl, checksumSha256: capture.checksumSha256, pageCount: capture.pageCount, byteLength: capture.byteLength, programmePages: doc.programmePages }; }),
    programme: { ...programme, checksumSha256: createHash("sha256").update(JSON.stringify(programme.sections)).digest("hex"), extraction: "verbatim_source_fragments_per_subject_with_exact_overlay" },
    previousExam: { ...recipe.previousExam, distributionMode: "external_link", sourceContentStored: false, metadata: previousMetadata, approvedForProduct: false, admissionBlocker: previousExamAdmissionBlocker(recipe.previousExam), thirdPartyQuestionsImported: 0 },
    review: { proposedApprovalBasis: "owner_standing_authorization", approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE, humanReview: false, applied: false },
    limitations: recipe.limitations, databaseWrites: 0, admissionApplied: false, applySupported: false, questionsGenerated: 0, productsReleased: 0, publicationAllowed: false,
  };
}
