// Programas de magistratura passam de 200 itens; o limite só protege a fila.
const MAX_EXTRACTED_REQUIREMENTS = 400;
const MIN_REQUIREMENT_LENGTH = 8;
const MAX_REQUIREMENT_LENGTH = 2_000;

type SubjectReference = Readonly<{ id: number; name: string }>;
type SubjectContext = Readonly<{ id: number | null; name: string | null; law?: boolean }>;

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
      /^\s*(?:[•▪●◦\-–—*]+\s*|\d+(?:\.\d+)*(?:[.)-])(?:\s+|(?=\p{Lu}))|[IVXLCDM]+(?:[.)-])\s*)/iu,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function matchSubject(line: string, subjects: readonly SubjectReference[]) {
  const lineKey = normalized(line)
    .replace(/^(?:disciplina|materia)\s+/, "")
    .replace(/^nocoes (?:gerais )?de\s+/, "");
  return (
    subjects.find((subject) => {
      const subjectKey = normalized(subject.name);
      return lineKey === subjectKey || lineKey.startsWith(`${subjectKey} `);
    }) ?? null
  );
}

// Foco em lei seca: matéria sem lei a mapear (português, humanidades, cálculo,
// TI) não vira requisito, porque o Guardião só bloquearia essas tarefas.
const LAW_SUBJECT =
  /\b(?:direitos?|legislacao|leis?|constituicao|estatutos?|codigos?|regimento|regime juridico|juridico|crimes?|penal|processual|tributaria|tributario|eleitoral|previdenciario|ambiental|consumidor|adolescente|magistratura|notarial|registral|registros publicos)\b/;
const NON_LAW_SUBJECT =
  /\b(?:sociologia|psicologia|filosofia|teoria geral|humanistica|economia|pragmatismo|lingua portuguesa|raciocinio|matematica|informatica|tecnologia da informacao|contabilidade|estatistica|atualidades|administracao geral|administracao financeira|gestao|primeiros socorros|inteligencia artificial|ciencia de dados|sistemas|infraestrutura|analise de dados|analise financeira|financas)\b/;

export function isLawSubject(name: string, matchesKnownSubject: boolean) {
  if (matchesKnownSubject) return true;
  const key = normalized(name);
  return LAW_SUBJECT.test(key) && !NON_LAW_SUBJECT.test(key);
}

function subjectContext(name: string, subjects: readonly SubjectReference[]): SubjectContext {
  const subject = matchSubject(name, subjects);
  return subject
    ? { id: subject.id, name: subject.name, law: true }
    : { id: null, name, law: isLawSubject(name, false) };
}

function isSectionAnchor(line: string) {
  return /^(?:\d+(?:\.\d+)*\s+)?(?:conteudo programatico|programa de conteudos?|conhecimentos (?:gerais|especificos)|objetos de avaliacao)$/i.test(
    normalized(line),
  );
}

// Só título de anexo; "Anexo III deste edital." no corpo do texto não conta.
function annexLabel(line: string) {
  if (!isUppercaseHeading(line.trim())) return null;
  return normalized(line).match(/^anexo ([ivxlcdm]+|\d+)\b/)?.[1] ?? null;
}

// "ANEXO II – CONTEÚDO PROGRAMÁTICO" (TJ-RS) ou "ANEXO I" e o título na linha
// seguinte (PC-PR) também abrem o programa, não só "ANEXO I – ...".
function isOfficialAnnexAnchor(line: string, nextLine = "") {
  // Título em maiúsculas; o sumário ("Anexo I – Conteúdo Programático.") não abre o programa.
  if (!isUppercaseHeading(line.trim())) return false;
  const key = normalized(line);
  return (
    /^anexo (?:[ivxlcdm]+|\d+) conteudo programatico$/.test(key) ||
    (/^anexo (?:[ivxlcdm]+|\d+)$/.test(key) && normalized(nextLine) === "conteudo programatico")
  );
}

function isSubsequentAnnex(line: string, openingAnnex: string | null) {
  const label = annexLabel(line);
  return label !== null && label !== openingAnnex;
}

/** Cabeçalho ou rodapé repetido em várias páginas (TRF-5: "TRIBUNAL REGIONAL
 * FEDERAL DA 5ª REGIÃO | CONCURSO PÚBLICO 2026 54") não é texto do programa. */
