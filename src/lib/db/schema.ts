import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const idColumn = () =>
  bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("student"),
    avatarUrl: text("avatar_url"),
    stripeCustomerId: text("stripe_customer_id").unique(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsVersion: text("terms_version"),
    privacyVersion: text("privacy_version"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_lower_uidx").on(sql`lower(${table.email})`),
    check("users_role_check", sql`${table.role} in ('student', 'editor', 'admin')`),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_sessions_user_id_idx").on(table.userId),
    index("auth_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    scope: text("scope").notNull(),
    subjectHash: text("subject_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.scope, table.subjectHash, table.windowStartedAt],
      name: "rate_limit_counters_pkey",
    }),
    index("rate_limit_counters_expires_at_idx").on(table.expiresAt),
    check(
      "rate_limit_counters_scope_check",
      sql`char_length(${table.scope}) between 1 and 80`,
    ),
    check(
      "rate_limit_counters_subject_hash_check",
      sql`${table.subjectHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check("rate_limit_counters_count_check", sql`${table.requestCount} > 0`),
    check(
      "rate_limit_counters_expiry_check",
      sql`${table.expiresAt} > ${table.windowStartedAt}`,
    ),
  ],
);

export const quizBanks = pgTable(
  "quiz_banks",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    check("quiz_banks_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
  ],
);

export const questionStyleProfiles = pgTable(
  "question_style_profiles",
  {
    id: idColumn(),
    quizBankId: bigint("quiz_bank_id", { mode: "number" })
      .notNull()
      .unique()
      .references(() => quizBanks.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    format: text("format").notNull(),
    commandStyle: text("command_style").notNull(),
    reasoningDemand: text("reasoning_demand").notNull(),
    authoringGuidelines: jsonb("authoring_guidelines")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    distractorGuidance: jsonb("distractor_guidance")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    prohibitedPatterns: jsonb("prohibited_patterns")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    disclaimer: text("disclaimer").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("question_style_profiles_active_idx").on(table.isActive),
    index("question_style_profiles_updated_by_idx").on(table.updatedByUserId),
    check("question_style_profiles_version_check", sql`${table.version} >= 1`),
    check(
      "question_style_profiles_format_check",
      sql`${table.format} in ('multiple_choice', 'true_false')`,
    ),
    check(
      "question_style_profiles_disclaimer_check",
      sql`char_length(btrim(${table.disclaimer})) between 20 and 500`,
    ),
  ],
);

export const quizCareerTracks = pgTable(
  "quiz_career_tracks",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    description: text("description").notNull(),
    featured: boolean("featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("quiz_career_tracks_active_featured_idx").on(table.isActive, table.featured),
    check("quiz_career_tracks_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
  ],
);

export const quizCareerSpecializations = pgTable(
  "quiz_career_specializations",
  {
    id: idColumn(),
    careerTrackId: bigint("career_track_id", { mode: "number" })
      .notNull()
      .references(() => quizCareerTracks.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("quiz_career_specializations_career_slug_uidx").on(table.careerTrackId, table.slug),
    index("quiz_career_specializations_career_active_idx").on(table.careerTrackId, table.isActive),
    check(
      "quiz_career_specializations_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const quizSubjects = pgTable(
  "quiz_subjects",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    check("quiz_subjects_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
  ],
);

export const quizTopics = pgTable(
  "quiz_topics",
  {
    id: idColumn(),
    subjectId: bigint("subject_id", { mode: "number" })
      .notNull()
      .references(() => quizSubjects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("quiz_topics_subject_slug_uidx").on(table.subjectId, table.slug),
    index("quiz_topics_subject_active_idx").on(table.subjectId, table.isActive),
    check("quiz_topics_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
  ],
);

export const quizCareerSubjects = pgTable(
  "quiz_career_subjects",
  {
    careerTrackId: bigint("career_track_id", { mode: "number" })
      .notNull()
      .references(() => quizCareerTracks.id, { onDelete: "cascade" }),
    subjectId: bigint("subject_id", { mode: "number" })
      .notNull()
      .references(() => quizSubjects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.careerTrackId, table.subjectId],
      name: "quiz_career_subjects_pkey",
    }),
    index("quiz_career_subjects_subject_id_idx").on(table.subjectId),
  ],
);

export const examEditions = pgTable(
  "exam_editions",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    careerTrackId: bigint("career_track_id", { mode: "number" })
      .notNull()
      .references(() => quizCareerTracks.id, { onDelete: "restrict" }),
    specializationId: bigint("specialization_id", { mode: "number" }).references(
      () => quizCareerSpecializations.id,
      { onDelete: "restrict" },
    ),
    bankId: bigint("bank_id", { mode: "number" })
      .notNull()
      .references(() => quizBanks.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    organizer: text("organizer"),
    jurisdiction: text("jurisdiction"),
    officialUrl: text("official_url"),
    examDate: date("exam_date").notNull(),
    durationMinutes: integer("duration_minutes"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("exam_editions_career_status_date_idx").on(
      table.careerTrackId,
      table.status,
      table.examDate,
      table.id,
    ),
    index("exam_editions_bank_status_date_idx").on(table.bankId, table.status, table.examDate, table.id),
    index("exam_editions_specialization_id_idx").on(table.specializationId),
    check(
      "exam_editions_status_check",
      sql`${table.status} in ('draft', 'scheduled', 'held', 'published', 'canceled', 'archived')`,
    ),
    check("exam_editions_public_id_check", sql`${table.publicId} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      "exam_editions_duration_check",
      sql`${table.durationMinutes} is null or ${table.durationMinutes} > 0`,
    ),
  ],
);

