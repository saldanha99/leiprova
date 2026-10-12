import { cpCorrectionSha256, CAMARA_CP_CORRECTION, type StoredCpCorrectionArticle } from "./camara-cp-correction-parser";

export const CP_CUT_REFERENCE = "owner-standing-2026-10-12:official-sources-programs";
export const CP_CUT_POLICY = "cp63-camara402-enac5-v1";
export const CP_CUT_CONTRACT = "7660bfd0c5dde3d5d866307f462053530e9923726c81f25adb1ca169694d6ad7";
export const CP_CUT_PRODUCT = "enac-exame-nacional-dos-cartorios-2026-2";
export const CP_CUT_OPINION_HASH = "3824213b864b66601cee2062e241e9be300cfee97f19ecf8228c7e9bbd4fdc99";
/** These hashes identify the five original items actually compared privately. No question text is shipped. */
export const CP_CUT_ITEMS = [
  [1285, "C", "01483c80c0ceecf5e9b92fe6fd8fcbea1b5417304834be7414edc5ec49daee5d", "c429de3a193807a01d8023885f8e2ee3ec1c308bf3da2ae56a5a055587aa92d1", "b671b3495733c8edcbee08d6049cdf5b0bab8ac473d3c29e4accda89f0d9a5c3"],
  [1286, "A", "07bb0c5ffa8259bf496d03d810610496150df615eaf7c6b68388218127911c60", "b00c9f2672f151a127c7a884931e8a582269e430e808a770308f919089969d57", "3283fb8ece2e3e08c8f164a93a5da77c8bac53c4780145afe0b1ead52d80693d"],
  [1287, "E", "18dcd1513445474cd68ca31956806ef299fe001b441d5ba2cfe316ae82dcd665", "7f8e7d25d11bc986c1ed2799fe6ac363c196b0811580ee29a4e334d1d23c85f1", "e256a7e645a3aeb936be90f9a03150fe0b5031d34875e811dbe30e3e1aad433f"],
  [1288, "B", "91429aaad94ab7400627043360f9588b34b85b4cae9a3c3d87471ad36e2a9d5c", "c7ca48828085fb2ab03485d5d1b2733acc12570182389201e7c007722965374b", "3afe31a77fa13bc0ddb2131983f473999fe02495425557997428bcdacb82205c"],
  [1289, "D", "bb917c4dc963428b556f95d500cd781c3ec33855220ade9d7e8c4428bd2c5d16", "ed479f5a3f9bf0683754bc16347c24fcb9e16fb453e7953a34d4eb10ab32b488", "723773f91ceb1b48c22ec27ced7bc4219916ce4d35d7941983d7f9a7e2caf597"],
] as const;
export const CP_CUT_SCOPE_NOTE = "Questão inédita própria sobre Código Penal, art. 351, conferida automaticamente contra a redação atual da Câmara. Cobre somente a regra citada do item Conteúdo programático, p. 28, ENAC2026.2; não cobre todo o programa. Aprovação permanente do proprietário, sem revisão humana, com conferência posterior pelo Maestro.";
const OLD_FOOTER = "Fonte: Código Penal, art. 351, corpus ID 3733, versão 63.";

export function cpCutReplacement(questionId: number, explanation: string, corrected351: string) {
  const item = CP_CUT_ITEMS.find(([id]) => id === questionId);
  if (!item || !explanation.endsWith(OLD_FOOTER) || explanation.split(OLD_FOOTER).length !== 2) throw new Error("Item/footer fora do parecer delimitado das cinco inéditas.");
  const lines = corrected351.split("\n");
  if (lines.length !== 6 || !lines[0].startsWith("Art. 351.") || !lines[1].startsWith("Pena - ") || lines.slice(2).some((line, index) => !line.startsWith(`§ ${index + 1}º `))) throw new Error("Literal351 corrigida incompleta ou fronteira desconhecida.");
  const paragraph = questionId - 1285;
  const locator = paragraph === 0 ? "caput" : `§ ${paragraph}º`;
  const footer = `Fonte: Código Penal, art. 351, ${locator} — texto atualizado da Câmara dos Deputados.`;
  const legalQuote = paragraph === 0 ? lines.slice(0, 2).join("\n") : lines[paragraph + 1];
  return { explanation: explanation.slice(0, -OLD_FOOTER.length) + footer, legalQuote, sourceUrl: CAMARA_CP_CORRECTION.url, expectedContentHash: item[4], answer: item[1] };
}

