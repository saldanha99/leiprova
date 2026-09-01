\set ON_ERROR_STOP on

begin;

alter default privileges in schema public revoke all privileges on tables from :app_user;
alter default privileges in schema public revoke all privileges on sequences from :app_user;
revoke all privileges on all tables in schema public from :app_user;
revoke all privileges on all sequences in schema public from :app_user;

grant select on
  plans,
  legal_acts,
  legal_source_snapshots,
  legal_versions,
  legal_articles,
  questions,
  question_options,
  question_style_profiles,
  quiz_banks,
  quiz_career_tracks,
  quiz_career_specializations,
  quiz_subjects,
  quiz_topics,
  quiz_career_subjects,
  exam_editions,
  exam_source_portals,
  contest_categories,
  contest_category_careers,
  contest_opportunities,
  contest_opportunity_plans,
  opportunity_source_documents,
  opportunity_organizer_assignments,
  opportunity_requirements,
  opportunity_analysis_snapshots,
  question_opportunities,
  stripe_connect_partners,
  stripe_connect_split_rules,
  stripe_connect_split_allocations,
  stripe_connect_transfer_batches,
  stripe_connect_transfers
to :app_user;

grant insert (
  id,
  public_id,
  legal_article_id,
  subject_id,
  topic_id,
  quiz_mode,
  style_bank_id,
  exam_edition_id,
  type,
  prompt,
  explanation,
  learning_objective,
  topic,
  difficulty,
  mutation_kind,
  exam_board_style,
  editorial_status,
  source_rights,
  source_title,
  source_url,
  source_rights_holder,
  license_basis,
  license_reference,
  licensed_at,
  license_expires_at,
  original_question_number,
  original_question_order,
  original_booklet,
  authorship_method,
  generator_model,
  prompt_version,
  created_by_user_id,
  reviewed_by_user_id,
  clean_room_attested_at,
  submitted_at,
  review_notes,
  similarity_max_bps,
  similarity_reference_public_id,
  originality_checked_at,
  verified_at,
  created_at,
  updated_at
) on questions to :app_user;

grant update (
  editorial_status,
  created_by_user_id,
  reviewed_by_user_id,
  clean_room_attested_at,
  submitted_at,
  review_notes,
  similarity_max_bps,
  similarity_reference_public_id,
  originality_checked_at,
  verified_at,
  updated_at
) on questions to :app_user;

grant insert (
  id,
  question_id,
  option_key,
  text,
  is_correct,
  mutation_kind,
  rationale,
  sort_order
) on question_options to :app_user;

grant insert (
  id,
  public_id,
  legal_act_id,
  source_url,
  checksum_sha256,
  normalized_content,
  content_length,
  article_marker_count,
  http_status,
  status,
  initiated_by_user_id,
  reviewed_by_user_id,
  review_notes,
  fetched_at,
  last_seen_at,
  reviewed_at,
  created_at
) on legal_source_snapshots to :app_user;

grant update (
  http_status,
  status,
  reviewed_by_user_id,
  review_notes,
  last_seen_at,
  reviewed_at
) on legal_source_snapshots to :app_user;

grant update (
  last_http_status,
  last_page_title,
  last_final_url,
  last_error,
  last_checked_at,
  updated_at
) on exam_source_portals to :app_user;

grant insert (
  id,
  public_id,
  career_track_id,
  specialization_id,
  bank_id,
  source_external_id,
  title,
  organizer,
  jurisdiction,
  official_url,
  exam_date,
  duration_minutes,
  source_policy,
  source_content_stored,
  source_page_title,
  source_http_status,
  source_checked_at,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at
) on exam_editions to :app_user;

grant update (
  title,
  organizer,
  jurisdiction,
  official_url,
  exam_date,
  duration_minutes,
  source_checked_at,
  updated_at
) on exam_editions to :app_user;

grant insert (
  public_id,
  slug,
  category_id,
  career_track_id,
  specialization_id,
  jurisdiction_code,
  scope,
  cycle_year,
  institution_acronym,
  institution_name,
  role_name,
  official_notice_number,
  title,
  summary,
  lifecycle_status,
  status_as_of,
  official_url,
  announced_at,
  notice_published_at,
  registration_starts_at,
  registration_ends_at,
  exam_date,
  source_checked_at,
  created_by_user_id,
  updated_by_user_id,
  is_featured
) on contest_opportunities to :app_user;

grant update (
  title,
  summary,
  lifecycle_status,
  status_as_of,
  official_url,
  announced_at,
  notice_published_at,
  registration_starts_at,
  registration_ends_at,
  exam_date,
  source_checked_at,
  editorial_status,
  published_at,
  updated_by_user_id,
  reviewed_by_user_id,
  reviewed_at,
  review_notes,
  is_featured,
  updated_at
) on contest_opportunities to :app_user;