export const plans = pgTable(
  "plans",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    billingType: text("billing_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("brl"),
    stripePriceId: text("stripe_price_id").unique(),
    features: jsonb("features").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check("plans_billing_type_check", sql`${table.billingType} in ('month', 'year', 'lifetime')`),
    check("plans_amount_nonnegative_check", sql`${table.amountCents} >= 0`),
    check("plans_currency_lowercase_check", sql`${table.currency} = lower(${table.currency})`),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().default("stripe"),
    providerSubscriptionId: text("provider_subscription_id").unique(),
    providerCheckoutSessionId: text("provider_checkout_session_id").unique(),
    status: text("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    accessEndsAt: timestamp("access_ends_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_plan_id_idx").on(table.planId),
    uniqueIndex("subscriptions_one_current_per_user_uidx")
      .on(table.userId)
      .where(sql`${table.status} in ('active', 'trialing', 'past_due')`),
    check(
      "subscriptions_status_check",
      sql`${table.status} in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid', 'expired')`,
    ),
  ],
);

export const legalActs = pgTable(
  "legal_acts",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    shortTitle: text("short_title").notNull(),
    actType: text("act_type").notNull(),
    actNumber: text("act_number"),
    actYear: integer("act_year"),
    jurisdiction: text("jurisdiction").notNull().default("federal"),
    urn: text("urn").unique(),
    officialUrl: text("official_url").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("legal_acts_title_idx").on(table.title),
    check("legal_acts_year_check", sql`${table.actYear} is null or ${table.actYear} between 1800 and 2200`),
  ],
);

