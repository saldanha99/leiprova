import { mkdir, lstat, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import postgres from "postgres";
import { CAMARA_CP_CORRECTION, compareCamaraCpCorrection, cpCorrectionSha256, fetchCamaraCpCorrectionEvidence, storedCpCorrectionFingerprint, type StoredCpCorrectionArticle } from "../src/lib/official-sources/camara-cp-correction-parser";

export function parseCpCorrectionPreviewArgs(args: readonly string[]) {
  if (args.length !== 1 || !/^output=[a-z0-9][a-z0-9-]{0,63}$/u.test(args[0])) throw new Error("Prévia aceita somente output=<nome privado>; não aceita --apply.");
  return { outputName: args[0].slice("output=".length) };
}
export function requireCpCorrectionPreviewDatabase(url: string | undefined) {
  if (!url) throw new Error("Defina MIGRATION_DATABASE_URL existente somente na VPS.");
  const target = new URL(url);
  if (!["postgres:", "postgresql:"].includes(target.protocol) || decodeURIComponent(target.username) !== "leiprova_owner" || target.pathname !== "/leiprova") throw new Error("Prévia exige leiprova_owner/banco leiprova; somente leitura.");
  return url;
}

async function createPrivateOutput(name: string) {
  const base = resolve(".local/editorial/cp-correction-previews");
  // Recusar symlinks em cada nível, inclusive antes de criar a pasta privada.
  for (const path of [resolve(".local"), resolve(".local/editorial"), base]) {
    try { const stat = await lstat(path); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Diretório privado inválido/symlink."); }
    catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error; await mkdir(path, { mode: 0o700 }); }
  }
  const output = resolve(base, name);
  if (relative(base, output) !== name || dirname(output) !== base) throw new Error("Saída fora da pasta privada.");
  await mkdir(output, { mode: 0o700 }); // EEXIST bloqueia sobrescrita de recibo/captura.
  return output;
}

async function main() {
  const command = parseCpCorrectionPreviewArgs(process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--")));
  const url = requireCpCorrectionPreviewDatabase(process.env.MIGRATION_DATABASE_URL);
  const fresh = await fetchCamaraCpCorrectionEvidence();
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  try {
    const stored = await client.begin("read only", async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`set local lock_timeout='3s'`;
      const [identity] = await tx<{ database: string; role: string; readOnly: string }[]>`select current_database() as database,current_user as role,current_setting('transaction_read_only') as "readOnly"`;
      if (identity.database !== "leiprova" || identity.role !== "leiprova_owner" || identity.readOnly !== "on") throw new Error("Transação/alvo somente leitura não confirmados.");
      const [version] = await tx<{ id: number; legalActId: number; status: string; checksum: string; sourceUrl: string; slug: string; urn: string; active: boolean; actType: string; actNumber: string; actYear: number }[]>`
        select v.id::int as id,v.legal_act_id::int as "legalActId",v.status,v.checksum_sha256 as checksum,v.source_url as "sourceUrl",a.slug,a.urn,a.is_active as active,a.act_type as "actType",a.act_number as "actNumber",a.act_year as "actYear"
        from legal_versions v join legal_acts a on a.id=v.legal_act_id where v.id=63`;
      if (!version || version.id !== 63 || version.legalActId !== 17 || version.status !== "current" || version.checksum !== CAMARA_CP_CORRECTION.oldVersionChecksum || version.sourceUrl !== "https://legis.senado.leg.br/norma/527942/publicacao/39870011" || version.slug !== "codigo-penal" || version.urn !== "urn:lex:br:federal:decreto.lei:1940-12-07;2848" || !version.active || version.actType !== "decreto-lei" || version.actNumber !== "2.848" || version.actYear !== 1940) throw new Error("Versão CP63/ato17 divergente; não assumir novo perfil.");
      const rows = await tx<StoredCpCorrectionArticle[]>`
        select r.id::int as id,r.legal_version_id::int as "versionId",r.path,r.article_order as "articleOrder",r.heading,r.literal_text as "literalText",r.source_rights as "sourceRights",r.editorial_status as "editorialStatus",
          (select count(*)::int from questions q where q.legal_article_id=r.id) as "questionCount",
          (select count(*)::int from contest_product_question_bindings b where b.legal_article_id=r.id) as "bindingCount",
          (select count(*)::int from opportunity_requirements p where p.legal_article_id=r.id) as "primaryRequirementCount",
          (select count(*)::int from opportunity_requirement_articles p where p.legal_article_id=r.id) as "additionalRequirementCount"
        from legal_articles r where r.legal_version_id=63 order by r.article_order`;
      return { version, rows, observedAt: new Date().toISOString(), database: identity.database, role: identity.role, transactionReadOnly: true };
    });
    const age = Date.now() - fresh.body.fetchedAt.getTime();
    if (age < -30_000 || age > 300_000) throw new Error("Captura perdeu frescor; produzir outra prévia.");
    const diff = compareCamaraCpCorrection(stored.rows, fresh.parsed, fresh.amendment.bytes);
    const oldStates = stored.rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.editorialStatus]: (counts[row.editorialStatus] ?? 0) + 1 }), {});
    const fingerprint = cpCorrectionSha256(JSON.stringify({ parser: fresh.parsed.parserVersion, raw: fresh.parsed.rawSha256, canonical: fresh.parsed.canonicalSha256, amendmentRaw: cpCorrectionSha256(fresh.amendment.bytes), oldCorpus: storedCpCorrectionFingerprint(stored.rows), rows: stored.rows.map(row => [row.id, row.editorialStatus, row.questionCount, row.bindingCount, row.primaryRequirementCount, row.additionalRequirementCount]) }));
    const output = await createPrivateOutput(command.outputName);
    const receipt = { mode: "preview_only", fingerprint, parserVersion: fresh.parsed.parserVersion, rawSha256: fresh.parsed.rawSha256, canonicalSha256: fresh.parsed.canonicalSha256,
      officialUrl: CAMARA_CP_CORRECTION.url, fetchedAt: fresh.body.fetchedAt.toISOString(), robotsHttp: fresh.robots.status, robotsSha256: cpCorrectionSha256(fresh.robots.bytes),
      amendmentUrl: CAMARA_CP_CORRECTION.amendmentUrl, amendmentRawSha256: cpCorrectionSha256(fresh.amendment.bytes), amendmentFetchedAt: fresh.amendment.fetchedAt.toISOString(),
      oldVersionId: 63, oldVersionChecksum: CAMARA_CP_CORRECTION.oldVersionChecksum, oldStates, candidateArticles: 402, candidateStatus: "unapproved_candidate", withdrawn: 31, oldMissing: diff.missing.length, counts: diff.counts,
      observedAt: stored.observedAt, transactionReadOnly: true, databaseWrites: 0, snapshotsPersisted: 0, currentVersionsChanged: 0, questionsApproved: 0, publicationAllowed: false, humanReview: false, outputDirectory: output };
    await writeFile(resolve(output, "cp-current.html"), fresh.body.bytes, { mode: 0o600, flag: "wx" });
    await writeFile(resolve(output, "law-15517-original.html"), fresh.amendment.bytes, { mode: 0o600, flag: "wx" });
    await writeFile(resolve(output, "diff.json"), JSON.stringify({ receipt, stored, diff }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await writeFile(resolve(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify(receipt, null, 2));
  } finally { await client.end(); }
}
if (process.argv[1]?.endsWith("preview-camara-cp-correction.ts")) void main().catch((error: unknown) => {
  const message = error instanceof Error && error.name !== "PostgresError" ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]") : "Falha operacional; diagnóstico privado na VPS.";
  console.error("Prévia CP bloqueada.", message); process.exitCode = 1;
});
