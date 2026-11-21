/** Formatting helpers for the law/article templates. Pure. */

const MONTHS: Readonly<Record<string, string>> = {
  janeiro: "01",
  fevereiro: "02",
  março: "03",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

/** "Lei nº 10.406, de 10 de janeiro de 2002 — …" → "2002-01-10". */
export function lawDateFromTitle(title: string): string | null {
  const match = /de\s+(\d{1,2})º?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(title);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || !month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

const LEGISLATION_TYPES: Readonly<Record<string, string>> = {
  lei: "Lei",
  "lei-complementar": "Lei Complementar",
  "decreto-lei": "Decreto-Lei",
  decreto: "Decreto",
  constituicao: "Constituição",
};

export function legislationTypeLabel(actType: string): string {
  return LEGISLATION_TYPES[actType] ?? "Norma";
}

/** Portuguese contraction before the law label: "do Código Penal", "da Lei 8.112/1990". */
export function ofLaw(label: string): string {
  return /^(Código|Decreto|Estatuto|Marco)\b/.test(label) ? `do ${label}` : `da ${label}`;
}

/** Article before the law label: "o Código Penal", "a Lei 8.112/1990". */
export function theLaw(label: string): string {
  return ofLaw(label).slice(1);
}

/** "Art. 5º" → "art. 5º" for use inside a sentence. */
export function inlineArticle(label: string): string {
  return label.replace(/^Art\./, "art.");
}

export function brDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Readable name of the official source host. */
export function sourceLabel(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "fonte oficial";
  }
  if (host.endsWith("planalto.gov.br")) return "Planalto";
  if (host.endsWith("senado.leg.br")) return "Senado Federal";
  if (host.endsWith("camara.leg.br")) return "Câmara dos Deputados";
  return host;
}

/** "A, B e C" (Portuguese list). */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}
