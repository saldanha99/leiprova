import { constants } from "node:fs";
import { open, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { escapeReviewMarkdownText as plain, scopedAuthoringBatchSchema, scopedWorkOrderSchema, validateScopedAuthoring } from "../src/lib/editorial/scoped-authoring";

// Operador privado, sem cliente de banco, SSH, rede, modelos ou modo de aprovação.
async function main() {
  let requestedDirectory: string | undefined;
  let writeReview = false;
  let corpusFile: string | undefined;
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith("--directory=") && !requestedDirectory) requestedDirectory = argument.slice(12);
    else if (argument === "--write-review" && !writeReview) writeReview = true;
    else if (/^--corpus=[a-z0-9-]+\.json$/u.test(argument) && !corpusFile) corpusFile = argument.slice(9);
    else throw new Error("Use --directory=PASTA, --corpus=ARQUIVO.json e, opcionalmente, --write-review.");
  }
  if (!requestedDirectory) throw new Error("Escolha a pasta editorial privada do projeto.");
  const allowedRoot = await realpath(fileURLToPath(new URL("../.local/editorial/", import.meta.url)));
  const directory = await realpath(path.resolve(requestedDirectory));
  if (!directory.startsWith(allowedRoot + path.sep)) throw new Error("Pacote fora do diretório editorial.");
  async function readJson(name: string): Promise<unknown> {
    const candidate = path.join(directory, name);
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(directory + path.sep)) throw new Error("Arquivo fora do pacote.");
    const file = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat();
      if (!before.isFile() || before.size > 4_194_304) throw new Error("Arquivo inválido ou maior que 4 MiB.");
      const text = await file.readFile("utf8");
      const after = await file.stat();
      if (Buffer.byteLength(text) > 4_194_304 || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        await realpath(candidate) !== resolved) throw new Error("Arquivo mudou durante a leitura.");
      return JSON.parse(text) as unknown;
    } finally { await file.close(); }
  }
  const order = scopedWorkOrderSchema.parse(await readJson("work-order.json"));
  const batches = await Promise.all(order.batchFiles.map(async (name) => scopedAuthoringBatchSchema.parse(await readJson(name))));
  const corpus = corpusFile ? z.object({ database: z.literal("leiprova"), role: z.literal("leiprova_app"),
    capturedAt: z.iso.datetime({ offset: true }), questions: z.array(z.object({ publicId: z.string().min(1).max(160),
      prompt: z.string().min(1).max(12_000) }).strict()).min(1).max(100_000),
  }).strict().parse(await readJson(corpusFile)).questions : [];
  const result = validateScopedAuthoring(order, batches, corpus);
  if (writeReview && result.valid) {
    // O fingerprint evita sobrescrever relatórios de uma revisão anterior.
    const suffix = result.fingerprint.slice(0, 16);
    const lines = ["# Caderno de revisão — inéditas por cargo", "",
      `**${order.target.organization.toUpperCase()} · ${order.target.role} · referência ${order.target.edition} · ${order.target.bank.toUpperCase()}**`, "",
      `${result.totalQuestions} rascunhos assistidos por IA. Objetivo: treino de legislação atual, com vigência e adequação sujeitas a revisão. Não é simulado oficial nem reconstrução do corte normativo histórico.`, "",
      "**Não publicado. Revisão humana e aderência ao programa pendentes. Sem produto associado e sem liberação a alunos.**", "",
      "## Como revisar", "",
      "Confira dispositivo e contexto, vigência/corte temporal, única resposta, explicações, dificuldade e adequação ao cargo. Registre correções por ID. Nenhuma leitura ou clique neste caderno registra aprovação automaticamente.", "",
      `Identificador de conteúdo: \`${result.fingerprint}\`. A verificação automática atesta somente contrato e consistência mecânica; não atesta mérito jurídico ou originalidade.`, "",
      `Comparação com acervo externo ao pacote: ${result.corpusComparisonPerformed ? "realizada" : "não realizada nesta verificação"}.`, "",
      ...result.warnings.map((warning) => `- Atenção: ${warning}`), "",
    ];
    let count = 0;
    for (const batch of batches) {
      lines.push(`## ${batch.batchId}`, "");
      for (const question of batch.questions) {
        count += 1;
        const source = batch.sources.find((candidate) => candidate.id === question.sourceId)!;
        lines.push(`### ${count}. ${question.id}`, "", plain(question.prompt), "",
          ...question.options.flatMap((option) => [`${option.key}) ${plain(option.text)}`, ""]),
          `**Gabarito proposto: ${question.options.find((option) => option.isCorrect)!.key}**`, "", plain(question.explanation), "",
          ...question.options.flatMap((option) => [`- **${option.key}:** ${plain(option.rationale)}`]), "",
          `**Objetivo:** ${plain(question.learningObjective)}`, "",
          `**Modalidade:** ${question.demand === "literal_law" ? "literalidade" : "aplicação normativa"}. **Dificuldade proposta:** ${question.difficulty}/5.`, "",
          `**Fonte:** [${plain(source.articleRef)}](${source.officialUrl}), consulta informada em ${source.retrievedOn}.`, "",
          ...question.supportingQuote.split("\n").map((line) => `> ${plain(line)}`), "",
          "**Revisão humana:** pendente. **Correções:** ____________________", "", "---", "");
      }
    }
    await writeFile(path.join(directory, `validation-${suffix}.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await writeFile(path.join(directory, `CADERNO-REVISAO-${suffix}.md`), lines.join("\n"), { flag: "wx", mode: 0o600 });
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

main().catch(() => {
  console.error("Validação não concluída: confira pasta, contrato, arquivos e relatórios já existentes. Nenhuma aprovação, importação ou publicação foi executada.");
  process.exitCode = 1;
});
