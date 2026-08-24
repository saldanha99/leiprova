import type { QuizBankSlug } from "@/lib/quiz/catalog";

export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION = "constitutional-original-pilot-v1";
export const ORIGINAL_STYLE_PILOT_GENERATOR = "OpenAI Codex";

type PilotQuestionOption = {
  readonly key: string;
  readonly text: string;
  readonly isCorrect: boolean;
  readonly rationale: string;
};

export type PilotOriginalQuestion = {
  readonly publicId: string;
  readonly bankSlug: QuizBankSlug;
  readonly articleRef: string;
  readonly type: "multiple_choice" | "true_false";
  readonly prompt: string;
  readonly explanation: string;
  readonly learningObjective: string;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly options: readonly PilotQuestionOption[];
};

/**
 * Lote inicial inteiramente autoral, criado somente a partir dos artigos oficiais
 * já revisados na biblioteca. O seed registra estes itens como rascunhos de IA:
 * nenhum deles é publicado ou atribuído a uma pessoa antes da assunção editorial.
 */
export const PILOT_ORIGINAL_QUESTIONS = [
  {
    publicId: "fed46abe-967f-46c8-8a3f-3e7ce4bbbd09",
    bankSlug: "vunesp",
    articleRef: "Art. 5º, IV",
    type: "multiple_choice",
    prompt:
      "Bruno pretende publicar uma crítica política em um canal aberto de participação social, mas exige que sua identidade permaneça desconhecida. Considerando exclusivamente o art. 5º, IV, da Constituição Federal, assinale a conclusão correta.",
    explanation:
      "O art. 5º, IV, assegura a livre manifestação do pensamento e, simultaneamente, veda o anonimato. Portanto, a proteção à manifestação não inclui o direito de ocultar a autoria.",
    learningObjective:
      "Distinguir a liberdade de manifestação do pensamento da vedação constitucional ao anonimato.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "A crítica depende de autorização prévia da autoridade responsável pelo canal.",
        isCorrect: false,
        rationale: "O dispositivo não condiciona a manifestação a autorização prévia.",
      },
      {
        key: "B",
        text: "A manifestação é livre, mas a Constituição veda que ela seja anônima.",
        isCorrect: true,
        rationale: "A alternativa reúne os dois comandos expressos no inciso IV.",
      },
      {
        key: "C",
        text: "O anonimato é permitido quando a manifestação tratar de tema político.",
        isCorrect: false,
        rationale: "O inciso IV não cria essa exceção temática.",
      },
      {
        key: "D",
        text: "A manifestação somente é livre quando não houver crítica a agente público.",
        isCorrect: false,
        rationale: "Essa limitação não consta do dispositivo usado como fonte.",
      },
      {
        key: "E",
        text: "A Constituição protege o anonimato, mas permite censura posterior da crítica.",
        isCorrect: false,
        rationale: "A assertiva inverte a vedação expressa ao anonimato.",
      },
    ],
  },
  {
    publicId: "853cbb02-eff7-4c77-b928-863f30c2f941",
    bankSlug: "fgv",
    articleRef: "Art. 5º, IX",
    type: "multiple_choice",
    prompt:
      "Uma lei municipal passou a exigir licença prévia para que autores divulguem, em meios digitais, obras artísticas produzidas no território local. À luz apenas do art. 5º, IX, da Constituição Federal, a medida é",
    explanation:
      "O art. 5º, IX, declara livre a expressão das atividades intelectual, artística, científica e de comunicação, independentemente de censura ou licença. A licença descrita incide sobre a própria divulgação artística e contraria esse comando.",
    learningObjective:
      "Aplicar a independência de censura ou licença à expressão intelectual, artística, científica e comunicacional.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "compatível, porque a liberdade constitucional alcança apenas atividade científica.",
        isCorrect: false,
        rationale: "O inciso também protege expressamente a atividade artística.",
      },
      {
        key: "B",
        text: "compatível, desde que a licença não seja acompanhada de censura do conteúdo.",
        isCorrect: false,
        rationale: "A norma afasta tanto a censura quanto a licença.",
      },
      {
        key: "C",
        text: "compatível, porque o meio digital não está abrangido pela atividade de comunicação.",
        isCorrect: false,
        rationale: "O dispositivo não exclui a comunicação realizada por meio digital.",
      },
      {
        key: "D",
        text: "incompatível, porque a expressão artística é livre independentemente de censura ou licença.",
        isCorrect: true,
        rationale: "É a consequência direta do comando constitucional selecionado.",
      },
      {
        key: "E",
        text: "incompatível somente se a obra também tiver finalidade científica.",
        isCorrect: false,
        rationale: "As atividades protegidas são alternativas, não requisitos cumulativos.",
      },
    ],
  },
  {
    publicId: "442bf4a3-577e-4aad-817a-127fb21a401a",
    bankSlug: "fcc",
    articleRef: "Art. 5º, XXXV",
    type: "multiple_choice",
    prompt:
      "Ao registrar o alcance do princípio da inafastabilidade da jurisdição, uma equipe deve adotar a formulação que corresponde ao art. 5º, XXXV, da Constituição Federal. Essa formulação estabelece que",
    explanation:
      "O inciso XXXV impede a lei de excluir da apreciação do Poder Judiciário tanto uma lesão já ocorrida quanto uma ameaça a direito.",
    learningObjective:
      "Reconhecer o alcance objetivo e institucional da garantia de acesso ao Poder Judiciário.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito.",
        isCorrect: true,
        rationale: "A alternativa preserva o Poder competente e as duas situações protegidas.",
      },
      {
        key: "B",
        text: "a lei não excluirá da apreciação do Poder Judiciário apenas a lesão consumada a direito.",
        isCorrect: false,
        rationale: "A ameaça a direito também está expressamente abrangida.",
      },
      {
        key: "C",
        text: "a administração não excluirá da apreciação do Poder Legislativo lesão ou ameaça a direito.",
        isCorrect: false,
        rationale: "O dispositivo se refere à lei e ao Poder Judiciário.",
      },
      {
        key: "D",
        text: "a lei poderá excluir ameaça a direito quando ainda não houver lesão comprovada.",
        isCorrect: false,
        rationale: "A ameaça é protegida de modo expresso, sem essa condição.",
      },
      {
        key: "E",
        text: "o Poder Judiciário não apreciará lesão que possa ser resolvida administrativamente.",
        isCorrect: false,
        rationale: "Essa limitação não integra o inciso usado como fonte.",
      },
    ],
  },
  {
    publicId: "199fca09-87a6-404f-9f08-10086dfd0ace",
    bankSlug: "cebraspe",
    articleRef: "Art. 37, caput",
    type: "true_false",
    prompt:
      "Julgue o item: a observância dos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência limita-se à administração direta do Poder Executivo da União.",
    explanation:
      "O item está errado. O art. 37, caput, alcança a administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios.",
    learningObjective:
      "Identificar o alcance subjetivo e federativo dos princípios constitucionais da administração pública.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A assertiva restringe indevidamente o alcance do caput." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O caput inclui administração direta e indireta de todos os Poderes e entes indicados." },
    ],
  },
  {
    publicId: "c8440197-2fc7-43ff-a3f8-9f58bec408e6",
    bankSlug: "vunesp",
    articleRef: "Art. 37, II",
    type: "multiple_choice",
    prompt:
      "Um município pretende preencher um cargo efetivo sem concurso e, ao mesmo tempo, nomear livremente pessoa para cargo em comissão assim declarado em lei. Segundo o art. 37, II, da Constituição Federal, é correto afirmar que",
    explanation:
      "A investidura em cargo ou emprego público depende de aprovação prévia em concurso de provas ou de provas e títulos, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração.",
    learningObjective:
      "Diferenciar a regra do concurso público da ressalva constitucional relativa aos cargos em comissão.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "ambas as nomeações independem de concurso, desde que haja previsão em decreto municipal.",
        isCorrect: false,
        rationale: "A regra constitucional exige concurso para o cargo efetivo e menciona declaração em lei para o cargo em comissão.",
      },
      {
        key: "B",
        text: "ambas as nomeações exigem concurso público exclusivamente de provas.",
        isCorrect: false,
        rationale: "A ressalva alcança o cargo em comissão e o concurso pode ser de provas ou de provas e títulos.",
      },
      {
        key: "C",
        text: "o cargo efetivo exige aprovação prévia em concurso, enquanto o cargo em comissão descrito está abrangido pela ressalva constitucional.",
        isCorrect: true,
        rationale: "A alternativa aplica corretamente a regra e a ressalva do inciso II.",
      },
      {
        key: "D",
        text: "o cargo efetivo admite concurso posterior à investidura, e o cargo em comissão exige concurso prévio.",
        isCorrect: false,
        rationale: "A aprovação deve ser prévia e a ressalva opera no sentido oposto.",
      },
      {
        key: "E",
        text: "o cargo efetivo exige concurso apenas quando sua complexidade for elevada.",
        isCorrect: false,
        rationale: "Natureza e complexidade orientam o concurso, mas não eliminam a exigência.",
      },
    ],
  },
  {
    publicId: "49817eae-a9a2-4b1a-aea3-c6ed16f573e3",
    bankSlug: "fgv",
    articleRef: "Art. 37, III",
    type: "multiple_choice",
    prompt:
      "O edital de um concurso fixou prazo de validade de dezoito meses e previu uma única prorrogação por doze meses. Considerando apenas o art. 37, III, da Constituição Federal, a previsão é",
    explanation:
      "O prazo inicial de dezoito meses está dentro do máximo constitucional de dois anos. Contudo, caso haja prorrogação, ela somente pode ocorrer uma vez e deve ter período igual ao prazo inicial, isto é, dezoito meses.",
    learningObjective:
      "Aplicar os limites de duração, frequência e equivalência temporal da prorrogação de concurso público.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "integralmente válida, pois qualquer prorrogação inferior a dois anos é permitida.",
        isCorrect: false,
        rationale: "A prorrogação deve ter período igual ao prazo inicial.",
      },
      {
        key: "B",
        text: "inválida apenas porque o prazo inicial deveria ser exatamente de dois anos.",
        isCorrect: false,
        rationale: "A Constituição estabelece prazo de até dois anos, não prazo fixo.",
      },
      {
        key: "C",
        text: "válida se forem autorizadas duas prorrogações sucessivas de doze meses.",
        isCorrect: false,
        rationale: "O dispositivo permite uma única prorrogação.",
      },
      {
        key: "D",
        text: "integralmente inválida, porque nenhum concurso pode ter validade inferior a dois anos.",
        isCorrect: false,
        rationale: "O prazo de dois anos é máximo, não mínimo.",
      },
      {
        key: "E",
        text: "parcialmente incompatível, pois a única prorrogação admitida deve repetir os dezoito meses do prazo inicial.",
        isCorrect: true,
        rationale: "A resposta preserva o prazo inicial e corrige a exigência de igual período.",
      },
    ],
  },
  {
    publicId: "5869f68d-88cc-4624-bf5d-2f77ce0a7f1a",
    bankSlug: "fcc",
    articleRef: "Art. 41, caput",
    type: "multiple_choice",
    prompt:
      "De acordo com o art. 41, caput, da Constituição Federal, a estabilidade ali prevista é adquirida por servidores que reúnam, cumulativamente,",
    explanation:
      "O caput do art. 41 combina três elementos: três anos de efetivo exercício, nomeação para cargo de provimento efetivo e ingresso em virtude de concurso público.",
    learningObjective:
      "Reconhecer os elementos cumulativos expressamente associados à estabilidade constitucional do servidor.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "dois anos de exercício, cargo efetivo e processo seletivo simplificado.",
        isCorrect: false,
        rationale: "O prazo é de três anos e a fonte exige concurso público.",
      },
      {
        key: "B",
        text: "três anos de efetivo exercício, cargo de provimento efetivo e nomeação em virtude de concurso público.",
        isCorrect: true,
        rationale: "A alternativa contém os três elementos previstos no caput.",
      },
      {
        key: "C",
        text: "três anos de exercício, cargo em comissão e nomeação de livre escolha.",
        isCorrect: false,
        rationale: "Cargo em comissão não corresponde ao cargo efetivo descrito.",
      },
      {
        key: "D",
        text: "quatro anos de efetivo exercício, qualquer cargo público e aprovação interna.",
        isCorrect: false,
        rationale: "Prazo, tipo de cargo e forma de ingresso divergem da fonte.",
      },
      {
        key: "E",
        text: "três anos desde a nomeação, ainda que não haja efetivo exercício ou concurso público.",
        isCorrect: false,
        rationale: "A fonte exige efetivo exercício e nomeação em virtude de concurso.",
      },
    ],
  },
  {
    publicId: "525da577-bfab-4ac5-9716-ae50c89fe17a",
    bankSlug: "cebraspe",
    articleRef: "Art. 41, § 1º, III",
    type: "true_false",
    prompt:
      "Julgue o item: o servidor público estável pode perder o cargo mediante procedimento de avaliação periódica de desempenho, na forma de lei ordinária, desde que lhe seja assegurada ampla defesa.",
    explanation:
      "O item está errado porque o art. 41, § 1º, III, exige que o procedimento de avaliação periódica de desempenho seja disciplinado na forma de lei complementar, além de assegurar ampla defesa.",
    learningObjective:
      "Distinguir a espécie normativa exigida para a perda do cargo por avaliação periódica de desempenho.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A referência à lei ordinária torna a assertiva incorreta." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O dispositivo exige lei complementar." },
    ],
  },
  {
    publicId: "c3c87f4f-b486-4afb-90bc-10a668fb3d77",
    bankSlug: "vunesp",
    articleRef: "Art. 84, II",
    type: "multiple_choice",
    prompt:
      "Ao organizar a direção superior da administração federal, qual solução corresponde à atribuição presidencial prevista no art. 84, II, da Constituição Federal?",
    explanation:
      "O inciso II atribui ao Presidente da República o exercício da direção superior da administração federal com o auxílio dos Ministros de Estado.",
    learningObjective:
      "Identificar o titular e a forma de exercício da direção superior da administração federal.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "Transferir integralmente a direção superior ao Congresso Nacional.",
        isCorrect: false,
        rationale: "A atribuição indicada é presidencial.",
      },
      {
        key: "B",
        text: "Exercer a direção superior sem qualquer participação dos Ministros de Estado.",
        isCorrect: false,
        rationale: "O texto constitucional menciona o auxílio dos Ministros de Estado.",
      },
      {
        key: "C",
        text: "Limitar a direção superior à administração estadual e municipal.",
        isCorrect: false,
        rationale: "O dispositivo trata da administração federal.",
      },
      {
        key: "D",
        text: "Exercer, com o auxílio dos Ministros de Estado, a direção superior da administração federal.",
        isCorrect: true,
        rationale: "A alternativa preserva sujeito, auxílio e âmbito previstos no inciso.",
      },
      {
        key: "E",
        text: "Submeter a direção superior à autorização prévia do Poder Judiciário.",
        isCorrect: false,
        rationale: "Essa condição não consta do dispositivo selecionado.",
      },
    ],
  },
  {
    publicId: "0a04d70b-ae85-4015-9468-bf0a93bd120d",
    bankSlug: "fgv",
    articleRef: "Art. 84, IV",
    type: "multiple_choice",
    prompt:
      "Após a publicação de uma lei federal, o Presidente da República avalia a edição de atos destinados a permitir sua execução fiel. Com base apenas no art. 84, IV, da Constituição Federal, compete-lhe",
    explanation:
      "O art. 84, IV, prevê, entre outras ações, a expedição de decretos e regulamentos para a fiel execução das leis.",
    learningObjective:
      "Reconhecer a finalidade constitucional dos decretos e regulamentos expedidos pelo Presidente da República.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "expedir decretos e regulamentos para a fiel execução da lei.",
        isCorrect: true,
        rationale: "A alternativa corresponde à finalidade expressa no inciso IV.",
      },
      {
        key: "B",
        text: "expedir resoluções para substituir integralmente a lei publicada.",
        isCorrect: false,
        rationale: "O inciso não prevê substituição da lei por resolução.",
      },
      {
        key: "C",
        text: "suspender a lei até que o Poder Judiciário aprove seu regulamento.",
        isCorrect: false,
        rationale: "Essa condição não consta da atribuição constitucional indicada.",
      },
      {
        key: "D",
        text: "editar regulamentos independentes da execução da lei.",
        isCorrect: false,
        rationale: "A fonte vincula os atos à fiel execução das leis.",
      },
      {
        key: "E",
        text: "promulgar apenas a lei, ficando vedada a expedição de decretos.",
        isCorrect: false,
        rationale: "O inciso autoriza expressamente decretos e regulamentos.",
      },
    ],
  },
  {
    publicId: "92f2a0a3-b3eb-40f5-8fd8-b178c8f6334d",
    bankSlug: "fcc",
    articleRef: "Art. 144, caput",
    type: "multiple_choice",
    prompt:
      "Na formulação constitucional da segurança pública prevista no art. 144, caput, a relação entre dever, direito, responsabilidade e finalidade está corretamente expressa em:",
    explanation:
      "O caput do art. 144 define a segurança pública como dever do Estado, direito e responsabilidade de todos, exercida para preservar a ordem pública e a incolumidade das pessoas e do patrimônio.",
    learningObjective:
      "Relacionar os sujeitos e as finalidades que estruturam a segurança pública no texto constitucional.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "dever de todos, direito exclusivo do Estado e finalidade limitada à proteção patrimonial.",
        isCorrect: false,
        rationale: "A alternativa troca os sujeitos e reduz indevidamente a finalidade.",
      },
      {
        key: "B",
        text: "dever dos Municípios, responsabilidade da União e finalidade de defesa nacional.",
        isCorrect: false,
        rationale: "Esses sujeitos e essa finalidade não correspondem ao caput.",
      },
      {
        key: "C",
        text: "dever do Estado, direito e responsabilidade de todos, com preservação da ordem pública e da incolumidade das pessoas e do patrimônio.",
        isCorrect: true,
        rationale: "A alternativa conserva todos os elementos relevantes do dispositivo.",
      },
      {
        key: "D",
        text: "direito do Estado, dever dos agentes policiais e responsabilidade facultativa da sociedade.",
        isCorrect: false,
        rationale: "A distribuição constitucional dos papéis foi alterada.",
      },
      {
        key: "E",
        text: "responsabilidade exclusiva da União, destinada apenas à preservação da ordem pública.",
        isCorrect: false,
        rationale: "Não há exclusividade da União, e a finalidade é mais ampla.",
      },
    ],
  },
  {
    publicId: "e86dc46a-8b53-4565-aa09-6bd043374c12",
    bankSlug: "cebraspe",
    articleRef: "Art. 144, § 5º",
    type: "true_false",
    prompt:
      "Julgue o item: às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.",
    explanation:
      "O item está certo e reproduz os dois núcleos de atribuições estabelecidos no art. 144, § 5º, da Constituição Federal.",
    learningObjective:
      "Diferenciar as atribuições constitucionais das polícias militares e dos corpos de bombeiros militares.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "A assertiva corresponde integralmente ao § 5º." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "Não há alteração de sujeito, atribuição ou condição no item." },
    ],
  },
] as const satisfies readonly PilotOriginalQuestion[];
