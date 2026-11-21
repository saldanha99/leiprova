/**
 * Gera o SQL da correção determinística do jargão do motor (sem IA). NÃO grava nada sozinho.
 *
 *   tsx scripts/editorial/jargon-rewrite-sql.ts <entrada.jsonl> <saida.sql> [--limit N] [--commit]
 *
 * Entrada: uma questão por linha (exportada só leitura, ver scripts/editorial/jargon-rewrite.sh):
 *   {"id", "prompt", "explanation", "articleRef", "actTitle", "options":[{"id","text","rationale"}]}
 * Saída: uma transação que, para cada questão com algum campo resolvido pela regra:
 *   1) guarda a cópia do conteúdo e o hash de certificação ANTES (tabela temporária);
 *   2) atualiza só os campos cujo texto ainda é o esperado (nunca updated_at);
 *   3) regrava evidence->questionContent só nos vínculos que batiam com o conteúdo antigo;
 *   4) recalcula question_content_hash só nas certificações que batiam com o hash antigo;
 *   5) registra antes/depois em audit_logs (action editorial.jargon_rewrite).
 * Sem --commit termina em ROLLBACK (ensaio). Campos não resolvidos ficam intactos.
 * Roda como dono do banco: o papel da aplicação não altera texto de questão por desenho.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { rewriteJargon } from "../../src/lib/editorial/jargon-rewrite";
import { questionContractContentHash } from "../../src/lib/editorial/question-contract-query";

type OptionRow = { id: number; text: string; rationale: string | null };
type QuestionRow = { id: number; prompt: string; explanation: string; articleRef: string | null; actTitle: string | null; options: OptionRow[] };

/** Mesma montagem do vínculo verificado (src/lib/commerce/product-binding-query.ts). */
const contentJson = (questionId: string) => `(select jsonb_build_object(
  'prompt', cq.prompt, 'explanation', cq.explanation, 'type', cq.type, 'learningObjective', cq.learning_objective,
  'options', coalesce((select jsonb_agg(jsonb_build_object(
    'optionKey', co.option_key, 'text', co.text, 'isCorrect', co.is_correct,
    'rationale', co.rationale, 'sortOrder', co.sort_order) order by co.sort_order)
    from question_options co where co.question_id = cq.id), '[]'::jsonb))
  from questions cq where cq.id = ${questionId})`;
const contentHash = (questionId: string) => new PgDialect().sqlToQuery(questionContractContentHash(sql.raw(questionId))).sql;

let tagSeq = 0;
/** Literal seguro com dollar-quoting de tag única. */
const lit = (value: string) => {
  const tag = `jr${(tagSeq++).toString(36)}`;
  if (value.includes(`$${tag}$`)) throw new Error("Colisão de tag de literal.");
  return `$${tag}$${value}$${tag}$`;
};

