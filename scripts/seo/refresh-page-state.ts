/**
 * Atualiza seo_page_state (hash do conteúdo e data real de mudança) e lista as
 * URLs que entraram, mudaram ou saíram do índice. IndexNow só é chamado com
 * --apply e INDEXNOW_KEY definida; sem a chave, nada é enviado.
 *
 *   pnpm seo:page-state            # prévia, não grava
 *   pnpm seo:page-state --apply    # grava a tabela (exige a migration 0057)
 */
import { closeDb } from "@/lib/db/client";
import { absoluteUrl } from "@/lib/seo";
import { submitIndexNow } from "@/lib/seo/indexnow";
import { listLaws, loadSnapshot } from "@/lib/seo/legal-data";
import { currentLegalPages, readPageStates, writePageStates } from "@/lib/seo/page-state-db";
import { planPageState } from "@/lib/seo/page-state";
import { articleInWave, lawInWave, seoWave } from "@/lib/seo/wave";

async function main() {
  const apply = process.argv.includes("--apply");
  const snapshots = [];
  for (const law of await listLaws()) snapshots.push(await loadSnapshot(law));
  const current = currentLegalPages(snapshots);
  const plan = planPageState(current, await readPageStates(), new Date());
  const wave = seoWave();
  const notify = plan.changedPaths.filter((path) => (path.split("/").length > 3 ? articleInWave(path, wave) : lawInWave(path, wave)));
  const report = {
    mode: apply ? "apply" : "preview",
    wave,
    pages: plan.rows.length,
    indexable: plan.rows.filter((row) => row.indexable).length,
    changed: plan.changedPaths.length,
    indexNowCandidates: notify.length,
    indexNow: apply ? await submitIndexNow(notify.map((path) => absoluteUrl(path))) : { sent: false, reason: "preview" },
  };
  if (apply) await writePageStates(plan.rows);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Falha ao atualizar seo_page_state: ${error instanceof Error ? error.message : "erro desconhecido"}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
