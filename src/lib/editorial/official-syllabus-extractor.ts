const MAX_EXTRACTED_REQUIREMENTS = 200;
const MIN_REQUIREMENT_LENGTH = 8;
const MAX_REQUIREMENT_LENGTH = 600;

type SubjectReference = Readonly<{ id: number; name: string }>;

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
    .replace(/^\s*(?:[•▪●◦\-–—*]+|\d+(?:\.\d+)*(?:[.)-])?)\s*/, "")
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

function isNoise(line: string) {
  const key = normalized(line);
  return (
    !key ||
    /^pagina \d+(?: de \d+)?$/.test(key) ||
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
  const hasAnchor = pageTexts.some((page) => page.split(/\n+/).some(isSectionAnchor));
  const candidates: ExtractedSyllabusCandidate[] = [];
  const seen = new Set<string>();
  let insideSyllabus = !hasAnchor;
  let currentSubject: SubjectReference | null = null;

  for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex += 1) {
    const pageNumber = pageIndex + 1;
    for (const rawLine of pageTexts[pageIndex].split(/\n+/)) {
      const line = cleanLine(rawLine);
      if (!line) continue;
      if (isSectionAnchor(line)) {
        insideSyllabus = true;
        currentSubject = null;
        continue;
      }
      if (!insideSyllabus) continue;
      if (currentSubject && isSectionTerminator(line)) {
        insideSyllabus = false;
        currentSubject = null;
        continue;
      }

      const subject = matchSubject(line, subjects);
      if (subject) {
        currentSubject = subject;
        const remainder = line.replace(new RegExp(`^(?:disciplina|mat[eé]ria)?\\s*${subject.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:—-]?\\s*`, "i"), "").trim();
        if (!remainder || normalized(remainder) === normalized(line)) continue;
      }
      if (!currentSubject || isNoise(line)) continue;
      if (line.length < MIN_REQUIREMENT_LENGTH || line.length > MAX_REQUIREMENT_LENGTH) continue;

      const key = `${currentSubject.id}:${normalized(line)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(
        Object.freeze({
          requirementText: line,
          pageNumber,
          sourceLocator: `Conteúdo programático, p. ${pageNumber}`,
          suggestedSubjectId: currentSubject.id,
          suggestedSubjectName: currentSubject.name,
        }),
      );
      if (candidates.length >= MAX_EXTRACTED_REQUIREMENTS) {
        return Object.freeze(candidates);
      }
    }
  }

  return Object.freeze(candidates);
}