function repeatedPageLines(pageTexts: readonly string[]) {
  const pagesByLine = new Map<string, Set<number>>();
  pageTexts.forEach((page, index) => {
    for (const line of page.split(/\n+/)) {
      const key = normalized(line).replace(/\d+/g, "#");
      if (key.length < 12) continue;
      const pages = pagesByLine.get(key) ?? new Set<number>();
      pages.add(index);
      pagesByLine.set(key, pages);
    }
  });
  // Nome de matéria aparece em poucas páginas (tabelas da prova); cabeçalho, em quase todas.
  const minimumPages = Math.max(3, Math.ceil(pageTexts.length * 0.3));
  return new Set([...pagesByLine].filter(([, pages]) => pages.size >= minimumPages).map(([key]) => key));
}

function isStandaloneHeading(rawLine: string, line: string) {
  return (
    isUppercaseHeading(line) &&
    line.length <= 120 &&
    !/[.;]$/.test(line.trim()) &&
    !isNumberedRequirement(rawLine) &&
    !/^\s*\d/.test(rawLine)
  );
}

function isRomanSectionHeading(line: string) {
  return /^\s*[IVXLCDM]+\s*\.\s*\S/i.test(line);
}

function isUppercaseHeading(line: string) {
  const letters = line.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]+/g, "");
  return letters.length >= 4 && letters === letters.toLocaleUpperCase("pt-BR");
}

function isNumberedRequirement(line: string) {
  // "1. Tema" e "1.Tema" (TJ-RS) abrem item; "1.1 Subtema" continua o item de cima.
  return /^\s*\d+(?:\.\d+)*[.)-](?:\s+\S|\p{Lu})/u.test(line);
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
    /^(?:cargo|area|especialidade|nivel|bloco|disciplina|materia)$/.test(key) ||
    /^(?:bloco|cargo)\b/.test(key)
  );
}

function isSectionTerminator(line: string) {
  // Só título do edital: "Das provas." dentro de Direito Civil é tema, não fim do programa.
  if (!isUppercaseHeading(line)) return false;
  return /^(?:cronograma|calendario|das inscricoes|da inscricao|das provas|da prova objetiva|dos recursos|do resultado|das disposicoes finais|disposicoes finais|modelo de declaracao|formulario)/.test(
    normalized(line),
  );
}

const INLINE_LABEL =
  /^(?:\d+\s*[.)-]?\s+|[IVXLCDM]+\s*[.)-]?\s+)?([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9ºª ,.()/–-]{2,140}?):\s*(.*)$/u;
const ITEM_MARKER = /(^|[.;:]\s+)(\d+(?:\.\d+)*)\.?\s+(?=\p{Lu})/gu;
const ABBREVIATION_BEFORE_MARKER = /\b(?:arts?|inc|incs|n|nº|no|p|pp|cap|al|fl|fls|par|§)\.?\s*$/iu;

function isInlineLabel(rawLine: string) {
  const match = rawLine.trim().match(INLINE_LABEL);
  return match && isUppercaseHeading(match[1]) ? { label: match[1].trim(), rest: match[2] } : null;
}

function isSectionHeadingLine(rawLine: string, line: string) {
  return (
    isStandaloneHeading(rawLine, line) ||
    /^\s*\d+(?:\.\d+)+\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ ,()/–-]+$/u.test(rawLine)
  );
}

/** O programa começa no título que abre o trecho mais longo até o anexo
 * seguinte; o mesmo título no sumário do edital é seguido logo por outro anexo. */
function syllabusStart(pageTexts: readonly string[]) {
  const flat = pageTexts.flatMap((page, pageIndex) =>
    page.split(/\n+/).map((line, lineIndex) => ({ line, page: pageIndex, lineIndex })),
  );
  let best: { page: number; line: number; annex: string | null; span: number } | null = null;
  for (let position = 0; position < flat.length; position += 1) {
    const entry = flat[position];
    const opensAnnex = isOfficialAnnexAnchor(entry.line, flat[position + 1]?.line);
    const opensObjects =
      isUppercaseHeading(entry.line.trim()) &&
      /^(?:\d+ )*(?:dos )?objetos de avaliacao\b/.test(normalized(entry.line));
    if (!opensAnnex && !opensObjects) continue;
    const annex = opensAnnex ? annexLabel(entry.line) : null;
    const titleOnNextLine = opensAnnex && !/conteudo/.test(normalized(entry.line));
    let span = 0;
    for (let next = position + (titleOnNextLine ? 2 : 1); next < flat.length; next += 1) {
      if (isSubsequentAnnex(flat[next].line, annex)) break;
      span += 1;
    }
    if (!best || span > best.span) best = { page: entry.page, line: entry.lineIndex, annex, span };
  }
  return best ? { page: best.page, line: best.line, annex: best.annex } : null;
}

