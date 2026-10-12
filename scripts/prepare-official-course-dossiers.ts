import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

import { buildOfficialCourseDossierPreview, OFFICIAL_COURSE_DOSSIER_RECIPES } from "../src/lib/editorial/official-course-dossier";
import { buildDirectOfficialDocumentCandidate } from "../src/lib/opportunities/official-document-policy";
import { captureOfficialPdf } from "../src/lib/opportunities/official-document-fetch";
import { admitStandingOfficialCourse } from "../src/lib/editorial/official-course-admission";

export function safeOfficialCourseDossierError(error: unknown) {
  if (!(error instanceof Error)) return "Erro operacional sem detalhe seguro.";
  if (error.name === "PostgresError" || ("code" in error && typeof error.code === "string" && /^[0-9A-Z]{5}$/u.test(error.code))) {
    return "Falha no banco durante a operação; detalhes PostgreSQL omitidos.";
  }
  return error.message
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"'<>]+/giu, "[URL omitida]")
    .replace(/\b(?:[spr]k_(?:live|test)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+|AIza[A-Za-z0-9_-]+)/gu, "[chave omitida]")
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|token|password|senha|secret)\s*[:=]\s*[^\s,;]+/giu, "[credencial omitida]")
    .replace(/\bBearer\s+[^\s,;]+/giu, "[credencial omitida]")
    .slice(0, 400);
}

export function parseOfficialCourseDossierArgs(argv: readonly string[]) {
  const slugs: string[] = [];
  let output = ".local/editorial/official-course-dossiers-20261012";
  let apply = false;
  let expectedHash = "";
  for (const arg of argv.filter((value) => value !== "--")) {
    if (arg === "--apply" && !apply) apply = true;
    else if (arg.startsWith("--expected-sha256=") && !expectedHash) expectedHash = arg.slice("--expected-sha256=".length);
    else if (arg.startsWith("--product=")) slugs.push(arg.slice("--product=".length));
    else if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else throw new Error(`Argumento não suportado: ${arg}. Este comando só produz prévia, sem aprovação no banco.`);
  }
  const recipes = slugs.length ? OFFICIAL_COURSE_DOSSIER_RECIPES.filter((item) => slugs.includes(item.productSlug)) : OFFICIAL_COURSE_DOSSIER_RECIPES;
  if (new Set(slugs).size !== slugs.length || recipes.length !== (slugs.length || OFFICIAL_COURSE_DOSSIER_RECIPES.length)) throw new Error("Produto desconhecido ou repetido.");
  if (apply && (slugs.length !== 1 || slugs[0] !== "mpe-mt-promotor-de-justica-2026" || !/^[a-f0-9]{64}$/u.test(expectedHash))) throw new Error("Apply exige MPMT único e --expected-sha256 da prévia conferida; MPGO bloqueado.");
  if (!apply && expectedHash) throw new Error("Fingerprint só é usado com --apply.");
  const privateRoot = resolve(".local");
  const outputDirectory = resolve(output);
  const child = relative(privateRoot, outputDirectory);
  if (!child || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) throw new Error("Saída deve ficar abaixo de .local; PDFs e textos nunca entram no Git.");
  return { recipes, outputDirectory, apply, expectedHash };
}

async function main() {
  const { recipes, outputDirectory, apply, expectedHash } = parseOfficialCourseDossierArgs(process.argv.slice(2));
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const results: Record<string, unknown>[] = [];
  // Sequential, max two configured PDFs: keeps memory bounded and respects access policy.
  for (const recipe of recipes) {
    const captured = await captureOfficialPdf(buildDirectOfficialDocumentCandidate(recipe.noticeUrl, "fgv-conhecimento", recipe.title), "fgv-conhecimento");
    const preview = buildOfficialCourseDossierPreview(recipe, captured, new Date().toISOString());
    if (apply) {
      console.log(JSON.stringify(await admitStandingOfficialCourse(recipe, captured, expectedHash), null, 2));
      continue;
    }
    const prefix = resolve(outputDirectory, recipe.productSlug);
    await writeFile(`${prefix}.pdf`, captured.documentBytes, { mode: 0o600, flag: "wx" });
    await writeFile(`${prefix}.snapshot.json`, JSON.stringify({ ...preview.capture, pageTexts: captured.pageTexts }, null, 2), { mode: 0o600, flag: "wx" });
    await writeFile(`${prefix}.preview.json`, JSON.stringify(preview, null, 2), { mode: 0o600, flag: "wx" });
    results.push({ productSlug: recipe.productSlug, checksumSha256: captured.checksumSha256, pageCount: captured.pageCount, programmePages: preview.programme.pages.length, output: `${prefix}.preview.json` });
  }
  if (!apply) console.log(JSON.stringify({ mode: "preview", databaseMutations: 0, humanReview: false, publicationAllowed: false, results }, null, 2));
}

if (process.argv[1]?.endsWith("prepare-official-course-dossiers.ts")) void main().catch((error: unknown) => {
  console.error("Falha na operação de dossiês oficiais:", safeOfficialCourseDossierError(error));
  process.exitCode = 1;
});
