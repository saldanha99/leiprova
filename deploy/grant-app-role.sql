\set ON_ERROR_STOP on

alter default privileges in schema public revoke all privileges on tables from :app_user;
alter default privileges in schema public revoke all privileges on sequences from :app_user;
revoke all privileges on all tables in schema public from :app_user;
revoke all privileges on all sequences in schema public from :app_user;

grant select on
  plans,
  legal_acts,
  legal_versions,
  legal_articles,
  questions,
  question_options,
  quiz_banks,
  quiz_career_tracks,
  quiz_career_specializations,
  quiz_subjects,
  quiz_topics,
  quiz_career_subjects,
  exam_editions,
  stripe_connect_partners,
  stripe_connect_split_rules,
  stripe_connect_split_allocations,
  stripe_connect_transfer_batches,
  stripe_connect_transfers
to :app_user;

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
  stripe_customer_id,
  last_seen_at,
  updated_at
) on users to :app_user;

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
  question_notebooks_id_seq
to :app_user;
