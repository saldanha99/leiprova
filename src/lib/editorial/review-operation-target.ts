import { importFingerprint, LocalImportError, parseLocalImport } from "./local-import-plan";
import { requireLocalImportTarget } from "./local-import-target";
import { packageReviewAuthorizationSchema } from "./package-review-service";

export const REVIEW_80_BUNDLE_ID = "cf-garantias-processuais-2026-09-06";
export const REVIEW_80_APPROVAL = `review-80:${REVIEW_80_BUNDLE_ID}`;
export const REVIEW_80_BATCH_FILES = ["fgv.json", "fcc.json", "vunesp.json", "cebraspe.json"] as const;
const banks = ["fgv", "fcc", "vunesp", "cebraspe"] as const;
const sha256 = /^[a-f0-9]{64}$/u;

/** Este operador só revisa o pacote já importado; não cria confirmações humanas. */
export function parseReview80Package(sources: unknown, batches: readonly unknown[], mapping: unknown, authorization: unknown) {
  const input = parseLocalImport(sources, batches, mapping);
  if (input.sources.id !== REVIEW_80_BUNDLE_ID || input.validation.totalQuestions !== 80 ||
      input.batches.length !== 4 || input.batches.some((batch, index) =>
        batch.bankSlug !== banks[index] || batch.questions.length !== 20)) {
    throw new LocalImportError("A revisão está limitada às 80 questões do pacote de garantias processuais, 20 por banca nos quatro arquivos fixos.");
  }
  const parsed = packageReviewAuthorizationSchema.safeParse(authorization);
  if (!parsed.success) throw new LocalImportError("Faltam as confirmações humanas específicas de revisão e responsabilidade editorial deste lote de 80.");
  const confirmed = parsed.data;
  if (confirmed.sourceBundleId !== input.sources.id || confirmed.sourcesSha256 !== input.validation.sourcesSha256 ||
      confirmed.mappingSha256 !== importFingerprint(input.mapping) || confirmed.banks.length !== banks.length ||
      new Set(confirmed.banks.map((bank) => bank.bank)).size !== banks.length ||
      input.validation.banks.some((bank) => !confirmed.banks.some((entry) => entry.bank === bank.bank && entry.sha256 === bank.sha256))) {
    throw new LocalImportError("A autorização não corresponde às versões exatas dos 80 itens, fontes e mapeamento.");
  }
  return { input, authorization: confirmed };
}

export function parseReview80Arguments(arguments_: readonly string[]) {
  const args = new Map<string, string>();
  for (const argument of arguments_) {
    const match = /^--(directory|mode|fingerprint)=(.+)$/u.exec(argument);
    if (!match || args.has(match[1])) throw new LocalImportError("Use --directory=PASTA --mode=preview|apply; aplicação exige --fingerprint=SHA256 da prévia.");
    args.set(match[1], match[2]);
  }
  const mode = args.get("mode") ?? "preview";
  const fingerprint = args.get("fingerprint");
  if (mode !== "preview" && mode !== "apply") throw new LocalImportError("Modo inválido. Este operador somente revisa: preview ou apply.");
  if ((mode === "apply" && !sha256.test(fingerprint ?? "")) || (mode === "preview" && fingerprint !== undefined)) {
    throw new LocalImportError("A aplicação exige a impressão SHA256 de uma prévia; a prévia não recebe impressão.");
  }
  return { mode, directory: args.get("directory"), fingerprint };
}

/** Além dos dossiês, prende a aplicação à identidade e declaração exatas. */
export function review80OperationFingerprint(reviewFingerprint: string, authorization: unknown) {
  const confirmed = packageReviewAuthorizationSchema.parse(authorization);
  if (!sha256.test(reviewFingerprint)) throw new LocalImportError("Impressão de revisão inválida.");
  return importFingerprint({ version: "review-80-operation-v1", sourceBundleId: REVIEW_80_BUNDLE_ID,
    batchFiles: REVIEW_80_BATCH_FILES, reviewFingerprint, authorizationSha256: importFingerprint(confirmed) });
}

export function requireReview80ApplyFingerprint(expected: string | undefined, current: string) {
  if (!sha256.test(expected ?? "") || expected !== current) {
    throw new LocalImportError("Pacote, responsável, declaração ou contexto mudou. Confira uma nova prévia antes de aprovar os 80 itens.");
  }
}

/** Sem fallback de conexão e sem reaproveitar a habilitação do lote antigo. */
export function requireReviewOperationTarget(connectionString: string | undefined, environment: {
  nodeEnv?: string; appUrl?: string; approval?: string;
}) {
  if (!connectionString) throw new LocalImportError("Defina LEIPROVA_REVIEW_80_DATABASE_URL explicitamente.");
  if (environment.nodeEnv !== "production") return requireLocalImportTarget(connectionString);
  if (environment.appUrl !== "https://leiprova.2b.app.br" || environment.approval !== REVIEW_80_APPROVAL) {
    throw new LocalImportError("Habilite explicitamente a revisão do pacote de 80 na Editalume.");
  }
  let target: URL;
  try { target = new URL(connectionString); } catch { throw new LocalImportError("Destino da revisão inválido."); }
  if (!["postgres:", "postgresql:"].includes(target.protocol) || !["leiprova-pooler", "pooler"].includes(target.hostname) ||
      (target.port && target.port !== "5432") || target.pathname !== "/leiprova" || target.username !== "leiprova_app" ||
      target.search || target.hash) {
    throw new LocalImportError("A revisão exige pooler interno, banco exclusivo da Editalume e papel restrito, sem redirecionamento.");
  }
  return { connectionString, database: "leiprova" };
}
