import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { validateLocalAuthoring } from "../src/lib/editorial/local-authoring";
import { PILOT_ORIGINAL_QUESTIONS } from "../src/lib/editorial/pilot-questions";
import { DEMO_QUESTIONS } from "../src/lib/demo-content";

// Alvos fixos neste projeto: não lê .env, não conecta ao banco nem aciona modelos.
const directory = new URL("../content/editorial/cf-direitos-fundamentais-2026-09-05/", import.meta.url);
const batchFiles = ["claude-fgv.json", "prism-fcc.json", "radar-vunesp.json", "forge-cebraspe.json"];

async function readJson(filename: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(filename, directory), "utf8")) as unknown;
}

async function main() {
  const result = validateLocalAuthoring(
    await readJson("sources.json"),
    await Promise.all(batchFiles.map(readJson)),
    [
      ...PILOT_ORIGINAL_QUESTIONS,
      ...DEMO_QUESTIONS.map((question) => ({ publicId: question.slug, prompt: question.prompt })),
    ],
  );
  console.log(JSON.stringify({ directory: fileURLToPath(directory), ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
}

main().catch(() => {
  // Não imprime entrada inválida inteira ou conteúdo de arquivos que poderiam conter segredos.
  console.error("Lote ausente ou formato inválido. Confira os arquivos editoriais e execute os testes focados.");
  process.exitCode = 1;
});
