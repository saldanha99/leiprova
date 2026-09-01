import type { QuizBankSlug } from "@/lib/quiz/catalog";

export const OFFICIAL_EXAM_PORTALS = [
  {
    bankSlug: "vunesp",
    officialUrl: "https://www.vunesp.com.br/?b=v",
    allowedHosts: ["vunesp.com.br", "www.vunesp.com.br", "documento.vunesp.com.br"],
  },
  {
    bankSlug: "fgv",
    officialUrl: "https://conhecimento.fgv.br/concursos",
    allowedHosts: ["conhecimento.fgv.br"],
  },
  {
    bankSlug: "fcc",
    officialUrl: "https://www.concursosfcc.com.br/?sck=direto",
    allowedHosts: ["concursosfcc.com.br", "www.concursosfcc.com.br"],
  },
  {
    bankSlug: "cebraspe",
    officialUrl: "https://www.cebraspe.org.br/concursos/",
    allowedHosts: ["cebraspe.org.br", "www.cebraspe.org.br", "cdn.cebraspe.org.br"],
  },
] as const satisfies readonly {
  bankSlug: QuizBankSlug;
  officialUrl: string;
  allowedHosts: readonly string[];
}[];

export function getOfficialExamPortal(bankSlug: string) {
  return OFFICIAL_EXAM_PORTALS.find((portal) => portal.bankSlug === bankSlug) ?? null;
}

export function parseOfficialExamUrl(bankSlug: string, input: string) {
  const portal = getOfficialExamPortal(bankSlug);
  if (!portal) throw new Error("A banca não possui um portal oficial configurado.");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Informe uma URL oficial válida.");
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("A fonte precisa usar HTTPS, porta padrão e não pode conter credenciais.");
  }

  if (!(portal.allowedHosts as readonly string[]).includes(url.hostname.toLowerCase())) {
    throw new Error(`O endereço informado não pertence ao domínio oficial da ${bankSlug.toUpperCase()}.`);
  }

  return url;
}

export function isOfficialExamUrl(bankSlug: string, input: string) {
  try {
    parseOfficialExamUrl(bankSlug, input);
    return true;
  } catch {
    return false;
  }
}