type InlineBlock = { label: string; segments: { text: string; page: number }[] };

/** Divide "1 Tema. 1.1 Subtema. 2 Tema" no primeiro nível da numeração, que
 * sobe de um em um (1, 2, 3 ou 1.1, 1.2); subitens ficam no item de cima. */
export function splitNumberedItems(text: string) {
  const first = text.match(/^(\d+(?:\.\d+)*)\.?\s+/u);
  if (!first) return null;
  const parts = first[1].split(".").map(Number);
  const next = (value: number[]) => [...value.slice(0, -1), value[value.length - 1] + 1].join(".");
  let expected = next(parts);
  const items = [{ number: first[1], start: 0 }];
  for (const match of text.matchAll(ITEM_MARKER)) {
    const markerStart = (match.index ?? 0) + match[1].length;
    if (markerStart === 0 || match[2] !== expected) continue;
    if (ABBREVIATION_BEFORE_MARKER.test(text.slice(0, (match.index ?? 0) + 1))) continue;
    items.push({ number: match[2], start: markerStart });
    expected = next(match[2].split(".").map(Number));
  }
  return items.map((item, index) => ({
    number: item.number,
    start: item.start,
    text: text.slice(item.start, items[index + 1]?.start ?? text.length).trim(),
  }));
}

/** Subitens diretos de um item ("1.1", "1.2" dentro de "1"), com o mesmo
 * cuidado de numeração crescente da divisão principal. */
function splitChildItems(text: string, parentNumber: string) {
  const firstChild = `${parentNumber}.1`;
  const position = text.search(new RegExp(`(?:^|[.;:]\\s+)${firstChild.replace(/\./g, "\\.")}\\.?\\s+(?=\\p{Lu})`, "u"));
  if (position < 0) return null;
  const offset = text.slice(position).search(/\d/u) + position;
  const children = splitNumberedItems(text.slice(offset));
  return children?.map((child) => ({ ...child, start: child.start + offset })) ?? null;
}

