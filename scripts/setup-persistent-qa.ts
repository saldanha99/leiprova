import { hash } from "@node-rs/argon2";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import postgres from "postgres";
import { bindSyntheticProductQuestions } from "./lib/synthetic-product-bindings";
import {
  CONTEST_ACCESS_OPTIONS,
  CONTEST_CATALOG,
} from "../src/lib/commerce/catalog";
import { contestCategories } from "../src/lib/opportunities/categories";
import {
  quizBanks,
  quizCareerTracks,
  quizSubjects,
} from "../src/lib/quiz/catalog";
import {
  assertPersistentQaDatabase,
  persistentQaAccountsSchema,
} from "./lib/qa-safety";

async function main() {
  const url = assertPersistentQaDatabase(
    process.env.LEIPROVA_QA_DATABASE_URL,
    process.env.LEIPROVA_QA_ENVIRONMENT,
  );
  const path = process.env.LEIPROVA_QA_ACCOUNT_FILE;
  if (!path || (statSync(path).mode & 0o077) !== 0)
    throw new Error("Arquivo de acessos precisa de permissão 600.");
  const { accounts } = persistentQaAccountsSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const db = postgres(url, { max: 1 });
  try {
    const [identity] = await db`select current_database() as name`;
    if (identity.name !== "leiprova_qa")
      throw new Error("Banco de homologação incorreto.");
    await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('leiprova:synthetic-qa-bootstrap'))`;
      const [foreignData] = await tx`select
        exists(select 1 from users where email not in ('qa-admin@example.invalid','qa-master@example.invalid','qa-avulso@example.invalid'))
        or exists(select 1 from users where stripe_customer_id is not null)
        or exists(select 1 from subscriptions where provider <> 'synthetic_test')
        or exists(select 1 from contest_orders where stripe_mode <> 'test' or stripe_session_id is not null)
        or exists(select 1 from questions where public_id not like 'qa-persistente-%') as unsafe`;
      if (foreignData.unsafe)
        throw new Error(
          "O banco contém dados externos à fixture. Bootstrap abortado.",
        );
      const accountIds = new Map<string, number>();
      for (const account of accounts) {
        const passwordHash = await hash(account.password, {
          algorithm: 2,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        });
        const [user] =
          await tx`insert into users(public_id,email,name,role,password_hash,email_verified_at)
          values(${randomUUID()},${account.email},${account.name},${account.role},${passwordHash},now())
          on conflict(lower(email)) do update set password_hash=excluded.password_hash,name=excluded.name,
          role=excluded.role,email_verified_at=now(),updated_at=now() returning id`;
        accountIds.set(account.access, Number(user.id));
      }
      const adminId = accountIds.get("admin")!;
      // Somente taxonomia pública. Não chama seed.ts nem copia conteúdo/banco de produção.
      for (const bank of quizBanks)
        await tx`insert into quiz_banks(slug,name,full_name)
        values(${bank.slug},${bank.name},${bank.fullName}) on conflict(slug) do nothing`;
      for (const career of quizCareerTracks)
        await tx`insert into quiz_career_tracks(slug,name,short_name,description,featured)
        values(${career.slug},${career.name},${career.shortName},${career.description},${career.featured}) on conflict(slug) do nothing`;
      for (const subject of quizSubjects) {
        const [row] = await tx`insert into quiz_subjects(slug,name,short_name)
          values(${subject.slug},${subject.name},${subject.shortName}) on conflict(slug) do update set name=excluded.name returning id`;
        for (const topic of subject.topics)
          await tx`insert into quiz_topics(subject_id,slug,name)
          values(${row.id},${topic.slug},${topic.name}) on conflict(subject_id,slug) do nothing`;
      }
      for (const career of quizCareerTracks)
        for (const slug of career.subjectSlugs) {
          await tx`insert into quiz_career_subjects(career_track_id,subject_id)
          select c.id,s.id from quiz_career_tracks c,quiz_subjects s where c.slug=${career.slug} and s.slug=${slug}
          on conflict do nothing`;
        }
      for (const category of contestCategories) {
        const [row] =
          await tx`insert into contest_categories(slug,name,description)
          values(${category.slug},${category.name},${category.description}) on conflict(slug) do update set name=excluded.name returning id`;
        for (const career of category.careerSlugs)
          await tx`insert into contest_category_careers(category_id,career_track_id)
          select ${row.id},id from quiz_career_tracks where slug=${career} on conflict do nothing`;
      }
      for (const contest of CONTEST_CATALOG)
        await tx`insert into contest_store_products(slug) values(${contest.slug}) on conflict do nothing`;
      const [category] =
        await tx`select id from contest_categories where slug='carreiras-policiais'`;
      const [career] =
        await tx`select id from quiz_career_tracks where slug='delegado'`;
      const [topic] =
        await tx`select t.id,t.subject_id from quiz_topics t join quiz_subjects s on s.id=t.subject_id
        where s.slug='direito-constitucional' order by t.id limit 1`;
      const [bank] = await tx`select id from quiz_banks where slug='fgv'`;
      await tx`insert into question_style_profiles(quiz_bank_id,format,command_style,reasoning_demand,disclaimer)
        values(${bank.id},'multiple_choice','Fixture sintética, sem avaliação de banca real',
        'Exercício fictício de software','Perfil sintético usado apenas para validar a interface e o isolamento.')
        on conflict(quiz_bank_id) do nothing`;
      const opportunityIds = new Map<string, number>();
      const sourceUrl =
        "https://example.invalid/leiprova-qa-sem-validade-juridica";
      for (const label of ["alfa", "beta"]) {
        const slug = `qa-curso-${label}`;
        const title = `HOMOLOGAÇÃO — Curso QA ${label.toUpperCase()} (fictício)`;
        const [edition] =
          await tx`insert into exam_editions(public_id,career_track_id,bank_id,title,official_url,exam_date,status,source_checked_at)
          values(${`qa-edicao-${label}`},${career.id},${bank.id},${title},${sourceUrl},'2030-12-01','scheduled',now())
          on conflict(public_id) do update set title=excluded.title returning id`;
        const [opportunity] =
          await tx`insert into contest_opportunities(public_id,slug,category_id,career_track_id,
          jurisdiction_code,scope,cycle_year,institution_acronym,institution_name,role_name,title,summary,
          lifecycle_status,status_as_of,official_url,source_checked_at,editorial_status,exam_edition_id)
          values(${randomUUID()},${slug},${category.id},${career.id},'BR','national',2030,${`QA-${label.toUpperCase()}`},
          'Instituição fictícia de homologação','Perfil fictício',${title},
          'Exercício de software sem validade jurídica. Não é concurso, curso vendido ou conteúdo oficial.',
          'pre_notice',current_date,${sourceUrl},now(),'draft',${edition.id})
          on conflict(slug) do update set title=excluded.title returning id`;
        opportunityIds.set(label, Number(opportunity.id));
        const [existingSource] =
          await tx`select id from opportunity_source_documents where opportunity_id=${opportunity.id} and source_url=${sourceUrl}`;
        const sourceId =
          existingSource?.id ??
          (
            await tx`insert into opportunity_source_documents(public_id,opportunity_id,document_type,title,
          source_url,source_host,observed_at,last_seen_at,http_status,status,reviewed_by_user_id,reviewed_at)
          values(${randomUUID()},${opportunity.id},'official_announcement','Fixture fictícia — não é fonte oficial',
          ${sourceUrl},'example.invalid',now(),now(),200,'approved',${adminId},now()) returning id`
          )[0].id;
        await tx`update contest_opportunities set editorial_status='reviewed',reviewed_by_user_id=${adminId},reviewed_at=now(),
          published_at=now(),review_notes='Somente homologação: aprovação sintética, sem validade editorial.'
          where id=${opportunity.id} and editorial_status <> 'reviewed'`;
        await tx`insert into contest_store_products(slug,opportunity_id) values(${slug},${opportunity.id}) on conflict(slug) do nothing`;
        await tx`insert into opportunity_organizer_assignments(opportunity_id,quiz_bank_id,source_document_id,
          responsible_type,role,organizer_slug,organizer_name,valid_from,status,reviewed_by_user_id,reviewed_at,review_notes)
          values(${opportunity.id},${bank.id},${sourceId},'external_organizer','examination_provider','fgv',
          'Perfil em fixture sintética, sem concurso real',current_date,'reviewed',${adminId},now(),
          'Vínculo sintético de software; não é aprovação editorial.') on conflict do nothing`;
        const [act] =
          await tx`insert into legal_acts(slug,title,short_title,act_type,act_year,official_url)
          values(${`qa-regra-${label}`},${`REGRA FICTÍCIA QA ${label.toUpperCase()} — NÃO É LEI`},
          ${`QA ${label.toUpperCase()} — sem validade jurídica`},'regra_ficticia',2030,${sourceUrl})
          on conflict(slug) do update set title=excluded.title returning id`;
        const digest = createHash("sha256")
          .update(`qa-persistente-${label}-v1`)
          .digest("hex");
        const [version] =
          await tx`insert into legal_versions(legal_act_id,source_url,checksum_sha256,verified_at,status)
          values(${act.id},${sourceUrl},${digest},now(),'current')
          on conflict(legal_act_id,checksum_sha256) do update set verified_at=excluded.verified_at returning id`;
        for (let index = 1; index <= 4; index++) {
          const literal = `No cenário inteiramente fictício QA ${label.toUpperCase()} ${index}, a equipe organiza ${index + 2} cartões azuis antes da atividade. Este texto não é uma norma jurídica.`;
          const [article] =
            await tx`insert into legal_articles(legal_version_id,article_ref,article_order,path,literal_text,editorial_status,source_rights)
            values(${version.id},${`Regra fictícia ${index}`},${index},${`qa/${index}`},${literal},'reviewed','official_text')
            on conflict(legal_version_id,path) do update set literal_text=excluded.literal_text returning id`;
          const [existingRequirement] =
            await tx`select id from opportunity_requirements where opportunity_id=${opportunity.id} and legal_article_id=${article.id}`;
          if (!existingRequirement)
            await tx`insert into opportunity_requirements(opportunity_id,source_document_id,subject_id,topic_id,
            legal_act_id,legal_article_id,requirement_text,source_locator,editorial_status,reviewed_by_user_id,reviewed_at)
            values(${opportunity.id},${sourceId},${topic.subject_id},${topic.id},${act.id},${article.id},
            ${`Requisito sintético ${label} ${index}: reconhecer o número de cartões. Sem validade jurídica.`},
            'Fixture local sem edital real','reviewed',${adminId},now())`;
          const mode = index <= 2 ? "dry_law" : "original_style";
          const [question] =
            await tx`insert into questions(public_id,legal_article_id,subject_id,topic_id,quiz_mode,style_bank_id,type,prompt,
            explanation,learning_objective,topic,difficulty,editorial_status,source_rights,source_title,source_url,authorship_method,
            generator_model,prompt_version,created_by_user_id,reviewed_by_user_id,clean_room_attested_at,submitted_at,review_notes,
            originality_checked_at,verified_at)
            values(${`qa-persistente-${label}-${index}`},${article.id},${topic.subject_id},${topic.id},${mode},${mode === "original_style" ? bank.id : null},
            'multiple_choice',${`HOMOLOGAÇÃO — cenário QA ${label.toUpperCase()} ${index}: segundo a regra fictícia exibida, quantos cartões azuis são organizados?`},
            ${`Somente teste de software: a regra fictícia informa ${index + 2} cartões. Não use este exercício para preparação jurídica.`},
            'Validar a interface e o isolamento entre dois cursos fictícios.','Direitos e garantias fundamentais',1,'reviewed',
            'original_authorial','Fixture sintética, não é conteúdo oficial',${sourceUrl},'rule_based','qa-fixture','v1',${adminId},${adminId},now(),now(),
            'Aprovação sintética de software; não é revisão editorial ou jurídica.',now(),now())
            on conflict(public_id) do update set prompt=excluded.prompt returning id`;
          for (let option = 0; option < 5; option++)
            await tx`insert into question_options(question_id,option_key,text,is_correct,sort_order,rationale)
            values(${question.id},${String.fromCharCode(65 + option)},${`${index + 2 + option} cartões azuis.`},${option === 0},${option},
            'Compare apenas com a regra fictícia de homologação.') on conflict(question_id,option_key) do nothing`;
          await tx`insert into question_opportunities(question_id,opportunity_id,relationship)
            values(${question.id},${opportunity.id},'direct_requirement') on conflict do nothing`;
        }
        await bindSyntheticProductQuestions(tx, slug);
      }
      const [plan] =
        await tx`insert into plans(slug,name,description,billing_type,amount_cents,is_active)
        values('qa-commerce-master','Master sintético — SEM COBRANÇA','Acesso de homologação a todos os exercícios fictícios.','month',29700,false)
        on conflict(slug) do update set name=excluded.name returning id`;
      await tx`insert into subscriptions(user_id,plan_id,provider,status,current_period_start,current_period_end,access_ends_at)
        values(${accountIds.get("master")!},${plan.id},'synthetic_test','active',now(),now()+interval '30 days',now()+interval '30 days')
        on conflict(user_id) where status in ('active','trialing','past_due') do update set access_ends_at=excluded.access_ends_at,
        current_period_end=excluded.current_period_end,status='active',updated_at=now() where subscriptions.provider='synthetic_test'`;
      const monthly = CONTEST_ACCESS_OPTIONS.find(
        (option) => option.key === "monthly",
      )!;
      const orderId = "qa-persistente-curso-alfa";
      const opportunityId = opportunityIds.get("alfa")!;
      const lines = [
        {
          productSlug: "qa-curso-alfa",
          accessKey: monthly.key,
          months: monthly.months,
          amountCents: monthly.amountCents,
          stripePriceId: "synthetic-no-stripe",
          opportunityId,
        },
      ];
      await tx`insert into contest_orders(id,user_id,status,amount_cents,lines,stripe_mode)
        values(${orderId},${accountIds.get("contest")!},'paid',${monthly.amountCents},${tx.json(lines)},'test') on conflict(id) do nothing`;
      await tx`insert into contest_purchases(order_id,product_slug,opportunity_id,user_id,status,access_starts_at,access_ends_at)
        values(${orderId},'qa-curso-alfa',${opportunityId},${accountIds.get("contest")!},'active',now(),now()+interval '1 month')
        on conflict(order_id,product_slug) do update set access_starts_at=excluded.access_starts_at,access_ends_at=excluded.access_ends_at,
        status='active',updated_at=now()`;
      await tx`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        values(${adminId},'qa.synthetic_bootstrap','environment','leiprova_qa',
        '{"synthetic":true,"payments_created":false,"courses":2,"questions":8,"grant_days":30}'::jsonb)`;
    });
    console.log(
      "Homologação sintética preparada: 3 perfis, 2 cursos fictícios, 8 exercícios. Nenhuma cobrança Stripe ou dado de produção.",
    );
  } finally {
    await db.end();
  }
}
void main().catch((error: unknown) => {
  console.error(
    "Bootstrap de homologação falhou. Confira guardas de ambiente, migrations e arquivo privado; nenhum segredo foi exibido.",
  );
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    console.error(`Código de diagnóstico: ${error.code}`);
    if ("constraint_name" in error && typeof error.constraint_name === "string")
      console.error(`Restrição: ${error.constraint_name}`);
  }
  process.exitCode = 1;
});
