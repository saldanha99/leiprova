import { mkdir, lstat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  MPRJ_OFFICIAL_PREVIOUS_EXAM,
  assertMprjRegistrationRequest,
  previewMprjPreviousExam,
  registerMprjPreviousExam,
} from "../src/lib/exams/mprj-previous-exam-admission";
import { safeOfficialCourseDossierError } from "./prepare-official-course-dossiers";

// Operador exclusivo da prova preambular MPRJ XXXIX/2026 com evidência final
// composta. Sem --apply, nada é gravado: a prévia só lê fonte oficial e banco.
// Uso: pnpm exams:mprj:register [--opportunity=<uuid> --expected-notice-sha256=<sha>]
//      [--apply --expected-fingerprint=<sha>] [--output=<nome privado>]

const PREVIEW_DIRECTORY = ".local/editorial/mprj-previous-exam-previews";

export function parseMprjPreviousExamArgs(args: readonly string[]) {
  let apply = false;
  let opportunityPublicId = "";
  let expectedNoticeSha256 = "";
  let expectedFingerprint = "";
  let outputName = "mprj-previous-exam-20261015";
  const seen = new Set<string>();
  for (const [index, arg] of args.entries()) {
    if (arg === "--" && index === 0) continue;
    const key = arg.split("=", 1)[0];
    if (seen.has(key)) throw new Error("Argumento repetido.");
    seen.add(key);
    if (arg === "--apply") apply = true;
    else if (arg.startsWith("--opportunity=")) opportunityPublicId = arg.slice("--opportunity=".length);
    else if (arg.startsWith("--expected-notice-sha256=")) expectedNoticeSha256 = arg.slice("--expected-notice-sha256=".length);
    else if (arg.startsWith("--expected-fingerprint=")) expectedFingerprint = arg.slice("--expected-fingerprint=".length);
    else if (arg.startsWith("--output=")) outputName = arg.slice("--output=".length);
    else throw new Error("Argumento desconhecido; operador exclusivo MPRJ XXXIX/2026 preambular.");
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(outputName)) {
    throw new Error("Saída privada exige nome simples, sem caminho.");
  }
  if (!apply && seen.has("--expected-fingerprint")) {
    throw new Error("Fingerprint de aplicação somente com apply explícito.");
  }
  const request = {
    mode: apply ? ("apply" as const) : ("preview" as const),
    opportunityPublicId,
    expectedNoticeSha256,
    expectedFingerprint: expectedFingerprint || undefined,
  };
  if (apply || seen.has("--opportunity") || seen.has("--expected-notice-sha256")) {
    assertMprjRegistrationRequest(request);
  }
  return { apply, databasePreview: !apply && Boolean(opportunityPublicId), request, outputName };
}

async function outputDirectory(name: string) {
  for (const path of [resolve(".local"), resolve(".local/editorial"), resolve(PREVIEW_DIRECTORY)]) {
    try {
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("Diretório privado inválido/symlink.");
      }
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
      await mkdir(path, { mode: 0o700 });
    }
  }
  const output = resolve(PREVIEW_DIRECTORY, name);
  await mkdir(output, { mode: 0o700 });
  return output;
}

async function main() {
  const args = parseMprjPreviousExamArgs(process.argv.slice(2));
  const result =
    args.apply || args.databasePreview
      ? await registerMprjPreviousExam(args.request)
      : await previewMprjPreviousExam();
  const path = resolve(await outputDirectory(args.outputName), args.apply ? "receipt.json" : "preview.json");
  await writeFile(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(
    JSON.stringify({
      mode: result.mode,
      output: path,
      productSlug: MPRJ_OFFICIAL_PREVIOUS_EXAM.productSlug,
      answerKeyFinality: MPRJ_OFFICIAL_PREVIOUS_EXAM.answerKeyFinality,
      fingerprint: "fingerprint" in result ? result.fingerprint : null,
      questionsImported: 0,
      productsReleased: 0,
      publicationAllowed: false,
      humanReview: false,
    }),
  );
}

if (process.argv[1]?.endsWith("register-mprj-previous-exam-links.ts")) {
  void main().catch((error: unknown) => {
    console.error("Cadastro MPRJ bloqueado:", safeOfficialCourseDossierError(error));
    process.exitCode = 1;
  });
}
