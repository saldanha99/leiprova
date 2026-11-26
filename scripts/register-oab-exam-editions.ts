import { createHash } from "node:crypto";

import postgres from "postgres";

import { requireStandingCourseMaintenanceDatabaseUrl } from "@/lib/editorial/official-course-admission";
import {
  assertOabExamEditions,
  OAB_EXAM_EDITIONS,
  OAB_EXAM_EDITIONS_AUDIT_ACTION,
  OAB_EXAM_EDITIONS_OBSERVED_AT,
  OAB_EXAM_EDITIONS_REFERENCE,
} from "@/lib/exams/oab-exam-editions";
import { saoPauloDateIso } from "@/lib/quiz/exam-edition-catalog";

// Cadastro das edições do Exame de Ordem (FGV) como metadados de prova realizada.
//   --verify-sources  baixa os editais em oab.fgv.br e confere SHA-256 e a data (precisa de internet)
//   (sem flag)        prévia: mostra o que seria gravado, sem conectar ao banco
//   --apply           grava numa transação, com auditoria; edição já existente é preservada
// Uso na VPS: docker compose --profile tools run --rm migrate pnpm exec tsx scripts/register-oab-exam-editions.ts --apply

async function verifySources() {
  const { extractText, getDocumentProxy } = await import("unpdf");
  for (const item of OAB_EXAM_EDITIONS) {
    const response = await fetch(item.noticeUrl, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`Edital indisponível (${response.status}): ${item.publicId}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    const normalized = text.replace(/\s+/g, " ");
    const ok = sha256 === item.noticeSha256 && normalized.includes(item.noticeDateExcerpt)
      && normalized.includes(`${item.number}º EXAME DE ORDEM UNIFICADO`);
    console.log(JSON.stringify({ edition: item.publicId, sha256Matches: sha256 === item.noticeSha256, dateFound: ok }));
    if (!ok) throw new Error(`Edital divergente: ${item.publicId}.`);
  }
}

async function apply() {
  const sql = postgres(requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL), { max: 1 });
  try {
    const created = await sql.begin(async (tx) => {
      const [ids] = await tx<{ bankId: string | null; careerId: string | null }[]>`
        select (select id from quiz_banks where slug = 'fgv' and is_active) as "bankId",
               (select id from quiz_career_tracks where slug = 'oab' and is_active) as "careerId"`;
      if (!ids?.bankId || !ids.careerId) throw new Error("Banca FGV ou carreira OAB inativa; nada gravado.");
      const inserted: string[] = [];
      for (const item of OAB_EXAM_EDITIONS) {
        const rows = await tx<{ publicId: string }[]>`
          insert into exam_editions (public_id, career_track_id, bank_id, title, organizer, jurisdiction, official_url,
            exam_date, status, duration_minutes, source_policy, source_content_stored, source_http_status,
            source_checked_at, source_external_id, institution_acronym, jurisdiction_code)
          values (${item.publicId}, ${ids.careerId}, ${ids.bankId}, ${item.title}, 'Fundação Getulio Vargas', 'Brasil',
            ${item.officialUrl}, ${item.examDate}, ${item.status}, 300, 'metadata_only', false, 200,
            ${OAB_EXAM_EDITIONS_OBSERVED_AT}, ${item.sourceExternalId}, 'OAB', 'BR')
          on conflict do nothing
          returning public_id as "publicId"`;
        if (!rows.length) continue;
        inserted.push(item.publicId);
        await tx`insert into audit_logs (action, entity_type, entity_id, metadata) values (
          ${OAB_EXAM_EDITIONS_AUDIT_ACTION}, 'exam_edition', ${item.publicId}, ${tx.json({
            approvalBasis: "owner_standing_authorization",
            approvalReference: OAB_EXAM_EDITIONS_REFERENCE,
            humanReview: false,
            executionSource: "server_cli",
            bank: "fgv",
            career: "oab",
            examDate: item.examDate,
            status: item.status,
            officialUrl: item.officialUrl,
            noticeUrl: item.noticeUrl,
            noticeSha256: item.noticeSha256,
            noticeDateExcerpt: item.noticeDateExcerpt,
            examDateCorroboration: item.answerKeyEvidence,
            sourceObservedAt: OAB_EXAM_EDITIONS_OBSERVED_AT,
            sourcePolicy: "metadata_only",
            sourceContentStored: false,
            questionsImported: 0,
          })})`;
      }
      return inserted;
    });
    console.log(JSON.stringify({ mode: "apply", created, skippedExisting: OAB_EXAM_EDITIONS.length - created.length }));
  } finally {
    await sql.end();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2).filter((arg) => arg !== "--"));
  for (const arg of args) if (arg !== "--apply" && arg !== "--verify-sources") throw new Error(`Argumento desconhecido: ${arg}.`);
  assertOabExamEditions(OAB_EXAM_EDITIONS, saoPauloDateIso());
  if (args.has("--verify-sources")) await verifySources();
  if (args.has("--apply")) return apply();
  console.log(JSON.stringify({ mode: "preview", editions: OAB_EXAM_EDITIONS.map(({ publicId, examDate, status }) => ({ publicId, examDate, status })) }));
}

if (process.argv[1]?.endsWith("register-oab-exam-editions.ts")) {
  void main().catch((error: unknown) => {
    console.error("Cadastro das edições OAB bloqueado:", error instanceof Error ? error.message : "erro desconhecido");
    process.exitCode = 1;
  });
}
