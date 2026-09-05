import { randomUUID } from "node:crypto";
import postgres from "postgres";

import { contestCategories } from "../src/lib/opportunities/categories";

// Somente fixtures de apresentação, sem validade editorial ou conteúdo jurídico.
// Não lê DATABASE_URL nem .env e nunca se conecta a um servidor remoto.
async function main() {
  const url = process.env.LEIPROVA_TEST_DATABASE_URL;
  if (!url) throw new Error("Informe a conexão do banco sintético local.");
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55439" ||
    parsed.username !== "leiprova_test" ||
    parsed.pathname !== "/leiprova_automation_test"
  )
    throw new Error(
      "Fixture limitada ao banco sintético local na porta 55439.",
    );
  const db = postgres(url, { max: 1 });
  const sourceUrl = "https://example.invalid/contest-premium-preview";
  try {
    const [identity] = await db`select current_database() as name`;
    if (identity.name !== "leiprova_automation_test")
      throw new Error("Banco incorreto.");
    await db.begin(async (tx) => {
      const [editor] =
        await tx`insert into users (public_id, name, email, password_hash, role)
        values (${randomUUID()}, 'Fixture visual sem login', 'qa-contest-premium@example.invalid', 'not-a-login-password', 'editor')
        on conflict (lower(email)) do update set name = excluded.name returning id`;
      for (const category of contestCategories) {
        const slug = `qa-premium-${category.slug}`;
        const [existing] =
          await tx`select id from contest_opportunities where slug = ${slug}`;
        if (existing) continue;
        const [pair] =
          await tx`select cc.category_id, cc.career_track_id from contest_category_careers cc
          join contest_categories c on c.id = cc.category_id where c.slug = ${category.slug} order by cc.career_track_id limit 1`;
        if (!pair) throw new Error("Catálogo sintético ainda não preparado.");
        const acronym =
          category.slug === "carreiras-policiais"
            ? "PC-BA"
            : category.slug === "carreiras-juridicas"
              ? "ENAM"
              : `QA ${category.name}`;
        const [opportunity] = await tx`insert into contest_opportunities
          (public_id, slug, category_id, career_track_id, jurisdiction_code, scope, cycle_year,
          institution_acronym, institution_name, role_name, title, summary, lifecycle_status, status_as_of,
          official_url, source_checked_at, editorial_status)
          values (${randomUUID()}, ${slug}, ${pair.category_id}, ${pair.career_track_id}, 'BR', 'national', 2026,
          ${acronym}, 'Instituição ilustrativa — QA local', 'Objetivo de teste', ${`${acronym} — prévia visual local`},
          'Esta é uma fixture para verificar o layout. Não representa informações oficiais, um curso liberado ou revisão jurídica.',
          'pre_notice', current_date, ${sourceUrl}, now(), 'draft') returning id`;
        await tx`insert into opportunity_source_documents
          (public_id, opportunity_id, document_type, title, source_url, source_host, observed_at, last_seen_at,
          http_status, status, reviewed_by_user_id, reviewed_at)
          values (${randomUUID()}, ${opportunity.id}, 'official_announcement', 'Fonte fictícia de QA', ${sourceUrl},
          'example.invalid', now(), now(), 200, 'approved', ${editor.id}, now())`;
        await tx`update contest_opportunities set editorial_status = 'reviewed', reviewed_by_user_id = ${editor.id},
          reviewed_at = now(), published_at = now(), review_notes = 'Fixture de apresentação; sem validade jurídica.' where id = ${opportunity.id}`;
      }
    });
    console.log(
      "8 prévias exclusivamente locais disponíveis em /concursos/<categoria>/brasil/qa-premium-<categoria>.",
    );
  } finally {
    await db.end();
  }
}

void main().catch(() => {
  console.error("Falha no setup visual local. Nenhum banco real é permitido.");
  process.exitCode = 1;
});