export const legalVersions = pgTable(
  "legal_versions",
  {
    id: idColumn(),
    legalActId: bigint("legal_act_id", { mode: "number" })
      .notNull()
      .references(() => legalActs.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    validFrom: date("valid_from"),
    validUntil: date("valid_until"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("current"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_versions_act_checksum_uidx").on(table.legalActId, table.checksumSha256),
    index("legal_versions_act_id_idx").on(table.legalActId),
    check("legal_versions_status_check", sql`${table.status} in ('draft', 'current', 'superseded', 'revoked', 'pending_review')`),
    check(
      "legal_versions_date_range_check",
      sql`${table.validUntil} is null or ${table.validFrom} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
  ],
);

export const legalArticles = pgTable(
  "legal_articles",
  {
    id: idColumn(),
    legalVersionId: bigint("legal_version_id", { mode: "number" })
      .notNull()
      .references(() => legalVersions.id, { onDelete: "cascade" }),
    articleRef: text("article_ref").notNull(),
    articleOrder: integer("article_order").notNull(),
    heading: text("heading"),
    path: text("path").notNull(),
    literalText: text("literal_text").notNull(),
    editorialStatus: text("editorial_status").notNull().default("reviewed"),
    sourceRights: text("source_rights").notNull().default("official_text"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_articles_version_path_uidx").on(table.legalVersionId, table.path),
    index("legal_articles_version_order_idx").on(table.legalVersionId, table.articleOrder),
    check(
      "legal_articles_editorial_status_check",
      sql`${table.editorialStatus} in ('draft', 'pending_review', 'reviewed', 'suspended')`,
    ),
    check(
      "legal_articles_source_rights_check",
      sql`${table.sourceRights} in ('official_text', 'original_authorial', 'licensed')`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    legalArticleId: bigint("legal_article_id", { mode: "number" }).references(() => legalArticles.id, {
      onDelete: "restrict",
    }),
    subjectId: bigint("subject_id", { mode: "number" }).references(() => quizSubjects.id, {
      onDelete: "restrict",
    }),
    topicId: bigint("topic_id", { mode: "number" }).references(() => quizTopics.id, {
      onDelete: "restrict",
    }),
    quizMode: text("quiz_mode").notNull().default("dry_law"),
    styleBankId: bigint("style_bank_id", { mode: "number" }).references(() => quizBanks.id, {
      onDelete: "restrict",
    }),
    examEditionId: bigint("exam_edition_id", { mode: "number" }).references(() => examEditions.id, {
      onDelete: "restrict",
    }),
    type: text("type").notNull(),
    prompt: text("prompt").notNull(),
    explanation: text("explanation").notNull(),
    learningObjective: text("learning_objective"),
    topic: text("topic").notNull(),
    difficulty: smallint("difficulty").notNull().default(2),
    mutationKind: text("mutation_kind"),
    examBoardStyle: text("exam_board_style"),
    editorialStatus: text("editorial_status").notNull().default("reviewed"),
    sourceRights: text("source_rights").notNull().default("original_authorial"),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    sourceRightsHolder: text("source_rights_holder"),
    licenseBasis: text("license_basis"),
    licenseReference: text("license_reference"),
    licensedAt: timestamp("licensed_at", { withTimezone: true }),
    licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }),
    originalQuestionNumber: text("original_question_number"),
    originalQuestionOrder: integer("original_question_order"),
    originalBooklet: text("original_booklet"),
    authorshipMethod: text("authorship_method").notNull().default("human"),
    generatorModel: text("generator_model"),
    promptVersion: text("prompt_version"),
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    cleanRoomAttestedAt: timestamp("clean_room_attested_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("questions_article_id_idx").on(table.legalArticleId),
    index("questions_subject_id_idx").on(table.subjectId),
    index("questions_topic_id_idx").on(table.topicId),
    index("questions_style_bank_id_idx").on(table.styleBankId),
    index("questions_exam_edition_id_idx").on(table.examEditionId),
    index("questions_created_by_user_id_idx").on(table.createdByUserId),
    index("questions_reviewed_by_user_id_idx").on(table.reviewedByUserId),
    index("questions_topic_status_idx").on(table.topic, table.editorialStatus),
    index("questions_mode_status_subject_topic_idx").on(
      table.quizMode,
      table.editorialStatus,
      table.subjectId,
      table.topicId,
    ),
    index("questions_exam_mode_status_idx").on(
      table.examEditionId,
      table.quizMode,
      table.editorialStatus,
    ),
    uniqueIndex("questions_exam_original_order_uidx")
      .on(table.examEditionId, table.originalQuestionOrder)
      .where(sql`${table.examEditionId} is not null and ${table.originalQuestionOrder} is not null`),
    check("questions_difficulty_check", sql`${table.difficulty} between 1 and 5`),
    check(
      "questions_type_check",
      sql`${table.type} in ('literal_exact', 'cloze', 'altered_word', 'deadline', 'competence', 'true_false', 'multiple_choice')`,
    ),
    check(
      "questions_quiz_mode_check",
      sql`${table.quizMode} in ('dry_law', 'previous_exam', 'original_style')`,
    ),
    check(
      "questions_editorial_status_check",
      sql`${table.editorialStatus} in ('draft', 'pending_review', 'reviewed', 'suspended')`,
    ),
    check(
      "questions_source_rights_check",
      sql`${table.sourceRights} in ('original_authorial', 'licensed')`,
    ),
    check(
      "questions_authorship_method_check",
      sql`${table.authorshipMethod} in ('human', 'ai_assisted')`,
    ),
    check(
      "questions_ai_metadata_check",
      sql`${table.authorshipMethod} <> 'ai_assisted' or (
        nullif(btrim(${table.generatorModel}), '') is not null
        and nullif(btrim(${table.promptVersion}), '') is not null
      )`,
    ),
    check(
      "questions_mode_relations_check",
      sql`(
        ${table.quizMode} = 'dry_law'
        and ${table.legalArticleId} is not null
        and ${table.examEditionId} is null
        and ${table.styleBankId} is null
      ) or (
        ${table.quizMode} = 'original_style'
        and ${table.legalArticleId} is not null
        and ${table.subjectId} is not null
        and ${table.examEditionId} is null
        and ${table.styleBankId} is not null
        and ${table.sourceRights} = 'original_authorial'
        and nullif(btrim(${table.learningObjective}), '') is not null
        and ${table.createdByUserId} is not null
        and ${table.cleanRoomAttestedAt} is not null
      ) or (
        ${table.quizMode} = 'previous_exam'
        and ${table.subjectId} is not null
        and ${table.examEditionId} is not null
        and ${table.styleBankId} is null
        and ${table.sourceRights} = 'licensed'
      )`,
    ),
    check(
      "questions_topic_subject_check",
      sql`${table.topicId} is null or ${table.subjectId} is not null`,
    ),
    check(
      "questions_previous_exam_provenance_check",
      sql`${table.quizMode} <> 'previous_exam' or (
        nullif(btrim(${table.sourceTitle}), '') is not null
        and nullif(btrim(${table.sourceUrl}), '') is not null
        and nullif(btrim(${table.sourceRightsHolder}), '') is not null
        and nullif(btrim(${table.licenseBasis}), '') is not null
        and nullif(btrim(${table.licenseReference}), '') is not null
        and nullif(btrim(${table.originalQuestionNumber}), '') is not null
        and ${table.originalQuestionOrder} is not null
        and ${table.originalQuestionOrder} > 0
        and ${table.licensedAt} is not null
      )`,
    ),
    check(
      "questions_license_period_check",
      sql`${table.licenseExpiresAt} is null or ${table.licensedAt} is null or ${table.licenseExpiresAt} > ${table.licensedAt}`,
    ),
    check(
      "questions_reviewed_provenance_check",
      sql`${table.editorialStatus} <> 'reviewed' or ${table.quizMode} = 'dry_law' or ${table.reviewedByUserId} is not null`,
    ),
    check(
      "questions_independent_review_check",
      sql`${table.editorialStatus} <> 'reviewed'
        or ${table.quizMode} <> 'original_style'
        or ${table.reviewedByUserId} <> ${table.createdByUserId}`,
    ),
    check(
      "questions_submission_check",
      sql`${table.editorialStatus} not in ('pending_review', 'reviewed')
        or ${table.quizMode} <> 'original_style'
        or ${table.submittedAt} is not null`,
    ),
    check(
      "questions_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 1500`,
    ),
  ],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: idColumn(),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    optionKey: text("option_key").notNull(),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    mutationKind: text("mutation_kind"),
    rationale: text("rationale"),
    sortOrder: smallint("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("question_options_question_key_uidx").on(table.questionId, table.optionKey),
    uniqueIndex("question_options_question_order_uidx").on(table.questionId, table.sortOrder),
    uniqueIndex("question_options_id_question_uidx").on(table.id, table.questionId),
    uniqueIndex("question_options_one_correct_uidx")
      .on(table.questionId)
      .where(sql`${table.isCorrect}`),
    index("question_options_question_id_idx").on(table.questionId),
  ],
);

export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: text("id").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    careerTrackId: bigint("career_track_id", { mode: "number" }).references(
      () => quizCareerTracks.id,
      { onDelete: "restrict" },
    ),
    specializationId: bigint("specialization_id", { mode: "number" }).references(
      () => quizCareerSpecializations.id,
      { onDelete: "restrict" },
    ),
    bankId: bigint("bank_id", { mode: "number" }).references(() => quizBanks.id, {
      onDelete: "restrict",
    }),
    subjectId: bigint("subject_id", { mode: "number" }).references(() => quizSubjects.id, {
      onDelete: "restrict",
    }),
    topicId: bigint("topic_id", { mode: "number" }).references(() => quizTopics.id, {
      onDelete: "restrict",
    }),
    mode: text("mode").notNull(),
    experience: text("experience").notNull().default("training"),
    timed: boolean("timed").notNull().default(false),
    examScope: text("exam_scope").notNull().default("latest"),
    examEditionId: bigint("exam_edition_id", { mode: "number" }).references(() => examEditions.id, {
      onDelete: "restrict",
    }),
    requestedCount: smallint("requested_count").notNull(),
    questionCount: smallint("question_count").notNull().default(0),
    status: text("status").notNull().default("created"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("quiz_sessions_user_created_idx").on(table.userId, table.createdAt),
    index("quiz_sessions_career_track_id_idx").on(table.careerTrackId),
    index("quiz_sessions_specialization_id_idx").on(table.specializationId),
    index("quiz_sessions_bank_id_idx").on(table.bankId),
    index("quiz_sessions_subject_id_idx").on(table.subjectId),
    index("quiz_sessions_topic_id_idx").on(table.topicId),
    index("quiz_sessions_exam_edition_id_idx").on(table.examEditionId),
    index("quiz_sessions_expires_at_idx").on(table.expiresAt),
    check("quiz_sessions_path_check", sql`${table.path} in ('career', 'bank')`),
    check(
      "quiz_sessions_path_selection_check",
      sql`(${table.path} = 'career' and ${table.careerTrackId} is not null)
        or (${table.path} = 'bank' and ${table.bankId} is not null)`,
    ),
    check(
      "quiz_sessions_specialization_check",
      sql`${table.specializationId} is null or ${table.careerTrackId} is not null`,
    ),
    check("quiz_sessions_topic_check", sql`${table.topicId} is null or ${table.subjectId} is not null`),
    check(
      "quiz_sessions_mode_check",
      sql`${table.mode} in ('dry_law', 'previous_exam', 'original_style')`,
    ),
    check(
      "quiz_sessions_experience_check",
      sql`${table.experience} in ('training', 'exam')`,
    ),
    check("quiz_sessions_exam_scope_check", sql`${table.examScope} in ('latest', 'all')`),
    check(
      "quiz_sessions_exam_edition_check",
      sql`${table.examEditionId} is null or ${table.mode} = 'previous_exam'`,
    ),
    check(
      "quiz_sessions_count_check",
      sql`${table.requestedCount} between 1 and 50 and ${table.questionCount} between 0 and ${table.requestedCount}`,
    ),
    check(
      "quiz_sessions_status_check",
      sql`${table.status} in ('created', 'in_progress', 'completed', 'expired')`,
    ),
    check("quiz_sessions_expiry_check", sql`${table.expiresAt} > ${table.startedAt}`),
    check(
      "quiz_sessions_deadline_check",
      sql`(${table.timed} and ${table.deadlineAt} is not null
        and ${table.deadlineAt} > ${table.startedAt}
        and ${table.deadlineAt} <= ${table.expiresAt})
        or (not ${table.timed} and ${table.deadlineAt} is null)`,
    ),
  ],
);

export const quizSessionQuestions = pgTable(
  "quiz_session_questions",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => quizSessions.id, { onDelete: "cascade" }),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: smallint("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.questionId], name: "quiz_session_questions_pkey" }),
    uniqueIndex("quiz_session_questions_session_position_uidx").on(table.sessionId, table.position),
    index("quiz_session_questions_question_id_idx").on(table.questionId),
    check("quiz_session_questions_position_check", sql`${table.position} >= 1`),
  ],
);

export const quizSessionAnswers = pgTable(
  "quiz_session_answers",
  {
    sessionId: text("session_id").notNull(),
    questionId: bigint("question_id", { mode: "number" }).notNull(),
    selectedOptionId: bigint("selected_option_id", { mode: "number" }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    durationMs: integer("duration_ms"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.questionId], name: "quiz_session_answers_pkey" }),
    foreignKey({
      columns: [table.sessionId, table.questionId],
      foreignColumns: [quizSessionQuestions.sessionId, quizSessionQuestions.questionId],
      name: "quiz_session_answers_session_question_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.selectedOptionId, table.questionId],
      foreignColumns: [questionOptions.id, questionOptions.questionId],
      name: "quiz_session_answers_option_question_fk",
    }).onDelete("restrict"),
    index("quiz_session_answers_question_id_idx").on(table.questionId),
    index("quiz_session_answers_selected_option_id_idx").on(table.selectedOptionId),
    check(
      "quiz_session_answers_duration_check",
      sql`${table.durationMs} is null or ${table.durationMs} between 0 and 3600000`,
    ),
  ],
);

