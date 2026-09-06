import { createHash } from "node:crypto";
import type postgres from "postgres";

/** Exclusivo de fixtures de software. Nunca executado por migração ou importador editorial. */
export async function bindSyntheticProductQuestions(db: postgres.Sql | postgres.TransactionSql, productSlug: string, questionPublicId?: string) {
  const [identity] = await db`select current_database() as name`;
  if (!["leiprova_qa", "leiprova_automation_test", "leiprova_binding_test"].includes(identity.name)) throw new Error("Vínculo sintético proibido fora dos bancos de QA.");
  const rows = await db`
    select p.slug, o.id opportunity_id, r.id requirement_id, q.id question_id, r.source_document_id,
      a.id legal_article_id, v.id legal_version_id, v.checksum_sha256, q.updated_at,
      r.requirement_text, r.source_locator, a.literal_text, o.reviewed_by_user_id,
      jsonb_build_object('synthetic',true,'publicationAllowed',false,'legalArticleText',a.literal_text,
        'sourceUrl',s.source_url,'legalSourceUrl',v.source_url,
        'organizerAssignmentId',(select assignment.id from opportunity_organizer_assignments assignment
          where assignment.opportunity_id=o.id and assignment.status='reviewed' and assignment.valid_until is null
          order by (assignment.role='examination_provider') desc limit 1),
        'bankProfileVersion',profile.version,'questionContent',jsonb_build_object(
          'prompt',q.prompt,'explanation',q.explanation,'type',q.type,'learningObjective',q.learning_objective,
          'options',coalesce((select jsonb_agg(jsonb_build_object('optionKey',opt.option_key,'text',opt.text,
            'isCorrect',opt.is_correct,'rationale',opt.rationale,'sortOrder',opt.sort_order) order by opt.sort_order)
            from question_options opt where opt.question_id=q.id),'[]'::jsonb))) evidence
    from contest_store_products p join contest_opportunities o on o.id=p.opportunity_id
    join opportunity_requirements r on r.opportunity_id=o.id
    join opportunity_source_documents s on s.id=r.source_document_id
    join questions q on q.legal_article_id=r.legal_article_id and q.subject_id=r.subject_id and q.topic_id=r.topic_id
    join legal_articles a on a.id=q.legal_article_id join legal_versions v on v.id=a.legal_version_id
    left join question_style_profiles profile on profile.quiz_bank_id=q.style_bank_id
    where p.slug=${productSlug} and (${questionPublicId ?? null}::text is null or q.public_id=${questionPublicId ?? null})
      and (o.slug like 'teste-%' or o.slug like 'qa-%')
      and v.source_url in ('https://example.invalid/test-fixture','https://example.invalid/leiprova-qa-sem-validade-juridica')
      and s.source_url=v.source_url and s.status='approved' and r.source_snapshot_id is null
      and q.editorial_status='reviewed' and r.editorial_status='reviewed' and o.editorial_status='reviewed'
      and v.status='current' and a.editorial_status='reviewed'
  `;
  if (!rows.length) throw new Error("Não há conteúdo sintético revisado para este produto de QA.");
  for (const row of rows) {
    const questionUpdatedAt = new Date(row.updated_at).toISOString();
    const id = createHash("sha256").update(JSON.stringify(["qa-only", { ...row, updated_at: questionUpdatedAt }])).digest("hex");
    await db`insert into contest_product_question_bindings(id,product_slug,opportunity_id,requirement_id,question_id,
      source_document_id,legal_article_id,legal_version_id,legal_version_checksum,question_updated_at,
      requirement_text,source_locator,requirement_quote,legal_quote,scope_notes,evidence,
      proposed_by_user_id,status,reviewed_by_user_id,reviewed_at,review_notes)
      values(${id},${row.slug},${row.opportunity_id},${row.requirement_id},${row.question_id},${row.source_document_id},
        ${row.legal_article_id},${row.legal_version_id},${row.checksum_sha256},${questionUpdatedAt}::timestamptz,
        ${row.requirement_text},${row.source_locator},${row.requirement_text},${row.literal_text},
        'Fixture sintética de isolamento; não é curadoria nem aprovação de conteúdo jurídico.',${JSON.stringify(row.evidence)}::jsonb,
        ${row.reviewed_by_user_id},'approved',${row.reviewed_by_user_id},now(),
        'Aprovação sintética de software, exclusiva deste banco de homologação.') on conflict(id) do nothing`;
  }
  return rows.length;
}