grant insert (
  public_id,
  opportunity_id,
  document_type,
  source_external_id,
  title,
  source_url,
  source_host,
  published_at,
  observed_at,
  last_seen_at,
  checksum_sha256,
  http_status,
  content_type,
  source_policy,
  source_content_stored,
  supersedes_public_id,
  initiated_by_user_id
) on opportunity_source_documents to :app_user;

grant update (
  title,
  published_at,
  last_seen_at,
  checksum_sha256,
  http_status,
  content_type,
  supersedes_public_id,
  status,
  reviewed_by_user_id,
  reviewed_at,
  review_notes
) on opportunity_source_documents to :app_user;

grant insert (
  opportunity_id,
  quiz_bank_id,
  source_document_id,
  responsible_type,
  role,
  organizer_slug,
  organizer_name,
  valid_from,
  valid_until
) on opportunity_organizer_assignments to :app_user;

grant update (
  valid_until,
  status,
  reviewed_by_user_id,
  reviewed_at,
  review_notes,
  updated_at
) on opportunity_organizer_assignments to :app_user;

grant insert (
  opportunity_id,
  source_document_id,
  subject_id,
  topic_id,
  legal_act_id,
  legal_article_id,
  requirement_text,
  source_locator
) on opportunity_requirements to :app_user;

grant update (
  subject_id,
  topic_id,
  legal_act_id,
  legal_article_id,
  requirement_text,
  source_locator,
  editorial_status,
  reviewed_by_user_id,
  reviewed_at,
  updated_at
) on opportunity_requirements to :app_user;

grant insert (
  public_id,
  opportunity_id,
  organizer_assignment_id,
  analysis_kind,
  methodology_version,
  lookback_years,
  window_start_year,
  window_end_year,
  sample_size,
  corpus_basis,
  corpus_rights_reference,
  methodology,
  scores,
  confidence_bps,
  limitations,
  created_by_user_id
) on opportunity_analysis_snapshots to :app_user;

grant update (
  methodology_version,
  lookback_years,
  window_start_year,
  window_end_year,
  sample_size,
  corpus_basis,
  corpus_rights_reference,
  methodology,
  scores,
  confidence_bps,
  limitations,
  status,
  reviewed_by_user_id,
  reviewed_at,
  updated_at
) on opportunity_analysis_snapshots to :app_user;

grant insert, delete on question_opportunities to :app_user;

grant select, insert, update on
  subscriptions,
  review_queue,
  study_days,
  checkout_attempts,
  stripe_events,
  rate_limit_counters,
  quiz_sessions
to :app_user;

grant select on users to :app_user;
grant insert (
  public_id,
  email,
  name,
  password_hash,
  terms_accepted_at,
  terms_version,
  privacy_version
) on users to :app_user;
grant update (
  password_hash,
  email_verified_at,
  stripe_customer_id,
  last_seen_at,
  updated_at
) on users to :app_user;

grant select, insert, update on account_access_tokens to :app_user;

grant insert (
  public_id,
  display_name,
  legal_name,
  email,
  country,
  currency,
  account_type,
  status,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at
) on stripe_connect_partners to :app_user;
grant update (
  stripe_account_id,
  status,
  details_submitted,
  charges_enabled,
  payouts_enabled,
  requirements_currently_due,
  requirements_past_due,
  updated_by_user_id,
  updated_at
) on stripe_connect_partners to :app_user;

grant select, insert on
  user_attempts,
  question_reports,
  audit_logs,
  contact_messages
to :app_user;

grant select, insert on quiz_session_questions to :app_user;
grant select, insert, update on quiz_session_answers to :app_user;

grant select, insert, delete on saved_study_filters to :app_user;
grant select, insert, update, delete on question_notebooks to :app_user;
grant select, insert, delete on question_notebook_items to :app_user;

grant delete on rate_limit_counters to :app_user;

grant delete on auth_sessions to :app_user;
grant select, insert, update on auth_sessions to :app_user;
grant usage on
  users_id_seq,
  subscriptions_id_seq,
  user_attempts_id_seq,
  question_reports_id_seq,
  audit_logs_id_seq,
  contact_messages_id_seq,
  stripe_connect_partners_id_seq,
  saved_study_filters_id_seq,
  question_notebooks_id_seq,
  questions_id_seq,
  question_options_id_seq,
  legal_source_snapshots_id_seq,
  exam_editions_id_seq,
  contest_opportunities_id_seq,
  opportunity_source_documents_id_seq,
  opportunity_organizer_assignments_id_seq,
  opportunity_requirements_id_seq,
  opportunity_analysis_snapshots_id_seq
to :app_user;

commit;
