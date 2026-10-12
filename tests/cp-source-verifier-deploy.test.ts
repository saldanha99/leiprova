import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const wrapper=resolve("deploy/verify-cp-correction-source.sh");
function receipt(value:unknown) {
  const directory=mkdtempSync(join(tmpdir(),"leiprova-cp-monitor-test-"));
  try {
    const file=join(directory,"synthetic.json");writeFileSync(file,JSON.stringify(value),{mode:0o600});
    return spawnSync("bash",["-c",'source "$1"; cp_verification_receipt "$2"',"synthetic-test",wrapper,file],{encoding:"utf8",timeout:5000});
  }finally{rmSync(directory,{recursive:true,force:true});}
}

describe("wrapper de verificação CP usa infraestrutura existente sem cron/daemon",()=> {
  it("shell válido e executável, recibo real obrigatório e lock compartilhado",()=> {
    expect(()=>execFileSync("bash",["-n",wrapper])).not.toThrow();expect(statSync(wrapper).mode&0o111).toBeTruthy();
    const source=readFileSync(wrapper,"utf8");
    expect(source).toContain("procurement_monitor_guard");expect(source).toContain("/run/lock/leiprova-supplementary-monitor.lock");expect(source).toContain("/opt/leiprova/.local/editorial/cp-current-receipt.json");
    expect(source).toContain("--kill-after=15s 240s");expect(source).toContain("--rm --no-deps");expect(source).toContain("--env-file-if-exists=.env");
    expect(source).not.toMatch(/\b(?:crontab|systemctl|pnpm build|docker pull)\b/u);
  });
  it("somente verified com versão/auditoria reais e humanfalse é sucesso",()=> {
    expect(receipt({mode:"verified",auditId:1,versionId:112,humanReview:false,sourceVerificationSucceeded:true}).status).toBe(0);
    for(const value of [{mode:"preview",auditId:1,versionId:112,humanReview:false,sourceVerificationSucceeded:true},{mode:"verified",auditId:true,versionId:112,humanReview:false,sourceVerificationSucceeded:true},{mode:"verified",auditId:1,versionId:63,humanReview:false,sourceVerificationSucceeded:true},{mode:"verified",auditId:1,versionId:112,humanReview:true,sourceVerificationSucceeded:true},{mode:"verified",auditId:1,versionId:112,humanReview:false,sourceVerificationSucceeded:false}]) expect(receipt(value).status).toBe(11);
  });
  it("suspensão auditada exige atenção, nunca é verificação bem-sucedida",()=> {
    const suspended=receipt({mode:"suspended",auditId:2,versionId:112,humanReview:false,sourceVerificationSucceeded:false});expect(suspended.status).toBe(10);expect(suspended.stderr).toContain("suspenso");
  });
});
