import { createHash } from "node:crypto";

import { CAMARA_LGPD_SOURCE } from "./camara-text";
import { getOfficialLegalSource } from "./legal-registry";
import { parseConsolidatedLegalArticles } from "./legal-text";

export const OFFICIAL_LAW_STANDING_REFERENCE = "owner-standing-2026-10-12:official-sources-programs";
const HASH = /^[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

export function parseStandingLawReviewArgs(argv: readonly string[]) {
  const args = argv.filter((arg, index) => !(arg === "--" && index === 0));
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (const arg of args) {
    if (["--apply", "--inspect", "--standing"].includes(arg)) {
      if (flags.has(arg)) throw new Error("Flag repetida.");
      flags.add(arg); continue;
    }
    const match = /^(snapshot|checksum|fingerprint)=([^=]+)$/u.exec(arg);
    if (!match || values.has(match[1])) throw new Error("Argumento desconhecido ou repetido.");
    values.set(match[1], match[2]);
  }
  const snapshot = values.get("snapshot");
  if (!snapshot || !UUID.test(snapshot)) throw new Error("Informe snapshot=<UUID exato>.");
  const inspect = flags.has("--inspect");
  if (inspect) {
    if (flags.size !== 1 || values.size !== 1) throw new Error("--inspect permite somente snapshot=<UUID>, sem aprovação.");
    return { inspect: true as const, apply: false, snapshot };
  }
  const checksum = values.get("checksum");
  const fingerprint = values.get("fingerprint");
  if (!flags.has("--standing") || !checksum || !HASH.test(checksum) || !fingerprint || !HASH.test(fingerprint)) {
    throw new Error("Exige --standing, snapshot, checksum e fingerprint exatos.");
  }
  return { inspect: false as const, apply: flags.has("--apply"), snapshot, checksum, fingerprint };
}

export type StandingLawContext = {
  act: { id: number; slug: string; officialUrl: string; urn: string | null; isActive: boolean; actNumber: string | null; actYear: number | null; actType: string; jurisdiction: string };
  monitor: { id: number; publicId: string; legalActId: number; sourceUrl: string; checksumSha256: string; normalizedContent: string; fetchedAt: Date; status: string };
  text: { id: number; publicId: string; legalActId: number; monitorSnapshotId: number; sourceUrl: string; parserVersion: string; checksumSha256: string; normalizedContent: string; articleCount: number; contentLength: number; fetchedAt: Date; status: string };
};

export function standingLawFingerprint(context: StandingLawContext) {
  return createHash("sha256").update(JSON.stringify({
    act: context.act,
    monitor: { id: context.monitor.id, publicId: context.monitor.publicId, actId: context.monitor.legalActId, url: context.monitor.sourceUrl, checksum: context.monitor.checksumSha256, content: createHash("sha256").update(context.monitor.normalizedContent).digest("hex"), fetchedAt: context.monitor.fetchedAt.toISOString() },
    text: { id: context.text.id, publicId: context.text.publicId, actId: context.text.legalActId, monitorId: context.text.monitorSnapshotId, url: context.text.sourceUrl, parser: context.text.parserVersion, checksum: context.text.checksumSha256, articleCount: context.text.articleCount, contentLength: context.text.contentLength, content: createHash("sha256").update(context.text.normalizedContent).digest("hex"), fetchedAt: context.text.fetchedAt.toISOString() },
  })).digest("hex");
}

export function validateStandingLawIdentity(context: StandingLawContext) {
  const registered = getOfficialLegalSource("lei-geral-protecao-dados-2018")!;
  if (context.act.slug !== registered.slug || !context.act.isActive || context.act.officialUrl !== registered.officialUrl || context.act.urn !== registered.lexmlUrn || context.act.actType !== "lei" || context.act.actNumber !== "13.709" || context.act.actYear !== 2018 || context.act.jurisdiction !== "federal") throw new Error("Ato fora da identidade delimitada da LGPD.");
  if (context.monitor.legalActId !== context.act.id || context.text.legalActId !== context.act.id || context.text.monitorSnapshotId !== context.monitor.id || context.monitor.sourceUrl !== registered.monitorUrl || context.text.sourceUrl !== CAMARA_LGPD_SOURCE.url || context.text.parserVersion !== CAMARA_LGPD_SOURCE.parserVersion) throw new Error("Fonte, parser ou vínculo de monitoramento diverge do escopo atual.");
  if (!["pending_review", "approved"].includes(context.monitor.status) || !["pending_review", "approved"].includes(context.text.status)) throw new Error("Fotografia rejeitada/superada não pode ser reativada.");
}

export function validateStandingLawCorpus(context: StandingLawContext) {
  validateStandingLawIdentity(context);
  const { text, monitor } = context;
  if (text.contentLength !== text.normalizedContent.length || text.normalizedContent.length < 1000 || !HASH.test(text.checksumSha256) || createHash("sha256").update(monitor.normalizedContent).digest("hex") !== monitor.checksumSha256) throw new Error("Integridade da fotografia jurídica divergente.");
  const articles = parseConsolidatedLegalArticles(text.normalizedContent);
  const expected = new Set([...Array.from({ length: 65 }, (_, index) => index + 1).filter((number) => ![28, 55, 56, 57, 58, 59, 60].includes(number)).map((number) => `art-${number}`), ..."ACDEFGHIJKLM".split("").map((suffix) => `art-55-${suffix.toLowerCase()}`), "art-58-a", "art-58-b"]);
  if (articles.length !== 72 || text.articleCount !== articles.length || articles.some((article) => !expected.has(article.path))) throw new Error("Seleção de artigos diverge dos 72 dispositivos delimitados da LGPD.");
  for (const article of articles) {
    if (article.heading !== null || article.literalText.split("\n").slice(1).some((line) => !/^(?:§\s*\d|Par[aá]grafo [uú]nico\.|[IVXLCDM]+(?:-[A-Z])?\s*[-–—.]|[a-z]\))/u.test(line)) || /\((?:VETAD|REVOGAD)|reda[cç][aã]o dada|acrescid[oa] pela|convertida na Lei/iu.test(article.literalText)) throw new Error(`Texto editorial, título ou disposição não reconhecida em ${article.articleRef}.`);
  }
  const canonical = articles.map((article) => [article.path, "", article.literalText].join("\n")).join("\n\n");
  if (createHash("sha256").update([text.sourceUrl, text.parserVersion, canonical].join("\n")).digest("hex") !== text.checksumSha256) throw new Error("Checksum do corpus não corresponde à origem/parser/seleção.");
  return articles;
}

type FreshCapture = { sourceUrl: string; checksumSha256: string; normalizedContent: string; fetchedAt: Date };

export function validateFreshStandingLawCapture(context: StandingLawContext, expected: { checksum: string; fingerprint: string }, fresh: { monitor: FreshCapture; text: FreshCapture & { parserVersion: string; articleCount: number; contentLength: number } }, now = new Date()) {
  const articles = validateStandingLawCorpus(context);
  if (context.text.checksumSha256 !== expected.checksum || standingLawFingerprint(context) !== expected.fingerprint) throw new Error("Checksum ou fingerprint esperado mudou; preparar nova prévia.");
  for (const capture of [fresh.monitor, fresh.text]) {
    const age = now.getTime() - capture.fetchedAt.getTime();
    if (!Number.isFinite(age) || age < -30_000 || age > 5 * 60_000) throw new Error("A conferência oficial não está fresca para esta execução.");
  }
  if (fresh.monitor.sourceUrl !== context.monitor.sourceUrl || fresh.monitor.checksumSha256 !== context.monitor.checksumSha256 || fresh.monitor.normalizedContent !== context.monitor.normalizedContent || fresh.text.sourceUrl !== context.text.sourceUrl || fresh.text.checksumSha256 !== context.text.checksumSha256 || fresh.text.normalizedContent !== context.text.normalizedContent || fresh.text.parserVersion !== context.text.parserVersion || fresh.text.articleCount !== context.text.articleCount || fresh.text.contentLength !== context.text.contentLength) throw new Error("Nova captura oficial diverge da fotografia indicada; nenhuma ativação permitida.");
  return articles;
}
