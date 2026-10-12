import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { buildNextOfficialCoursePreview, NEXT_OFFICIAL_COURSE_RECIPES } from "../src/lib/editorial/official-course-preview-candidates";
import { captureOfficialPdf, type CapturedOfficialDocument } from "../src/lib/opportunities/official-document-fetch";
import { buildDirectOfficialDocumentCandidate } from "../src/lib/opportunities/official-document-policy";
import { verifyOfficialExamUrl } from "../src/lib/official-sources/fetch";
import { safeOfficialCourseDossierError } from "./prepare-official-course-dossiers";

export function parseNextOfficialDossierArgs(argv: readonly string[]) {
  let output = ".local/editorial/official-course-next-20261012-final";
  const slugs: string[] = [];
  for (const arg of argv.filter((value) => value !== "--")) {
    if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else if (arg.startsWith("--product=")) slugs.push(arg.slice("--product=".length));
    else throw new Error("Comando somente de prévia: aceita --product e --output; apply não disponível.");
  }
  const recipes = slugs.length ? NEXT_OFFICIAL_COURSE_RECIPES.filter((recipe) => slugs.includes(recipe.productSlug)) : NEXT_OFFICIAL_COURSE_RECIPES;
  if (new Set(slugs).size !== slugs.length || recipes.length !== (slugs.length || NEXT_OFFICIAL_COURSE_RECIPES.length)) throw new Error("Alvo de prévia desconhecido ou repetido.");
  const outputDirectory = resolve(output);
  const child = relative(resolve(".local"), outputDirectory);
  if (!child || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) throw new Error("Saída privada abaixo de .local obrigatória.");
  return { recipes, outputDirectory };
}

async function main() {
  const { recipes, outputDirectory } = parseNextOfficialDossierArgs(process.argv.slice(2));
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  for (const recipe of recipes) {
    const captures = new Map<string, CapturedOfficialDocument>();
    const captureReceipts: { key: string; capturedAt: string }[] = [];
    // Sequential PDF capture; references and third-party question bodies never enter this map.
    for (const doc of recipe.documents) {
      const capture = await captureOfficialPdf(buildDirectOfficialDocumentCandidate(doc.url, "fgv-conhecimento", doc.title), "fgv-conhecimento");
      captures.set(doc.key, capture);
      const capturedAt = new Date().toISOString();
      captureReceipts.push({ key: doc.key, capturedAt });
      const prefix = resolve(outputDirectory, doc.key);
      await writeFile(`${prefix}.pdf`, capture.documentBytes, { mode: 0o600, flag: "wx" });
      const { documentBytes: omitted, ...snapshot } = capture;
      void omitted;
      await writeFile(`${prefix}.snapshot.json`, JSON.stringify({ ...snapshot, capturedAt }, null, 2), { mode: 0o600, flag: "wx" });
    }
    const previousMetadata: Record<string, unknown>[] = [];
    for (const doc of recipe.previousExam.documents) {
      const metadata = await verifyOfficialExamUrl("fgv", doc.url);
      previousMetadata.push({ ...doc, ...metadata, disposition: metadata.httpStatus === 200 && metadata.isPdf && metadata.finalUrl === doc.url ? "available_external_link_pending_review" : "blocked_or_unverified", distributionMode: "external_link", sourceContentStored: false, verificationPolicy: "existing_official_exam_verifier_bounded_transient_bytes_no_storage_or_extraction" });
    }
    const preview = { ...buildNextOfficialCoursePreview(recipe, captures, new Date().toISOString(), previousMetadata), captureReceipts };
    const path = resolve(outputDirectory, `${recipe.productSlug}.preview.json`);
    await writeFile(path, JSON.stringify(preview, null, 2), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ productSlug: recipe.productSlug, output: path, programmeHash: preview.programme.checksumSha256,
      effectiveSubjects: preview.programme.sections.length, replacedSubjects: preview.programme.superseded.length, captures: preview.captures,
      previousLinks: previousMetadata.map((metadata) => ({ type: metadata.type, httpStatus: metadata.httpStatus, disposition: metadata.disposition })), applySupported: false, databaseWrites: 0 }));
  }
}

if (process.argv[1]?.endsWith("prepare-next-official-course-dossiers.ts")) void main().catch((error: unknown) => {
  console.error("Falha na prévia oficial delimitada:", safeOfficialCourseDossierError(error));
  process.exitCode = 1;
});