function chunkLongItem(text: string) {
  if (text.length <= MAX_REQUIREMENT_LENGTH) return [text];
  const chunks: string[] = [];
  let current = "";
  // Corta só em fronteira de subitem ("… 3.2 Tema"), sem reescrever o texto.
  for (const piece of text.split(/(?<=[.;])\s+(?=\d+(?:\.\d+)+\s+\p{Lu})/u)) {
    if (current && current.length + piece.length + 1 > MAX_REQUIREMENT_LENGTH) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((chunk) => chunk.length <= MAX_REQUIREMENT_LENGTH);
}

/**
 * Formato "MATÉRIA: 1 Tema. 1.1 Subtema. 2 Tema" (Cebraspe; PC-PR com
 * "1. DIREITO PENAL: 1.1 …"). Devolve null quando o documento não usa esse
 * formato, para cair na leitura por linhas.
 */
function extractInlineSyllabusCandidates(
  pageTexts: readonly string[],
  subjects: readonly SubjectReference[],
) {
  const start = syllabusStart(pageTexts);
  if (!start) return null;
  const noise = repeatedPageLines(pageTexts);
  const blocks: InlineBlock[] = [];
  let current: InlineBlock | null = null;
  let labelLines = 0;

  scan: for (let page = start.page; page < pageTexts.length; page += 1) {
    const lines = pageTexts[page].split(/\n+/);
    for (let index = page === start.page ? start.line + 1 : 0; index < lines.length; index += 1) {
      const rawLine = lines[index];
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (!line || noise.has(normalized(line).replace(/\d+/g, "#"))) continue;
      if (isSubsequentAnnex(line, start.annex) || (current && isSectionTerminator(line))) break scan;
      const label = isInlineLabel(line);
      if (label) {
        labelLines += 1;
        current = { label: label.label, segments: label.rest ? [{ text: label.rest, page: page + 1 }] : [] };
        blocks.push(current);
        continue;
      }
      if (isSectionHeadingLine(rawLine, line)) {
        current = null;
        continue;
      }
      current?.segments.push({ text: line, page: page + 1 });
    }
  }
  if (labelLines < 3) return null;

  const candidates: ExtractedSyllabusCandidate[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const subject = subjectContext(block.label, subjects);
    if (!subject.law || !block.segments.length) continue;
    let text = "";
    const pageAt: { offset: number; page: number }[] = [];
    for (const segment of block.segments) {
      if (text) text += " ";
      pageAt.push({ offset: text.length, page: segment.page });
      text += segment.text;
    }
    const pageFor = (offset: number) =>
      pageAt.filter((entry) => entry.offset <= offset).at(-1)?.page ?? pageAt[0].page;
    const topLevel = splitNumberedItems(text) ?? [{ number: null, start: 0, text }];
    const items =
      topLevel.length < 3
        ? topLevel.flatMap((item) => {
            const children = item.number ? splitChildItems(item.text, item.number) : null;
            return children && children.length >= 2
              ? children.map((child) => ({ ...child, start: item.start + child.start }))
              : [item];
          })
        : topLevel;
    for (const item of items) {
      const body = item.number ? item.text.replace(/^\d+(?:\.\d+)*\.?\s+/u, "") : item.text;
      for (const requirementText of chunkLongItem(body)) {
        if (requirementText.length < MIN_REQUIREMENT_LENGTH) continue;
        const key = `${subject.id ?? `unmapped:${normalized(block.label)}`}:${normalized(requirementText)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const pageNumber = pageFor(item.start);
        candidates.push(
          Object.freeze({
            requirementText,
            pageNumber,
            sourceLocator: `Conteúdo programático, p. ${pageNumber} · ${block.label}${item.number ? ` · item ${item.number}` : ""}`,
            suggestedSubjectId: subject.id,
            suggestedSubjectName: subject.name,
          }),
        );
        if (candidates.length >= MAX_EXTRACTED_REQUIREMENTS) return Object.freeze(candidates);
      }
    }
  }
  return Object.freeze(candidates);
}

/**
 * Deterministic extraction only: every candidate is an unchanged line from the
 * official PDF after list-marker/whitespace cleanup. It never completes or rewrites text.
 */
export function extractOfficialSyllabusCandidates(
  pageTexts: readonly string[],
  subjects: readonly SubjectReference[],
) {
  const inline = extractInlineSyllabusCandidates(pageTexts, subjects);
  if (inline) return inline;

  const noise = repeatedPageLines(pageTexts);
  let officialAnnexPage = -1;
  let openingAnnex: string | null = null;
  for (let page = 0; page < pageTexts.length && officialAnnexPage < 0; page += 1) {
    const lines = pageTexts[page].split(/\n+/);
    const index = lines.findIndex((line, position) => isOfficialAnnexAnchor(line, lines[position + 1]));
    if (index >= 0) {
      officialAnnexPage = page;
      openingAnnex = annexLabel(lines[index]);
    }
  }
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
    const lines = pageTexts[pageIndex].split(/\n+/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const rawLine = lines[lineIndex];
      const line = cleanLine(rawLine);
      if (!line || noise.has(normalized(rawLine).replace(/\d+/g, "#"))) continue;
      const startsOfficialAnnex =
        pageIndex === officialAnnexPage && isOfficialAnnexAnchor(rawLine, lines[lineIndex + 1]);
      const startsFallbackSection = officialAnnexPage < 0 && isSectionAnchor(line);
      if (startsOfficialAnnex || startsFallbackSection) {
        if (flushPending()) return Object.freeze(candidates);
        insideSyllabus = true;
        currentSubject = null;
        continue;
      }
      if (!insideSyllabus) continue;
      if (officialAnnexPage >= 0 && isSubsequentAnnex(rawLine, openingAnnex)) {
        // Título em duas linhas ("ANEXO I" + "CONTEÚDO PROGRAMÁTICO") já foi lido.
        if (pageIndex === officialAnnexPage && normalized(lines[lineIndex + 1] ?? "") === "conteudo programatico") continue;
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
        /^(?:disciplina|materia)\b/.test(normalized(rawLine)) ||
        // Matéria fora da lista conhecida (DIREITO AMBIENTAL) não herda a anterior.
        (!isNoise(line) && isStandaloneHeading(rawLine, line));
      if (explicitSubjectHeading) {
        if (flushPending()) return Object.freeze(candidates);
        currentSubject = subject
          ? { id: subject.id, name: subject.name, law: true }
          : { id: null, name: line, law: isLawSubject(line, false) };
        continue;
      }
      if (!currentSubject || isNoise(line) || currentSubject.law === false) continue;

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
