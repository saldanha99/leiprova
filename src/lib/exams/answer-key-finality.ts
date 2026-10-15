// Política de finalidade do gabarito de uma prova anterior **externa**.
//
// Duas formas de evidência final são reconhecidas:
//
// 1. `definitive_document` — a organizadora publicou um gabarito oficial
//    definitivo autônomo (caso MPMT 01/2026, PGE-AC VIII/2026, MPRJ XXXVIII/2025).
// 2. `preliminary_plus_maintenance_act` — não existe gabarito definitivo
//    autônomo, e a finalidade se comprova por dois documentos oficiais: o
//    gabarito preliminar e o ato da comissão que, julgados os recursos, mantém
//    **todos** os gabaritos (caso MPRJ XXXIX/2026, cujo edital não prevê a
//    publicação de novos gabaritos).
//
// Este módulo é política pura: não acessa banco, rede ou arquivo, não decide
// licença, publicação, liberação comercial nem revisão humana, e não integra
// nenhum operador. Ele apenas recusa, de forma fechada, composições de
// evidência que não se sustentam.
//
// Limites conhecidos desta versão estão no final do arquivo.

export const ANSWER_KEY_FINALITIES = [
  "definitive_document",
  "preliminary_plus_maintenance_act",
] as const;
export type AnswerKeyFinality = (typeof ANSWER_KEY_FINALITIES)[number];

/** Papel de cada documento dentro do conjunto de evidência. */
export const ANSWER_KEY_EVIDENCE_ROLES = [
  "question_booklet",
  "definitive_answer_key",
  "preliminary_answer_key",
  "answer_key_maintenance_act",
] as const;
export type AnswerKeyEvidenceRole = (typeof ANSWER_KEY_EVIDENCE_ROLES)[number];

/** Tipos de documento do vocabulário desta política. `answer_key_decision` é
 * proposta reversível: nenhuma tabela é alterada aqui. */
export const ANSWER_KEY_DOCUMENT_TYPES = [
  "question_booklet",
  "answer_key",
  "answer_key_decision",
] as const;
export type AnswerKeyDocumentType = (typeof ANSWER_KEY_DOCUMENT_TYPES)[number];

/** Efeitos reais que um ato de julgamento de recursos pode ter. Só o primeiro é
 * suportado; os outros são reconhecidos para que a recusa seja explícita, em vez
 * de cair em "valor desconhecido". */
export const ANSWER_KEY_DECISION_EFFECTS = [
  "all_keys_maintained",
  "keys_changed",
  "questions_annulled",
  "keys_changed_and_questions_annulled",
] as const;
export type AnswerKeyDecisionEffect =
  (typeof ANSWER_KEY_DECISION_EFFECTS)[number];

export const SUPPORTED_ANSWER_KEY_DECISION_EFFECT =
  "all_keys_maintained" satisfies AnswerKeyDecisionEffect;

const ROLE_DOCUMENT_TYPE = {
  question_booklet: "question_booklet",
  definitive_answer_key: "answer_key",
  preliminary_answer_key: "answer_key",
  answer_key_maintenance_act: "answer_key_decision",
} as const satisfies Readonly<
  Record<AnswerKeyEvidenceRole, AnswerKeyDocumentType>
>;

const REQUIRED_ROLES = {
  definitive_document: ["question_booklet", "definitive_answer_key"],
  preliminary_plus_maintenance_act: [
    "question_booklet",
    "preliminary_answer_key",
    "answer_key_maintenance_act",
  ],
} as const satisfies Readonly<
  Record<AnswerKeyFinality, readonly AnswerKeyEvidenceRole[]>
>;

// O título precisa declarar o papel do documento e não pode declarar o oposto.
// É o que impede um gabarito preliminar de ser apresentado como definitivo.
const TITLE_RULES = {
  question_booklet: { required: null, forbidden: /gabarito/u },
  definitive_answer_key: { required: /definitiv/u, forbidden: /prelimin|provis/u },
  preliminary_answer_key: { required: /prelimin|provis/u, forbidden: /definitiv/u },
  answer_key_maintenance_act: { required: /recurso|manut|mantid/u, forbidden: /definitiv/u },
} as const satisfies Readonly<
  Record<AnswerKeyEvidenceRole, { required: RegExp | null; forbidden: RegExp | null }>
