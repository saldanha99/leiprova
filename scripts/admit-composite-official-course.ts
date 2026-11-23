import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { admitCompositeOfficialCourse, assertCompositeHashes, compositeBank, compositeCourseTarget, compositeProgrammeRequirements, verifyCompositeMetadata, COMPOSITE_ADMISSION_TARGETS } from "../src/lib/editorial/composite-course-admission";
import { buildNextOfficialCoursePreview } from "../src/lib/editorial/official-course-preview-candidates";
import { captureOfficialPdf, captureOfficialPdfFromBytes, type CapturedOfficialDocument } from "../src/lib/opportunities/official-document-fetch";
import { buildDirectOfficialDocumentCandidate } from "../src/lib/opportunities/official-document-policy";
import { safeOfficialCourseDossierError } from "./prepare-official-course-dossiers";

export function parseCompositeCourseArgs(argv: readonly string[]) {
  const slugs: string[] = [];
  const expectedHashes = new Map<string, string>();
  const documentFiles = new Map<string, string>();
  let expectedProgrammeHash = "";
  let output = ".local/editorial/composite-course-admission-20261012";
  let apply = false;
  for (const arg of argv.filter((value) => value !== "--")) {
    if (arg === "--apply" && !apply) apply = true;
    else if (arg.startsWith("--product=")) slugs.push(arg.slice("--product=".length));
    else if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else if (arg.startsWith("--expected-programme-sha256=") && !expectedProgrammeHash) expectedProgrammeHash = arg.slice("--expected-programme-sha256=".length);
    else if (arg.startsWith("--expected-document=")) {
      const match = /^--expected-document=([a-z0-9-]+):([a-f0-9]{64})$/u.exec(arg);
      if (!match || expectedHashes.has(match[1])) throw new Error("Hash documental inválido ou repetido.");
      expectedHashes.set(match[1], match[2]);
    } else if (arg.startsWith("--document-file=")) {
      // PDF baixado pelo navegador da URL oficial, quando o WAF da origem recusa o servidor (DOM de Manaus).
      const match = /^--document-file=([a-z0-9-]+):(\/[^\0]+\.pdf)$/u.exec(arg);
      if (!match || documentFiles.has(match[1])) throw new Error("Arquivo documental inválido ou repetido.");
      documentFiles.set(match[1], match[2]);
    } else throw new Error("Argumento desconhecido/repetido; operador delimitado a prévia ou aplicação explícita.");
  }
  if (new Set(slugs).size !== slugs.length) throw new Error("Produto repetido.");
  const products = slugs.length ? slugs : COMPOSITE_ADMISSION_TARGETS.map((item) => item.productSlug);
  for (const slug of products) compositeCourseTarget(slug);
  if (apply) {
    if (slugs.length !== 1) throw new Error("Apply exige exatamente um produto explícito.");
    assertCompositeHashes(compositeCourseTarget(slugs[0]).recipe, expectedHashes, expectedProgrammeHash);
  } else if (expectedHashes.size || expectedProgrammeHash) throw new Error("Fingerprints só são aceitos com apply explícito.");
  const outputDirectory = resolve(output);
  const child = relative(resolve(".local"), outputDirectory);
  if (!child || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) throw new Error("Saída privada abaixo de .local obrigatória.");
  return { products, expectedHashes, expectedProgrammeHash, apply, outputDirectory, documentFiles };
}

async function main() {
  const args = parseCompositeCourseArgs(process.argv.slice(2));
  await mkdir(args.outputDirectory, { recursive: true, mode: 0o700 });
  for (const slug of args.products) {
    const { recipe, target } = compositeCourseTarget(slug);
    const sourceId = compositeBank(target).sourceId;
    const captures = new Map<string, CapturedOfficialDocument>();
    const capturedAt = new Map<string, string>();
    // At most four bounded PDFs, fetched sequentially; never fetch question text into this map.
    for (const doc of recipe.documents) {
      // Documento com SHA-256 de download do operador fixado na receita: só entra pelo arquivo
      // informado, conferido contra esse hash e a URL oficial; os demais seguem pela captura de rede.
      const pinned = "operatorDownloadSha256" in doc ? doc.operatorDownloadSha256 : undefined;
      const file = args.documentFiles.get(doc.key);
      if (Boolean(pinned) !== Boolean(file)) throw new Error("Arquivo local só para documento com hash de download fixado na receita, e obrigatório nele.");
      const capture = pinned && file
        ? await captureOfficialPdfFromBytes(new Uint8Array(await readFile(file)), doc.url, doc.title, sourceId, pinned)
        : await captureOfficialPdf(buildDirectOfficialDocumentCandidate(doc.url, sourceId, doc.title), sourceId);
      captures.set(doc.key, capture);
      capturedAt.set(doc.key, new Date().toISOString());
    }
    const result = args.apply ? await admitCompositeOfficialCourse({ productSlug: slug, captures, capturedAt,
      expectedHashes: args.expectedHashes, expectedProgrammeHash: args.expectedProgrammeHash }) : await (async () => {
      const metadata = await verifyCompositeMetadata(slug);
      const preview = buildNextOfficialCoursePreview(recipe, captures, new Date().toISOString(), metadata.previous);
      const requirements = compositeProgrammeRequirements(preview.programme.sections, recipe.repeatableRequirements ?? [], recipe.skipRepeatedRequirements ?? false);
      return { ...preview, stageEvidence: metadata.stages, captureReceipts: [...capturedAt].map(([key, timestamp]) => ({ key, capturedAt: timestamp })),
        requirements: requirements.length, legalMappingsApproved: 0, questionsApproved: 0, productsReleased: 0,
        applySupported: true, databaseWrites: 0, admissionApplied: false, productStatus: "draft" };
    })();
    const output = resolve(args.outputDirectory, `${slug}.${args.apply ? "receipt" : "preview"}.json`);
    await writeFile(output, JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ mode: args.apply ? "applied" : "preview", productSlug: slug, output,
      captures: recipe.documents.map((doc) => ({ key: doc.key, checksumSha256: captures.get(doc.key)!.checksumSha256 })),
      questionsApproved: 0, productsReleased: 0 }, null, 2));
  }
}

if (process.argv[1]?.endsWith("admit-composite-official-course.ts")) void main().catch((error: unknown) => {
  console.error("Falha na admissão composta delimitada:", safeOfficialCourseDossierError(error));
  process.exitCode = 1;
});
