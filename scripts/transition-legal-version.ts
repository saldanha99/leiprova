import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { fetchOfficialConsolidatedLegalText } from "../src/lib/official-sources/fetch";
import { getOfficialLegalSource } from "../src/lib/official-sources/legal-registry";
import { transitionLegalVersion } from "../src/lib/editorial/legal-version-transition";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";

// Uso: tsx scripts/transition-legal-version.ts lei=<slug> text=<sha256> [retire=<id,id>] [--rehearse | --apply fingerprint=<sha256>]
export function parseTransitionArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const values = new Map<string, string>(); const flags = new Set<string>();
  for (const arg of args) {
    if (arg === "--apply" || arg === "--rehearse") { if (flags.has(arg)) throw new Error("Flag repetida."); flags.add(arg); continue; }
    const match = /^(lei|text|retire|fingerprint)=(.+)$/u.exec(arg);
    if (!match || values.has(match[1])) throw new Error(`Argumento inválido ou repetido: ${arg}`);
    values.set(match[1], match[2]);
  }
  const slug = values.get("lei") ?? "", text = values.get("text") ?? "";
  if (!getOfficialLegalSource(slug) || !/^[a-f0-9]{64}$/u.test(text)) throw new Error("Informe lei=<slug do registro> e text=<sha256>.");
  if (flags.has("--apply") && flags.has("--rehearse")) throw new Error("Escolha --apply ou --rehearse.");
  const fingerprint = values.get("fingerprint");
  if (flags.has("--apply") !== Boolean(fingerprint) || (fingerprint && !/^[a-f0-9]{64}$/u.test(fingerprint))) throw new Error("--apply exige fingerprint=<sha256 da prévia>, e só ele.");
  const retire = (values.get("retire") ?? "").split(",").filter(Boolean).map((v) => { if (!/^\d{1,12}$/u.test(v)) throw new Error("retire exige ids numéricos."); return Number(v); });
  return { slug, text, retire, fingerprint, apply: flags.has("--apply"), rehearse: flags.has("--rehearse") };
}

class Rollback extends Error { constructor(readonly result: unknown) { super("rehearsal rollback"); } }

async function main() {
  const command = parseTransitionArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: process.env.LEGAL_TRANSITION_REFERENCE });
  // Rede fora da transação: o texto oficial atual precisa ser exatamente a captura pendente.
  const source = getOfficialLegalSource(command.slug)!;
  const fresh = await fetchOfficialConsolidatedLegalText(source.monitorUrl);
  if (fresh.checksumSha256 !== command.text) throw new Error("A recaptura oficial não confere com o texto informado; nada gravado.");
  const client = postgres(requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }), { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  try {
    const result = await db.transaction(async (tx) => {
      const operators = await tx.execute<{ id: number; role: string }>(sql`select id::int id, role from users where ${reviewer.email ? sql`lower(email)=${reviewer.email}` : sql`role='admin'`} order by id limit 2 for share`);
      if (operators.length !== 1 || operators[0].role !== "admin") throw new Error("Exige administrador único identificado.");
      const preview = await transitionLegalVersion(tx, { actSlug: command.slug, textChecksum: command.text, actorId: operators[0].id, approvalReference: reviewer.approvalReference,
        retireQuestionIds: command.retire, mode: "preview" });
      if (!command.apply && !command.rehearse) return preview;
      const applied = await transitionLegalVersion(tx, { actSlug: command.slug, textChecksum: command.text, actorId: operators[0].id, approvalReference: reviewer.approvalReference,
        retireQuestionIds: command.retire, mode: "apply", expectedFingerprint: command.apply ? command.fingerprint : preview.fingerprint });
      if (command.rehearse) throw new Rollback(applied);
      return applied;
    }, { isolationLevel: "serializable" }).catch((error: unknown) => {
      if (error instanceof Rollback) return { rehearsal: true, rolledBack: true, wouldApply: error.result };
      throw error;
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.end(); }
}

if (process.argv[1]?.endsWith("transition-legal-version.ts")) void main().catch((error: unknown) => {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
  const base = cause ?? (error instanceof Error ? error : null);
  console.error("Transição de versão bloqueada:", base ? base.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]") : "falha desconhecida");
  process.exitCode = 1;
});
