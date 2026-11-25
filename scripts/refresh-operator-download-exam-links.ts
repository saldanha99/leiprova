import postgres from "postgres";

import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { OPERATOR_DOWNLOAD_EXAM_DOCUMENTS, verifyOfficialExamUrlWithOperatorDownload } from "../src/lib/official-sources/operator-download-exam-documents";

// Renova só os links da exceção de download do operador (Vunesp/TCE-SP): o ciclo do worker não tem o PDF
// baixado no navegador e não consegue conferir esses links. Exige o arquivo recente em OPERATOR_EXAM_DOWNLOAD_DIR
// com o SHA-256 fixado; sem --apply, só confere. Mesma atualização do refresh automático (link_verified_at).
async function main() {
  const args = process.argv.slice(2).filter((value) => value !== "--");
  if (args.some((value) => value !== "--apply")) throw new Error("Use somente --apply (opcional).");
  const apply = args.includes("--apply");
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const results = [];
    for (const pinned of OPERATOR_DOWNLOAD_EXAM_DOCUMENTS) {
      const checked = await verifyOfficialExamUrlWithOperatorDownload(pinned.bankSlug, pinned.url);
      const downloadedAt = "operatorDownloadedAt" in checked ? checked.operatorDownloadedAt : null;
      const rows = await client.begin(apply ? "isolation level serializable" : "isolation level repeatable read read only", async (tx) => {
        await tx`set local statement_timeout = '30s'`;
        const documents = await tx<{ id: string; publicId: string }[]>`select document.id::text as id, document.public_id as "publicId"
          from exam_edition_documents document join exam_editions edition on edition.id = document.exam_edition_id
          join quiz_banks bank on bank.id = edition.bank_id
          where document.status = 'approved' and document.source_url = ${pinned.url} and bank.slug = ${pinned.bankSlug}`;
        if (!apply || !documents.length) return documents;
        await tx`update exam_edition_documents set link_verified_at = ${checked.checkedAt.toISOString()}::timestamptz, http_status = 200, updated_at = now()
          where id in ${tx(documents.map((document) => document.id))} and status = 'approved' and source_url = ${pinned.url}`;
        const [admin] = await tx<{ id: string }[]>`select id::text from users where role = 'admin' order by id limit 1`;
        await tx`insert into audit_logs (actor_user_id, action, entity_type, metadata)
          values (${admin.id}, 'automation.exam_link.operator_download_verified', 'exam_link_refresh', ${tx.json({ url: pinned.url, sha256: pinned.sha256,
            operatorDownloadedAt: downloadedAt, verifiedAt: checked.checkedAt.toISOString(), approvalReference: pinned.approvalReference,
            documentPublicIds: documents.map((document) => document.publicId) })})`;
        return documents;
      });
      results.push({ url: pinned.url, sha256: pinned.sha256, documents: rows.length, verifiedAt: checked.checkedAt.toISOString(), operatorDownloadedAt: downloadedAt });
    }
    console.log(JSON.stringify({ mode: apply ? "applied" : "preview", results }, null, 2));
  } finally { await client.end(); }
}

void main().catch((error: unknown) => {
  console.error("Falha ao renovar links da exceção de download do operador:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
