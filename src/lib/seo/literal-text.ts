/**
 * Splits the official literal text of an article into citable blocks with
 * stable anchors (spec 2.3): `#caput`, `#par-1`, `#par-unico`, `#inc-ii`,
 * `#inc-v-al-a`, `#par-3-inc-i`. Pure and deterministic.
 */

export type LiteralBlockKind = "caput" | "paragrafo" | "inciso" | "alinea" | "item" | "texto";

export type LiteralBlock = Readonly<{
  id: string;
  kind: LiteralBlockKind;
  /** Visible label that starts the line, e.g. "§ 1º", "II", "a)". */
  label: string | null;
  text: string;
  depth: number;
}>;

const PARAGRAPH = /^(§\s*(\d+)[º°]?\.?|Parágrafo único\.?)\s*/i;
const INCISO = /^([IVXLCDM]+)\s*[-–—]\s*/;
const ALINEA = /^([a-z])\)\s*/;
const ITEM = /^(\d+)\.\s+/;

export function parseLiteralText(literalText: string): LiteralBlock[] {
  const lines = literalText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: LiteralBlock[] = [];
  const used = new Map<string, number>();
  let paragraph: string | null = null;
  let inciso: string | null = null;
  let alinea: string | null = null;

  const unique = (id: string) => {
    const count = used.get(id) ?? 0;
    used.set(id, count + 1);
    return count === 0 ? id : `${id}-${count + 1}`;
  };
  const push = (block: Omit<LiteralBlock, "id"> & { id: string }) => {
    blocks.push({ ...block, id: unique(block.id) });
  };

  lines.forEach((line, index) => {
    const paragraphMatch = PARAGRAPH.exec(line);
    if (paragraphMatch && index > 0) {
      paragraph = paragraphMatch[2] ? `par-${Number(paragraphMatch[2])}` : "par-unico";
      inciso = null;
      alinea = null;
      push({ id: paragraph, kind: "paragrafo", label: paragraphMatch[1].trim(), text: line.slice(paragraphMatch[0].length), depth: 0 });
      return;
    }
    const incisoMatch = INCISO.exec(line);
    if (incisoMatch && index > 0) {
      const id = `${paragraph ? `${paragraph}-` : ""}inc-${incisoMatch[1].toLowerCase()}`;
      inciso = id;
      alinea = null;
      push({ id, kind: "inciso", label: incisoMatch[1], text: line.slice(incisoMatch[0].length), depth: 1 });
      return;
    }
    const alineaMatch = ALINEA.exec(line);
    if (alineaMatch && index > 0) {
      const id = `${inciso ?? paragraph ?? "caput"}-al-${alineaMatch[1]}`;
      alinea = id;
      push({ id, kind: "alinea", label: `${alineaMatch[1]})`, text: line.slice(alineaMatch[0].length), depth: 2 });
      return;
    }
    const itemMatch = ITEM.exec(line);
    if (itemMatch && index > 0 && alinea) {
      push({ id: `${alinea}-item-${itemMatch[1]}`, kind: "item", label: `${itemMatch[1]}.`, text: line.slice(itemMatch[0].length), depth: 3 });
      return;
    }
    if (index === 0) {
      push({ id: "caput", kind: "caput", label: null, text: line, depth: 0 });
      return;
    }
    push({ id: `${alinea ?? inciso ?? paragraph ?? "caput"}-texto`, kind: "texto", label: null, text: line, depth: 1 });
  });

  return blocks;
}

/** First sentence of the caput without the "Art. Nº" marker, for short quotes. */
export function caputExcerpt(literalText: string, maxWords = 45): string {
  const caput = literalText.split(/\r?\n/)[0]?.trim() ?? "";
  const body = caput.replace(/^Art\.\s*[\d.]+[º°o]?(?:-[A-Z])*\.?\s*/i, "");
  const words = body.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? body : `${words.slice(0, maxWords).join(" ")}…`;
}
