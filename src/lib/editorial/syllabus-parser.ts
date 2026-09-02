const MAX_SYLLABUS_INPUT_LENGTH = 20_000;
export const MAX_SYLLABUS_ITEMS = 50;
const MAX_REQUIREMENT_LENGTH = 600;

export class SyllabusParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyllabusParseError";
  }
}

function stripListMarker(value: string) {
  return value
    .replace(/^\s*(?:[-–—*]+|\d+(?:\.\d+)*(?:[.)-])?)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSyllabusItems(input: string) {
  if (typeof input !== "string" || !input.trim()) {
    throw new SyllabusParseError("Cole ao menos um item do conteúdo programático.");
  }
  if (input.length > MAX_SYLLABUS_INPUT_LENGTH) {
    throw new SyllabusParseError("O bloco deve ter no máximo 20.000 caracteres por importação.");
  }

  const expanded = input
    .replace(/\r\n?/g, "\n")
    .replace(/[•▪●◦]/g, "\n")
    .replace(/;\s*(?=\d+(?:\.\d+)*(?:[.)-])?\s+)/g, "\n");

  const ignored: string[] = [];
  const unique = new Map<string, string>();

  for (const rawLine of expanded.split(/\n+/)) {
    const item = stripListMarker(rawLine);
    if (!item) continue;
    if (item.length < 8) {
      ignored.push(item);
      continue;
    }
    if (item.length > MAX_REQUIREMENT_LENGTH) {
      throw new SyllabusParseError(
        `O item “${item.slice(0, 70)}…” excede 600 caracteres. Divida-o sem alterar o texto oficial.`,
      );
    }

    const deduplicationKey = item
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!unique.has(deduplicationKey)) unique.set(deduplicationKey, item);
  }

  const items = [...unique.values()];
  if (!items.length) {
    throw new SyllabusParseError("Nenhum item válido foi identificado no bloco informado.");
  }
  if (items.length > MAX_SYLLABUS_ITEMS) {
    throw new SyllabusParseError(
      `Foram identificados ${items.length} itens. Importe no máximo ${MAX_SYLLABUS_ITEMS} por vez.`,
    );
  }

  return Object.freeze({ items: Object.freeze(items), ignored: Object.freeze(ignored) });
}
