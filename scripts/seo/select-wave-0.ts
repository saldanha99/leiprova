/**
 * Seleciona as páginas de artigo da onda 0 (docs/seo/ondas.md) e grava
 * docs/seo/onda-0-300.txt e src/lib/seo/waves/onda-0.ts. Só leitura no banco.
 *
 *   pnpm seo:wave:select            # mostra o resumo, não grava
 *   pnpm seo:wave:select --write    # grava os dois arquivos
 */
import { writeFileSync } from "node:fs";

import { closeDb } from "@/lib/db/client";
import { listLaws, loadSnapshot } from "@/lib/seo/legal-data";
import { selectWave, type WaveLaw } from "@/lib/seo/wave";

const WAVE_SIZE = 300;
const WAVE_LAWS = 10;

async function main() {
  const write = process.argv.includes("--write");
  const laws = await listLaws();
  const waveLaws: WaveLaw[] = [];
  const summary: { law: string; products: number; candidates: number; reviewedQuestions: number }[] = [];
  for (const law of laws) {
    // A resposta direta autoral ainda não existe no banco: a seleção usa todos os
    // outros itens do gate 3.2 (o item faltante é tratado pela flag na publicação).
    const snapshot = await loadSnapshot(law, { requireDirectAnswer: false });
    const candidates = snapshot.articles
      .filter((article) => article.gate.status === "index")
      .map((article) => ({ path: article.path, questions: article.reviewedQuestionCount, order: article.articleOrder }));
    waveLaws.push({ path: snapshot.path, productCount: law.productCount, candidates });
    summary.push({ law: snapshot.path, products: law.productCount, candidates: candidates.length, reviewedQuestions: snapshot.reviewedQuestionCount });
  }
  const selected = selectWave(waveLaws, WAVE_SIZE, WAVE_LAWS);
  const perLaw = new Map<string, number>();
  for (const path of selected) {
    const lawPath = path.split("/").slice(0, 3).join("/");
    perLaw.set(lawPath, (perLaw.get(lawPath) ?? 0) + 1);
  }
  const report = {
    generatedAt: new Date().toISOString(),
    gatePassingArticles: waveLaws.reduce((sum, law) => sum + law.candidates.length, 0),
    selected: selected.length,
    perLaw: Object.fromEntries(perLaw),
    laws: summary,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!write) return;

  const header = [
    "# Onda 0: páginas de artigo liberadas no sitemap com SEO_WAVE=0.",
    `# Gerado por scripts/seo/select-wave-0.ts em ${report.generatedAt.slice(0, 10)}. Critérios em docs/seo/ondas.md.`,
    "",
  ];
  writeFileSync(new URL("../../docs/seo/onda-0-300.txt", import.meta.url), `${[...header, ...selected].join("\n")}\n`);
  writeFileSync(
    new URL("../../src/lib/seo/waves/onda-0.ts", import.meta.url),
    `// Gerado por scripts/seo/select-wave-0.ts a partir de docs/seo/onda-0-300.txt. Não editar à mão.\nexport const WAVE_0_ARTICLE_PATHS: readonly string[] = ${JSON.stringify(selected, null, 2)};\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Falha na seleção da onda 0: ${error instanceof Error ? error.message : "erro desconhecido"}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
