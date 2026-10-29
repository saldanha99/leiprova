import { mkdir,lstat,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertFgvRegistrationRequest,fgvHistoricalPreviousExam,previewFgvHistoricalPreviousExam,registerFgvHistoricalPreviousExam } from "../src/lib/exams/fgv-historical-previous-exam-admission";
import { safeOfficialCourseDossierError } from "./prepare-official-course-dossiers";

export function parseFgvHistoricalPreviousExamArgs(args:readonly string[]) {
  let apply=false,productSlug="",opportunityPublicId="",expectedNoticeSha256="",expectedFingerprint="",outputName="";
  const seen=new Set<string>();
  for(const [index,arg] of args.entries()) {
    if(arg==='--'&&index===0) continue;
    const key=arg.split('=',1)[0];
    if(seen.has(key)) throw new Error("Argumento repetido.");seen.add(key);
    if(arg==='--apply')apply=true;
    else if(arg.startsWith('--product='))productSlug=arg.slice('--product='.length);
    else if(arg.startsWith('--opportunity='))opportunityPublicId=arg.slice('--opportunity='.length);
    else if(arg.startsWith('--expected-notice-sha256='))expectedNoticeSha256=arg.slice('--expected-notice-sha256='.length);
    else if(arg.startsWith('--expected-fingerprint='))expectedFingerprint=arg.slice('--expected-fingerprint='.length);
    else if(arg.startsWith('--output='))outputName=arg.slice('--output='.length);
    else throw new Error("Argumento desconhecido; operador do lote FGV histórico.");
  }
  const target=fgvHistoricalPreviousExam(productSlug);
  outputName ||= `${target.editionPublicId}-20261029`;
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/u.test(outputName))throw new Error("Saída privada exige nome simples, sem caminho.");
  if(!apply&&seen.has('--expected-fingerprint'))throw new Error("Fingerprint de aplicação somente com apply explícito.");
  const request={productSlug,mode:apply?'apply' as const:'preview' as const,opportunityPublicId,expectedNoticeSha256,expectedFingerprint:expectedFingerprint||undefined};
  if(apply||seen.has('--opportunity')||seen.has('--expected-notice-sha256'))assertFgvRegistrationRequest(request);
  return {apply,databasePreview:!apply&&Boolean(opportunityPublicId),request,outputName,target};
}
async function outputDirectory(name:string) {
  for(const path of [resolve('.local'),resolve('.local/editorial'),resolve('.local/editorial/fgv-historical-previous-exam-previews')]) {
    try{const info=await lstat(path);if(!info.isDirectory()||info.isSymbolicLink())throw new Error("Diretório privado inválido/symlink.");}
    catch(error){if(!error||typeof error!=='object'||!('code' in error)||error.code!=='ENOENT')throw error;await mkdir(path,{mode:0o700});}
  }
  const output=resolve('.local/editorial/fgv-historical-previous-exam-previews',name);await mkdir(output,{recursive:true,mode:0o700});return output;
}
async function main() {
  const args=parseFgvHistoricalPreviousExamArgs(process.argv.slice(2));
  const result=args.apply||args.databasePreview?await registerFgvHistoricalPreviousExam(args.request):await previewFgvHistoricalPreviousExam(args.target);
  const path=resolve(await outputDirectory(args.outputName),args.apply?'receipt.json':args.databasePreview?'database-preview.json':'preview.json');
  await writeFile(path,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({mode:result.mode,output:path,productSlug:args.target.productSlug,
    fingerprint:'fingerprint' in result?result.fingerprint:null,questionsImported:0,productsReleased:0}));
}
if(process.argv[1]?.endsWith('register-fgv-historical-previous-exam-links.ts'))void main().catch((error:unknown)=>{
  console.error('Cadastro FGV histórico bloqueado:',safeOfficialCourseDossierError(error));process.exitCode=1;
});