export const userAttempts = pgTable(
  "user_attempts",
  {
    id: idColumn(),
    quizSessionId: text("quiz_session_id").references(() => quizSessions.id, {
      onDelete: "set null",
    }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedOptionId: bigint("selected_option_id", { mode: "number" }).references(() => questionOptions.id, {
      onDelete: "restrict",
    }),
    isCorrect: boolean("is_correct").notNull(),
    confidence: smallint("confidence"),
    durationMs: integer("duration_ms"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_attempts_quiz_session_question_uidx").on(table.quizSessionId, table.questionId),
    index("user_attempts_user_answered_idx").on(table.userId, table.answeredAt),
    index("user_attempts_question_id_idx").on(table.questionId),
    index("user_attempts_selected_option_id_idx").on(table.selectedOptionId),
    check("user_attempts_confidence_check", sql`${table.confidence} is null or ${table.confidence} between 1 and 3`),
    check("user_attempts_duration_check", sql`${table.durationMs} is null or ${table.durationMs} >= 0`),
  ],
);

export const reviewQueue = pgTable(
  "review_queue",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    stage: smallint("stage").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    lastResult: text("last_result"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.questionId], name: "review_queue_pkey" }),
    index("review_queue_user_due_idx").on(table.userId, table.nextReviewAt),
    index("review_queue_question_id_idx").on(table.questionId),
    check("review_queue_stage_check", sql`${table.stage} between 0 and 6`),
    check("review_queue_counts_check", sql`${table.repetitions} >= 0 and ${table.lapses} >= 0`),
  ],
);