export function buildJargonRewriteSql(rows: QuestionRow[], commit: boolean) {
  const changes: { id: number; fields: { field: string; optionId?: number; before: string; after: string; rules: string[] }[] }[] = [];
  const unresolved: { id: number; field: string; optionId?: number }[] = [];
  for (const row of rows) {
    const article = { articleRef: row.articleRef, actTitle: row.actTitle };
    const fields: (typeof changes)[number]["fields"] = [];
    const consider = (field: string, before: string | null, optionId?: number) => {
      if (!before) return;
      const out = rewriteJargon(before, article);
      if (!out.resolved) unresolved.push({ id: row.id, field, optionId });
      else if (out.text !== before) fields.push({ field, optionId, before, after: out.text, rules: out.rules });
    };
    consider("prompt", row.prompt);
    consider("explanation", row.explanation);
    for (const option of row.options) {
      consider("option_text", option.text, option.id);
      consider("option_rationale", option.rationale, option.id);
    }
    if (fields.length) changes.push({ id: row.id, fields });
  }

  const ids = changes.map((change) => change.id);
  const out: string[] = [
    "begin;",
    "set local statement_timeout = '300s';",
    "create temp table jr_old on commit drop as",
    `  select q.id as question_id, ${contentJson("q.id")} as content, ${contentHash("q.id")} as hash`,
    `  from questions q where q.id in (${ids.length ? ids.join(",") : "null"});`,
    "select 'antes' as fase,",
    "  (select count(*) from contest_product_question_bindings b join jr_old o on o.question_id = b.question_id where b.evidence->'questionContent' = o.content) as vinculos_em_dia,",
    "  (select count(*) from question_contract_certifications c join contest_product_question_bindings b on b.id = c.binding_id join jr_old o on o.question_id = b.question_id where c.question_content_hash = o.hash) as certificacoes_em_dia;",
  ];
  for (const change of changes) {
    for (const field of change.fields) {
      if (field.field === "prompt" || field.field === "explanation") {
        out.push(`update questions set ${field.field} = ${lit(field.after)} where id = ${change.id} and ${field.field} = ${lit(field.before)};`);
      } else {
        const column = field.field === "option_text" ? "text" : "rationale";
        out.push(`update question_options set ${column} = ${lit(field.after)} where id = ${field.optionId} and question_id = ${change.id} and ${column} = ${lit(field.before)};`);
      }
    }
    const metadata = JSON.stringify({
      classifier: "jargon-rewrite-v1",
      fields: change.fields.map(({ field, optionId, before, after, rules }) => ({ field, optionId, before, after, rules })),
    });
    out.push(`insert into audit_logs (action, entity_type, entity_id, metadata) values ('editorial.jargon_rewrite', 'question', '${change.id}', ${lit(metadata)}::jsonb);`);
  }
  out.push(
    "update contest_product_question_bindings b set evidence = jsonb_set(b.evidence, '{questionContent}', " + contentJson("b.question_id") + ")",
    "  from jr_old o where b.question_id = o.question_id and b.evidence->'questionContent' = o.content;",
    "update question_contract_certifications c set question_content_hash = " + contentHash("b.question_id"),
    "  from contest_product_question_bindings b, jr_old o",
    "  where c.binding_id = b.id and b.question_id = o.question_id and c.question_content_hash = o.hash;",
    "select 'depois' as fase,",
    "  (select count(*) from contest_product_question_bindings b join jr_old o on o.question_id = b.question_id where b.evidence->'questionContent' = " + contentJson("b.question_id") + ") as vinculos_em_dia,",
    "  (select count(*) from question_contract_certifications c join contest_product_question_bindings b on b.id = c.binding_id join jr_old o on o.question_id = b.question_id where c.question_content_hash = " + contentHash("b.question_id") + ") as certificacoes_em_dia,",
    "  (select count(*) from audit_logs where action = 'editorial.jargon_rewrite' and created_at >= now() - interval '10 minutes') as auditorias;",
    commit ? "commit;" : "rollback;",
  );
  return { sql: out.join("\n") + "\n", changes, unresolved };
}

function main() {
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output) throw new Error("uso: jargon-rewrite-sql.ts <entrada.jsonl> <saida.sql> [--limit N] [--commit]");
  const limitIndex = rest.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(rest[limitIndex + 1]) : Infinity;
  const rows = readFileSync(input, "utf8").trim().split("\n").filter(Boolean)
    // \copy em formato texto dobra as barras invertidas; desfaz antes do JSON.parse.
    .map((line) => JSON.parse(line.replace(/\\\\/g, "\\")) as QuestionRow).slice(0, Number.isFinite(limit) ? limit : undefined);
  const result = buildJargonRewriteSql(rows, rest.includes("--commit"));
  writeFileSync(output, result.sql);
  const fieldCount = result.changes.reduce((sum, change) => sum + change.fields.length, 0);
  process.stdout.write(JSON.stringify({ questoes: rows.length, questoesAlteradas: result.changes.length, camposAlterados: fieldCount, camposNaoResolvidos: result.unresolved.length, commit: rest.includes("--commit") }) + "\n");
}

if (process.argv[1]?.endsWith("jargon-rewrite-sql.ts")) main();