>;

export type AnswerKeyEditionIdentity = Readonly<{
  publicId: string;
  institutionAcronym: string;
  jurisdictionCode: string;
  roleName: string;
  examDate: string;
  bookletVersionLabel: string;
  expectedQuestionCount: number;
}>;

export type AnswerKeyEvidenceDocument = Readonly<{
  role: AnswerKeyEvidenceRole;
  documentType: AnswerKeyDocumentType;
  editionPublicId: string;
  title: string;
  sourceUrl: string;
  publishedOn: string;
  coversBookletVersions: readonly string[];
  checksumSha256: string | null;
}>;

export type AnswerKeyMaintenanceAct = AnswerKeyEvidenceDocument &
  Readonly<{
    role: "answer_key_maintenance_act";
    decisionEffect: typeof SUPPORTED_ANSWER_KEY_DECISION_EFFECT;
    decisionLegalBasis: string;
  }>;

/** União discriminada: cada finalidade carrega exatamente os papéis que lhe
 * pertencem, e `never` impede o conjunto híbrido em tempo de compilação. */
export type AnswerKeyEvidence =
  | Readonly<{
      finality: "definitive_document";
      edition: AnswerKeyEditionIdentity;
      booklet: AnswerKeyEvidenceDocument;
      definitiveAnswerKey: AnswerKeyEvidenceDocument;
      preliminaryAnswerKey?: never;
      maintenanceAct?: never;
    }>
  | Readonly<{
      finality: "preliminary_plus_maintenance_act";
      edition: AnswerKeyEditionIdentity;
      booklet: AnswerKeyEvidenceDocument;
      definitiveAnswerKey?: never;
      preliminaryAnswerKey: AnswerKeyEvidenceDocument;
      maintenanceAct: AnswerKeyMaintenanceAct;
    }>;

export type AnswerKeyEvidenceDocumentDraft = Readonly<{
  role: string;
  documentType: string;
  editionPublicId: string;
  title: string;
  sourceUrl: string;
  publishedOn: string;
  coversBookletVersions: readonly string[];
  checksumSha256?: string | null;
  decisionEffect?: string | null;
  decisionLegalBasis?: string | null;
}>;

export type AnswerKeyEvidenceDraft = Readonly<{
  finality: string;
  edition: Readonly<{
    publicId: string;
    institutionAcronym: string;
    jurisdictionCode: string;
    roleName: string;
    examDate: string;
    bookletVersionLabel: string;
    expectedQuestionCount: number;
  }>;
  documents: readonly AnswerKeyEvidenceDocumentDraft[];
}>;

export const ANSWER_KEY_EVIDENCE_PROBLEM_CODES = [
  "finality_unknown",
  "edition_identity_invalid",
  "document_shape_invalid",
  "document_role_unknown",
  "document_type_mismatch",
  "document_edition_mismatch",
  "document_duplicated",
  "roles_incomplete",
  "roles_unexpected",
  "booklet_version_mismatch",
  "title_role_contradiction",
  "decision_fields_misplaced",
  "decision_effect_unknown",
  "decision_effect_unsupported",
  "decision_basis_missing",
  "publication_chronology_invalid",
] as const;
export type AnswerKeyEvidenceProblemCode =
  (typeof ANSWER_KEY_EVIDENCE_PROBLEM_CODES)[number];

export type AnswerKeyEvidenceReview =
  | Readonly<{ valid: true; evidence: AnswerKeyEvidence }>
  | Readonly<{
      valid: false;
      code: AnswerKeyEvidenceProblemCode;
      reason: string;
    }>;

export class AnswerKeyEvidenceError extends Error {
  readonly code: AnswerKeyEvidenceProblemCode;