export const savedStudyFilters = pgTable(
  "saved_study_filters",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    legalActId: bigint("legal_act_id", { mode: "number" })
      .notNull()
      .references(() => legalActs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    articleStartOrder: integer("article_start_order").notNull(),
    articleEndOrder: integer("article_end_order").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("saved_study_filters_user_name_uidx").on(table.userId, sql`lower(${table.name})`),
    index("saved_study_filters_user_updated_idx").on(table.userId, table.updatedAt),
    index("saved_study_filters_legal_act_id_idx").on(table.legalActId),
    check("saved_study_filters_name_check", sql`char_length(btrim(${table.name})) between 1 and 80`),
    check(
      "saved_study_filters_article_range_check",
      sql`${table.articleStartOrder} >= 0 and ${table.articleEndOrder} >= ${table.articleStartOrder}`,
    ),
  ],
);

export const questionNotebooks = pgTable(
  "question_notebooks",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("question_notebooks_user_name_uidx").on(table.userId, sql`lower(${table.name})`),
    index("question_notebooks_user_updated_idx").on(table.userId, table.updatedAt),
    check("question_notebooks_name_check", sql`char_length(btrim(${table.name})) between 1 and 80`),
    check(
      "question_notebooks_description_check",
      sql`${table.description} is null or char_length(${table.description}) <= 240`,
    ),
  ],
);

