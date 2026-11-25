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
  headings: readonly Readonly<{ line: string; subject: string; continuation?: string;
    /** Título no início do parágrafo ("DIREITO CIVIL. Lei de…"): abre a seção e o restante da linha é conteúdo. */
    inline?: boolean;
    /** Pontuação literal entre o título inline e o conteúdo; "." por padrão ("1. DIREITO PENAL: 1.1 …" usa ":"). */
    inlineSeparator?: ":" }>[];
  ignoreLines: readonly string[];
  /** Carimbo fixo colado ao texto pelo visualizador oficial ("SEM VALOR OFICIAL" no DOM de Manaus): sai de cada linha antes da extração. */
  removeLiterals?: readonly string[];
  /** Programa em prosa corrida ("1. … 2. …" na mesma linha): cada item numerado vira um fragmento. */
  splitInlineItems?: boolean;
  /** Linha literal que abre o cargo seguinte no mesmo anexo; a extração termina nela e ela é obrigatória. */
  stopLine?: string;
  /** Linhas literais que começam com número mas continuam o item anterior ("182 e Recomendação 190, …", Convenção da OIT). */
  continuationLines?: readonly string[];
  /** Linha literal que abre o cargo no anexo ("CARGO 9: …"); antes dela nada é lido e ela é obrigatória. */
  startLine?: string;
  /** "top-level-numbers": "1 Tema. 1.1 Sub. 2 Tema." agrupa subitens no item de primeiro nível.
   * "sentences": programa em prosa sem numeração; cada período literal é um requisito. */
  itemMode?: "top-level-numbers" | "second-level-numbers" | "sentences";
}>;
export type PreviewDocumentRecipe = Readonly<{ key: string; url: string; title: string; pages: number; programmePages: readonly [number, number] | null; layout?: ProgrammeLayout;
  /** PDF que a origem recusa ao servidor (WAF): entra só pelo arquivo baixado da URL oficial, com este SHA-256. */
  operatorDownloadSha256?: string }>;
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
  /** Programa em períodos curtos repete literais ("Lei nº 6.015/1973."): guarda só a primeira ocorrência. */
  skipRepeatedRequirements?: boolean;
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
    previousExam: { cycle: "Edital 01/2026 — objetiva aplicada em27/09/2026", role: "Juiz Substituto — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/concursos/tjpe26", examDate: "2026-09-27", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJPE 01/2026 — caderno Tipo1 da prova objetiva", url: `${FGV_FILES}tjpe-jsub-t1.pdf` },
      { type: "answer_key", title: "TJPE 01/2026 — gabarito oficial definitivo (11/11/2026)", url: `${FGV_FILES}gabaritodefinitivo.pdf` },
    ] },
    limitations: ["Gabarito definitivo publicado pelo portal em 11/11/2026 (conferido em 18/11/2026).", "A 1ª retificação altera idade, prazo de recurso e títulos, sem mudar o AnexoI.", "Treino histórico da objetiva com legislação atual; não simula fases seguintes.", "Legislação estadual de Pernambuco exige fonte oficial própria antes de vínculos."],
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
  // Lote 2 FGV histórico (13/11/2026): magistratura estadual TJGO e federal TRF-2.
  {
    productSlug: "tj-go-juiz-de-direito-2026", institution: "Tribunal de Justiça do Estado de Goiás", role: "Juiz Substituto",
    jurisdiction: "GO", cycle: "59º Concurso — Edital 01/2025", bankScope: "Fundação Getulio Vargas, responsável pela execução do concurso, sob a Comissão de Seleção e Treinamento do TJGO",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjgo2025", examDate: "2026-03-29", examDateEvidence: { documentKey: "tjgo-notice", page: 19, item: "12.1", quote: "está prevista para o dia 29 de março de 2026", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}juiz-substituto-j-sub-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou o caderno Tipo1 em31/03/2026 e o gabarito definitivo em28/04/2026, compatíveis com a data prevista." },
    stage: "Objetiva com gabarito definitivo (28/04/2026) e resultado definitivo (13/05/2026); resultado definitivo da prova prática em28/10/2026",
    stageObservedOn: "2026-11-13", proposedMode: "historical_training", expectedSubjects: 14,
    documents: [
      { key: "tjgo-notice", url: `${FGV_FILES}59_juiz_edital_abertura_consolidado_13-01-2026.pdf`, title: "Edital01/2025 TJGO — 59º Concurso de Juiz Substituto, consolidado em13/01/2026", pages: 62, programmePages: [43, 58], layout: {
        headings: [
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO DO CONSUMIDOR", subject: "Direito do Consumidor" }, { line: "DIREITO DA CRIANÇA E DO ADOLESCENTE", subject: "Direito da Criança e do Adolescente" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ELEITORAL", subject: "Direito Eleitoral" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" }, { line: "DIREITO TRIBUTÁRIO E FINANCEIRO", subject: "Direito Tributário e Financeiro" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA", subject: "Noções Gerais de Direito e Formação Humanística" },
          { line: "DIREITOS HUMANOS", subject: "Direitos Humanos" },
        ],
        ignoreLines: ["\\d+TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS", "ANEXO II – CONTEÚDO PROGRAMÁTICO", "CARGO: JUIZ SUBSTITUTO", "BLOCO (?:I|II|III)"],
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjgo-notice", page: 1, contains: ["EDITAL Nº 01/2025 de ABERTURA", "59º CONCURSO DE JUIZ SUBSTITUTO DO ESTADO DE GOIÁS", "CONSOLIDADO EM 13 DE JANEIRO DE 2026", "Fundação Getulio Vargas"] },
      { document: "tjgo-notice", page: 19, contains: ["12.1", "29 de março de 2026", "100 (cem) questões de múltipla escolha", "05 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "tjgo-notice", page: 43, contains: ["ANEXO II – CONTEÚDO PROGRAMÁTICO", "CARGO: JUIZ SUBSTITUTO", "DIREITO CIVIL"] },
    ],
    previousExam: { cycle: "59º Concurso — objetiva já realizada em29/03/2026", role: "Juiz Substituto — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/concursos/tjgo2025", examDate: "2026-03-29", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJGO 59º — caderno Tipo1 da prova objetiva seletiva", url: `${FGV_FILES}juiz-substituto-j-sub-tipo-1.pdf` },
      { type: "answer_key", title: "TJGO 59º — gabarito oficial definitivo da prova objetiva seletiva", url: `${FGV_FILES}tjgo-juiz-substituto-gabarito-definitivo.pdf` },
    ] },
    limitations: ["A 1ª retificação (Edital02/2026) altera só o item6.3.2 (laudo de pessoa com deficiência) e não muda o AnexoII; o edital consolidado já a incorpora.", "O produto se chama 'Juiz de Direito', mas o cargo oficial é Juiz Substituto.", "Treino histórico da objetiva com legislação atual; não simula discursiva, sentença ou oral.", "Organização judiciária, custas e regimentos de Goiás exigem fonte estadual própria antes de vínculos."],
  },
  {
    productSlug: "trf-2-juiz-federal-2-regiao", institution: "Tribunal Regional Federal da 2ª Região", role: "Juiz Federal Substituto",
    jurisdiction: "RJ", cycle: "XIX Concurso — Edital TRF2 154/2025", bankScope: "Fundação Getulio Vargas na primeira etapa (prova objetiva seletiva); Comissão Organizadora e Examinadora do TRF-2 nas demais",
    portalUrl: "https://conhecimento.fgv.br/concursos/trf2juiz", examDate: "2026-04-12", examDateEvidence: { documentKey: "trf2-notice", page: 18, item: "12.1", quote: "12 de abril de 2026, das 13h às 18h", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}juiz-federal-substituto-da-2a-regiao-cns100-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou o caderno Tipo1 em13/04/2026 e o gabarito definitivo retificado em06/05/2026, compatíveis com a data prevista." },
    stage: "Objetiva com gabarito definitivo retificado (06/05/2026) e resultado definitivo (20/05/2026); provas escritas e oral conduzidas pela comissão do TRF-2",
    stageObservedOn: "2026-11-13", proposedMode: "historical_training", expectedSubjects: 15,
    documents: [
      { key: "trf2-notice", url: `${FGV_FILES}sei_1438979_edital_154_retificado.pdf`, title: "Edital TRF2154/2025 — XIX Concurso de Juiz Federal Substituto, retificado em17/12/2025 pelo Edital157/2025", pages: 58, programmePages: [30, 56], layout: {
        headings: [
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário" },
          { line: "DIREITO FINANCEIRO", subject: "Direito Financeiro" }, { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental" },
          { line: "DIREITO INTERNACIONAL PÚBLICO E INTERNACIONAL PRIVADO", subject: "Direito Internacional Público e Privado" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" },
          { line: "DIREITO ECONÔMICO E DE PROTEÇÃO AO CONSUMIDOR", subject: "Direito Econômico e de Proteção ao Consumidor" },
          { line: "NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA", subject: "Noções Gerais de Direito e Formação Humanística" },
          { line: "DIREITOS HUMANOS", subject: "Direitos Humanos" },
        ],
        // O título conjunto "DIREITO FINANCEIRO E TRIBUTÁRIO" só agrupa as duas disciplinas seguintes;
        // os subtítulos A)–H) da formação humanística e as notas de inclusão por resolução não são requisitos.
        ignoreLines: ["Edital 154 \\(1438979\\) SEI 0026204-71\\.2025\\.4\\.02\\.8000 / pg\\. \\d+", "ANEXO I - CONTEÚDO PROGRAMÁTICO", "ANEXO - CONTEÚDO PROGRAMÁTICO",
          "CARGO: JUIZ SUBSTITUTO", "DIREITO FINANCEIRO E TRIBUTÁRIO", "[A-H]\\) [A-ZÀ-Ü ,]+(?: \\(incluído pela Resolução n\\. 423, de 5\\.10\\.2021\\)\\.)?",
          "\\(incluído pela Resolução n\\. 423, de 5\\.10\\.2021\\)\\.", "\\(Resolução n\\. 496, de 3\\.4\\.2023\\)"],
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "trf2-notice", page: 1, contains: ["EDITAL TRF2 Nº 154/2025", "RETIFICADO EM 17 DE DEZEMBRO DE 2025 PELO EDITAL TRF2 Nº 157/2025", "XIX Concurso público de provas e títulos", "Juiz Federal Substituto da 2ª Região", "Fundação Getulio Vargas"] },
      { document: "trf2-notice", page: 17, contains: ["12.1 A Prova Objetiva Seletiva"] },
      { document: "trf2-notice", page: 18, contains: ["12 de abril de 2026", "100 (cem) questões de múltipla escolha", "05 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "trf2-notice", page: 30, contains: ["ANEXO I - CONTEÚDO PROGRAMÁTICO", "DIREITO CONSTITUCIONAL"] },
    ],
    previousExam: { cycle: "XIX Concurso — objetiva já realizada em12/04/2026", role: "Juiz Federal Substituto — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/concursos/trf2juiz", examDate: "2026-04-12", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TRF-2 XIX — caderno Tipo1 da prova objetiva seletiva", url: `${FGV_FILES}juiz-federal-substituto-da-2a-regiao-cns100-tipo-1.pdf` },
      { type: "answer_key", title: "TRF-2 XIX — gabarito oficial definitivo da prova objetiva seletiva (retificado em06/05/2026)", url: `${FGV_FILES}gabarito-definitivo-trf2-juiz-substituto-v2.pdf` },
    ] },
    limitations: ["A 1ª retificação (Edital157/2025) altera datas da segunda à quarta etapa e o número de questões discursivas; o edital publicado como retificado já a incorpora e o AnexoI não muda.", "Os subtítulos A)–H) de Noções Gerais (Sociologia, Psicologia, Ética, Filosofia, Teoria Geral, Direito Digital, Pragmatismo/AED e Antidiscriminação) não viram requisitos próprios; os itens numerados de cada um ficam sob a mesma disciplina.", "Competência regional (RJ e ES): a jurisdição registrada é RJ, sede do tribunal, com escopo regional.", "Treino histórico da objetiva com legislação atual; não simula provas escritas, sentença ou oral."],
  },
  // Lote 2 FGV histórico (13/11/2026): servidores de tribunal, programas em prosa por cargo.
  {
    productSlug: "tj-ms-analista-judiciario-area-fim-reta-final", institution: "Tribunal de Justiça do Estado de Mato Grosso do Sul", role: "Analista Judiciário - Área Fim",
    jurisdiction: "MS", cycle: "XI Concurso — Edital 01/2025", bankScope: "Fundação Getulio Vargas, responsável pela execução do concurso, sob o TJMS",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjms25", examDate: "2026-01-25", examDateEvidence: { documentKey: "tjms-notice", page: 20, item: "10.1", quote: "no dia 25 de janeiro de 2026, das 13h às 16h30", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}analista-judiciario-area-fim-cns101-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou o caderno Tipo1 em27/01/2026 e o gabarito definitivo em03/03/2026, compatíveis com a data do edital." },
    stage: "Objetiva com gabarito definitivo (03/03/2026); resultado final de aprovados publicado em07/05/2026 e retificado em23/06/2026",
    stageObservedOn: "2026-11-13", proposedMode: "historical_training", expectedSubjects: 8,
    documents: [
      { key: "tjms-notice", url: `${FGV_FILES}edital-com-2a-retificacao-tjms-servidores-1_0.pdf`, title: "Edital01/2025 TJMS — XI Concurso de servidores, retificado em03/12/2025", pages: 41, programmePages: [31, 36], layout: {
        // Os títulos do anexo trazem um marcador gráfico (U+F034) colado ao texto, preservado literalmente.
        headings: [
          { line: "LíNGUA PORTUGUESA", subject: "Língua Portuguesa" }, { line: "NOÇÕES DE LEGISLAÇÃO", subject: "Noções de Legislação" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" }, { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
        ],
        ignoreLines: ["\\d+TRIBUNAL DE JUSTIÇA DO ESTADO DE MATO GROSSO DO SUL \\| CONCURSO PÚBLICO 2025", "ANEXO I – CONTEÚDO PROGRAMÁTICO", "NÍVEL SUPERIOR",
          "CONHECIMENTOS BÁSICOS", "CONHECIMENTOS ESPECÍFICOS", "ANALISTA JUDICIÁRIO – ÁREA FIM \\(BACHAREL EM DIREITO\\)"],
        stopLine: "TÉCNICO DE NÍVEL SUPERIOR – ENFERMEIRO",
        itemMode: "sentences",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjms-notice", page: 1, contains: ["RETIFICADO EM 03 DE DEZEMBRO DE 2025", "EDITAL Nº 01/2025", "XI CONCURSO PÚBLICO", "Analista Judiciário - Área Fim", "Fundação Getulio Vargas"] },
      { document: "tjms-notice", page: 20, contains: ["25 de janeiro de 2026", "60 (sessenta) questões de múltipla escolha", "05 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "tjms-notice", page: 32, contains: ["ANALISTA JUDICIÁRIO – ÁREA FIM (BACHAREL EM DIREITO)", "DIREITO CONSTITUCIONAL"] },
    ],
    previousExam: { cycle: "XI Concurso — objetiva já realizada em25/01/2026", role: "Analista Judiciário - Área Fim — prova objetiva", portalUrl: "https://conhecimento.fgv.br/concursos/tjms25", examDate: "2026-01-25", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJMS XI — caderno Tipo1 da prova objetiva de Analista Judiciário - Área Fim", url: `${FGV_FILES}analista-judiciario-area-fim-cns101-tipo-1.pdf` },
      { type: "answer_key", title: "TJMS XI — gabarito oficial definitivo da prova objetiva (Analista e Técnico)", url: `${FGV_FILES}tjms-analista-e-tecnico.pdf` },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["O programa do cargo é prosa sem numeração: cada período literal vira um requisito e a repetição literal guarda só a primeira ocorrência.", "Só o cargo Analista Judiciário - Área Fim; o Técnico de Nível Superior - Enfermeiro do mesmo edital fica fora.", "As 1ª e 2ª retificações já constam do edital consolidado em03/12/2025.", "Treino histórico da objetiva com legislação atual; a legislação estadual de MS exige fonte oficial própria antes de vínculos."],
  },
  {
    productSlug: "tj-rj-analista-e-tecnico-2025", institution: "Tribunal de Justiça do Estado do Rio de Janeiro", role: "Analista Judiciário – Sem Especialidade",
    jurisdiction: "RJ", cycle: "LXII Concurso — Edital 01/2025", bankScope: "Fundação Getulio Vargas, responsável pela execução do concurso, sob o TJRJ",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjrjservidores25/01", examDate: "2026-02-01", examDateEvidence: { documentKey: "tjrj-notice", page: 21, item: "11.1", quote: "serão realizadas no dia 01 de fevereiro de 2026", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}analista-judiciario-sem-especialidade-ns-a01-se-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou o caderno Tipo1 em04/02/2026 e o gabarito definitivo em11/03/2026, compatíveis com a data do edital." },
    stage: "Objetiva com gabarito definitivo (11/03/2026); resultado definitivo da discursiva em25/05/2026, retificado em10/06/2026",
    stageObservedOn: "2026-11-13", proposedMode: "historical_training", expectedSubjects: 11,
    documents: [
      { key: "tjrj-notice", url: `${FGV_FILES}edital-de-abertura-retificado-05-tjrj-analista-judiciario-06.03.26.pdf`, title: "Edital01/2025 TJRJ — LXII Concurso de Analista Judiciário, retificado (5ª retificação) em11/03/2026", pages: 83, programmePages: [34, 39], layout: {
        headings: [
          { line: "LÍNGUA PORTUGUESA", subject: "Língua Portuguesa" }, { line: "LEGISLAÇÃO ESPECIAL", subject: "Legislação Especial" },
          { line: "NOÇÕES DOS DIREITOS DAS PESSOAS COM DEFICIÊNCIA", subject: "Noções dos Direitos das Pessoas com Deficiência" },
          { line: "ÉTICA NO SERVIÇO PÚBLICO", subject: "Ética no Serviço Público" },
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" }, { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" },
          { line: "DIREITO CIVIL", subject: "Direito Civil" }, { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO PENAL", subject: "Direito Penal" }, { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal" },
          { line: "LEGISLAÇÃO", subject: "Legislação" },
        ],
        ignoreLines: ["TRIBUNAL DE JUSTIÇA DO ESTADO DO RIO DE JANEIRO \\| CONCURSO PÚBLICO 2025 \\d+", "ANEXO I – CONTEÚDO PROGRAMÁTICO", "ANALISTA JUDICIÁRIO – SEM E COM ESPECIALIDADE",
          "CONHECIMENTOS GERAIS", "CONHECIMENTOS ESPECÍFICOS", "CARGO: ANALISTA JUDICIÁRIO – GRUPO: NÍVEL SUPERIOR – SEM", "ESPECIALIDADE"],
        stopLine: "CARGO: ANALISTA JUDICIÁRIO – GRUPO: ASSISTENCIAL – ESPECIALIDADE:",
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjrj-notice", page: 1, contains: ["LXII CONCURSO PÚBLICO", "EDITAL Nº 01/2025", "Analista Judiciário – Sem Especialidade", "Fundação Getulio Vargas"] },
      { document: "tjrj-notice", page: 21, contains: ["01 de fevereiro de 2026", "70 (setenta) questões de múltipla escolha", "05 (cinco) alternativas e apenas uma resposta correta"] },
      { document: "tjrj-notice", page: 35, contains: ["CARGO: ANALISTA JUDICIÁRIO – GRUPO: NÍVEL SUPERIOR – SEM", "DIREITO ADMINISTRATIVO"] },
    ],
    previousExam: { cycle: "LXII Concurso — objetiva já realizada em01/02/2026", role: "Analista Judiciário – Sem Especialidade — prova objetiva", portalUrl: "https://conhecimento.fgv.br/concursos/tjrjservidores25/01", examDate: "2026-02-01", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJRJ LXII — caderno Tipo1 da prova objetiva de Analista Judiciário – Sem Especialidade", url: `${FGV_FILES}analista-judiciario-sem-especialidade-ns-a01-se-tipo-1.pdf` },
      { type: "answer_key", title: "TJRJ LXII — gabarito oficial definitivo da prova objetiva (Analista Judiciário)", url: `${FGV_FILES}tjrj-analista-gabarito-definitivo.pdf` },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Só Analista Judiciário – Sem Especialidade (conhecimentos gerais e específicos); especialidades e o Técnico (Edital02/2025) ficam fora.", "Itens agrupados pelo número de primeiro nível; subitens (1.1, 1.2.1…) ficam no item.", "Edital consolidado com as cinco retificações (última em06/03/2026, publicada em11/03/2026).", "Treino histórico da objetiva com legislação atual; Código de Normas, Regimento e leis estaduais do RJ exigem fonte oficial própria antes de vínculos."],
  },
  // TJMS Cartórios (VI Concurso de Notas e de Registro): títulos no início do parágrafo ("DIREITO CIVIL. Lei de…").
  {
    productSlug: "tj-ms-cartorios-reta-final", institution: "Tribunal de Justiça do Estado de Mato Grosso do Sul", role: "Outorga de Delegações de Notas e de Registro — Ingresso por Provimento",
    jurisdiction: "MS", cycle: "VI Concurso de Notas e de Registro — Edital 01/2025", bankScope: "Fundação Getulio Vargas, auxílio operacional do concurso, sob a Comissão do TJMS",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjmsnotarial25", examDate: "2026-03-01", examDateEvidence: { documentKey: "tjmsnot-notice", page: 23, item: "10.2", quote: "na modalidade de ingresso por provimento, será realizada no dia 01 de março de", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}outorga-de-delegacoes-de-notas-e-de-registro-ingresso-por-provimento-not-prov-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou o caderno Tipo 1 e o gabarito preliminar em 02/03/2026, compatíveis com a data do edital. O Comunicado 07/2026 (alteração de data, 10/04/2026) é posterior à objetiva e não foi capturado pela política de documentos." },
    stage: "Objetiva com gabarito definitivo republicado (07/05/2026); resultado definitivo da prova escrita e prática em 25/08/2026; prova oral em novembro de 2026",
    stageObservedOn: "2026-11-13", proposedMode: "historical_training", expectedSubjects: 22,
    documents: [
      { key: "tjmsnot-notice", url: `${FGV_FILES}edital-tjms-notarial-2025-com-2a-retificacao.pdf`, title: "Edital 01/2025 TJMS — VI Concurso de Outorga de Delegações de Notas e de Registro, 2ª publicação (com retificação) de 16/10/2025", pages: 74, programmePages: [53, 68], layout: {
        headings: [
          // Marcador gráfico U+F034 colado ao título, preservado literalmente (como no TJMS Área Fim).
          { line: "DIREITO NOTARIAL E REGISTRAL", subject: "Direito Notarial e Registral" },
          { line: "REGISTRO DE IMÓVEIS", subject: "Registro de Imóveis", inline: true },
          { line: "TABELIONATO DE NOTAS", subject: "Tabelionato de Notas", inline: true },
          { line: "REGISTRO CIVIL DAS PESSOAS NATURAIS", subject: "Registro Civil das Pessoas Naturais", inline: true },
          { line: "REGISTRO CIVIL DAS PESSOAS JURÍDICAS", subject: "Registro Civil das Pessoas Jurídicas", inline: true },
          { line: "REGISTROS DE TÍTULOS E DOCUMENTOS", subject: "Registros de Títulos e Documentos", inline: true },
          { line: "TABELIONATO DE PROTESTO", subject: "Tabelionato de Protesto", inline: true },
          { line: "LEIS LOCAIS RELACIONADAS AOS SERVIÇOS EXTRAJUDICIAIS", subject: "Leis Locais Relacionadas aos Serviços Extrajudiciais", inline: true },
          { line: "ATOS NORMATIVOS DO CONSELHO SUPERIOR DA MAGISTRATURA E DA PRESIDÊNCIA DO TJMS", subject: "Atos Normativos do Conselho Superior da Magistratura e da Presidência do TJMS", inline: true },
          { line: "ATOS NORMATIVOS DA CORREGEDORIA-GERAL DE JUSTIÇA DO ESTADO DE MATO GROSSO DO SUL", subject: "Atos Normativos da Corregedoria-Geral de Justiça do Estado de Mato Grosso do Sul", inline: true },
          { line: "ATOS NORMATIVOS DO CONSELHO NACIONAL DE JUSTIÇA – CNJ", subject: "Atos Normativos do Conselho Nacional de Justiça – CNJ", inline: true },
          { line: "CONHECIMENTOS GERAIS", subject: "Conhecimentos Gerais", inline: true },
          { line: "DIREITO CIVIL", subject: "Direito Civil", inline: true },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil", inline: true },
          { line: "DIREITO PENAL", subject: "Direito Penal", inline: true },
          { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal", inline: true },
          { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário", inline: true },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial", inline: true },
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true },
          { line: "LEGISLAÇÃO ESPECIAL DO ESTADO DE MATO GROSSO DO SUL", subject: "Legislação Especial do Estado de Mato Grosso do Sul", inline: true },
          { line: "LEGISLAÇÃO ESPECIAL FEDERAL", subject: "Legislação Especial Federal", inline: true },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true },
        ],
        ignoreLines: ["TRIBUNAL DE JUSTIÇA DO ESTADO DO MATO GROSSO DO SUL \\| CONCURSO PÚBLICO 2025 \\| \\d+", "EDITAL Nº 01/2025 – ABERTURA", "DO VI CONCURSO PÚBLICO DE",
          "PROVAS E TÍTULOS PARA", "OUTORGA DE DELEGAÇÕES DE", "NOTAS E DE REGISTRO", "ANEXO II – CONTEÚDO PROGRAMÁTICO", "PARA AS MODALIDADES DE INGRESSO POR PROVIMENTO E POR REMOÇÃO", "DISCIPLINAS",
          // Nota de rodapé do anexo (onde consultar a legislação estadual), não é conteúdo.
          "\\*As legislações estaduais e os atos normativos do Poder Judiciário do Estado de Mato Grosso do Sul podem", "ser consultados no portal do TJMS, no menu Consulta – Biblioteca, disponível no link", "https://www\\.tjms\\.jus\\.br/legislacao/\\."],
        itemMode: "sentences",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjmsnot-notice", page: 1, contains: ["EDITAL Nº 01/2025 – 2ª PUBLICAÇÃO (COM RETIFICAÇÃO)", "PARA OUTORGA DE DELEGAÇÕES DE NOTAS E DE REGISTRO DO ESTADO DO MATO GROSSO DO SUL", "remoção, de acordo com o disposto no presente Edital."] },
      { document: "tjmsnot-notice", page: 2, contains: ["Fundação Getulio Vargas"] },
      { document: "tjmsnot-notice", page: 23, contains: ["na modalidade de ingresso por provimento, será realizada no dia 01 de março de"] },
      { document: "tjmsnot-notice", page: 24, contains: ["por 100 (cem) questões de múltipla escolha, numeradas sequencialmente, com 05 (cinco)", "alternativas e apenas uma resposta correta."] },
      { document: "tjmsnot-notice", page: 53, contains: ["ANEXO II – CONTEÚDO PROGRAMÁTICO", "PARA AS MODALIDADES DE INGRESSO POR PROVIMENTO E POR REMOÇÃO"] },
    ],
    previousExam: { cycle: "VI Concurso — objetiva já realizada em 01/03/2026", role: "Outorga de Delegações de Notas e de Registro — Ingresso por Provimento — prova objetiva de seleção", portalUrl: "https://conhecimento.fgv.br/concursos/tjmsnotarial25", examDate: "2026-03-01", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJMS VI Notas e Registro — caderno Tipo 1 da prova objetiva (ingresso por provimento)", url: `${FGV_FILES}outorga-de-delegacoes-de-notas-e-de-registro-ingresso-por-provimento-not-prov-tipo-1.pdf` },
      { type: "answer_key", title: "TJMS VI Notas e Registro — gabarito oficial definitivo republicado da prova objetiva", url: `${FGV_FILES}2-gabarito-definitivo-tjms-notarial_atualizado07052026-2.pdf` },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Programa em prosa sem numeração: cada período literal vira um requisito e a repetição literal guarda só a primeira ocorrência.", "Ingresso por provimento; a remoção tem o mesmo quadro de disciplinas e o mesmo Anexo II, em turno próprio.", "Edital consolidado com as 1ª e 2ª retificações; o Edital 04/2025 só corrige o Anexo I (serventias).", "Treino histórico da objetiva com legislação atual; leis estaduais, atos do TJMS e da CGJ exigem fonte oficial própria antes de vínculos."],
  },
  // PCPR 2026 — Delegado de Polícia: títulos numerados inline ("1. DIREITO PENAL: 1.1 …"), itens de segundo nível.
  {
    productSlug: "pc-pr-delegado-2026", institution: "Polícia Civil do Estado do Paraná", role: "Delegado de Polícia",
    jurisdiction: "PR", cycle: "Edital 01/2026", bankScope: "Fundação Getulio Vargas, executora do concurso, com a FUNDASEG e a Comissão de Concurso da PCPR",
    portalUrl: "https://conhecimento.fgv.br/concursos/pcpr26", examDate: "2026-10-11", examDateEvidence: { documentKey: "pcpr-notice", page: 25, item: "9.1", quote: "Curitiba/PR, Londrina/PR e Cascavel/PR, no dia 11 de outubro de 2026 (domingo), no turno da", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}cns101-delegado-de-policia-cns101-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou os cadernos em 13/10/2026 e o gabarito definitivo em 13/11/2026, compatíveis com a data do edital." },
    stage: "Objetiva com gabarito definitivo (13/11/2026) e resultado preliminar publicado em 13/11/2026",
    stageObservedOn: "2026-11-18", proposedMode: "historical_training", expectedSubjects: 8,
    documents: [
      { key: "pcpr-notice", url: `${FGV_FILES}copia-1-de-edital-01-2026-pcpr-publicacao.docx.pdf`, title: "Edital 01/2026 PCPR — Delegado, Agente de Polícia Judiciária e Papiloscopista, retificado em 31/07/2026", pages: 107, programmePages: [65, 69], layout: {
        headings: [
          { line: "1. DIREITO PENAL", subject: "Direito Penal", inline: true, inlineSeparator: ":" },
          { line: "2. DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal", inline: true, inlineSeparator: ":" },
          { line: "3. LEGISLAÇÃO PENAL E LEGISLAÇÃO PROCESSUAL PENAL EXTRAVAGANTE", subject: "Legislação Penal e Legislação Processual Penal Extravagante", inline: true, inlineSeparator: ":" },
          { line: "4. DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "5. DIREITO ADMINISTRATIVO E GESTÃO PÚBLICA", subject: "Direito Administrativo e Gestão Pública", inline: true, inlineSeparator: ":" },
          { line: "6. LEGISLAÇÃO ESTADUAL E INSTITUCIONAL", subject: "Legislação Estadual e Institucional", inline: true, inlineSeparator: ":" },
          { line: "7. DIREITOS HUMANOS", subject: "Direitos Humanos", inline: true, inlineSeparator: ":" },
          { line: "8. CIÊNCIAS FORENSES", subject: "Ciências Forenses", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["ANEXO I", "CONTEÚDO PROGRAMÁTICO", "DELEGADO DE POLÍCIA"],
        stopLine: "AGENTE DE POLÍCIA JUDICIÁRIA E PAPILOSCOPISTA POLICIAL",
        itemMode: "second-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "pcpr-notice", page: 1, contains: ["CONCURSO PÚBLICO DA POLÍCIA CIVIL DO PARANÁ", "EDITAL N.º 01/2026"] },
      { document: "pcpr-notice", page: 2, contains: ["1.5 O concurso será executado sob a responsabilidade da Fundação Getulio Vargas, doravante"] },
      { document: "pcpr-notice", page: 25, contains: ["no dia 11 de outubro de 2026 (domingo)"] },
      { document: "pcpr-notice", page: 26, contains: ["9.5 A Prova Objetiva para o cargo de Delegado de Polícia", "será composta por 100 (cem) questões de múltipla escolha"] },
      { document: "pcpr-notice", page: 28, contains: ["contendo 5 (cinco) alternativas cada, e apenas"] },
      { document: "pcpr-notice", page: 65, contains: ["CONTEÚDO PROGRAMÁTICO", "DELEGADO DE POLÍCIA", "1. DIREITO PENAL: 1.1"] },
    ],
    previousExam: { cycle: "Edital 01/2026 — objetiva aplicada em 11/10/2026", role: "Delegado de Polícia — prova objetiva", portalUrl: "https://conhecimento.fgv.br/concursos/pcpr26", examDate: "2026-10-11", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PCPR 01/2026 — caderno Tipo 1 da prova objetiva de Delegado de Polícia", url: `${FGV_FILES}cns101-delegado-de-policia-cns101-tipo-1.pdf` },
      { type: "answer_key", title: "PCPR 01/2026 — gabarito oficial definitivo da prova objetiva", url: `${FGV_FILES}gabaritos-definitivos-v3.pdf` },
    ] },
    limitations: ["Só Delegado de Polícia; Agente de Polícia Judiciária e Papiloscopista têm programa próprio no mesmo anexo.", "Itens agrupados pelo número de segundo nível; subitens (1.1.1…) ficam no item.", "A 1ª retificação (Edital 02/2026) altera exame médico e títulos, sem mudar o Anexo I.", "Treino histórico da objetiva com legislação atual; legislação estadual do Paraná exige fonte oficial própria antes de vínculos."],
  },
  // PCPR 01/2026 — Agente de Polícia Judiciária: decisão do proprietário (23/11/2026) de separar os cargos de agente em concursos próprios.
  {
    productSlug: "pc-pr-agente-2026", institution: "Polícia Civil do Estado do Paraná", role: "Agente de Polícia Judiciária",
    jurisdiction: "PR", cycle: "Edital 01/2026", bankScope: "Fundação Getulio Vargas, executora do concurso, com a FUNDASEG e a Comissão de Concurso da PCPR",
    portalUrl: "https://conhecimento.fgv.br/concursos/pcpr26", examDate: "2026-10-11", examDateEvidence: { documentKey: "pcpr-notice", page: 25, item: "9.1", quote: "Curitiba/PR, Londrina/PR e Cascavel/PR, no dia 11 de outubro de 2026 (domingo), no turno da", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}cns201-agente-de-policia-judiciaria-cns201-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou os cadernos em 13/10/2026 e o gabarito definitivo em 13/11/2026, compatíveis com a data do edital." },
    stage: "Objetiva com gabarito definitivo (13/11/2026) e resultado preliminar publicado em 13/11/2026",
    stageObservedOn: "2026-11-23", proposedMode: "historical_training", expectedSubjects: 9,
    documents: [
      { key: "pcpr-notice", url: `${FGV_FILES}copia-1-de-edital-01-2026-pcpr-publicacao.docx.pdf`, title: "Edital 01/2026 PCPR — Delegado, Agente de Polícia Judiciária e Papiloscopista, retificado em 31/07/2026", pages: 107, programmePages: [70, 73], layout: {
        headings: [
          { line: "2. CIÊNCIAS FORENSES", subject: "Ciências Forenses", inline: true, inlineSeparator: ":" },
          { line: "3. CONTABILIDADE GERAL", subject: "Contabilidade Geral", inline: true, inlineSeparator: ":" },
          { line: "4. ESTATÍSTICA", subject: "Estatística", inline: true, inlineSeparator: ":" },
          { line: "5. LEGISLAÇÃO ESTADUAL E INSTITUCIONAL", subject: "Legislação Estadual e Institucional", inline: true, inlineSeparator: ":" },
          { line: "6. DIREITO PENAL E LEGISLAÇÃO PENAL EXTRAVAGANTE", subject: "Direito Penal e Legislação Penal Extravagante", inline: true, inlineSeparator: ":" },
          { line: "7. DIREITO PROCESSUAL PENAL E LEGISLAÇÃO PROCESSUAL PENAL EXTRAVAGANTE", subject: "Direito Processual Penal e Legislação Processual Penal Extravagante", inline: true, inlineSeparator: ":" },
          { line: "8. DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "9. DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true, inlineSeparator: ":" },
          { line: "10. DIREITOS HUMANOS", subject: "Direitos Humanos", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["CONHECIMENTOS ESPECÍFICOS"],
        stopLine: "PAPILOSCOPISTA POLICIAL",
        itemMode: "second-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "pcpr-notice", page: 1, contains: ["CONCURSO PÚBLICO DA POLÍCIA CIVIL DO PARANÁ", "EDITAL N.º 01/2026"] },
      { document: "pcpr-notice", page: 2, contains: ["1.5 O concurso será executado sob a responsabilidade da Fundação Getulio Vargas, doravante"] },
      { document: "pcpr-notice", page: 25, contains: ["no dia 11 de outubro de 2026 (domingo)"] },
      { document: "pcpr-notice", page: 26, contains: ["9.6 A Prova Objetiva para o cargo de Agente de Polícia Judiciária totalizará 100"] },
      { document: "pcpr-notice", page: 28, contains: ["contendo 5 (cinco) alternativas cada, e apenas"] },
      { document: "pcpr-notice", page: 70, contains: ["AGENTE DE POLÍCIA JUDICIÁRIA", "CONHECIMENTOS ESPECÍFICOS"] },
    ],
    previousExam: { cycle: "Edital 01/2026 — objetiva aplicada em 11/10/2026", role: "Agente de Polícia Judiciária — prova objetiva", portalUrl: "https://conhecimento.fgv.br/concursos/pcpr26", examDate: "2026-10-11", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PCPR 01/2026 — caderno Tipo 1 da prova objetiva de Agente de Polícia Judiciária", url: `${FGV_FILES}cns201-agente-de-policia-judiciaria-cns201-tipo-1.pdf` },
      { type: "answer_key", title: "PCPR 01/2026 — gabarito oficial definitivo da prova objetiva", url: `${FGV_FILES}gabaritos-definitivos-v3.pdf` },
    ] },
    limitations: ["Só os conhecimentos específicos de Agente de Polícia Judiciária (Anexo I); os conhecimentos gerais (Língua Portuguesa, Raciocínio Lógico-Matemático e Realidade do Paraná) não são lei seca e ficam fora.", "O item 1 (Tecnologia e Sistemas de Informação…, título quebrado em duas linhas) não é lei seca e fica fora do programa admitido.", "Itens agrupados pelo número de segundo nível; subitens ficam no item.", "Treino histórico da objetiva com legislação atual; não reproduz o caderno aplicado."],
  },
  // PCPR 01/2026 — Papiloscopista Policial: decisão do proprietário (23/11/2026) de separar os cargos de agente em concursos próprios.
  {
    productSlug: "pc-pr-papiloscopista-2026", institution: "Polícia Civil do Estado do Paraná", role: "Papiloscopista Policial",
    jurisdiction: "PR", cycle: "Edital 01/2026", bankScope: "Fundação Getulio Vargas, executora do concurso, com a FUNDASEG e a Comissão de Concurso da PCPR",
    portalUrl: "https://conhecimento.fgv.br/concursos/pcpr26", examDate: "2026-10-11", examDateEvidence: { documentKey: "pcpr-notice", page: 25, item: "9.1", quote: "Curitiba/PR, Londrina/PR e Cascavel/PR, no dia 11 de outubro de 2026 (domingo), no turno da", actualDayIndependentlyVerified: false, corroboratingUrl: `${FGV_FILES}cns301-papiloscopista-policial-cns301-tipo-1.pdf`, limitation: "O texto do gabarito não é extraído (política de material de prova); o portal publicou os cadernos em 13/10/2026 e o gabarito definitivo em 13/11/2026, compatíveis com a data do edital." },
    stage: "Objetiva com gabarito definitivo (13/11/2026) e resultado preliminar publicado em 13/11/2026",
    stageObservedOn: "2026-11-23", proposedMode: "historical_training", expectedSubjects: 10,
    documents: [
      { key: "pcpr-notice", url: `${FGV_FILES}copia-1-de-edital-01-2026-pcpr-publicacao.docx.pdf`, title: "Edital 01/2026 PCPR — Delegado, Agente de Polícia Judiciária e Papiloscopista, retificado em 31/07/2026", pages: 107, programmePages: [73, 76], layout: {
        headings: [
          { line: "2. CIÊNCIAS FORENSES", subject: "Ciências Forenses", inline: true, inlineSeparator: ":" },
          { line: "3. BIOLOGIA", subject: "Biologia", inline: true, inlineSeparator: ":" },
          { line: "4. FÍSICA", subject: "Física", inline: true, inlineSeparator: ":" },
          { line: "5. QUÍMICA", subject: "Química", inline: true, inlineSeparator: ":" },
          { line: "6. LEGISLAÇÃO ESTADUAL E INSTITUCIONAL", subject: "Legislação Estadual e Institucional", inline: true, inlineSeparator: ":" },
          { line: "7. DIREITO PENAL APLICADO", subject: "Direito Penal Aplicado", inline: true, inlineSeparator: ":" },
          { line: "8. DIREITO PROCESSUAL PENAL APLICADO", subject: "Direito Processual Penal Aplicado", inline: true, inlineSeparator: ":" },
          { line: "9. DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "10. DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true, inlineSeparator: ":" },
          { line: "11. DIREITOS HUMANOS", subject: "Direitos Humanos", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["CONHECIMENTOS ESPECÍFICOS"],
        startLine: "PAPILOSCOPISTA POLICIAL",
        itemMode: "second-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "pcpr-notice", page: 1, contains: ["CONCURSO PÚBLICO DA POLÍCIA CIVIL DO PARANÁ", "EDITAL N.º 01/2026"] },
      { document: "pcpr-notice", page: 2, contains: ["1.5 O concurso será executado sob a responsabilidade da Fundação Getulio Vargas, doravante"] },
      { document: "pcpr-notice", page: 25, contains: ["no dia 11 de outubro de 2026 (domingo)"] },
      { document: "pcpr-notice", page: 27, contains: ["9.7 A Prova Objetiva para o cargo de Papiloscopista Policial totalizará 100"] },
      { document: "pcpr-notice", page: 28, contains: ["contendo 5 (cinco) alternativas cada, e apenas"] },
      { document: "pcpr-notice", page: 73, contains: ["PAPILOSCOPISTA POLICIAL", "CONHECIMENTOS ESPECÍFICOS"] },
    ],
    previousExam: { cycle: "Edital 01/2026 — objetiva aplicada em 11/10/2026", role: "Papiloscopista Policial — prova objetiva", portalUrl: "https://conhecimento.fgv.br/concursos/pcpr26", examDate: "2026-10-11", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PCPR 01/2026 — caderno Tipo 1 da prova objetiva de Papiloscopista Policial", url: `${FGV_FILES}cns301-papiloscopista-policial-cns301-tipo-1.pdf` },
      { type: "answer_key", title: "PCPR 01/2026 — gabarito oficial definitivo da prova objetiva", url: `${FGV_FILES}gabaritos-definitivos-v3.pdf` },
    ] },
    limitations: ["Só os conhecimentos específicos de Papiloscopista Policial (Anexo I); os conhecimentos gerais (Língua Portuguesa, Raciocínio Lógico-Matemático e Realidade do Paraná) não são lei seca e ficam fora.", "O item 1 (Tecnologia e Sistemas de Informação…, título quebrado em duas linhas) não é lei seca e fica fora do programa admitido.", "No edital, os itens de Direito Constitucional e Administrativo do Papiloscopista mantêm a numeração 8.x e 9.x do bloco do Agente; o texto é o literal da página.", "Itens agrupados pelo número de segundo nível; subitens ficam no item.", "Treino histórico da objetiva com legislação atual; não reproduz o caderno aplicado."],
  },
  // PGM-Manaus 01/2026 (FCC). O edital está no DOM nº 6343 (Edição Extra, 02/07/2026); o WAF do DOM recusa o servidor
  // e o robots da FCC proíbe /concursos/ e PDFs. O PDF entra pelo arquivo baixado no navegador, com o SHA-256 fixado.
  {
    productSlug: "pgm-manaus-procurador-do-municipio-2026", institution: "Procuradoria Geral do Município de Manaus", role: "Procurador do Município de 3ª Classe",
    jurisdiction: "AM", cycle: "Edital nº 01/2026", bankScope: "Fundação Carlos Chagas, responsável pela realização do concurso (item 1.1), sob a Comissão de Concurso Público da PGM",
    portalUrl: "https://www.concursosfcc.com.br/concursoInscricaoAberta.html", examDate: "2026-09-20", examDateEvidence: { documentKey: "pgmmanaus-notice", page: 6, item: "6.2", quote: "a) Prova Objetiva: 20/09/2026, no período da MANHÃ;", actualDayIndependentlyVerified: false, corroboratingUrl: "https://dom.manaus.am.gov.br/pdf/2026/julho/DOM%206343%2002.07.2026%20Edicao%20Extra.pdf", limitation: "Data prevista no edital; o resultado e o gabarito ficam no portal da FCC, cujo robots proíbe a consulta automatizada." },
    stage: "Objetiva prevista para 20/09/2026 (item 6.2); discursivas em 29/11 e 06/12/2026",
    stageObservedOn: "2026-11-23", proposedMode: "historical_training", expectedSubjects: 12,
    documents: [
      { key: "pgmmanaus-notice", url: "https://dom.manaus.am.gov.br/pdf/2026/julho/DOM%206343%2002.07.2026%20Edicao%20Extra.pdf", title: "Edital nº 01/2026 PGM-Manaus — Procurador do Município de 3ª Classe (DOM nº 6343, Edição Extra, 02/07/2026)", pages: 20, programmePages: [14, 19],
        operatorDownloadSha256: "8cb56a3c5c1506c4d0b90772f39936713634c5874eb0b160c6efdcfd80d8b163", layout: {
        headings: [
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" },
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário" },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO FINANCEIRO", subject: "Direito Financeiro" },
          { line: "DIREITO CIVIL", subject: "Direito Civil" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" },
          { line: "DIREITO DO TRABALHO", subject: "Direito do Trabalho" },
          { line: "DIREITO PROCESSUAL DO TRABALHO", subject: "Direito Processual do Trabalho" },
          { line: "DIREITO MUNICIPAL", subject: "Direito Municipal" },
        ],
        ignoreLines: ["Manaus, [a-zçá-]+-feira, 02 de julho de 2026\\.?", "DOM \\| Edição Extra 6343 \\| Página \\d+", "ANEXO II", "CONTEÚDO PROGRAMÁTICO"],
        removeLiterals: ["SEM VALOR OFICIAL"],
        stopLine: "ANEXO III",
        splitInlineItems: true,
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "pgmmanaus-notice", page: 1, contains: ["PROCURADORIA GERAL DO MUNICÍPIO DE MANAUS", "PROCURADOR DO MUNICÍPIO DE 3ª CLASSE", "EDITAL Nº 01/2026 DE ABERTURA DE INSCRIÇÕES", "responsabilidade da Fundação Carlos Chagas"] },
      { document: "pgmmanaus-notice", page: 6, contains: ["a) Prova Objetiva: 20/09/2026, no período da MANHÃ;"] },
      { document: "pgmmanaus-notice", page: 8, contains: ["8.1 A Prova Objetiva de caráter eliminatório e classificatório, será", "(cinco) alternativas cada, versando sobre disciplinas constantes do"] },
      { document: "pgmmanaus-notice", page: 14, contains: ["ANEXO II", "CONTEÚDO PROGRAMÁTICO", "DIREITO CONSTITUCIONAL"] },
    ],
    previousExam: { cycle: "Edital nº 01/2026 — objetiva prevista para 20/09/2026", role: "Procurador do Município de 3ª Classe — prova objetiva", portalUrl: "https://www.concursosfcc.com.br/concursoInscricaoAberta.html", examDate: "2026-09-20", answerKeyFinality: "definitive_document", documents: [] },
    limitations: ["Caderno e gabarito ficam no portal da FCC, cujo robots proíbe /concursos/ e PDFs: prova anterior não registrada (bloqueio explícito).", "Itens numerados de primeiro nível; a linha seguinte continua o item.", "O carimbo \"SEM VALOR OFICIAL\" do visualizador do DOM, colado ao fim de uma linha por página, é removido do texto dos requisitos.", "Direito Municipal cita a Lei Orgânica e leis de Manaus, fora do corpus federal.", "Treino histórico da objetiva com legislação atual; não simula as discursivas."],
  },
  // Lote Cebraspe histórico (18/11/2026): títulos inline com dois-pontos ("DIREITO CIVIL: 1 …"), itens numerados corridos.
  {
    productSlug: "sefaz-rn-auditor-fiscal-reta-final", institution: "Secretaria de Estado da Fazenda do Rio Grande do Norte", role: "Auditor Fiscal de Receitas Estaduais",
    jurisdiction: "RN", cycle: "Edital nº 5 – SEAD/SEFAZ/RN, de 19/12/2025", bankScope: "Cebraspe, executor do concurso e responsável pelas provas objetivas, sob a SEAD/RN",
    portalUrl: "https://www.cebraspe.org.br/concursos/sefaz_rn_25_auditor", examDate: "2026-03-22", examDateEvidence: { documentKey: "sefazrn-notice", page: 38, item: "Anexo I", quote: "Aplicação das provas objetivas 21 e 22/3/2026", actualDayIndependentlyVerified: false, corroboratingUrl: "https://cdn.cebraspe.org.br/concursos/sefaz_rn_25_auditor/arquivos/355613AE6F4CBAEBA889E8A28F0DB4FC3887AE80F556A18EFF6980A58F662096.pdf", limitation: "O cronograma prevê as provas em 21 e 22/3/2026 sem dizer o dia de cada uma; a edição usa 22/3/2026, fim da aplicação. O texto do gabarito não é extraído (política de material de prova); a API oficial publicou os cadernos em 27/03/2026 e o gabarito definitivo P3 em 24/04/2026." },
    stage: "Objetivas com gabarito definitivo (24/04/2026, P1 atualizado em 29/04/2026); concurso homologado em 03/06/2026",
    stageObservedOn: "2026-11-18", proposedMode: "historical_training", expectedSubjects: 18,
    documents: [
      { key: "sefazrn-notice", url: "https://cdn.cebraspe.org.br/concursos/sefaz_rn_25_auditor/arquivos/E8D7BE4C19CD39BFF1D87ECFBF92C0409AF35B178B8865C9534F17236D261200.pdf", title: "Edital nº 5 – SEAD/SEFAZ/RN, de 19/12/2025 — abertura do concurso de Auditor Fiscal de Receitas Estaduais", pages: 40, programmePages: [31, 37], layout: {
        headings: [
          { line: "LÍNGUA PORTUGUESA", subject: "Língua Portuguesa", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true, inlineSeparator: ":" },
          { line: "DIREITO COMERCIAL", subject: "Direito Comercial", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CIVIL", subject: "Direito Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PENAL", subject: "Direito Penal", inline: true, inlineSeparator: ":" },
          { line: "DIREITO FINANCEIRO", subject: "Direito Financeiro", inline: true, inlineSeparator: ":" },
          { line: "ECONOMIA", subject: "Economia", inline: true, inlineSeparator: ":" },
          { line: "CONTABILIDADE GERAL", subject: "Contabilidade Geral", inline: true, inlineSeparator: ":" },
          { line: "HISTÓRIA DO RIO GRANDE DO NORTE E ASPECTOS GEOECONÔMICOS DO RIO GRANDE DO NORTE", subject: "História do Rio Grande do Norte e Aspectos Geoeconômicos do Rio Grande do Norte", inline: true, inlineSeparator: ":" },
          { line: "AUDITORIA", subject: "Auditoria", inline: true, inlineSeparator: ":" },
          { line: "MATEMÁTICA FINANCEIRA E ESTATÍSTICA", subject: "Matemática Financeira e Estatística", inline: true, inlineSeparator: ":" },
          { line: "TECNOLOGIA DA INFORMAÇÃO", subject: "Tecnologia da Informação", inline: true, inlineSeparator: ":" },
          { line: "DIREITO TRIBUTÁRIO I - GERAL", subject: "Direito Tributário I - Geral", inline: true, inlineSeparator: ":" },
          { line: "DIREITO TRIBUTÁRIO II – REFORMA TRIBUTÁRIA", subject: "Direito Tributário II – Reforma Tributária", inline: true, inlineSeparator: ":" },
          { line: "CONTABILIDADE AVANÇADA E CONTABILIDADE DE CUSTOS", subject: "Contabilidade Avançada e Contabilidade de Custos", inline: true, inlineSeparator: ":" },
          { line: "LEGISLAÇÃO TRIBUTÁRIA ESTADUAL", subject: "Legislação Tributária Estadual", inline: true, inlineSeparator: ":" },
          { line: "PROCESSO ADMINISTRATIVO TRIBUTÁRIO", subject: "Processo Administrativo Tributário", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["13\\.2\\.1 Nas provas, serão avaliados, além de habilidades, conhecimentos conforme descritos a seguir\\.", "13\\.2\\.2 CONHECIMENTOS GERAIS",
          "13\\.2\\.3 CONHECIMENTOS COMPLEMENTARES", "13\\.2\\.4 CONHECIMENTOS ESPECÍFICOS",
          // Assinatura do edital, depois do último título.
          "IRANILDO GERMANO DOS SANTOS", "Secretário de Estado da Administração"],
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "sefazrn-notice", page: 1, contains: ["EDITAL Nº 5 – SEAD/SEFAZ/RN, DE 19 DE DEZEMBRO DE 2025", "CARGO DE AUDITOR FISCAL DE RECEITAS ESTADUAIS", "executado pelo Centro Brasileiro de Pesquisa em"] },
      { document: "sefazrn-notice", page: 21, contains: ["múltipla escolha, com cinco opções (A, B, C, D e E)", "Processo administrativo tributário 10"] },
      { document: "sefazrn-notice", page: 38, contains: ["Aplicação das provas objetivas 21 e 22/3/2026"] },
    ],
    previousExam: { cycle: "Edital nº 5/2025 — objetivas já realizadas em 21 e 22/3/2026", role: "Auditor Fiscal de Receitas Estaduais — prova objetiva P3 (conhecimentos específicos)", portalUrl: "https://www.cebraspe.org.br/concursos/sefaz_rn_25_auditor", examDate: "2026-03-22", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "SEFAZ-RN 2025 — caderno da prova objetiva P3 (conhecimentos específicos)", url: "https://cdn.cebraspe.org.br/concursos/sefaz_rn_25_auditor/arquivos/355613AE6F4CBAEBA889E8A28F0DB4FC3887AE80F556A18EFF6980A58F662096.pdf" },
      { type: "answer_key", title: "SEFAZ-RN 2025 — gabarito definitivo da prova objetiva P3", url: "https://cdn.cebraspe.org.br/concursos/sefaz_rn_25_auditor/arquivos/CAA752D9479FB2950FC4628B664090960445EF8846E2AC3E7AF5FB2F344267C5.pdf" },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Itens agrupados pelo número de primeiro nível; subitens (1.1, 1.2.1…) ficam no item.", "Prova anterior registrada pela P3 (conhecimentos específicos, 80 questões); P1 e P2 têm cadernos próprios no mesmo evento.", "Edital nº 5/2025 sem retificação de programa; o Edital nº 7 só retifica resultado.", "Treino histórico da objetiva com legislação atual; legislação tributária estadual do RN exige fonte oficial própria antes de vínculos."],
  },
  // TCE-RN 2025 — Auditor de Controle Externo – Direito (Cargo 9): só conhecimentos específicos (P2, Certo/Errado).
  {
    productSlug: "tce-rn-auditor-2026", institution: "Tribunal de Contas do Estado do Rio Grande do Norte", role: "Auditor de Controle Externo – Especialidade: Direito",
    jurisdiction: "RN", cycle: "Edital nº 1 – TCE/RN, de 29/12/2025", bankScope: "Cebraspe, executor do concurso e responsável pelas provas objetivas e discursiva, sob o TCE/RN",
    portalUrl: "https://www.cebraspe.org.br/concursos/tce_rn_25", examDate: "2026-04-11", examDateEvidence: { documentKey: "tcern-notice", page: 69, item: "Anexo I", quote: "(Auditor de Controle Externo) 11/4/2026", actualDayIndependentlyVerified: false, corroboratingUrl: "https://cdn.cebraspe.org.br/concursos/TCE_RN_25/arquivos/361EF1E1F67D6BA00F5FF942DEB12899120042A4355EBAEB4966FEFFD970832D.pdf", limitation: "O texto do gabarito não é extraído (política de material de prova); a API oficial publicou o caderno P2 do Cargo 9 em 17/04/2026 e o gabarito definitivo em 13/05/2026, compatíveis com a data do cronograma." },
    stage: "Objetivas com gabarito definitivo (13/05/2026); resultado final no concurso para o nível superior em 12/08/2026 (Edital nº 13)",
    stageObservedOn: "2026-11-18", proposedMode: "historical_training", expectedSubjects: 9,
    documents: [
      { key: "tcern-notice", url: "https://cdn.cebraspe.org.br/concursos/TCE_RN_25/arquivos/57E129C2E6851CF23E0EC1333E6F5A80DB7550368502E00A308C4E839EAE78BB.pdf", title: "Edital nº 1 – TCE/RN, de 29/12/2025 — abertura, versão atualizada até o Edital nº 6, de 31/03/2026", pages: 71, programmePages: [57, 60], layout: {
        headings: [
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "DIREITO FINANCEIRO", subject: "Direito Financeiro", inline: true, inlineSeparator: ":" },
          { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CIVIL", subject: "Direito Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PENAL", subject: "Direito Penal", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário", inline: true, inlineSeparator: ":" },
          { line: "AUDITORIA DO SETOR PÚBLICO", subject: "Auditoria do Setor Público", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: [],
        startLine: "CARGO 9: AUDITOR DE CONTROLE EXTERNO – ESPECIALIDADE: DIREITO",
        stopLine: "CARGO 10: AUDITOR DE CONTROLE EXTERNO – ESPECIALIDADE: ENGENHARIA",
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tcern-notice", page: 1, contains: ["EDITAL Nº 1 – TCE/RN, DE 29 DE DEZEMBRO DE 2025", "Versão atualizada até a retificação constante do Edital nº 6 – TCE/RN, de 31 de março de 2026.", "Avaliação e Seleção e de Promoção de Eventos (Cebraspe)."] },
      { document: "tcern-notice", page: 26, contains: ["7.1.2 AUDITOR DE CONTROLE EXTERNO", "Prova objetiva (P2) Conhecimentos específicos 70"] },
      { document: "tcern-notice", page: 27, contains: ["O julgamento de cada item será CERTO ou ERRADO"] },
      { document: "tcern-notice", page: 57, contains: ["CARGO 9: AUDITOR DE CONTROLE EXTERNO – ESPECIALIDADE: DIREITO"] },
      { document: "tcern-notice", page: 69, contains: ["(Auditor de Controle Externo) 11/4/2026"] },
    ],
    previousExam: { cycle: "Edital nº 1/2025 — objetivas já realizadas em 11/4/2026", role: "Auditor de Controle Externo – Direito — prova objetiva P2 (conhecimentos específicos)", portalUrl: "https://www.cebraspe.org.br/concursos/tce_rn_25", examDate: "2026-04-11", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TCE-RN 2025 — caderno da prova objetiva P2 (conhecimentos específicos) — Cargo 9", url: "https://cdn.cebraspe.org.br/concursos/TCE_RN_25/arquivos/361EF1E1F67D6BA00F5FF942DEB12899120042A4355EBAEB4966FEFFD970832D.pdf" },
      { type: "answer_key", title: "TCE-RN 2025 — gabarito definitivo da prova objetiva P2 — Cargo 9", url: "https://cdn.cebraspe.org.br/concursos/TCE_RN_25/arquivos/6F2A7444B2D884D74F7FAA21083CF8D4F5342036A955C80C1AA293A4C118882C.pdf" },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Só os conhecimentos específicos do Cargo 9 (P2, 70 itens Certo/Errado); os conhecimentos gerais (P1) têm títulos com exceções por cargo e ficam para revisão própria.", "Itens agrupados pelo número de primeiro nível.", "Edital consolidado até a retificação do Edital nº 6 (avaliação de títulos); nenhuma retificação de programa.", "Treino histórico da objetiva com legislação atual; leis complementares estaduais do RN exigem fonte oficial própria antes de vínculos."],
  },
  // TJ-MT 2025 — Outorga de Delegações de Notas e de Registro, ingresso por provimento (objetiva de seleção, 100 questões A–E).
  {
    productSlug: "tj-mt-cartorios-reta-final", institution: "Tribunal de Justiça do Estado de Mato Grosso", role: "Outorga de Delegações de Notas e de Registro — Ingresso por Provimento",
    jurisdiction: "MT", cycle: "Edital TJMT/DGP nº 48, de 20/10/2025", bankScope: "Cebraspe, executor do concurso e responsável pela prova objetiva de seleção, com a Comissão Examinadora do TJMT",
    portalUrl: "https://www.cebraspe.org.br/concursos/tj_mt_25_notarios", examDate: "2026-09-05", examDateEvidence: { documentKey: "tjmt-notice", page: 57, item: "Anexo I", quote: "Aplicação da prova objetiva de seleção – Provimento 5/9/2026", actualDayIndependentlyVerified: false, corroboratingUrl: "https://cdn.cebraspe.org.br/concursos/tj_mt_25_notarios/arquivos/E8790E73E144A9BDAF6B0FC269782453E9217B3E5CBF4C89F3B67E91D228EED5.pdf", limitation: "O texto do gabarito não é extraído (política de material de prova); a API oficial publicou o caderno de provimento em 11/09/2026 e o gabarito definitivo em 01/10/2026, compatíveis com a data do cronograma." },
    stage: "Objetiva de seleção com gabarito definitivo (Edital nº 28, 01/10/2026); prova escrita e prática aplicada (padrão preliminar em 03/11/2026)",
    stageObservedOn: "2026-11-19", proposedMode: "historical_training", expectedSubjects: 10,
    documents: [
      { key: "tjmt-notice", url: "https://cdn.cebraspe.org.br/concursos/tj_mt_25_notarios/arquivos/6500401BB1E96C8AF9F9DA0910FF96202FF79B66FE7A9E9E516DFAA4B169DF9B.pdf", title: "Edital TJMT/DGP nº 48, de 20/10/2025 — abertura, versão atualizada até o Edital nº 11, de 15/04/2026", pages: 72, programmePages: [49, 55], layout: {
        headings: [
          { line: "DIREITO NOTARIAL E REGISTRAL", subject: "Direito Notarial e Registral", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true, inlineSeparator: ":" },
          { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CIVIL", subject: "Direito Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PENAL", subject: "Direito Penal", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL PENAL", subject: "Direito Processual Penal", inline: true, inlineSeparator: ":" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial", inline: true, inlineSeparator: ":" },
          { line: "CONHECIMENTOS GERAIS", subject: "Conhecimentos Gerais", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["ESTADO DE MATO GROSSO", "PODER JUDICIÁRIO", "TRIBUNAL DE JUSTIÇA",
          // Assinatura do edital, depois do último título.
          "JOSÉ ZUQUIM NOGUEIRA", "Presidente do Tribunal de Justiça do Estado de Mato Grosso"],
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "tjmt-notice", page: 1, contains: ["EDITALTJMT/DGP N. 48 DE 20 DE OUTUBRO DE 2025", "Versão atualizada até a retificação constante do Edital TJMT/DGP nº 11, de 15 de abril de 2026."] },
      { document: "tjmt-notice", page: 24, contains: ["múltipla escolha, com cinco opções (A, B, C, D", "abrangerá os objetos de"] },
      { document: "tjmt-notice", page: 49, contains: ["20 DOS OBJETOS DE AVALIAÇÃO"] },
      { document: "tjmt-notice", page: 57, contains: ["Aplicação da prova objetiva de seleção –", "5/9/2026"] },
    ],
    previousExam: { cycle: "Edital TJMT/DGP nº 48/2025 — objetiva de seleção (provimento) já realizada em 5/9/2026", role: "Outorga de Delegações de Notas e de Registro — prova objetiva de seleção, ingresso por provimento", portalUrl: "https://www.cebraspe.org.br/concursos/tj_mt_25_notarios", examDate: "2026-09-05", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TJ-MT 2025 Cartórios — caderno da prova objetiva de seleção — provimento", url: "https://cdn.cebraspe.org.br/concursos/tj_mt_25_notarios/arquivos/E8790E73E144A9BDAF6B0FC269782453E9217B3E5CBF4C89F3B67E91D228EED5.pdf" },
      { type: "answer_key", title: "TJ-MT 2025 Cartórios — gabarito definitivo da prova objetiva de seleção — provimento", url: "https://cdn.cebraspe.org.br/concursos/tj_mt_25_notarios/arquivos/AC049C45E817444A5C57213E5850F5D6B78D57B4D6F4AE912D60F0FE472AFE2B.pdf" },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Itens agrupados pelo número de primeiro nível; subitens ficam no item.", "Só o ingresso por provimento; a remoção tem prova própria com os mesmos objetos de avaliação.", "Edital consolidado até o Edital nº 11; as retificações posteriores (nº 17, 21 e seguintes) não alteram o item 20.", "Treino histórico da objetiva com legislação atual; normas da CGJ/TJMT exigem fonte oficial própria antes de vínculos."],
  },
  // TRT-10 2024 — Analista Judiciário – Área Judiciária (Cargo 12): só conhecimentos específicos (P2, Certo/Errado).
  {
    productSlug: "trt-10-analista-e-tecnico-df-to", institution: "Tribunal Regional do Trabalho da 10ª Região", role: "Analista Judiciário – Área: Judiciária",
    jurisdiction: "DF", cycle: "Edital nº 1 – TRT 10ª Região, de 19/12/2024", bankScope: "Cebraspe, executor do concurso e responsável pelas provas objetivas e discursiva, sob o TRT 10ª Região",
    portalUrl: "https://www.cebraspe.org.br/concursos/trt10_24", examDate: "2025-03-16", examDateEvidence: { documentKey: "trt10-notice", page: 83, item: "Anexo I", quote: "Aplicação das provas objetivas e discursiva 16/3/2025", actualDayIndependentlyVerified: false, corroboratingUrl: "https://cdn.cebraspe.org.br/concursos/TRT10_24/arquivos/050_TRT10_012_01.pdf", limitation: "O texto do gabarito não é extraído (política de material de prova); a API oficial publicou o caderno P2 do Cargo 12 em 21/03/2025 e o gabarito definitivo em 14/04/2025, compatíveis com a data do cronograma." },
    stage: "Objetivas com gabarito definitivo (14/04/2025); resultado final no concurso em 01/08/2025 (Edital nº 11)",
    stageObservedOn: "2026-11-19", proposedMode: "historical_training", expectedSubjects: 5,
    documents: [
      { key: "trt10-notice", url: "https://cdn.cebraspe.org.br/concursos/TRT10_24/arquivos/Ed_1_2024_TRT_10_Abertura_atualizado_at%C3%A9_ret_6.pdf", title: "Edital nº 1 – TRT 10ª Região, de 19/12/2024 — abertura, versão atualizada até o Edital nº 6, de 23/05/2025", pages: 86, programmePages: [73, 76], layout: {
        headings: [
          { line: "DIREITO CIVIL", subject: "Direito Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO DO TRABALHO", subject: "Direito do Trabalho", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL DO TRABALHO", subject: "Direito Processual do Trabalho", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: [],
        startLine: "CARGO 12: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA",
        stopLine: "CARGO 13: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA – ESPECIALIDADE: OFICIAL DE JUSTIÇA AVALIADOR",
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "trt10-notice", page: 1, contains: ["EDITAL Nº 1 – TRT 10ª REGIÃO, DE 19 DE DEZEMBRO DE 2024", "Versão atualização até a retificação publicada no Edital nº 6 – TRT 10ª Região, de 23 de maio de 2025", "Avaliação e Seleção e de Promoção de Eventos (Cebraspe)."] },
      { document: "trt10-notice", page: 34, contains: ["O julgamento de cada item será CERTO ou ERRADO"] },
      { document: "trt10-notice", page: 73, contains: ["CARGO 12: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA"] },
      { document: "trt10-notice", page: 83, contains: ["Aplicação das provas objetivas e discursiva", "16/3/2025"] },
    ],
    previousExam: { cycle: "Edital nº 1/2024 — objetivas já realizadas em 16/3/2025", role: "Analista Judiciário – Área Judiciária — prova objetiva P2 (conhecimentos específicos)", portalUrl: "https://www.cebraspe.org.br/concursos/trt10_24", examDate: "2025-03-16", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "TRT-10 2024 — caderno da prova objetiva P2 (conhecimentos específicos) — Cargo 12", url: "https://cdn.cebraspe.org.br/concursos/TRT10_24/arquivos/050_TRT10_012_01.pdf" },
      { type: "answer_key", title: "TRT-10 2024 — gabarito definitivo da prova objetiva P2 — Cargo 12", url: "https://cdn.cebraspe.org.br/concursos/TRT10_24/arquivos/Gab_Definitivo_050_TRT10_012_01.pdf" },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Só os conhecimentos específicos do Cargo 12 (P2, 70 itens Certo/Errado); os conhecimentos básicos (P1) têm disciplinas com exceções por cargo e ficam para revisão própria.", "Itens agrupados pelo número de primeiro nível.", "Edital consolidado até o Edital nº 6; nenhuma retificação de programa.", "O produto cobre Analista e Técnico; esta admissão cobre só o Analista Judiciário – Área Judiciária.", "Treino histórico da objetiva com legislação atual."],
  },
  // PGE-AL 2026 — Procurador do Estado (1ª Classe): objetiva P1, 100 questões A–E.
  {
    productSlug: "pge-al-procurador-do-estado-reta-final", institution: "Procuradoria-Geral do Estado de Alagoas", role: "Procurador do Estado – 1ª Classe",
    jurisdiction: "AL", cycle: "Edital nº 1 – PGE/AL, de 31/03/2026", bankScope: "Cebraspe, executor do concurso e responsável pelas provas objetiva e discursivas, sob a PGE/AL e a SEPLAG/AL",
    portalUrl: "https://www.cebraspe.org.br/concursos/pge_al_26", examDate: "2026-09-05", examDateEvidence: { documentKey: "pgeal-notice", page: 50, item: "Anexo I", quote: "Aplicação das provas objetivas 5/9/2026", actualDayIndependentlyVerified: false, corroboratingUrl: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/E30405D8FA2DE9B7FB3214F56781A2A33187C7F96567C12916CEF4940FDB29AC.pdf", limitation: "O texto do gabarito não é extraído (política de material de prova); a API oficial publicou o caderno P1 em 25/09/2026 e o gabarito definitivo em 20/10/2026, compatíveis com a data do cronograma." },
    stage: "Objetiva com gabarito definitivo e resultado final (Edital nº 12, 20/10/2026); discursivas com resultado final e convocação para a oral (Edital nº 13, 19/11/2026)",
    stageObservedOn: "2026-11-19", proposedMode: "historical_training", expectedSubjects: 11,
    documents: [
      { key: "pgeal-notice", url: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/0C284DE63B81A961F93A4CE27711AF9109B61CE570945D18A8B6F64252D282E3.pdf", title: "Edital nº 1 – PGE/AL, de 31/03/2026 — abertura, versão atualizada até o Edital nº 11, de 23/09/2026", pages: 51, programmePages: [41, 48], layout: {
        headings: [
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo", inline: true, inlineSeparator: ":" },
          { line: "DIREITO AMBIENTAL", subject: "Direito Ambiental", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CIVIL", subject: "Direito Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional", inline: true, inlineSeparator: ":" },
          { line: "DIREITO DO TRABALHO", subject: "Direito do Trabalho", inline: true, inlineSeparator: ":" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial", inline: true, inlineSeparator: ":" },
          { line: "DIREITO FINANCEIRO", subject: "Direito Financeiro", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL DO TRABALHO", subject: "Direito Processual do Trabalho", inline: true, inlineSeparator: ":" },
          { line: "DIREITO TRIBUTÁRIO", subject: "Direito Tributário", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["\\(Retificado por meio do Edital nº 3 – PGE/AL, de 6 de maio de 2026, disponível no endereço eletrônico", "http://www\\.cebraspe\\.org\\.br/concursos/pge_al_26\\)",
          // Assinatura do edital, depois do último título.
          "JÚLIA CAROLINA BARROS CASADO BELTRÃO", "Secretária Interina de Estado do Planejamento, Gestão e Patrimônio"],
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "pgeal-notice", page: 1, contains: ["EDITAL Nº 1 – PGE/AL, DE 31 DE MARÇO DE 2026", "Versão atualizada até a retificação divulgada por meio do Edital nº 11 – PGE/AL, de 23 de setembro de 2026."] },
      { document: "pgeal-notice", page: 22, contains: ["múltipla escolha, com cinco opções (A, B, C, D e E)"] },
      { document: "pgeal-notice", page: 41, contains: ["17.2 CONHECIMENTOS"] },
      { document: "pgeal-notice", page: 50, contains: ["Aplicação das provas objetivas", "5/9/2026"] },
    ],
    previousExam: { cycle: "Edital nº 1/2026 — objetiva já realizada em 5/9/2026", role: "Procurador do Estado – 1ª Classe — prova objetiva P1", portalUrl: "https://www.cebraspe.org.br/concursos/pge_al_26", examDate: "2026-09-05", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PGE-AL 2026 — caderno da prova objetiva P1", url: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/E30405D8FA2DE9B7FB3214F56781A2A33187C7F96567C12916CEF4940FDB29AC.pdf" },
      { type: "answer_key", title: "PGE-AL 2026 — gabarito definitivo da prova objetiva P1", url: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/43C3F343C215B3BCA4EC0F173722CF4F373EF03D9FE757A0EED8F48A7869A341.pdf" },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Itens agrupados pelo número de primeiro nível; subitens ficam no item.", "Edital consolidado até o Edital nº 11; as exclusões do Edital nº 3 em Direito Ambiental (subtópicos 4.6, 4.7 e tópico 10, com renumeração) já estão no texto consolidado.", "Treino histórico da objetiva com legislação atual; leis e decretos estaduais de Alagoas exigem fonte oficial própria antes de vínculos."],
  },
  // PC-DF 2026 — Delegado de Polícia: objetiva P1, 120 itens Certo/Errado.
  {
    productSlug: "pc-df-delegado-de-policia-reta-final", institution: "Polícia Civil do Distrito Federal", role: "Delegado de Polícia",
    jurisdiction: "DF", cycle: "Edital nº 1 – PCDF – Delegado, de 03/02/2026", bankScope: "Cebraspe, executor das provas objetiva e discursiva, sob a Escola Superior de Polícia Civil da PCDF",
    portalUrl: "https://www.cebraspe.org.br/concursos/pc_df_26_delegado", examDate: "2026-07-05", examDateEvidence: { documentKey: "pcdf-notice", page: 86, item: "Anexo I", quote: "Aplicação das provas objetiva e discursiva 5/7/2026", actualDayIndependentlyVerified: false, corroboratingUrl: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/710BA7293977732DDD213CAE2E329E52507C348D3E446135F8978861CDA880F1.pdf", limitation: "O texto do caderno e do gabarito não é extraído (política de material de prova); a API oficial publicou o caderno P1 em 07/07/2026 e o gabarito definitivo em 10/08/2026, compatíveis com a data do cronograma." },
    stage: "Objetiva com gabarito definitivo (10/08/2026) e resultado final (Edital nº 9, 02/09/2026); prova oral com resultado final (Edital nº 13, 17/11/2026)",
    stageObservedOn: "2026-11-19", proposedMode: "historical_training", expectedSubjects: 10,
    documents: [
      { key: "pcdf-notice", url: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/0D616074EFE30F97B69C0B62003B1A66CA3330166AC50F786225B864E24A5443.pdf", title: "Edital nº 1 – PCDF – Delegado, de 03/02/2026 — abertura, versão atualizada até o Edital nº 7, de 10/07/2026", pages: 99, programmePages: [79, 84], layout: {
        headings: [
          { line: "DIREITO ADMINISTRATIVO E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Administrativo e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CONSTITUCIONAL E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Constitucional e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "DIREITO CIVIL E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Civil e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "DIREITO EMPRESARIAL E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Empresarial e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PENAL E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Penal e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "DIREITO TRIBUTÁRIO E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Tributário e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "MEDICINA LEGAL", subject: "Medicina Legal", inline: true, inlineSeparator: ":" },
          { line: "DIREITO PROCESSUAL PENAL E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Processual Penal e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "DIREITO AMBIENTAL E LEGISLAÇÃO COMPLEMENTAR", subject: "Direito Ambiental e Legislação Complementar", inline: true, inlineSeparator: ":" },
          { line: "PRIMEIROS SOCORROS", subject: "Conhecimentos do Distrito Federal, Política para Mulheres, Legislação e Noções de Primeiros Socorros", inline: true, inlineSeparator: ":" },
        ],
        ignoreLines: ["\\(Retificado por meio do Edital nº 2 – PCDF – Delegado, de 12 de março de 2026, disponível no endereço eletrônico", "http://www\\.cebraspe\\.org\\.br/concursos/pc_df_26_delegado\\)",
          // Primeira linha do último título, que continua na linha "PRIMEIROS SOCORROS: 1 …" (título inline).
          "CONHECIMENTOS DO DISTRITO FEDERAL, POLÍTICA PARA MULHERES, LEGISLAÇÃO E NOÇÕES DE",
          // Assinatura do edital, depois do último título.
          "GIANCARLOS ZULIANI"],
        itemMode: "top-level-numbers",
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "pcdf-notice", page: 1, contains: ["EDITAL Nº 1 – PCDF – DELEGADO, DE 3 DE FEVEREIRO DE 2026", "Versão atualizada até a retificação divulgada por meio do Edital nº 7 – PCDF – Delegado, de 10 de julho de 2026."] },
      { document: "pcdf-notice", page: 32, contains: ["O julgamento de cada item será CERTO ou ERRADO"] },
      { document: "pcdf-notice", page: 79, contains: ["22.2 CONHECIMENTOS"] },
      { document: "pcdf-notice", page: 84, contains: ["CONHECIMENTOS DO DISTRITO FEDERAL, POLÍTICA PARA MULHERES, LEGISLAÇÃO E NOÇÕES DE"] },
      { document: "pcdf-notice", page: 86, contains: ["Aplicação das provas objetiva e discursiva", "5/7/2026"] },
    ],
    previousExam: { cycle: "Edital nº 1/2026 — objetiva já realizada em 5/7/2026", role: "Delegado de Polícia — prova objetiva P1", portalUrl: "https://www.cebraspe.org.br/concursos/pc_df_26_delegado", examDate: "2026-07-05", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "PC-DF 2026 Delegado — caderno da prova objetiva P1", url: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/710BA7293977732DDD213CAE2E329E52507C348D3E446135F8978861CDA880F1.pdf" },
      { type: "answer_key", title: "PC-DF 2026 Delegado — gabarito definitivo da prova objetiva P1", url: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/793E15AB2B5B357F2DD614A0ACAEE093B9DFE97618931164855D005CDFF89841.pdf" },
    ] },
    skipRepeatedRequirements: true,
    limitations: ["Itens agrupados pelo número de primeiro nível; as partes \"I\" (disciplina) e \"II\" (legislação complementar) de cada bloco ficam na mesma disciplina.", "O último título ocupa duas linhas no PDF; a primeira é tratada como cabeçalho e a disciplina abre na linha \"PRIMEIROS SOCORROS:\".", "Edital consolidado até o Edital nº 7; a retificação de Direito Constitucional e Legislação Complementar e a renumeração de Medicina Legal (Edital nº 2) já estão no texto.", "Treino histórico da objetiva com legislação atual; Lei Orgânica e normas do DF exigem fonte oficial própria antes de vínculos."],
  },
  // TST / Magistratura do Trabalho como pré-edital (decisão de 25/11/2026): sem edital novo, a base é o último
  // edital oficial do mesmo cargo, o II Concurso Nacional Unificado (CSJT, FGV, Edital nº 1/2023). A admissão
  // registra a edição de referência; o modo pre_notice é gravado depois pelo operador de modo de preparação.
  {
    productSlug: "tst-magistratura-do-trabalho-pre-edital", institution: "Conselho Superior da Justiça do Trabalho", role: "Juiz(a) do Trabalho Substituto(a)",
    jurisdiction: "BR", cycle: "II Concurso Público Nacional Unificado — Edital de Abertura nº 1/2023", bankScope: "Fundação Getulio Vargas, assessoria técnica das cinco etapas (item 1.2), sob a Comissão Executiva Nacional do CSJT",
    portalUrl: "https://conhecimento.fgv.br/concursos/csjt23", examDate: "2023-05-14", examDateEvidence: { documentKey: "csjt-notice", page: 23, item: "10.1", quote: "provável de 14 de maio de 2023, com duração de 5 (cinco) horas, das 13h às 18h,", actualDayIndependentlyVerified: true, corroboratingUrl: `${FGV_FILES}csjt-gabaritos-definitivos.pdf`, limitation: null },
    stage: "Concurso encerrado: objetiva em 14/05/2023, gabarito definitivo em 22/06/2023, resultado definitivo da avaliação de títulos em 26/06/2024",
    stageObservedOn: "2026-11-25", proposedMode: "historical_training", expectedSubjects: 15,
    documents: [
      { key: "csjt-notice", url: `${FGV_FILES}csjt_edital-05-01-2023-integra-apos-a-setima-retificacao-em-17-1-2024_0_0.pdf`, title: "Edital de Abertura nº 1/2023 — II Concurso Público Nacional Unificado da Magistratura do Trabalho (CSJT), íntegra após a sétima retificação", pages: 71, programmePages: [52, 66], layout: {
        headings: [
          { line: "DIREITO INDIVIDUAL DO TRABALHO", subject: "Direito Individual do Trabalho" },
          { line: "DIREITO COLETIVO DO TRABALHO", subject: "Direito Coletivo do Trabalho" },
          { line: "DIREITO ADMINISTRATIVO", subject: "Direito Administrativo" },
          { line: "DIREITO PENAL", subject: "Direito Penal" },
          { line: "NOÇÕES GERAIS DE DIREITO E FORMAÇÃO HUMANÍSTICA", subject: "Noções Gerais de Direito e Formação Humanística" },
          { line: "DIREITO PROCESSUAL DO TRABALHO", subject: "Direito Processual do Trabalho" },
          { line: "DIREITO CONSTITUCIONAL", subject: "Direito Constitucional" },
          { line: "DIREITO CONSTITUCIONAL DO TRABALHO", subject: "Direito Constitucional do Trabalho" },
          { line: "DIREITO CIVIL", subject: "Direito Civil" },
          { line: "DIREITO DA CRIANÇA, DO ADOLESCENTE E DO JOVEM", subject: "Direito da Criança, do Adolescente e do Jovem" },
          { line: "DIREITO PROCESSUAL CIVIL", subject: "Direito Processual Civil" },
          { line: "DIREITO INTERNACIONAL E COMUNITÁRIO", subject: "Direito Internacional e Comunitário" },
          { line: "DIREITO PREVIDENCIÁRIO", subject: "Direito Previdenciário" },
          { line: "DIREITO EMPRESARIAL", subject: "Direito Empresarial" },
          { line: "DIREITOS HUMANOS E DIREITOS HUMANOS SOCIAIS", subject: "Direitos Humanos e Direitos Humanos Sociais" },
        ],
        ignoreLines: ["CONSELHO SUPERIOR DA JUSTIÇA DO TRABALHO \\| CONCURSO PÚBLICO 2023 \\d+", "BLOCO (?:I|II|III)"],
        // Marcador gráfico (U+F034) colado a cada título de disciplina no PDF.
        removeLiterals: ["\uF034"],
        startLine: "CARGO: JUIZ(A) DO TRABALHO SUBSTITUTO(A)",
        // "182 e Recomendação 190, …" continua o item 9 de Direitos Humanos (Convenção 182 da OIT), não abre item.
        continuationLines: ["182 e Recomendação 190, sobre as piores formas de trabalho infantil, da Organização Internacional"],
      } },
    ],
    overlays: [],
    identityClaims: [
      { document: "csjt-notice", page: 1, contains: ["II CONCURSO PÚBLICO NACIONAL UNIFICADO PARA INGRESSO NA", "EDITAL DE ABERTURA Nº 1/2023", "cargos de Juiz(a) do Trabalho Substituto(a), com base nas instruções constantes da Resolução", "Trabalho será realizado pelo Conselho Superior da Justiça do Trabalho, com a adesão de", "a assessoria da Fundação Getulio Vargas, doravante"] },
      { document: "csjt-notice", page: 23, contains: ["10.1 A Prova Objetiva Seletiva, de caráter eliminatório e classificatório, será realizada na data"] },
      { document: "csjt-notice", page: 24, contains: ["10.6 A Prova Objetiva Seletiva será composta por 100 (cem) questões de múltipla escolha,"] },
      { document: "csjt-notice", page: 52, contains: ["ANEXO II - CONTEÚDO PROGRAMÁTICO", "CARGO: JUIZ(A) DO TRABALHO SUBSTITUTO(A)"] },
    ],
    previousExam: { cycle: "II CNU da Magistratura do Trabalho — Edital nº 1/2023, objetiva em 14/05/2023", role: "Juiz(a) do Trabalho Substituto(a) — prova objetiva seletiva", portalUrl: "https://conhecimento.fgv.br/concursos/csjt23", examDate: "2023-05-14", answerKeyFinality: "definitive_document", documents: [
      { type: "question_booklet", title: "CSJT 2023 — caderno Tipo 1 da prova objetiva seletiva — Juiz(a) do Trabalho Substituto(a)", url: `${FGV_FILES}juiza-do-trabalho-substitutoajuiz-substituto-tipo-1.pdf` },
      { type: "answer_key", title: "CSJT 2023 — gabarito oficial definitivo da prova objetiva seletiva (22/06/2023)", url: `${FGV_FILES}csjt-gabaritos-definitivos.pdf` },
    ] },
    // O anexo repete itens literais em mais de uma disciplina; a fonte guarda a primeira ocorrência.
    skipRepeatedRequirements: true,
    limitations: ["Pré-edital: o programa é o do último edital oficial (II CNU, Edital nº 1/2023) e será conferido e atualizado quando o novo edital sair.", "O edital limita a cobrança à legislação vigente na publicação (jan/2023); o treino usa a legislação atual.", "Itens numerados de primeiro nível; a linha seguinte continua o item.", "Direito Individual, Coletivo e Constitucional do Trabalho são títulos próprios do anexo, sem equivalência automática no catálogo de disciplinas.", "Treino da objetiva com legislação atual; não simula as provas escritas, a oral nem os títulos."],
  },
];

function normalized(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim(); }
/** `start` (só nos modos `itemMode`) diz se o fragmento abre um requisito; ausente, vale a numeração. */
export type ProgrammeSection = Readonly<{ subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: readonly Readonly<{ page: number; text: string; start?: boolean }>[] }>;

function extractLayoutSections(recipe: PreviewDocumentRecipe, layout: ProgrammeLayout, capture: Pick<CapturedOfficialDocument, "documentUrl" | "checksumSha256" | "pageTexts">): readonly ProgrammeSection[] {
  const ignore = layout.ignoreLines.map((source) => new RegExp(`^(?:${source})$`, "u"));
  const headings = layout.headings.map((heading) => ({ ...heading, key: normalized(heading.line) }));
  if (new Set(headings.map((heading) => heading.key)).size !== headings.length) throw new Error("Títulos de disciplina repetidos no layout.");
  const sections: { subject: string; documentKey: string; checksumSha256: string; sourceUrl: string; fragments: { page: number; text: string; start?: boolean }[] }[] = [];
  let current: (typeof sections)[number] | null = null;
  let expectedContinuation: string | null = null;
  // Anexo com vários cargos: a extração termina na linha literal que abre o cargo seguinte.
  const stopKey = layout.stopLine ? normalized(layout.stopLine) : null;
  // Anexo com vários cargos na mesma página: o cargo começa na linha literal que o abre.
  const startKey = layout.startLine ? normalized(layout.startLine) : null;
  let started = startKey === null;
  let stopped = false;
  let continuesNext = false;
  let sentenceEnded = false;
  const [start, end] = recipe.programmePages!;
  pages: for (let index = start - 1; index < end; index += 1) {
    for (const raw of capture.pageTexts[index].split(/\n+/u)) {
      let line = raw.replace(/\s+/g, " ").trim();
      for (const literal of layout.removeLiterals ?? []) line = line.split(literal).join(" ").replace(/\s+/g, " ").trim();
      if (!line) continue;
      if (!started) { started = normalized(line) === startKey; continue; }
      if (stopKey !== null && current && normalized(line) === stopKey) { stopped = true; break pages; }
      if (expectedContinuation !== null) {
        if (normalized(line) !== expectedContinuation) throw new Error("Continuação do título de disciplina diverge do layout.");
        expectedContinuation = null;
        continue;
      }
      if (ignore.some((pattern) => pattern.test(line))) continue;
      // Com ":" o PDF às vezes cola o conteúdo ("TECNOLOGIA DA INFORMAÇÃO:1 Fluência…"); com "." o espaço é obrigatório.
      const inlineHeading = headings.find((item) => item.inline && line.startsWith(`${item.line}${item.inlineSeparator === ":" ? ":" : ". "}`));
      const heading = inlineHeading ?? headings.find((item) => !item.inline && item.key === normalized(line));
      if (heading) {
        if (sections.length !== headings.indexOf(heading)) throw new Error("Título de disciplina fora da ordem do layout.");
        current = { subject: heading.subject, documentKey: recipe.key, checksumSha256: capture.checksumSha256, sourceUrl: capture.documentUrl, fragments: [] };
        sections.push(current);
        continuesNext = false; sentenceEnded = false;
        expectedContinuation = heading.continuation ? normalized(heading.continuation) : null;
        if (!inlineHeading) continue;
      }
      if (!current) continue;
      if (inlineHeading && current.fragments.length === 0) { line = line.slice(inlineHeading.line.length + 1).trimStart(); if (!line) continue; }
      if (layout.itemMode === "top-level-numbers") {
        // "1 Tema. 1.1 Subtema. 2 Tema." (estilo Cebraspe/FGV corrido): só o número de primeiro
        // nível abre item; subitens continuam no item. Número isolado no fim da linha abre a seguinte.
        const trailing = /\s(\d{1,2})$/u.exec(line);
        const body = trailing ? line.slice(0, trailing.index) : line;
        body.split(/\s+(?=\d{1,2} [A-ZÀ-Ö])/u).forEach((part, partIndex) => {
          const opens = !current!.fragments.length || (partIndex === 0 && continuesNext ? false : /^\d{1,2} [A-ZÀ-Ö]/u.test(part));
          current!.fragments.push({ page: index + 1, text: part, start: opens });
        });
        continuesNext = false;
        if (trailing) { current.fragments.push({ page: index + 1, text: trailing[1], start: true }); continuesNext = true; }
        continue;
      }
      if (layout.itemMode === "second-level-numbers") {
        // "1.1 Tema. 1.1.1 Sub. 1.2 Tema." (título numerado inline): o número de segundo nível abre
        // item e os de terceiro nível continuam nele. Número isolado no fim da linha abre a seguinte.
        const trailing = /\s(\d{1,2}\.\d{1,2}\.?)$/u.exec(line);
        const body = trailing ? line.slice(0, trailing.index) : line;
        body.split(/\s+(?=\d{1,2}\.\d{1,2}\.?\s+[A-ZÀ-Ö])/u).forEach((part, partIndex) => {
          const opens = !current!.fragments.length || (partIndex === 0 && continuesNext ? false : /^\d{1,2}\.\d{1,2}\.?\s+[A-ZÀ-Ö]/u.test(part));
          current!.fragments.push({ page: index + 1, text: part, start: opens });
        });
        continuesNext = false;
        if (trailing) { current.fragments.push({ page: index + 1, text: trailing[1], start: true }); continuesNext = true; }
        continue;
      }
      if (layout.itemMode === "sentences") {
        // Programa em prosa sem numeração: cada período literal ("… . Próximo") é um item;
        // a quebra de linha só encerra o item quando a linha termina em ponto final.
        line.split(/(?<=\.)\s+(?=[A-ZÀ-Ö])/u).forEach((part, partIndex) => {
          current!.fragments.push({ page: index + 1, text: part, start: !current!.fragments.length || partIndex > 0 || sentenceEnded });
        });
        sentenceEnded = /\.$/u.test(line);
        continue;
      }
      if (layout.continuationLines?.includes(line)) { current.fragments.push({ page: index + 1, text: line, start: false }); continue; }
      const parts = layout.splitInlineItems ? line.split(/\s+(?=\d{1,2}\.(?:\s+[A-ZÀ-Ö]|$))/u) : [line];
      for (const part of parts) {
        // Número de item isolado no fim da linha ("3.") abre o item da linha seguinte.
        const last = current.fragments.at(-1);
        if (layout.splitInlineItems && last && /^\d{1,2}\.$/u.test(last.text)) last.text = `${last.text} ${part}`;
        else current.fragments.push({ page: index + 1, text: part });
      }
    }
  }
  if (!started) throw new Error("Linha inicial do cargo ausente; composição bloqueada.");
  if (stopKey !== null && !stopped) throw new Error("Linha final do cargo ausente; composição bloqueada.");
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
