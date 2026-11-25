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
import { resolveWaveScope, saoPauloDate, scopeLaws, seoWave, shiftDate, wavePace } from "@/lib/seo/wave";

async function main() {
  const apply = process.argv.includes("--apply");
  const snapshots = [];
  for (const law of await listLaws()) snapshots.push(await loadSnapshot(law));
  const current = currentLegalPages(snapshots);
  const now = new Date();
  const plan = planPageState(current, await readPageStates(), now);
  const wave = seoWave();
  const pace = wavePace();
  const today = saoPauloDate(now);
  const laws = scopeLaws(snapshots);
  const scope = resolveWaveScope(laws, wave, pace, today);
  const yesterday = resolveWaveScope(laws, wave, pace, shiftDate(today, -1));
  const inScope = (path: string, target = scope) => (path.split("/").length > 3 ? target.hasArticle(path) : target.hasLaw(path));
  // Changed pages of the wave, plus indexable pages the paced wave released today (timer runs daily).
  const released = current.filter((page) => page.indexable && inScope(page.path) && !inScope(page.path, yesterday)).map((page) => page.path);
  const notify = [...new Set([...plan.changedPaths.filter((path) => inScope(path)), ...released])];
  const report = {
    mode: apply ? "apply" : "preview",
    wave,
    ...(scope.release ? { paced: { ...scope.release, daily: pace.daily, start: pace.start, releasedToday: released.length } } : {}),
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