export function assertCpCutImpact(rows: readonly StoredCpCorrectionArticle[]) {
  for (const row of rows) {
    const expected = row.id === 3733 ? [5, 5, 1, 0] : [0, 0, 0, 0];
    const observed = [row.questionCount, row.bindingCount, row.primaryRequirementCount, row.additionalRequirementCount];
    if (observed.some((value, index) => value !== expected[index])) throw new Error("Dependências do CP mudaram: este operador cobre somente as cinco ENAC e requisito667.");
  }
  if (!rows.some(row => row.id === 3733 && row.path === "art-351")) throw new Error("Dependência351 ausente.");
}

export type CpCutFloor = { slug: string; count: number; ready: boolean };
export function assertCpCutFloors(rows: readonly CpCutFloor[]) {
  const ready = rows.filter(row => row.ready).sort((a, b) => a.slug.localeCompare(b.slug));
  if (ready.length !== 3 || ready.reduce((sum, row) => sum + row.count, 0) !== 285 || !ready.some(row => row.slug === CP_CUT_PRODUCT && row.count === 70) || ready.some(row => row.count < 68) || !ready.some(row => row.slug === "enam-exame-nacional-da-magistratura-2026-2" && row.count === 146) || !ready.some(row => row.slug === "tc-df-analista-2026" && row.count === 69)) throw new Error("Piso real 3 preparações/285 questões (146/70/69) divergente; não ajustar o piso nem liberar produtos.");
  return ready;
}

export function parseCpCutArgs(args: readonly string[]) {
  const argv = args[0] === "--" ? args.slice(1) : [...args];
  const apply = argv.includes("--apply");
  const keys = new Set<string>(); const values: Record<string, string> = {};
  for (const arg of argv) {
    if (arg === "--apply") { if (keys.has("apply")) throw new Error("Modo repetido."); keys.add("apply"); continue; }
    const match = /^(output|fingerprint)=(.+)$/u.exec(arg);
    if (!match || keys.has(match[1])) throw new Error("Use output=<nome privado> [--apply fingerprint=<sha256>]; sem outros alvos/opções.");
    keys.add(match[1]); values[match[1]] = match[2];
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(values.output ?? "") || (apply ? !/^[a-f0-9]{64}$/u.test(values.fingerprint ?? "") : Boolean(values.fingerprint))) throw new Error("Prévia exige saída privada nova; apply exige fingerprint exato da prévia.");
  return { apply, output: values.output, fingerprint: values.fingerprint };
}
export function requireCpCutDatabase(value: string | undefined) {
  if (!value) throw new Error("MIGRATION_DATABASE_URL existente somente na VPS é obrigatória.");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || decodeURIComponent(url.username) !== "leiprova_owner" || url.pathname !== "/leiprova" || url.search || url.hash) throw new Error("Corte restrito a leiprova_owner/banco leiprova.");
  return value;
}
export function cpCutFingerprint(context: unknown) { return cpCorrectionSha256(JSON.stringify(context)); }
export function assertCpCutFresh(fetchedAt: Date, now = new Date()) {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(fetchedAt.getTime()) || now.getTime() - fetchedAt.getTime() > 300_000 || now.getTime() - fetchedAt.getTime() < -30_000) throw new Error("Captura oficial perdeu frescor de cinco minutos.");
}
