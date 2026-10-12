import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { MPMT_OFFICIAL_PREVIOUS_EXAM, previewMpmtPreviousExam, registerMpmtPreviousExam } from "../src/lib/exams/mpmt-previous-exam-admission";
import { safeOfficialCourseDossierError } from "./prepare-official-course-dossiers";

export function parseMpmtPreviousExamArgs(argv: readonly string[]) {
  let apply = false; let opportunityPublicId = ""; let expectedNoticeSha256 = "";
  let output = ".local/editorial/mpmt-previous-exam-metadata-20261012";
  for (const [index,arg] of argv.entries()) {
    if (arg === "--" && index === 0) continue;
    if (arg === "--apply" && !apply) apply = true;
    else if (arg.startsWith("--opportunity=") && !opportunityPublicId) opportunityPublicId = arg.slice("--opportunity=".length);
    else if (arg.startsWith("--expected-notice-sha256=") && !expectedNoticeSha256) expectedNoticeSha256 = arg.slice("--expected-notice-sha256=".length);
    else if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else throw new Error("Argumento desconhecido/repetido; operador exclusivo MPMT 01/2026.");
  }
  if (apply && (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(opportunityPublicId) || expectedNoticeSha256 !== MPMT_OFFICIAL_PREVIOUS_EXAM.noticeSha256)) throw new Error("Apply exige ID real da oportunidade e hash exato do edital aprovado.");
  if (!apply && (opportunityPublicId || expectedNoticeSha256)) throw new Error("Identidade/hash de aplicação só são aceitos com apply explícito.");
  const outputDirectory = resolve(output);
  const child = relative(resolve(".local"),outputDirectory);
  if (!child || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) throw new Error("Saída privada abaixo de .local obrigatória.");
  return { apply, opportunityPublicId, expectedNoticeSha256, outputDirectory };
}

async function main() {
  const args = parseMpmtPreviousExamArgs(process.argv.slice(2));
  const result = args.apply ? await registerMpmtPreviousExam(args.opportunityPublicId,args.expectedNoticeSha256) : await previewMpmtPreviousExam();
  await mkdir(args.outputDirectory,{recursive:true,mode:0o700});
  const path=resolve(args.outputDirectory,`${args.apply?"receipt":"preview"}.json`);
  await writeFile(path,JSON.stringify(result,null,2),{flag:"wx",mode:0o600});
  console.log(JSON.stringify({mode:result.mode,output:path,productSlug:result.productSlug,questionsImported:0,productsReleased:0}));
}
if (process.argv[1]?.endsWith("register-mpmt-previous-exam-links.ts")) void main().catch((error:unknown)=>{
  console.error("Falha no cadastro de metadados MPMT:",safeOfficialCourseDossierError(error));process.exitCode=1;
});
