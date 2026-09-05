import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// EXCLUSIVO para o banco temporário criado para QA. Nunca lê DATABASE_URL.
// Execute após tests/editorial-postgres.test.ts. Nenhuma revisão jurídica real.
async function main() {
  const url = process.env.LEIPROVA_TEST_DATABASE_URL;
  if (!url) throw new Error("Informe LEIPROVA_TEST_DATABASE_URL do banco temporário.");
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55439" ||
      parsed.pathname !== "/leiprova_automation_test" || parsed.username !== "leiprova_test") {
    throw new Error("Setup restrito ao banco local sintético de QA, porta 55439.");
  }
  const db = postgres(url, { max: 1 });
  try {
    const [identity] = await db`select current_database() as name`;
    if (identity.name !== "leiprova_automation_test") throw new Error("Banco incorreto.");
    const fixtures = await db`
      select o.id opportunity_id, o.career_track_id, o.specialization_id,
        q.id question_id, q.public_id, q.style_bank_id, o.reviewed_by_user_id editor_id,
        c.slug career, s.slug subject
      from contest_opportunities o
      join quiz_career_tracks c on c.id = o.career_track_id
      join question_opportunities l on l.opportunity_id = o.id
      join questions q on q.id = l.question_id
      join quiz_subjects s on s.id = q.subject_id
      join legal_articles a on a.id = q.legal_article_id
      join legal_versions v on v.id = a.legal_version_id
      where o.slug like 'teste-%' and v.source_url = 'https://example.invalid/test-fixture'
        and v.status = 'current' and q.editorial_status = 'draft'
      order by q.id limit 2
    `;
    if (fixtures.length !== 2) throw new Error("Execute os testes de integração para gerar duas fixtures inéditas.");
    const passwordHash = await hash("Smoke-local-only-2026!", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const [student] = await db`
      insert into users (public_id, name, email, password_hash)
      values (${randomUUID()}, 'Aluno fictício — QA local', 'qa-aluno@example.invalid', ${passwordHash})
      on conflict (lower(email)) do update set password_hash = excluded.password_hash
      returning id
    `;
    await db`insert into subscriptions (user_id, plan_id, provider, status)
      select ${student.id}, id, 'synthetic_test', 'active' from plans order by id limit 1
      on conflict do nothing`;
    await db`update users set email = 'qa-editor@example.invalid', password_hash = ${passwordHash}
      where id = ${fixtures[0].editor_id}`;
    for (const [index, f] of fixtures.entries()) {
      const [edition] = await db`
        insert into exam_editions (public_id, career_track_id, specialization_id, bank_id, title,
          official_url, exam_date, status, source_checked_at)
        values (${`qa-edicao-${index + 1}`}, ${f.career_track_id}, ${f.specialization_id}, ${f.style_bank_id},
          ${`QA fictício — edição ${index + 1} (sem validade)`}, 'https://conhecimento.fgv.br/concursos/qa-local-fixture-not-real',
          '2026-12-01', 'scheduled', now())
        on conflict (public_id) do update set title = excluded.title returning id
      `;
      await db`update contest_opportunities set exam_edition_id = ${edition.id} where id = ${f.opportunity_id}`;
      // Somente conteúdo explicitamente fictício deste banco, para exercitar o estado publicado.
      await db`update questions set created_by_user_id = ${f.editor_id}, reviewed_by_user_id = ${f.editor_id},
        editorial_status = 'reviewed', clean_room_attested_at = now(), submitted_at = now(),
        verified_at = now(), review_notes = 'Fixture sintética de QA; não é revisão jurídica.'
        where id = ${f.question_id}`;
    }
    console.log(JSON.stringify({ student: "qa-aluno@example.invalid", editor: "qa-editor@example.invalid",
      fixtures: fixtures.map((f, index) => ({ edition: `qa-edicao-${index + 1}`, question: f.public_id,
        career: f.career, subject: f.subject })) }));
  } finally { await db.end(); }
}

void main().catch(() => {
  console.error("Falha no setup sintético. Verifique o banco temporário e as fixtures dos testes; nenhum banco real é permitido.");
  process.exitCode = 1;
});