export const questionNotebookItems = pgTable(
  "question_notebook_items",
  {
    notebookId: bigint("notebook_id", { mode: "number" })
      .notNull()
      .references(() => questionNotebooks.id, { onDelete: "cascade" }),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.notebookId, table.questionId],
      name: "question_notebook_items_pkey",
    }),
    index("question_notebook_items_question_id_idx").on(table.questionId),
  ],
);

export const studyDays = pgTable(
  "study_days",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studyDate: date("study_date").notNull(),
    answeredCount: integer("answered_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    minutesStudied: integer("minutes_studied").notNull().default(0),
    xpEarned: integer("xp_earned").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.studyDate], name: "study_days_pkey" }),
    index("study_days_date_xp_idx").on(table.studyDate, table.xpEarned),
    check(
      "study_days_counts_check",
      sql`${table.answeredCount} >= 0 and ${table.correctCount} >= 0 and ${table.correctCount} <= ${table.answeredCount}`,
    ),
    check("study_days_minutes_xp_check", sql`${table.minutesStudied} >= 0 and ${table.xpEarned} >= 0`),
  ],
);

export const checkoutAttempts = pgTable(
  "checkout_attempts",
  {
    id: text("id").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    providerSessionId: text("provider_session_id").unique(),
    status: text("status").notNull().default("created"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("checkout_attempts_user_created_idx").on(table.userId, table.createdAt),
    index("checkout_attempts_plan_id_idx").on(table.planId),
    check(
      "checkout_attempts_status_check",
      sql`${table.status} in ('created', 'session_created', 'completed', 'expired', 'failed')`,
    ),
  ],
);

export const stripeEvents = pgTable(
  "stripe_events",
  {
    eventId: text("event_id").primaryKey(),
    eventType: text("event_type").notNull(),
    apiVersion: text("api_version"),
    livemode: boolean("livemode").notNull(),
    status: text("status").notNull().default("received"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("stripe_events_status_received_idx").on(table.status, table.receivedAt),
    index("stripe_events_type_idx").on(table.eventType),
    check("stripe_events_status_check", sql`${table.status} in ('received', 'processing', 'processed', 'failed')`),
  ],
);

export const stripeConnectPartners = pgTable(
  "stripe_connect_partners",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name").notNull(),
    email: text("email").notNull(),
    country: text("country").notNull().default("BR"),
    currency: text("currency").notNull().default("brl"),
    stripeAccountId: text("stripe_account_id").unique(),
    accountType: text("account_type").notNull().default("express"),
    status: text("status").notNull().default("draft"),
    detailsSubmitted: boolean("details_submitted").notNull().default(false),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    requirementsCurrentlyDue: jsonb("requirements_currently_due")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    requirementsPastDue: jsonb("requirements_past_due")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("stripe_connect_partners_status_idx").on(table.status),
    index("stripe_connect_partners_created_by_idx").on(table.createdByUserId),
    index("stripe_connect_partners_updated_by_idx").on(table.updatedByUserId),
    check(
      "stripe_connect_partners_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check("stripe_connect_partners_country_check", sql`${table.country} = upper(${table.country})`),
    check("stripe_connect_partners_currency_check", sql`${table.currency} = lower(${table.currency})`),
    check(
      "stripe_connect_partners_account_id_check",
      sql`${table.stripeAccountId} is null or ${table.stripeAccountId} ~ '^acct_[A-Za-z0-9]+$'`,
    ),
    check("stripe_connect_partners_account_type_check", sql`${table.accountType} = 'express'`),
    check(
      "stripe_connect_partners_status_check",
      sql`${table.status} in ('draft', 'onboarding', 'restricted', 'enabled', 'paused', 'archived')`,
    ),
  ],
);

export const stripeConnectSplitRules = pgTable(
  "stripe_connect_split_rules",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    chargeModel: text("charge_model").notNull().default("separate_charges_and_transfers"),
    currency: text("currency").notNull().default("brl"),
    platformShareBps: integer("platform_share_bps").notNull().default(0),
    version: integer("version").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("stripe_connect_split_rules_one_active_uidx")
      .on(table.status)
      .where(sql`${table.status} = 'active'`),
    index("stripe_connect_split_rules_created_by_idx").on(table.createdByUserId),
    index("stripe_connect_split_rules_updated_by_idx").on(table.updatedByUserId),
    check(
      "stripe_connect_split_rules_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "stripe_connect_split_rules_status_check",
      sql`${table.status} in ('draft', 'pending_approval', 'active', 'paused', 'archived')`,
    ),
    check(
      "stripe_connect_split_rules_charge_model_check",
      sql`${table.chargeModel} = 'separate_charges_and_transfers'`,
    ),
    check("stripe_connect_split_rules_currency_check", sql`${table.currency} = lower(${table.currency})`),
    check(
      "stripe_connect_split_rules_platform_share_check",
      sql`${table.platformShareBps} between 0 and 10000`,
    ),
    check("stripe_connect_split_rules_version_check", sql`${table.version} >= 1`),
    check(
      "stripe_connect_split_rules_effective_period_check",
      sql`${table.effectiveUntil} is null or ${table.effectiveFrom} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const stripeConnectSplitAllocations = pgTable(
  "stripe_connect_split_allocations",
  {
    ruleId: bigint("rule_id", { mode: "number" })
      .notNull()
      .references(() => stripeConnectSplitRules.id, { onDelete: "cascade" }),
    partnerId: bigint("partner_id", { mode: "number" })
      .notNull()
      .references(() => stripeConnectPartners.id, { onDelete: "restrict" }),
    shareBps: integer("share_bps").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.ruleId, table.partnerId],
      name: "stripe_connect_split_allocations_pkey",
    }),
    index("stripe_connect_split_allocations_partner_idx").on(table.partnerId),
    check(
      "stripe_connect_split_allocations_share_check",
      sql`${table.shareBps} between 1 and 10000`,
    ),
  ],
);

export const stripeConnectTransferBatches = pgTable(
  "stripe_connect_transfer_batches",
  {
    id: text("id").primaryKey(),
    sourceEventId: text("source_event_id")
      .notNull()
      .unique()
      .references(() => stripeEvents.eventId, { onDelete: "restrict" }),
    checkoutAttemptId: text("checkout_attempt_id").references(() => checkoutAttempts.id, {
      onDelete: "restrict",
    }),
    ruleId: bigint("rule_id", { mode: "number" })
      .notNull()
      .references(() => stripeConnectSplitRules.id, { onDelete: "restrict" }),
    providerPaymentIntentId: text("provider_payment_intent_id").unique(),
    providerInvoiceId: text("provider_invoice_id").unique(),
    providerChargeId: text("provider_charge_id").unique(),
    transferGroup: text("transfer_group").notNull().unique(),
    status: text("status").notNull().default("planned"),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    platformAmountCents: integer("platform_amount_cents").notNull(),
    partnerAmountCents: integer("partner_amount_cents").notNull(),
    currency: text("currency").notNull().default("brl"),
    livemode: boolean("livemode").notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("stripe_connect_transfer_batches_identity_uidx").on(
      table.id,
      table.ruleId,
      table.currency,
    ),
    index("stripe_connect_transfer_batches_status_created_idx").on(table.status, table.createdAt),
    index("stripe_connect_transfer_batches_rule_idx").on(table.ruleId),
    index("stripe_connect_transfer_batches_checkout_attempt_idx").on(table.checkoutAttemptId),
    check(
      "stripe_connect_transfer_batches_status_check",
      sql`${table.status} in ('planned', 'processing', 'completed', 'failed', 'partially_reversed', 'reversed')`,
    ),
    check(
      "stripe_connect_transfer_batches_amounts_check",
      sql`${table.grossAmountCents} > 0
        and ${table.platformAmountCents} >= 0
        and ${table.partnerAmountCents} >= 0
        and ${table.platformAmountCents} + ${table.partnerAmountCents} = ${table.grossAmountCents}`,
    ),
    check("stripe_connect_transfer_batches_currency_check", sql`${table.currency} = lower(${table.currency})`),
    check(
      "stripe_connect_transfer_batches_provider_reference_check",
      sql`${table.providerPaymentIntentId} is not null
        or ${table.providerInvoiceId} is not null
        or ${table.providerChargeId} is not null`,
    ),
  ],
);

export const stripeConnectTransfers = pgTable(
  "stripe_connect_transfers",
  {
    id: idColumn(),
    batchId: text("batch_id").notNull(),
    ruleId: bigint("rule_id", { mode: "number" }).notNull(),
    partnerId: bigint("partner_id", { mode: "number" }).notNull(),
    providerTransferId: text("provider_transfer_id").unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    reversedAmountCents: integer("reversed_amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("brl"),
    status: text("status").notNull().default("planned"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    transferredAt: timestamp("transferred_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.batchId, table.ruleId, table.currency],
      foreignColumns: [
        stripeConnectTransferBatches.id,
        stripeConnectTransferBatches.ruleId,
        stripeConnectTransferBatches.currency,
      ],
      name: "stripe_connect_transfers_batch_rule_currency_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.ruleId, table.partnerId],
      foreignColumns: [
        stripeConnectSplitAllocations.ruleId,
        stripeConnectSplitAllocations.partnerId,
      ],
      name: "stripe_connect_transfers_rule_partner_fk",
    }).onDelete("restrict"),
    uniqueIndex("stripe_connect_transfers_batch_partner_uidx").on(table.batchId, table.partnerId),
    index("stripe_connect_transfers_rule_partner_idx").on(table.ruleId, table.partnerId),
    index("stripe_connect_transfers_partner_status_idx").on(table.partnerId, table.status),
    check("stripe_connect_transfers_amount_check", sql`${table.amountCents} > 0`),
    check(
      "stripe_connect_transfers_reversed_amount_check",
      sql`${table.reversedAmountCents} between 0 and ${table.amountCents}`,
    ),
    check("stripe_connect_transfers_currency_check", sql`${table.currency} = lower(${table.currency})`),
    check(
      "stripe_connect_transfers_status_check",
      sql`${table.status} in ('planned', 'pending', 'succeeded', 'failed', 'partially_reversed', 'reversed')`,
    ),
  ],
);

export const questionReports = pgTable(
  "question_reports",
  {
    id: idColumn(),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("question_reports_question_id_idx").on(table.questionId),
    index("question_reports_user_id_idx").on(table.userId),
    index("question_reports_open_idx").on(table.createdAt).where(sql`${table.status} = 'open'`),
    check("question_reports_status_check", sql`${table.status} in ('open', 'reviewing', 'resolved', 'dismissed')`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn(),
    actorUserId: bigint("actor_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorUserId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    ipHash: text("ip_hash"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("contact_messages_status_created_idx").on(table.status, table.createdAt),
    index("contact_messages_user_id_idx").on(table.userId),
    check("contact_messages_status_check", sql`${table.status} in ('open', 'reviewing', 'resolved', 'spam')`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type QuestionStyleProfile = typeof questionStyleProfiles.$inferSelect;