  constructor(code: AnswerKeyEvidenceProblemCode, reason: string) {
    super(reason);
    this.name = "AnswerKeyEvidenceError";
    this.code = code;
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ACRONYM = /^[A-Z]{2,16}$/u;
const JURISDICTION = /^[A-Z]{2}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

function isPlainText(
  value: unknown,
  min: number,
  max: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}

/** Minúsculas sem acento: compara rótulo e título sem depender da acentuação
 * usada pela organizadora. */
function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

/** Data de calendário real; recusa 2026-02-30 e afins. */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** Link oficial externo canônico: HTTPS, sem credencial, porta, consulta ou
 * fragmento, apontando para um PDF. O domínio permitido por banca continua a
 * cargo de `official-sources/exam-registry`.
 *
 * A exigência decisiva é `url.href === value`: a cadeia recebida tem de **já
 * estar** na forma canônica do analisador de URL. Sem isso, duas formas que
 * normalizam para o mesmo recurso — espaço em volta, caixa do host, porta 443
 * explícita, segmentos `.` e `..` — passariam como documentos distintos, e a
 * deduplicação por cadeia bruta deixaria o mesmo PDF exercer dois papéis.
 * Com a exigência, igualdade bruta e igualdade canônica coincidem entre as
 * entradas aceitas, e a deduplicação por `sourceUrl` fica correta. */
function isCanonicalPdfUrl(value: unknown) {
  if (typeof value !== "string" || !value || /\s/u.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.href === value &&
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    url.pathname.toLowerCase().endsWith(".pdf")
  );
}

function isVersionLabel(value: unknown) {
  return isPlainText(value, 1, 40);
}

function problem(
  code: AnswerKeyEvidenceProblemCode,
  reason: string,
): AnswerKeyEvidenceReview {
  return { valid: false, code, reason };
}

function isFinality(value: unknown): value is AnswerKeyFinality {
  return (
    typeof value === "string" &&
    (ANSWER_KEY_FINALITIES as readonly string[]).includes(value)
  );
}

function isRole(value: unknown): value is AnswerKeyEvidenceRole {
  return (
    typeof value === "string" &&
    (ANSWER_KEY_EVIDENCE_ROLES as readonly string[]).includes(value)
  );
}

function isDecisionEffect(value: unknown): value is AnswerKeyDecisionEffect {
  return (
    typeof value === "string" &&
    (ANSWER_KEY_DECISION_EFFECTS as readonly string[]).includes(value)
  );
}

function reviewEditionIdentity(
  edition: AnswerKeyEvidenceDraft["edition"],
): AnswerKeyEvidenceReview | null {
  if (!edition || typeof edition !== "object") {
    return problem("edition_identity_invalid", "Identidade da edição ausente.");
  }
  if (typeof edition.publicId !== "string" || !SLUG.test(edition.publicId)) {
    return problem(
      "edition_identity_invalid",
      "Identificador público da edição fora do formato de slug.",
    );
  }
  if (
    typeof edition.institutionAcronym !== "string" ||
    !ACRONYM.test(edition.institutionAcronym)
  ) {
    return problem(
      "edition_identity_invalid",
      "Acrônimo do órgão precisa ter de 2 a 16 letras maiúsculas.",
    );
  }
  if (
    typeof edition.jurisdictionCode !== "string" ||
    !JURISDICTION.test(edition.jurisdictionCode)
  ) {
    return problem(
      "edition_identity_invalid",
      "Unidade federativa precisa ter exatamente duas letras maiúsculas.",
    );
  }
  if (!isPlainText(edition.roleName, 3, 200)) {
    return problem("edition_identity_invalid", "Cargo da edição ausente.");
  }
  if (!isCalendarDate(edition.examDate)) {
    return problem(
      "edition_identity_invalid",
      "Data de aplicação precisa ser uma data de calendário real.",
    );
  }
  if (!isVersionLabel(edition.bookletVersionLabel)) {
    return problem(
      "edition_identity_invalid",
      "Rótulo da versão do caderno de referência ausente.",
    );
  }
  if (
    !Number.isInteger(edition.expectedQuestionCount) ||
    edition.expectedQuestionCount < 1 ||
    edition.expectedQuestionCount > 300
  ) {
    return problem(
      "edition_identity_invalid",
      "Quantidade esperada de questões precisa ser inteiro de 1 a 300.",
    );
  }
  return null;
}

function reviewDocumentShape(
  draft: AnswerKeyEvidenceDocumentDraft,
  edition: AnswerKeyEvidenceDraft["edition"],
): AnswerKeyEvidenceReview | null {
  if (!draft || typeof draft !== "object") {
    return problem("document_shape_invalid", "Documento ausente no conjunto.");
  }
  if (!isRole(draft.role)) {
    return problem(
      "document_role_unknown",
      `Papel de documento desconhecido: ${String(draft.role)}.`,
    );
  }
  if (draft.documentType !== ROLE_DOCUMENT_TYPE[draft.role]) {
    return problem(
      "document_type_mismatch",
      `O papel ${draft.role} exige o tipo ${ROLE_DOCUMENT_TYPE[draft.role]}, não ${String(draft.documentType)}.`,
    );
  }
  if (draft.editionPublicId !== edition.publicId) {
    return problem(
      "document_edition_mismatch",
      `O documento ${draft.role} pertence a outra edição: ${String(draft.editionPublicId)}.`,
    );
  }
  if (!isPlainText(draft.title, 3, 500)) {
    return problem(
      "document_shape_invalid",
      `Título do documento ${draft.role} ausente ou fora do tamanho aceito.`,
    );
  }
  if (!isCanonicalPdfUrl(draft.sourceUrl)) {
    return problem(
      "document_shape_invalid",
      `URL do documento ${draft.role} precisa ser HTTPS canônica de PDF, sem credencial, porta, consulta ou fragmento.`,
    );
  }
  if (!isCalendarDate(draft.publishedOn)) {
    return problem(
      "document_shape_invalid",
      `Data de publicação do documento ${draft.role} precisa ser uma data de calendário real.`,
    );
  }
  if (draft.publishedOn <= edition.examDate) {
    return problem(
      "publication_chronology_invalid",
      `O documento ${draft.role} não pode ser publicado antes da aplicação da prova.`,
    );
  }
  if (
    !Array.isArray(draft.coversBookletVersions) ||
    draft.coversBookletVersions.length < 1 ||
    draft.coversBookletVersions.length > 8 ||
    !draft.coversBookletVersions.every(isVersionLabel) ||
    new Set(draft.coversBookletVersions.map(normalized)).size !==
      draft.coversBookletVersions.length
  ) {
    return problem(
      "document_shape_invalid",
      `Versões de caderno cobertas pelo documento ${draft.role} ausentes, repetidas ou acima do limite.`,
    );
  }
  if (
    draft.checksumSha256 !== undefined &&
    draft.checksumSha256 !== null &&
    (typeof draft.checksumSha256 !== "string" ||
      !SHA256.test(draft.checksumSha256))
  ) {
    return problem(
      "document_shape_invalid",
      `Resumo sha256 do documento ${draft.role} precisa ter 64 dígitos hexadecimais minúsculos quando informado.`,
    );
  }

  const title = normalized(draft.title);
  const rules = TITLE_RULES[draft.role];
  if (rules.required && !rules.required.test(title)) {
    return problem(
      "title_role_contradiction",
      `O título do documento ${draft.role} não declara o papel que ele exerce.`,
    );
  }
  if (rules.forbidden && rules.forbidden.test(title)) {
    return problem(
      "title_role_contradiction",
      `O título do documento ${draft.role} declara um papel que ele não tem.`,
    );
  }

  const isAct = draft.role === "answer_key_maintenance_act";
  const declaresDecision =
    (draft.decisionEffect !== undefined && draft.decisionEffect !== null) ||
    (draft.decisionLegalBasis !== undefined &&
      draft.decisionLegalBasis !== null);
  if (!isAct && declaresDecision) {
    return problem(
      "decision_fields_misplaced",
      `Somente o ato de manutenção pode declarar efeito e fundamento de decisão; ${draft.role} não pode.`,
    );
  }
  if (isAct) {
    if (!isDecisionEffect(draft.decisionEffect)) {
      return problem(
        "decision_effect_unknown",
        `Efeito de decisão desconhecido: ${String(draft.decisionEffect)}.`,
      );
    }
    if (draft.decisionEffect !== SUPPORTED_ANSWER_KEY_DECISION_EFFECT) {
      return problem(
        "decision_effect_unsupported",
        `Esta política só aceita ato que mantém todos os gabaritos; o efeito ${draft.decisionEffect} exige decisão própria.`,
      );
    }
    if (!isPlainText(draft.decisionLegalBasis, 10, 500)) {
      return problem(
        "decision_basis_missing",
        "O ato de manutenção precisa declarar o fundamento legal do julgamento dos recursos.",
      );
    }
  }
  return null;
}

function toDocument(
  draft: AnswerKeyEvidenceDocumentDraft,
  role: AnswerKeyEvidenceRole,
): AnswerKeyEvidenceDocument {
  return {
    role,
    documentType: ROLE_DOCUMENT_TYPE[role],
    editionPublicId: draft.editionPublicId,
    title: draft.title.trim(),
    sourceUrl: draft.sourceUrl,
    publishedOn: draft.publishedOn,
    coversBookletVersions: draft.coversBookletVersions.map((version) =>
      version.trim(),
    ),
    checksumSha256: draft.checksumSha256 ?? null,
  };
}

/**
 * Revisa um conjunto de evidência de gabarito e devolve a união discriminada
 * correspondente. Recusa fechada: qualquer dúvida de integridade invalida o
 * conjunto inteiro, sem conserto automático.
 */
export function reviewAnswerKeyEvidence(
  draft: AnswerKeyEvidenceDraft,
): AnswerKeyEvidenceReview {
  if (!draft || typeof draft !== "object") {
    return problem("finality_unknown", "Conjunto de evidência ausente.");
  }
  if (!isFinality(draft.finality)) {
    return problem(
      "finality_unknown",
      `Finalidade de gabarito desconhecida: ${String(draft.finality)}.`,
    );
  }
  const editionProblem = reviewEditionIdentity(draft.edition);
  if (editionProblem) return editionProblem;
  if (!Array.isArray(draft.documents)) {
    return problem("document_shape_invalid", "Lista de documentos ausente.");
  }

  const required = REQUIRED_ROLES[draft.finality];
  for (const document of draft.documents) {
    const documentProblem = reviewDocumentShape(document, draft.edition);
    if (documentProblem) return documentProblem;
  }

  // Um mesmo documento não pode exercer dois papéis, e dois documentos não podem
  // apresentar o mesmo título.
  const urls = new Set(draft.documents.map((document) => document.sourceUrl));
  if (urls.size !== draft.documents.length) {
    return problem(
      "document_duplicated",
      "O mesmo documento oficial foi usado em mais de um papel do conjunto.",
    );
  }
  const titles = new Set(
    draft.documents.map((document) => normalized(document.title)),
  );
  if (titles.size !== draft.documents.length) {
    return problem(
      "document_duplicated",
      "Dois documentos do conjunto apresentam o mesmo título.",
    );
  }
  const checksums = draft.documents
    .map((document) => document.checksumSha256)
    .filter((checksum): checksum is string => typeof checksum === "string");
  if (new Set(checksums).size !== checksums.length) {
    return problem(
      "document_duplicated",
      "Dois documentos do conjunto têm o mesmo resumo sha256.",
    );
  }

  const byRole = new Map<AnswerKeyEvidenceRole, AnswerKeyEvidenceDocumentDraft>();
  for (const document of draft.documents) {
    if (!isRole(document.role)) {
      return problem(
        "document_role_unknown",
        `Papel de documento desconhecido: ${String(document.role)}.`,
      );
    }
    if (byRole.has(document.role)) {
      return problem(
        "document_duplicated",
        `O papel ${document.role} aparece mais de uma vez no conjunto.`,
      );
    }
    byRole.set(document.role, document);
  }
  const unexpected = [...byRole.keys()].filter(
    (role) => !(required as readonly AnswerKeyEvidenceRole[]).includes(role),
  );
  if (unexpected.length) {
    return problem(
      "roles_unexpected",
      `A finalidade ${draft.finality} não admite: ${unexpected.join(", ")}.`,
    );
  }
  const missing = required.filter((role) => !byRole.has(role));
  if (missing.length) {
    return problem(
      "roles_incomplete",
      `A finalidade ${draft.finality} exige também: ${missing.join(", ")}.`,
    );
  }

  const label = normalized(draft.edition.bookletVersionLabel);
  const bookletDraft = byRole.get("question_booklet");
  if (
    !bookletDraft ||
    bookletDraft.coversBookletVersions.length !== 1 ||
    normalized(bookletDraft.coversBookletVersions[0]) !== label
  ) {
    return problem(
      "booklet_version_mismatch",
      `O caderno de referência precisa cobrir exatamente a versão ${draft.edition.bookletVersionLabel}.`,
    );
  }
  for (const [role, document] of byRole) {
    if (role === "question_booklet") continue;
    if (
      !document.coversBookletVersions.some(
        (version) => normalized(version) === label,
      )
    ) {
      return problem(
        "booklet_version_mismatch",
        `O documento ${role} não alcança a versão ${draft.edition.bookletVersionLabel} do caderno.`,
      );
    }
  }

  const booklet = toDocument(bookletDraft, "question_booklet");
  if (draft.finality === "definitive_document") {
    const definitiveDraft = byRole.get("definitive_answer_key");
    if (!definitiveDraft) {
      return problem(
        "roles_incomplete",
        "Gabarito oficial definitivo ausente.",
      );
    }
    return {
      valid: true,
      evidence: {
        finality: "definitive_document",
        edition: { ...draft.edition },
        booklet,
        definitiveAnswerKey: toDocument(
          definitiveDraft,
          "definitive_answer_key",
        ),
      },
    };
  }

  const preliminaryDraft = byRole.get("preliminary_answer_key");
  const actDraft = byRole.get("answer_key_maintenance_act");
  if (!preliminaryDraft || !actDraft) {
    return problem(
      "roles_incomplete",
      "A evidência composta exige o gabarito preliminar e o ato de manutenção.",
    );
  }
  // O ato julga recursos contra o gabarito preliminar: não pode precedê-lo.
  if (actDraft.publishedOn <= preliminaryDraft.publishedOn) {
    return problem(
      "publication_chronology_invalid",
      "O ato de manutenção precisa ser publicado depois do gabarito preliminar que ele confirma.",
    );
  }
  if (
    !isDecisionEffect(actDraft.decisionEffect) ||
    actDraft.decisionEffect !== SUPPORTED_ANSWER_KEY_DECISION_EFFECT ||
    !isPlainText(actDraft.decisionLegalBasis, 10, 500)
  ) {
    return problem(
      "decision_effect_unsupported",
      "O ato de manutenção precisa declarar manutenção de todos os gabaritos e o fundamento legal.",
    );
  }
  return {
    valid: true,
    evidence: {
      finality: "preliminary_plus_maintenance_act",
      edition: { ...draft.edition },
      booklet,
      preliminaryAnswerKey: toDocument(
        preliminaryDraft,
        "preliminary_answer_key",
      ),
      maintenanceAct: {
        ...toDocument(actDraft, "answer_key_maintenance_act"),
        role: "answer_key_maintenance_act",
        decisionEffect: SUPPORTED_ANSWER_KEY_DECISION_EFFECT,
        decisionLegalBasis: actDraft.decisionLegalBasis.trim(),
      },
    },
  };
}

/** Igual a `reviewAnswerKeyEvidence`, lançando `AnswerKeyEvidenceError`. */
export function assertAnswerKeyEvidence(
  draft: AnswerKeyEvidenceDraft,
): AnswerKeyEvidence {
  const review = reviewAnswerKeyEvidence(draft);
  if (!review.valid) throw new AnswerKeyEvidenceError(review.code, review.reason);
  return review.evidence;
}

/** Documentos do conjunto na ordem dos papéis, para conferência e auditoria. */
export function answerKeyEvidenceDocuments(
  evidence: AnswerKeyEvidence,
): readonly AnswerKeyEvidenceDocument[] {
  return evidence.finality === "definitive_document"
    ? [evidence.booklet, evidence.definitiveAnswerKey]
    : [evidence.booklet, evidence.preliminaryAnswerKey, evidence.maintenanceAct];
}

/** Resumo estável para fingerprint e auditoria. Não inclui produto,
 * oportunidade, referência de autorização ou qualquer campo comercial. */
export function answerKeyEvidenceProvenance(evidence: AnswerKeyEvidence) {
  return {
    finality: evidence.finality,
    editionPublicId: evidence.edition.publicId,
    bookletVersionLabel: evidence.edition.bookletVersionLabel,
    definitiveAnswerKeyDocument:
      evidence.finality === "definitive_document"
        ? evidence.definitiveAnswerKey.sourceUrl
        : null,
    decisionEffect:
      evidence.finality === "preliminary_plus_maintenance_act"
        ? evidence.maintenanceAct.decisionEffect
        : null,
    decisionLegalBasis:
      evidence.finality === "preliminary_plus_maintenance_act"
        ? evidence.maintenanceAct.decisionLegalBasis
        : null,
    documents: answerKeyEvidenceDocuments(evidence).map((document) => ({
      role: document.role,
      documentType: document.documentType,
      sourceUrl: document.sourceUrl,
      publishedOn: document.publishedOn,
      checksumSha256: document.checksumSha256,
    })),
    relabelProhibited: true,
  } as const;
}

/** Rótulo exibível por tipo de documento. É o tipo que decide o rótulo, nunca a
 * finalidade: por isso nenhum valor aqui contém "definitivo", e o gabarito
 * preliminar do MPRJ não pode ser apresentado como definitivo pela interface. */
export const ANSWER_KEY_DOCUMENT_TYPE_LABELS = {
  question_booklet: "CADERNO DE QUESTÕES",
  answer_key: "GABARITO",
  answer_key_decision: "DECISÃO SOBRE O GABARITO",
} as const satisfies Readonly<Record<AnswerKeyDocumentType, string>>;

export function isAnswerKeyEvidenceDocumentType(
  value: unknown,
): value is AnswerKeyDocumentType {
  return (
    typeof value === "string" &&
    (ANSWER_KEY_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

export function isAnswerKeyFinality(value: unknown): value is AnswerKeyFinality {
  return (
    typeof value === "string" &&
    (ANSWER_KEY_FINALITIES as readonly string[]).includes(value)
  );
}

/** Rótulo do documento, ou `null` para tipo desconhecido (falha fechada: quem
 * chama decide recusar em vez de inventar um rótulo). */
export function answerKeyDocumentTypeLabel(value: unknown): string | null {
  return isAnswerKeyEvidenceDocumentType(value)
    ? ANSWER_KEY_DOCUMENT_TYPE_LABELS[value]
    : null;
}

/** Tipos de documento exigidos por cada finalidade, na ordem dos papéis.
 * `preliminary_plus_maintenance_act` exige os três; a ausência de qualquer um
 * invalida o conjunto. */
export function requiredAnswerKeyDocumentTypes(
  finality: AnswerKeyFinality,
): readonly AnswerKeyDocumentType[] {
  return REQUIRED_ROLES[finality].map((role) => ROLE_DOCUMENT_TYPE[role]);
}

/** Verdadeiro somente quando a finalidade declarada exige o ato de manutenção. */
export function requiresAnswerKeyMaintenanceAct(finality: unknown) {
  return finality === "preliminary_plus_maintenance_act";
}

/** Mesma regra de título aplicada por `reviewAnswerKeyEvidence`, exposta para que
 * a política de escopo do painel e do operador recusem relabelamento com o mesmo
 * critério, sem duplicar expressões em outro arquivo. */
export function answerKeyTitleFitsRole(
  role: AnswerKeyEvidenceRole,
  title: unknown,
) {
  if (!isPlainText(title, 3, 500)) return false;
  const rules = TITLE_RULES[role];
  const value = normalized(title);
  if (rules.required && !rules.required.test(value)) return false;
  if (rules.forbidden && rules.forbidden.test(value)) return false;
  return true;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

const FGV_FILES = "https://conhecimento.fgv.br/sites/default/files/concursos/";

/**
 * MPRJ XXXIX/2026 — prova preambular de 31/05/2026. URLs, datas de publicação
 * do portal e resumos sha256 conferidos na pesquisa de 14/10/2026
 * (`.local/maestri/heartbeat-2015-mprj-previous-evidence.md`). Somente
 * identidade de documento: produto, oportunidade e autorização ficam fora.
 */
export const MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE: AnswerKeyEvidenceDraft =
  deepFreeze({
    finality: "preliminary_plus_maintenance_act",
    edition: {
      publicId: "mprj-promotor-substituto-xxxix-2026-preambular",
      institutionAcronym: "MPRJ",
      jurisdictionCode: "RJ",
      roleName: "Promotor de Justiça Substituto",
      examDate: "2026-05-31",
      bookletVersionLabel: "Tipo 1",
      expectedQuestionCount: 100,
    },
    documents: [
      {
        role: "question_booklet",
        documentType: "question_booklet",
        editionPublicId: "mprj-promotor-substituto-xxxix-2026-preambular",
        title: "MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1",
        sourceUrl: `${FGV_FILES}promotor-de-justica-substituto-cns001-tipo-1.pdf`,
        publishedOn: "2026-06-01",
        coversBookletVersions: ["Tipo 1"],
        checksumSha256:
          "7c036cd2deb5a8f9704fc9c449bb484ec44d74d31c22cc9ee320be3d852db213",
      },
      {
        role: "preliminary_answer_key",
        documentType: "answer_key",
        editionPublicId: "mprj-promotor-substituto-xxxix-2026-preambular",
        title:
          "MPRJ XXXIX/2026 — gabarito oficial preliminar da prova preambular",
        sourceUrl: `${FGV_FILES}mprj-promotor-2026-gabaritos-para-publicacao.pdf`,
        publishedOn: "2026-06-01",
        coversBookletVersions: ["Tipo 1", "Tipo 2", "Tipo 3", "Tipo 4"],
        checksumSha256:
          "5a93ae1532e4fb1bebe910363cfa7b0e7911329d0370820cf2d26d10ca30d5d1",
      },
      {
        role: "answer_key_maintenance_act",
        documentType: "answer_key_decision",
        editionPublicId: "mprj-promotor-substituto-xxxix-2026-preambular",
        title:
          "MPRJ XXXIX/2026 — aviso de 22/06/2026: julgados os recursos, mantidos os gabaritos da prova preambular",
        sourceUrl: `${FGV_FILES}22.06-recursos-gabarito-preambular.pdf`,
        publishedOn: "2026-06-22",
        coversBookletVersions: ["Tipo 1", "Tipo 2", "Tipo 3", "Tipo 4"],
        checksumSha256:
          "30ce6bb837e9ed66e1535b1c8c4d9e91115782f7081848a8ca688ba71916e6a0",
        decisionEffect: "all_keys_maintained",
        decisionLegalBasis:
          "art. 38, IV, da Deliberação CSMP nº 86, de 11 de dezembro de 2025",
      },
    ],
  });

// Limites desta versão, para a revisão posterior:
//
// - O domínio permitido por banca não é checado aqui; isso é de
//   `official-sources/exam-registry` e do verificador de link.
// - As regras de título são heurísticas sobre o rótulo publicado. O dispositivo
//   do ato ("foram mantidos os gabaritos") é evidência de leitura, registrada na
//   pesquisa, e não é inferida de texto nenhum por este módulo.
// - `all_keys_maintained` é o único efeito suportado. Ato com alteração ou
//   anulação é recusado de propósito: exige decisão própria, não adaptação.
// - Todo documento precisa ser publicado **depois** do dia da aplicação. Vale
//   para os alvos conferidos (MPRJ, MPMT, PGE-AC publicam no dia útil seguinte);
//   um certame que publicasse no mesmo dia exigiria revisão desta regra.
// - Nenhuma coerência entre tabelas é prometida aqui; a política não lê banco.
// - `checksumSha256` é opcional e, quando informado, é apenas metadado de
//   conferência do link externo: não implica cópia, armazenamento ou licença.
