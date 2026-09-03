const MAX_EXTRACTED_REQUIREMENTS = 200;
const MIN_REQUIREMENT_LENGTH = 8;
const MAX_REQUIREMENT_LENGTH = 2_000;

type SubjectReference = Readonly<{ id: number; name: string }>;
type SubjectContext = Readonly<{ id: number | null; name: string | null }>;

export type ExtractedSyllabusCandidate = Readonly<{
  requirementText: string;
  pageNumber: number;
  sourceLocator: string;
  suggestedSubjectId: number | null;
  suggestedSubjectName: string | null;
}>;

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanLine(value: string) {
  return value
    .replace(
      /^\s*(?:[•▪●◦\-–—*]+\s*|\d+(?:\.\d+)*(?:[.)-])\s+|[IVXLCDM]+(?:[.)-])\s*)/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function matchSubject(line: string, subjects: readonly SubjectReference[]) {
  const lineKey = normalized(line).replace(/^(?:disciplina|materia)\s+/, "");
  return (
    subjects.find((subject) => {
      const subjectKey = normalized(subject.name);
      return lineKey === subjectKey || lineKey.startsWith(`${subjectKey} `);
    }) ?? null
  );
}

function isSectionAnchor(line: string) {
  return /^(?:\d+(?:\.\d+)*\s+)?(?:conteudo programatico|programa de conteudos?|conhecimentos (?:gerais|especificos)|objetos de avaliacao)$/i.test(
    normalized(line),
  );
}

function isOfficialAnnexAnchor(line: string) {
  return /^anexo (?:i|1) conteudo programatico$/.test(normalized(line));
}

function isSubsequentAnnex(line: string) {
  return /^anexo (?:ii|2)\b/.test(normalized(line));
}

function isRomanSectionHeading(line: string) {
  return /^\s*[IVXLCDM]+\s*\.\s*\S/i.test(line);
}

function isUppercaseHeading(line: string) {
  const letters = line.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]+/g, "");
  return letters.length >= 4 && letters === letters.toLocaleUpperCase("pt-BR");
}

function isNumberedRequirement(line: string) {
  return /^\s*\d+(?:\.\d+)*(?:[.)-])\s+\S/.test(line);
}

function isNoise(line: string) {
  const key = normalized(line);
  return (
    !key ||
    /^pagina \d+(?: de \d+)?$/.test(key) ||
    /^\d+ exame nacional da magistratura/.test(key) ||
    /^edital n? \d+/.test(key) ||
    /^(?:anexo|conteudo programatico|programa de conteudos?|conhecimentos gerais|conhecimentos especificos|objetos de avaliacao)$/.test(
      key,
    ) ||
    /^(?:cargo|area|especialidade|nivel|bloco|disciplina|materia)$/.test(key)
  );
}

function isSectionTerminator(line: string) {
  return /^(?:cronograma|calendario|das inscricoes|da inscricao|das provas|da prova objetiva|dos recursos|do resultado|das disposicoes finais|disposicoes finais|modelo de declaracao|formulario)/.test(
    normalized(line),
  );
}

/**
 * Deterministic extraction only: every candidate is an unchanged line from the
 * official PDF after list-marker/whitespace cleanup. It never completes or rewrites text.
 */
export function extractOfficialSyllabusCandidates(
  pageTexts: readonly string[],
  subjects: readonly SubjectReference[],
) {
  const officialAnnexPage = pageTexts.findIndex((page) =>
    page.split(/\n+/).some(isOfficialAnnexAnchor),
  );
  const hasAnchor = pageTexts.some((page) => page.split(/\n+/).some(isSectionAnchor));
  const candidates: ExtractedSyllabusCandidate[] = [];
  const seen = new Set<string>();
  let insideSyllabus = officialAnnexPage < 0 && !hasAnchor;
  let currentSubject: SubjectContext | null = null;
  let pending:
    | {
        parts: string[];
        pageNumber: number;
        subject: SubjectContext;
      }
    | null = null;

  function flushPending() {
    if (!pending) return false;
    const requirementText = pending.parts.join(" ").replace(/\s+/g, " ").trim();
    const pendingSubject = pending.subject;
    const pendingPage = pending.pageNumber;
    pending = null;
    if (
      requirementText.length < MIN_REQUIREMENT_LENGTH ||
      requirementText.length > MAX_REQUIREMENT_LENGTH
    ) {
      return false;
    }

    const subjectKey = pendingSubject.id ?? `unmapped:${normalized(pendingSubject.name ?? "")}`;
    const key = `${subjectKey}:${normalized(requirementText)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    candidates.push(
      Object.freeze({
        requirementText,
        pageNumber: pendingPage,
        sourceLocator: `Conteúdo programático, p. ${pendingPage}${pendingSubject.id === null && pendingSubject.name ? ` · ${pendingSubject.name}` : ""}`,
        suggestedSubjectId: pendingSubject.id,
        suggestedSubjectName: pendingSubject.name,
      }),
    );
    return candidates.length >= MAX_EXTRACTED_REQUIREMENTS;
  }

  for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex += 1) {
    const pageNumber = pageIndex + 1;
    for (const rawLine of pageTexts[pageIndex].split(/\n+/)) {
      const line = cleanLine(rawLine);
      if (!line) continue;
      const startsOfficialAnnex = pageIndex === officialAnnexPage && isOfficialAnnexAnchor(rawLine);
      const startsFallbackSection = officialAnnexPage < 0 && isSectionAnchor(line);
      if (startsOfficialAnnex || startsFallbackSection) {
        if (flushPending()) return Object.freeze(candidates);
        insideSyllabus = true;
        currentSubject = null;
        continue;
      }
      if (!insideSyllabus) continue;
      if (officialAnnexPage >= 0 && isSubsequentAnnex(rawLine)) {
        if (flushPending()) return Object.freeze(candidates);
        insideSyllabus = false;
        currentSubject = null;
        break;
      }
      if (currentSubject && isSectionTerminator(line)) {
        if (flushPending()) return Object.freeze(candidates);
        insideSyllabus = false;
        currentSubject = null;
        continue;
      }

      const subject = matchSubject(line, subjects);
      const explicitSubjectHeading =
        (isRomanSectionHeading(rawLine) && (subject !== null || isUppercaseHeading(line))) ||
        subjects.some((item) => normalized(item.name) === normalized(line)) ||
        /^(?:disciplina|materia)\b/.test(normalized(rawLine));
      if (explicitSubjectHeading) {
        if (flushPending()) return Object.freeze(candidates);
        currentSubject = subject ?? { id: null, name: line };
        continue;
      }
      if (!currentSubject || isNoise(line)) continue;

      if (officialAnnexPage < 0) {
        pending = { parts: [line], pageNumber, subject: currentSubject };
        if (flushPending()) return Object.freeze(candidates);
        continue;
      }

      if (isNumberedRequirement(rawLine)) {
        if (flushPending()) return Object.freeze(candidates);
        pending = { parts: [line], pageNumber, subject: currentSubject };
        continue;
      }
      if (pending) pending.parts.push(line);
    }
  }

  flushPending();

  return Object.freeze(candidates);
}
