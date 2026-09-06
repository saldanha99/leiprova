import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
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

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const idColumn = () =>
  bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export type ContestOrderLine = {
  productSlug: string;
  // Chaves antigas permanecem válidas somente para o histórico de pagamento único.
  accessKey: "6m" | "12m" | "monthly" | "annual";
  months: number;
  amountCents: number;
  stripePriceId: string;
  opportunityId: number;
};

// Comércio avulso: não usa subscriptions, que representa o acesso Master.
export const contestStoreProducts = pgTable(
  "contest_store_products",
  {
    slug: text("slug").primaryKey(),
    opportunityId: bigint("opportunity_id", { mode: "number" }).references(
      () => contestOpportunities.id,
      { onDelete: "restrict" },
    ),
    status: text("status").notNull().default("draft"),
    stripeProductId: text("stripe_product_id").unique(),
    stripePrice6m: text("stripe_price_6m").unique(),
    stripePrice12m: text("stripe_price_12m").unique(),
    stripePriceMonthly: text("stripe_price_monthly").unique(),
    stripePriceAnnual: text("stripe_price_annual").unique(),
    stripeMode: text("stripe_mode").notNull().default("test"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedByUserId: bigint("released_by_user_id", {
      mode: "number",
    }).references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("contest_store_opportunity_idx").on(table.opportunityId),
    index("contest_store_released_by_idx").on(table.releasedByUserId),
    check(
      "contest_store_status_check",
      sql`${table.status} in ('draft','released','retired')`,
    ),
    check(
      "contest_store_mode_check",
      sql`${table.stripeMode} in ('test','live')`,
    ),
    check(
      "contest_store_release_check",
      sql`${table.status} <> 'released' or (${table.opportunityId} is not null and ${table.releasedAt} is not null and ${table.releasedByUserId} is not null)`,
    ),
  ],
);

export const contestOrders = pgTable(
  "contest_orders",
  {
    id: text("id").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("created"),
    currency: text("currency").notNull().default("brl"),
    amountCents: integer("amount_cents").notNull(),
    lines: jsonb("lines").$type<ContestOrderLine[]>().notNull(),
    stripeSessionId: text("stripe_session_id").unique(),
    checkoutUiMode: text("checkout_ui_mode").notNull().default("hosted"),
    stripeCreationStartedAt: timestamp("stripe_creation_started_at", { withTimezone: true }),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    subscriptionStatus: text("subscription_status"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    paidThrough: timestamp("paid_through", { withTimezone: true }),
    stripeMode: text("stripe_mode").notNull(),
    ...timestamps,
  },
  (table) => [
    index("contest_orders_user_idx").on(table.userId, table.createdAt),
    check(
      "contest_orders_status_check",
      sql`${table.status} in ('created','pending','paid','failed','expired','refunded','disputed')`,
    ),
    check(
      "contest_orders_amount_check",
      sql`${table.amountCents} > 0 and ${table.currency} = 'brl'`,
    ),
    check(
      "contest_orders_mode_check",
      sql`${table.stripeMode} in ('test','live')`,
    ),
    check("contest_orders_ui_mode_check", sql`${table.checkoutUiMode} in ('hosted','elements')`),
    check(
      "contest_orders_lines_check",
      sql`jsonb_typeof(${table.lines}) = 'array' and jsonb_array_length(${table.lines}) between 1 and 3`,
    ),
  ],
);

export const contestPurchases = pgTable(
  "contest_purchases",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => contestOrders.id, { onDelete: "cascade" }),
    productSlug: text("product_slug")
      .notNull()
      .references(() => contestStoreProducts.slug, { onDelete: "restrict" }),
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "restrict" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    accessStartsAt: timestamp("access_starts_at", {
      withTimezone: true,
    }).notNull(),
    accessEndsAt: timestamp("access_ends_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.productSlug] }),
    index("contest_purchases_user_access_idx").on(
      table.userId,
      table.status,
      table.accessEndsAt,
    ),
    index("contest_purchases_product_idx").on(table.productSlug),
    index("contest_purchases_opportunity_idx").on(table.opportunityId),
    check(
      "contest_purchases_status_check",
      sql`${table.status} in ('active','revoked')`,
    ),
    check(
      "contest_purchases_period_check",
      sql`${table.accessEndsAt} > ${table.accessStartsAt}`,
    ),
  ],
);

// Cada ciclo pago tem sua própria referência: reembolso antigo não revoga um ciclo novo.
export const contestBillingInvoices = pgTable(
  "contest_billing_invoices",
  {
    invoiceId: text("invoice_id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => contestOrders.id, { onDelete: "cascade" }),
    paymentIntentId: text("payment_intent_id").notNull().unique(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("paid"),
    ...timestamps,
  },
  (table) => [
    index("contest_billing_invoices_order_idx").on(table.orderId),
    check(
      "contest_billing_invoices_period_check",
      sql`${table.periodEnd} > ${table.periodStart}`,
    ),
    check(
      "contest_billing_invoices_status_check",
      sql`${table.status} in ('paid','refunded','disputed')`,
    ),
  ],
);

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
    check(
      "users_role_check",
      sql`${table.role} in ('student', 'editor', 'admin')`,
    ),
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
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    check(
      "quiz_banks_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const examSourcePortals = pgTable(
  "exam_source_portals",
  {
    id: idColumn(),
    quizBankId: bigint("quiz_bank_id", { mode: "number" })
      .notNull()
      .unique()
      .references(() => quizBanks.id, { onDelete: "restrict" }),
    officialUrl: text("official_url").notNull(),
    sourcePolicy: text("source_policy").notNull().default("metadata_only"),
    lastHttpStatus: integer("last_http_status"),
    lastPageTitle: text("last_page_title"),
    lastFinalUrl: text("last_final_url"),
    lastError: text("last_error"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("exam_source_portals_active_idx").on(table.isActive),
    check(
      "exam_source_portals_url_check",
      sql`${table.officialUrl} ~ '^https://'`,
    ),
    check(
      "exam_source_portals_policy_check",
      sql`${table.sourcePolicy} = 'metadata_only'`,
    ),
    check(
      "exam_source_portals_http_status_check",
      sql`${table.lastHttpStatus} is null or ${table.lastHttpStatus} between 100 and 599`,
    ),
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
    updatedByUserId: bigint("updated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
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
    index("quiz_career_tracks_active_featured_idx").on(
      table.isActive,
      table.featured,
    ),
    check(
      "quiz_career_tracks_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
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
    uniqueIndex("quiz_career_specializations_career_slug_uidx").on(
      table.careerTrackId,
      table.slug,
    ),
    uniqueIndex("quiz_career_specializations_id_career_uidx").on(
      table.id,
      table.careerTrackId,
    ),
    index("quiz_career_specializations_career_active_idx").on(
      table.careerTrackId,
      table.isActive,
    ),
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
    check(
      "quiz_subjects_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
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
    uniqueIndex("quiz_topics_subject_slug_uidx").on(
      table.subjectId,
      table.slug,
    ),
    index("quiz_topics_subject_active_idx").on(table.subjectId, table.isActive),
    check(
      "quiz_topics_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    specializationId: bigint("specialization_id", { mode: "number" }),
    bankId: bigint("bank_id", { mode: "number" })
      .notNull()
      .references(() => quizBanks.id, { onDelete: "restrict" }),
    sourceExternalId: text("source_external_id"),
    title: text("title").notNull(),
    organizer: text("organizer"),
    jurisdiction: text("jurisdiction"),
    officialUrl: text("official_url"),
    examDate: date("exam_date").notNull(),
    durationMinutes: integer("duration_minutes"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    sourcePolicy: text("source_policy").notNull().default("metadata_only"),
    sourceContentStored: boolean("source_content_stored")
      .notNull()
      .default(false),
    sourcePageTitle: text("source_page_title"),
    sourceHttpStatus: integer("source_http_status"),
    sourceCheckedAt: timestamp("source_checked_at", { withTimezone: true }),
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: bigint("updated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.specializationId, table.careerTrackId],
      foreignColumns: [
        quizCareerSpecializations.id,
        quizCareerSpecializations.careerTrackId,
      ],
      name: "exam_editions_specialization_career_fk",
    }).onDelete("restrict"),
    uniqueIndex("exam_editions_bank_source_external_uidx")
      .on(table.bankId, table.sourceExternalId)
      .where(sql`${table.sourceExternalId} is not null`),
    index("exam_editions_career_status_date_idx").on(
      table.careerTrackId,
      table.status,
      table.examDate,
      table.id,
    ),
    index("exam_editions_bank_status_date_idx").on(
      table.bankId,
      table.status,
      table.examDate,
      table.id,
    ),
    index("exam_editions_specialization_id_idx").on(table.specializationId),
    index("exam_editions_created_by_idx").on(table.createdByUserId),
    index("exam_editions_source_policy_idx").on(
      table.sourcePolicy,
      table.examDate,
    ),
    check(
      "exam_editions_status_check",
      sql`${table.status} in ('draft', 'scheduled', 'held', 'published', 'canceled', 'archived')`,
    ),
    check(
      "exam_editions_public_id_check",
      sql`${table.publicId} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "exam_editions_source_external_id_check",
      sql`${table.sourceExternalId} is null or char_length(btrim(${table.sourceExternalId})) > 0`,
    ),
    check(
      "exam_editions_eligible_source_check",
      sql`${table.status} not in ('held', 'published') or (
        ${table.officialUrl} is not null
        and char_length(btrim(${table.officialUrl})) > 0
        and ${table.sourceCheckedAt} is not null
      )`,
    ),
    check(
      "exam_editions_duration_check",
      sql`${table.durationMinutes} is null or ${table.durationMinutes} > 0`,
    ),
    check(
      "exam_editions_source_policy_check",
      sql`${table.sourcePolicy} in ('metadata_only', 'licensed_content')`,
    ),
    check(
      "exam_editions_metadata_only_check",
      sql`${table.sourcePolicy} <> 'metadata_only' or not ${table.sourceContentStored}`,
    ),
    check(
      "exam_editions_source_http_status_check",
      sql`${table.sourceHttpStatus} is null or ${table.sourceHttpStatus} between 100 and 599`,
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
    features: jsonb("features")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check(
      "plans_billing_type_check",
      sql`${table.billingType} in ('month', 'year', 'lifetime')`,
    ),
    check("plans_amount_nonnegative_check", sql`${table.amountCents} >= 0`),
    check(
      "plans_currency_lowercase_check",
      sql`${table.currency} = lower(${table.currency})`,
    ),
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
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
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
    check(
      "legal_acts_year_check",
      sql`${table.actYear} is null or ${table.actYear} between 1800 and 2200`,
    ),
  ],
);

export const legalSourceSnapshots = pgTable(
  "legal_source_snapshots",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    legalActId: bigint("legal_act_id", { mode: "number" })
      .notNull()
      .references(() => legalActs.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    normalizedContent: text("normalized_content").notNull(),
    contentLength: integer("content_length").notNull(),
    articleMarkerCount: integer("article_marker_count").notNull(),
    httpStatus: integer("http_status").notNull(),
    status: text("status").notNull().default("pending_review"),
    initiatedByUserId: bigint("initiated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_source_snapshots_act_checksum_uidx").on(
      table.legalActId,
      table.checksumSha256,
    ),
    uniqueIndex("legal_source_snapshots_id_act_uidx").on(
      table.id,
      table.legalActId,
    ),
    index("legal_source_snapshots_act_status_idx").on(
      table.legalActId,
      table.status,
      table.fetchedAt,
    ),
    index("legal_source_snapshots_initiated_by_idx").on(
      table.initiatedByUserId,
    ),
    index("legal_source_snapshots_reviewed_by_idx").on(table.reviewedByUserId),
    check(
      "legal_source_snapshots_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "legal_source_snapshots_url_check",
      sql`${table.sourceUrl} ~ '^https://legis\\.senado\\.leg\\.br/norma/[0-9]+$'`,
    ),
    check(
      "legal_source_snapshots_checksum_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "legal_source_snapshots_content_check",
      sql`${table.contentLength} >= 1000`,
    ),
    check(
      "legal_source_snapshots_article_count_check",
      sql`${table.articleMarkerCount} >= 1`,
    ),
    check(
      "legal_source_snapshots_http_status_check",
      sql`${table.httpStatus} between 200 and 299`,
    ),
    check(
      "legal_source_snapshots_status_check",
      sql`${table.status} in ('pending_review', 'approved', 'superseded', 'rejected')`,
    ),
    check(
      "legal_source_snapshots_review_check",
      sql`${table.status} <> 'approved' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "legal_source_snapshots_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 1500`,
    ),
  ],
);

export const legalTextSnapshots = pgTable(
  "legal_text_snapshots",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    legalActId: bigint("legal_act_id", { mode: "number" })
      .notNull()
      .references(() => legalActs.id, { onDelete: "cascade" }),
    monitorSnapshotId: bigint("monitor_snapshot_id", {
      mode: "number",
    }).notNull(),
    sourceUrl: text("source_url").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    normalizedContent: text("normalized_content").notNull(),
    contentLength: integer("content_length").notNull(),
    articleCount: integer("article_count").notNull(),
    parserVersion: text("parser_version").notNull(),
    status: text("status").notNull().default("pending_review"),
    initiatedByUserId: bigint("initiated_by_user_id", {
      mode: "number",
    }).references(() => users.id, { onDelete: "set null" }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, { onDelete: "set null" }),
    reviewNotes: text("review_notes"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_text_snapshots_act_checksum_uidx").on(
      table.legalActId,
      table.checksumSha256,
    ),
    foreignKey({
      columns: [table.monitorSnapshotId, table.legalActId],
      foreignColumns: [
        legalSourceSnapshots.id,
        legalSourceSnapshots.legalActId,
      ],
      name: "legal_text_snapshots_monitor_act_fk",
    }).onDelete("restrict"),
    index("legal_text_snapshots_act_status_idx").on(
      table.legalActId,
      table.status,
      table.fetchedAt,
    ),
    index("legal_text_snapshots_monitor_idx").on(table.monitorSnapshotId),
    index("legal_text_snapshots_initiated_by_idx").on(table.initiatedByUserId),
    index("legal_text_snapshots_reviewed_by_idx").on(table.reviewedByUserId),
    check(
      "legal_text_snapshots_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "legal_text_snapshots_url_check",
      sql`${table.sourceUrl} ~ '^https://legis\\.senado\\.leg\\.br/norma/[0-9]+/publicacao/[0-9]+$'`,
    ),
    check(
      "legal_text_snapshots_checksum_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "legal_text_snapshots_content_check",
      sql`${table.contentLength} between 1000 and 5000000 and char_length(${table.normalizedContent}) = ${table.contentLength}`,
    ),
    check(
      "legal_text_snapshots_article_count_check",
      sql`${table.articleCount} between 1 and 5000`,
    ),
    check(
      "legal_text_snapshots_status_check",
      sql`${table.status} in ('pending_review', 'approved', 'superseded', 'rejected')`,
    ),
    check(
      "legal_text_snapshots_review_check",
      sql`${table.status} <> 'approved' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "legal_text_snapshots_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 1500`,
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_versions_act_checksum_uidx").on(
      table.legalActId,
      table.checksumSha256,
    ),
    index("legal_versions_act_id_idx").on(table.legalActId),
    check(
      "legal_versions_status_check",
      sql`${table.status} in ('draft', 'current', 'superseded', 'revoked', 'pending_review')`,
    ),
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
    editorialStatus: text("editorial_status").notNull().default("draft"),
    sourceRights: text("source_rights").notNull().default("official_text"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_articles_version_path_uidx").on(
      table.legalVersionId,
      table.path,
    ),
    index("legal_articles_version_order_idx").on(
      table.legalVersionId,
      table.articleOrder,
    ),
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

export const contestCategories = pgTable(
  "contest_categories",
  {
    id: idColumn(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("contest_categories_active_sort_idx").on(
      table.isActive,
      table.sortOrder,
    ),
    check(
      "contest_categories_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const contestCategoryCareers = pgTable(
  "contest_category_careers",
  {
    categoryId: bigint("category_id", { mode: "number" })
      .notNull()
      .references(() => contestCategories.id, { onDelete: "cascade" }),
    careerTrackId: bigint("career_track_id", { mode: "number" })
      .notNull()
      .references(() => quizCareerTracks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.categoryId, table.careerTrackId],
      name: "contest_category_careers_pkey",
    }),
    index("contest_category_careers_career_idx").on(table.careerTrackId),
  ],
);

export const contestOpportunities = pgTable(
  "contest_opportunities",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    examEditionId: bigint("exam_edition_id", { mode: "number" }).references(
      () => examEditions.id,
      { onDelete: "restrict" },
    ),
    slug: text("slug").notNull().unique(),
    categoryId: bigint("category_id", { mode: "number" })
      .notNull()
      .references(() => contestCategories.id, { onDelete: "restrict" }),
    careerTrackId: bigint("career_track_id", { mode: "number" })
      .notNull()
      .references(() => quizCareerTracks.id, { onDelete: "restrict" }),
    specializationId: bigint("specialization_id", { mode: "number" }),
    jurisdictionCode: text("jurisdiction_code").notNull(),
    scope: text("scope").notNull(),
    cycleYear: integer("cycle_year").notNull(),
    institutionAcronym: text("institution_acronym").notNull(),
    institutionName: text("institution_name").notNull(),
    roleName: text("role_name").notNull(),
    officialNoticeNumber: text("official_notice_number"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull().default("authorized"),
    statusAsOf: date("status_as_of").notNull(),
    officialUrl: text("official_url"),
    announcedAt: date("announced_at"),
    noticePublishedAt: date("notice_published_at"),
    registrationStartsAt: date("registration_starts_at"),
    registrationEndsAt: date("registration_ends_at"),
    examDate: date("exam_date"),
    sourceCheckedAt: timestamp("source_checked_at", { withTimezone: true }),
    editorialStatus: text("editorial_status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: bigint("updated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    isFeatured: boolean("is_featured").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId, table.careerTrackId],
      foreignColumns: [
        contestCategoryCareers.categoryId,
        contestCategoryCareers.careerTrackId,
      ],
      name: "contest_opportunities_category_career_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.specializationId, table.careerTrackId],
      foreignColumns: [
        quizCareerSpecializations.id,
        quizCareerSpecializations.careerTrackId,
      ],
      name: "contest_opportunities_specialization_career_fk",
    }).onDelete("restrict"),
    uniqueIndex("contest_opportunities_exam_edition_uidx")
      .on(table.examEditionId)
      .where(sql`${table.examEditionId} is not null`),
    uniqueIndex("contest_opportunities_identity_uidx")
      .on(
        table.institutionAcronym,
        table.officialNoticeNumber,
        table.cycleYear,
        table.roleName,
      )
      .where(sql`${table.officialNoticeNumber} is not null`),
    uniqueIndex("contest_opportunities_pre_notice_identity_uidx")
      .on(
        table.institutionAcronym,
        table.cycleYear,
        table.roleName,
        table.jurisdictionCode,
      )
      .where(sql`${table.officialNoticeNumber} is null`),
    index("contest_opportunities_public_catalog_idx").on(
      table.editorialStatus,
      table.lifecycleStatus,
      table.statusAsOf,
      table.id,
    ),
    index("contest_opportunities_category_jurisdiction_idx").on(
      table.categoryId,
      table.jurisdictionCode,
      table.lifecycleStatus,
    ),
    index("contest_opportunities_career_idx").on(
      table.careerTrackId,
      table.cycleYear,
    ),
    index("contest_opportunities_specialization_idx").on(
      table.specializationId,
    ),
    index("contest_opportunities_created_by_idx").on(table.createdByUserId),
    index("contest_opportunities_updated_by_idx").on(table.updatedByUserId),
    index("contest_opportunities_reviewed_by_idx").on(table.reviewedByUserId),
    check(
      "contest_opportunities_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "contest_opportunities_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "contest_opportunities_jurisdiction_check",
      sql`${table.jurisdictionCode} ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|BR)$'`,
    ),
    check(
      "contest_opportunities_scope_check",
      sql`${table.scope} in ('national', 'federal', 'state', 'regional', 'municipal')`,
    ),
    check(
      "contest_opportunities_year_check",
      sql`${table.cycleYear} between 2000 and 2200`,
    ),
    check(
      "contest_opportunities_lifecycle_check",
      sql`${table.lifecycleStatus} in ('authorized', 'commission_formed', 'organizer_selected', 'pre_notice', 'notice_published', 'registration_open', 'registration_closed', 'exam_scheduled', 'exam_held', 'result_published', 'homologated', 'closed', 'suspended', 'canceled')`,
    ),
    check(
      "contest_opportunities_editorial_check",
      sql`${table.editorialStatus} in ('draft', 'pending_review', 'reviewed', 'suspended')`,
    ),
    check(
      "contest_opportunities_url_check",
      sql`${table.officialUrl} is null or ${table.officialUrl} ~* '^https://[a-z0-9.-]+(?:/|$)'`,
    ),
    check(
      "contest_opportunities_registration_range_check",
      sql`${table.registrationEndsAt} is null or ${table.registrationStartsAt} is null or ${table.registrationEndsAt} >= ${table.registrationStartsAt}`,
    ),
    check(
      "contest_opportunities_notice_date_check",
      sql`${table.lifecycleStatus} not in ('notice_published', 'registration_open', 'registration_closed', 'exam_scheduled', 'exam_held', 'result_published', 'homologated', 'closed') or ${table.noticePublishedAt} is not null`,
    ),
    check(
      "contest_opportunities_review_check",
      sql`${table.editorialStatus} <> 'reviewed' or (
        ${table.officialUrl} is not null
        and ${table.sourceCheckedAt} is not null
        and ${table.reviewedByUserId} is not null
        and ${table.reviewedAt} is not null
        and ${table.reviewedAt} >= ${table.sourceCheckedAt}
        and ${table.publishedAt} is not null
      )`,
    ),
    check(
      "contest_opportunities_independent_review_check",
      sql`${table.editorialStatus} <> 'reviewed'
        or ${table.createdByUserId} is null
        or ${table.reviewedByUserId} <> ${table.createdByUserId}`,
    ),
    check(
      "contest_opportunities_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 2000`,
    ),
  ],
);

export const opportunitySourceDocuments = pgTable(
  "opportunity_source_documents",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    sourceExternalId: text("source_external_id"),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceHost: text("source_host").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    checksumSha256: text("checksum_sha256"),
    httpStatus: integer("http_status").notNull(),
    contentType: text("content_type"),
    sourcePolicy: text("source_policy").notNull().default("metadata_only"),
    sourceContentStored: boolean("source_content_stored")
      .notNull()
      .default(false),
    supersedesPublicId: text("supersedes_public_id"),
    status: text("status").notNull().default("pending_review"),
    initiatedByUserId: bigint("initiated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("opportunity_source_documents_opportunity_url_uidx").on(
      table.opportunityId,
      table.sourceUrl,
    ),
    uniqueIndex("opportunity_source_documents_external_uidx")
      .on(table.opportunityId, table.sourceExternalId)
      .where(sql`${table.sourceExternalId} is not null`),
    index("opportunity_source_documents_status_idx").on(
      table.opportunityId,
      table.status,
      table.observedAt,
    ),
    index("opportunity_source_documents_reviewed_by_idx").on(
      table.reviewedByUserId,
    ),
    check(
      "opportunity_source_documents_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "opportunity_source_documents_type_check",
      sql`${table.documentType} in ('authorization', 'commission_act', 'procurement_notice', 'organizer_contract', 'official_announcement', 'notice', 'correction', 'suspension', 'cancellation', 'result', 'homologation', 'other')`,
    ),
    check(
      "opportunity_source_documents_url_check",
      sql`${table.sourceUrl} ~* '^https://[a-z0-9.-]+(?:/|$)'`,
    ),
    check(
      "opportunity_source_documents_host_check",
      sql`${table.sourceHost} = lower(${table.sourceHost})
        and ${table.sourceHost} ~ '^[a-z0-9.-]+$'
        and ${table.sourceHost} = lower(substring(${table.sourceUrl} from '^https://([^/:?#]+)'))`,
    ),
    check(
      "opportunity_source_documents_checksum_check",
      sql`${table.checksumSha256} is null or ${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "opportunity_source_documents_http_check",
      sql`${table.httpStatus} between 100 and 599`,
    ),
    check(
      "opportunity_source_documents_policy_check",
      sql`${table.sourcePolicy} in ('metadata_only', 'official_document', 'licensed_content')`,
    ),
    check(
      "opportunity_source_documents_metadata_only_check",
      sql`${table.sourcePolicy} <> 'metadata_only' or not ${table.sourceContentStored}`,
    ),
    check(
      "opportunity_source_documents_status_check",
      sql`${table.status} in ('pending_review', 'approved', 'superseded', 'rejected')`,
    ),
    check(
      "opportunity_source_documents_review_check",
      sql`${table.status} <> 'approved' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "opportunity_source_documents_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 2000`,
    ),
  ],
);

export const opportunityDocumentSnapshots = pgTable(
  "opportunity_document_snapshots",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    sourceDocumentId: bigint("source_document_id", { mode: "number" })
      .notNull()
      .references(() => opportunitySourceDocuments.id, {
        onDelete: "restrict",
      }),
    documentUrl: text("document_url").notNull(),
    sourceHost: text("source_host").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    documentBytes: bytea("document_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    byteLength: integer("byte_length").notNull(),
    pageCount: integer("page_count").notNull(),
    extractedText: text("extracted_text").notNull(),
    pageTexts: jsonb("page_texts").$type<string[]>().notNull(),
    textLength: integer("text_length").notNull(),
    extractionMethod: text("extraction_method").notNull().default("pdfjs"),
    parserVersion: text("parser_version").notNull(),
    sourcePolicy: text("source_policy").notNull().default("official_document"),
    authorizationScope: text("authorization_scope").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),
    authorizedByUserId: bigint("authorized_by_user_id", {
      mode: "number",
    }).references(() => users.id, { onDelete: "set null" }),
    initiatedByUserId: bigint("initiated_by_user_id", {
      mode: "number",
    }).references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending_review"),
    approvalBasis: text("approval_basis")
      .notNull()
      .default("independent_review"),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("opportunity_document_snapshots_source_checksum_uidx").on(
      table.sourceDocumentId,
      table.checksumSha256,
    ),
    index("opportunity_document_snapshots_source_status_idx").on(
      table.sourceDocumentId,
      table.status,
      table.createdAt,
    ),
    index("opportunity_document_snapshots_initiated_by_idx").on(
      table.initiatedByUserId,
    ),
    index("opportunity_document_snapshots_reviewed_by_idx").on(
      table.reviewedByUserId,
    ),
    check(
      "opportunity_document_snapshots_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "opportunity_document_snapshots_url_check",
      sql`${table.documentUrl} ~* '^https://[a-z0-9.-]+(?:/|$)'`,
    ),
    check(
      "opportunity_document_snapshots_host_check",
      sql`${table.sourceHost} = lower(${table.sourceHost})
        and ${table.sourceHost} ~ '^[a-z0-9.-]+$'
        and ${table.sourceHost} = lower(substring(${table.documentUrl} from '^https://([^/:?#]+)'))`,
    ),
    check(
      "opportunity_document_snapshots_checksum_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "opportunity_document_snapshots_size_check",
      sql`${table.byteLength} between 5 and 15728640 and octet_length(${table.documentBytes}) = ${table.byteLength}`,
    ),
    check(
      "opportunity_document_snapshots_pages_check",
      sql`${table.pageCount} between 1 and 250`,
    ),
    check(
      "opportunity_document_snapshots_text_check",
      sql`${table.textLength} between 100 and 2000000 and char_length(${table.extractedText}) = ${table.textLength}`,
    ),
    check(
      "opportunity_document_snapshots_policy_check",
      sql`${table.sourcePolicy} = 'official_document'`,
    ),
    check(
      "opportunity_document_snapshots_authorization_check",
      sql`${table.authorizationScope} = 'owner-approval-2026-09-01'`,
    ),
    check(
      "opportunity_document_snapshots_status_check",
      sql`${table.status} in ('pending_review', 'approved', 'superseded', 'rejected')`,
    ),
    check(
      "opportunity_document_snapshots_approval_basis_check",
      sql`${table.approvalBasis} in ('independent_review', 'owner_override')`,
    ),
    check(
      "opportunity_document_snapshots_review_check",
      sql`${table.status} <> 'approved' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "opportunity_document_snapshots_independent_review_check",
      sql`${table.status} <> 'approved'
        or ${table.initiatedByUserId} is null
        or ${table.reviewedByUserId} <> ${table.initiatedByUserId}
        or (${table.approvalBasis} = 'owner_override'
          and ${table.authorizationScope} = 'owner-approval-2026-09-01'
          and ${table.authorizedByUserId} is not null
          and ${table.authorizedByUserId} = ${table.reviewedByUserId})`,
    ),
    check(
      "opportunity_document_snapshots_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 2000`,
    ),
  ],
);

export const opportunityOrganizerAssignments = pgTable(
  "opportunity_organizer_assignments",
  {
    id: idColumn(),
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "cascade" }),
    quizBankId: bigint("quiz_bank_id", { mode: "number" }).references(
      () => quizBanks.id,
      {
        onDelete: "restrict",
      },
    ),
    sourceDocumentId: bigint("source_document_id", { mode: "number" })
      .notNull()
      .references(() => opportunitySourceDocuments.id, {
        onDelete: "restrict",
      }),
    responsibleType: text("responsible_type").notNull(),
    role: text("role").notNull().default("primary_responsible"),
    organizerSlug: text("organizer_slug").notNull(),
    organizerName: text("organizer_name").notNull(),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    status: text("status").notNull().default("pending_review"),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("opportunity_organizer_assignments_primary_active_uidx")
      .on(table.opportunityId)
      .where(
        sql`${table.role} = 'primary_responsible' and ${table.status} = 'reviewed' and ${table.validUntil} is null`,
      ),
    uniqueIndex("opportunity_organizer_assignments_exam_provider_active_uidx")
      .on(table.opportunityId)
      .where(
        sql`${table.role} = 'examination_provider' and ${table.status} = 'reviewed' and ${table.validUntil} is null`,
      ),
    index("opportunity_organizer_assignments_bank_idx").on(table.quizBankId),
    index("opportunity_organizer_assignments_source_idx").on(
      table.sourceDocumentId,
    ),
    index("opportunity_organizer_assignments_reviewed_by_idx").on(
      table.reviewedByUserId,
    ),
    check(
      "opportunity_organizer_assignments_type_check",
      sql`${table.responsibleType} in ('external_organizer', 'institutional_commission', 'hybrid')`,
    ),
    check(
      "opportunity_organizer_assignments_role_check",
      sql`${table.role} in ('primary_responsible', 'examination_provider', 'logistics_provider')`,
    ),
    check(
      "opportunity_organizer_assignments_slug_check",
      sql`${table.organizerSlug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "opportunity_organizer_assignments_bank_check",
      sql`(${table.responsibleType} <> 'institutional_commission' or ${table.quizBankId} is null)
        and (${table.role} <> 'logistics_provider' or ${table.quizBankId} is null)`,
    ),
    check(
      "opportunity_organizer_assignments_date_check",
      sql`${table.validUntil} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
    check(
      "opportunity_organizer_assignments_status_check",
      sql`${table.status} in ('pending_review', 'reviewed', 'superseded', 'rejected')`,
    ),
    check(
      "opportunity_organizer_assignments_review_check",
      sql`${table.status} <> 'reviewed' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "opportunity_organizer_assignments_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 2000`,
    ),
  ],
);

export const opportunityRequirements = pgTable(
  "opportunity_requirements",
  {
    id: idColumn(),
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "cascade" }),
    sourceDocumentId: bigint("source_document_id", { mode: "number" })
      .notNull()
      .references(() => opportunitySourceDocuments.id, {
        onDelete: "restrict",
      }),
    sourceSnapshotId: bigint("source_snapshot_id", {
      mode: "number",
    }).references(() => opportunityDocumentSnapshots.id, {
      onDelete: "restrict",
    }),
    subjectId: bigint("subject_id", { mode: "number" }).references(
      () => quizSubjects.id,
      {
        onDelete: "restrict",
      },
    ),
    topicId: bigint("topic_id", { mode: "number" }).references(
      () => quizTopics.id,
      {
        onDelete: "restrict",
      },
    ),
    legalActId: bigint("legal_act_id", { mode: "number" }).references(
      () => legalActs.id,
      {
        onDelete: "restrict",
      },
    ),
    legalArticleId: bigint("legal_article_id", { mode: "number" }).references(
      () => legalArticles.id,
      {
        onDelete: "restrict",
      },
    ),
    requirementText: text("requirement_text").notNull(),
    sourceLocator: text("source_locator").notNull(),
    editorialStatus: text("editorial_status").notNull().default("draft"),
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("opportunity_requirements_source_text_uidx").on(
      table.sourceDocumentId,
      table.requirementText,
    ),
    index("opportunity_requirements_opportunity_status_idx").on(
      table.opportunityId,
      table.editorialStatus,
      table.subjectId,
    ),
    index("opportunity_requirements_source_idx").on(table.sourceDocumentId),
    index("opportunity_requirements_snapshot_idx").on(table.sourceSnapshotId),
    index("opportunity_requirements_topic_idx").on(table.topicId),
    index("opportunity_requirements_legal_act_idx").on(table.legalActId),
    index("opportunity_requirements_legal_article_idx").on(
      table.legalArticleId,
    ),
    index("opportunity_requirements_created_by_idx").on(table.createdByUserId),
    index("opportunity_requirements_reviewed_by_idx").on(
      table.reviewedByUserId,
    ),
    check(
      "opportunity_requirements_status_check",
      sql`${table.editorialStatus} in ('draft', 'pending_review', 'reviewed', 'suspended')`,
    ),
    check(
      "opportunity_requirements_topic_subject_check",
      sql`${table.topicId} is null or ${table.subjectId} is not null`,
    ),
    check(
      "opportunity_requirements_article_act_check",
      sql`${table.legalArticleId} is null or ${table.legalActId} is not null`,
    ),
    check(
      "opportunity_requirements_review_check",
      sql`${table.editorialStatus} <> 'reviewed' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "opportunity_requirements_review_notes_check",
      sql`${table.reviewNotes} is null or char_length(${table.reviewNotes}) <= 1500`,
    ),
  ],
);

export const opportunityAnalysisSnapshots = pgTable(
  "opportunity_analysis_snapshots",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "cascade" }),
    organizerAssignmentId: bigint("organizer_assignment_id", { mode: "number" })
      .notNull()
      .references(() => opportunityOrganizerAssignments.id, {
        onDelete: "restrict",
      }),
    analysisKind: text("analysis_kind").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    lookbackYears: smallint("lookback_years").notNull().default(10),
    windowStartYear: integer("window_start_year").notNull(),
    windowEndYear: integer("window_end_year").notNull(),
    sampleSize: integer("sample_size").notNull().default(0),
    corpusBasis: text("corpus_basis").notNull(),
    corpusRightsReference: text("corpus_rights_reference"),
    methodology: text("methodology").notNull(),
    scores: jsonb("scores")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    confidenceBps: integer("confidence_bps").notNull().default(0),
    limitations: text("limitations").notNull(),
    status: text("status").notNull().default("draft"),
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("opportunity_analysis_snapshots_catalog_idx").on(
      table.opportunityId,
      table.status,
      table.updatedAt,
    ),
    index("opportunity_analysis_snapshots_assignment_idx").on(
      table.organizerAssignmentId,
    ),
    index("opportunity_analysis_snapshots_created_by_idx").on(
      table.createdByUserId,
    ),
    index("opportunity_analysis_snapshots_reviewed_by_idx").on(
      table.reviewedByUserId,
    ),
    check(
      "opportunity_analysis_snapshots_public_id_check",
      sql`${table.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      "opportunity_analysis_snapshots_kind_check",
      sql`${table.analysisKind} in ('syllabus_frequency', 'question_incidence', 'legal_change_risk')`,
    ),
    check(
      "opportunity_analysis_snapshots_lookback_check",
      sql`${table.lookbackYears} between 1 and 10`,
    ),
    check(
      "opportunity_analysis_snapshots_window_check",
      sql`${table.windowStartYear} between 2000 and 2200
        and ${table.windowEndYear} between ${table.windowStartYear} and 2200
        and ${table.windowEndYear} - ${table.windowStartYear} + 1 = ${table.lookbackYears}`,
    ),
    check(
      "opportunity_analysis_snapshots_sample_check",
      sql`${table.sampleSize} >= 0`,
    ),
    check(
      "opportunity_analysis_snapshots_corpus_check",
      sql`${table.corpusBasis} in ('official_syllabi', 'licensed_questions', 'mixed_authorized')`,
    ),
    check(
      "opportunity_analysis_snapshots_question_rights_check",
      sql`${table.analysisKind} <> 'question_incidence' or ${table.corpusBasis} in ('licensed_questions', 'mixed_authorized')`,
    ),
    check(
      "opportunity_analysis_snapshots_confidence_check",
      sql`${table.confidenceBps} between 0 and 10000`,
    ),
    check(
      "opportunity_analysis_snapshots_status_check",
      sql`${table.status} in ('draft', 'pending_review', 'reviewed', 'suspended')`,
    ),
    check(
      "opportunity_analysis_snapshots_review_check",
      sql`${table.status} <> 'reviewed' or (
        ${table.sampleSize} > 0
        and nullif(btrim(${table.corpusRightsReference}), '') is not null
        and ${table.reviewedByUserId} is not null
        and ${table.reviewedAt} is not null
      )`,
    ),
    check(
      "opportunity_analysis_snapshots_independent_review_check",
      sql`${table.status} <> 'reviewed'
        or ${table.createdByUserId} is null
        or ${table.reviewedByUserId} <> ${table.createdByUserId}`,
    ),
  ],
);

export const contestOpportunityPlans = pgTable(
  "contest_opportunity_plans",
  {
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "cascade" }),
    planId: bigint("plan_id", { mode: "number" })
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    availability: text("availability").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.opportunityId, table.planId],
      name: "contest_opportunity_plans_pkey",
    }),
    index("contest_opportunity_plans_plan_idx").on(table.planId),
    check(
      "contest_opportunity_plans_availability_check",
      sql`${table.availability} in ('planned', 'active', 'retired')`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: idColumn(),
    publicId: text("public_id").notNull().unique(),
    legalArticleId: bigint("legal_article_id", { mode: "number" }).references(
      () => legalArticles.id,
      {
        onDelete: "restrict",
      },
    ),
    subjectId: bigint("subject_id", { mode: "number" }).references(
      () => quizSubjects.id,
      {
        onDelete: "restrict",
      },
    ),
    topicId: bigint("topic_id", { mode: "number" }).references(
      () => quizTopics.id,
      {
        onDelete: "restrict",
      },
    ),
    quizMode: text("quiz_mode").notNull().default("dry_law"),
    styleBankId: bigint("style_bank_id", { mode: "number" }).references(
      () => quizBanks.id,
      {
        onDelete: "restrict",
      },
    ),
    examEditionId: bigint("exam_edition_id", { mode: "number" }).references(
      () => examEditions.id,
      {
        onDelete: "restrict",
      },
    ),
    type: text("type").notNull(),
    prompt: text("prompt").notNull(),
    explanation: text("explanation").notNull(),
    learningObjective: text("learning_objective"),
    topic: text("topic").notNull(),
    difficulty: smallint("difficulty").notNull().default(2),
    mutationKind: text("mutation_kind"),
    examBoardStyle: text("exam_board_style"),
    editorialStatus: text("editorial_status").notNull().default("draft"),
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
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    cleanRoomAttestedAt: timestamp("clean_room_attested_at", {
      withTimezone: true,
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    similarityMaxBps: integer("similarity_max_bps").notNull().default(0),
    similarityReferencePublicId: text("similarity_reference_public_id"),
    originalityCheckedAt: timestamp("originality_checked_at", {
      withTimezone: true,
    }),
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
      .where(
        sql`${table.examEditionId} is not null and ${table.originalQuestionOrder} is not null`,
      ),
    check(
      "questions_difficulty_check",
      sql`${table.difficulty} between 1 and 5`,
    ),
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
      sql`${table.authorshipMethod} in ('human', 'ai_assisted', 'rule_based')`,
    ),
    check(
      "questions_generator_metadata_check",
      sql`${table.authorshipMethod} = 'human' or (
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
      ) or (
        ${table.quizMode} = 'previous_exam'
        and ${table.subjectId} is not null
        and ${table.examEditionId} is not null
        and ${table.styleBankId} is null
        and ${table.sourceRights} = 'licensed'
      )`,
    ),
    check(
      "questions_original_responsibility_check",
      sql`${table.quizMode} <> 'original_style'
        or ${table.editorialStatus} = 'draft'
        or (
          ${table.createdByUserId} is not null
          and ${table.cleanRoomAttestedAt} is not null
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
      sql`${table.editorialStatus} <> 'reviewed' or ${table.reviewedByUserId} is not null`,
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
    check(
      "questions_similarity_score_check",
      sql`${table.similarityMaxBps} between 0 and 10000`,
    ),
    check(
      "questions_originality_check",
      sql`${table.quizMode} <> 'original_style' or ${table.originalityCheckedAt} is not null`,
    ),
  ],
);

export const editorialAutomationJobs = pgTable(
  "editorial_automation_jobs",
  {
    jobKey: text("job_key").primaryKey(),
    kind: text("kind").notNull(),
    subjectId: bigint("subject_id", { mode: "number" }).notNull(),
    inputHash: text("input_hash").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("editorial_jobs_due_idx").on(
      table.kind,
      table.status,
      table.nextAttemptAt,
    ),
    check(
      "editorial_jobs_kind_check",
      sql`${table.kind} in ('draft_generation', 'source_capture')`,
    ),
    check(
      "editorial_jobs_hash_check",
      sql`${table.inputHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "editorial_jobs_status_check",
      sql`${table.status} in ('pending', 'running', 'retry', 'succeeded', 'blocked', 'failed')`,
    ),
    check(
      "editorial_jobs_attempts_check",
      sql`${table.attempts} between 0 and 5`,
    ),
    check("editorial_jobs_subject_check", sql`${table.subjectId} > 0`),
    check(
      "editorial_jobs_lease_check",
      sql`
      (${table.status} = 'running' and ${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null)
      or (${table.status} <> 'running' and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null)
    `,
    ),
  ],
);

export const questionOpportunities = pgTable(
  "question_opportunities",
  {
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    opportunityId: bigint("opportunity_id", { mode: "number" })
      .notNull()
      .references(() => contestOpportunities.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
    analysisSnapshotId: bigint("analysis_snapshot_id", {
      mode: "number",
    }).references(() => opportunityAnalysisSnapshots.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.questionId, table.opportunityId],
      name: "question_opportunities_pkey",
    }),
    index("question_opportunities_opportunity_idx").on(table.opportunityId),
    index("question_opportunities_analysis_idx").on(table.analysisSnapshotId),
    check(
      "question_opportunities_relationship_check",
      sql`${table.relationship} in ('direct_requirement', 'statistical_priority', 'legal_change')`,
    ),
    check(
      "question_opportunities_statistical_snapshot_check",
      sql`${table.relationship} <> 'statistical_priority' or ${table.analysisSnapshotId} is not null`,
    ),
  ],
);

// Curadoria comercial por produto: propostas nunca concedem acesso por si sós.
// Não substitui a revisão da questão nem transforma afinidade em cobertura de edital.
export const contestProductQuestionBindings = pgTable(
  "contest_product_question_bindings",
  {
    id: text("id").primaryKey(),
    productSlug: text("product_slug").notNull().references(() => contestStoreProducts.slug, { onDelete: "restrict" }),
    opportunityId: bigint("opportunity_id", { mode: "number" }).notNull().references(() => contestOpportunities.id, { onDelete: "restrict" }),
    requirementId: bigint("requirement_id", { mode: "number" }).notNull().references(() => opportunityRequirements.id, { onDelete: "restrict" }),
    questionId: bigint("question_id", { mode: "number" }).notNull().references(() => questions.id, { onDelete: "restrict" }),
    sourceDocumentId: bigint("source_document_id", { mode: "number" }).notNull().references(() => opportunitySourceDocuments.id, { onDelete: "restrict" }),
    sourceSnapshotId: bigint("source_snapshot_id", { mode: "number" }).references(() => opportunityDocumentSnapshots.id, { onDelete: "restrict" }),
    sourceSnapshotChecksum: text("source_snapshot_checksum"),
    legalArticleId: bigint("legal_article_id", { mode: "number" }).notNull().references(() => legalArticles.id, { onDelete: "restrict" }),
    legalVersionId: bigint("legal_version_id", { mode: "number" }).notNull().references(() => legalVersions.id, { onDelete: "restrict" }),
    legalVersionChecksum: text("legal_version_checksum").notNull(),
    questionUpdatedAt: timestamp("question_updated_at", { withTimezone: true }).notNull(),
    requirementText: text("requirement_text").notNull(),
    sourceLocator: text("source_locator").notNull(),
    requirementQuote: text("requirement_quote").notNull(),
    legalQuote: text("legal_quote").notNull(),
    scopeNotes: text("scope_notes").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending_review"),
    proposedByUserId: bigint("proposed_by_user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "restrict" }),
    reviewedByUserId: bigint("reviewed_by_user_id", { mode: "number" }).references(() => users.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    ...timestamps,
  },
  (table) => [
    index("contest_product_bindings_access_idx").on(table.productSlug, table.status, table.questionId),
    index("contest_product_bindings_requirement_idx").on(table.requirementId),
    check("contest_product_bindings_hash_check", sql`${table.id} ~ '^[a-f0-9]{64}$' and ${table.legalVersionChecksum} ~ '^[a-f0-9]{64}$'`),
    check("contest_product_bindings_status_check", sql`${table.status} in ('pending_review','approved','rejected','suspended')`),
    check("contest_product_bindings_snapshot_check", sql`(${table.sourceSnapshotId} is null and ${table.sourceSnapshotChecksum} is null) or (${table.sourceSnapshotId} is not null and ${table.sourceSnapshotChecksum} is not null and ${table.sourceSnapshotChecksum} ~ '^[a-f0-9]{64}$')`),
    check("contest_product_bindings_evidence_check", sql`jsonb_typeof(${table.evidence}) = 'object' and char_length(${table.requirementQuote}) between 10 and 20000 and char_length(${table.legalQuote}) between 15 and 12000 and char_length(${table.scopeNotes}) between 30 and 2000`),
    check("contest_product_bindings_review_check", sql`(${table.status} = 'pending_review' and ${table.reviewedByUserId} is null and ${table.reviewedAt} is null and ${table.reviewNotes} is null) or (${table.status} <> 'pending_review' and ${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null and ${table.reviewNotes} is not null and char_length(btrim(${table.reviewNotes})) between 20 and 2000)`),
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
    uniqueIndex("question_options_question_key_uidx").on(
      table.questionId,
      table.optionKey,
    ),
    uniqueIndex("question_options_question_order_uidx").on(
      table.questionId,
      table.sortOrder,
    ),
    uniqueIndex("question_options_id_question_uidx").on(
      table.id,
      table.questionId,
    ),
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
    specializationId: bigint("specialization_id", {
      mode: "number",
    }).references(() => quizCareerSpecializations.id, { onDelete: "restrict" }),
    bankId: bigint("bank_id", { mode: "number" }).references(
      () => quizBanks.id,
      {
        onDelete: "restrict",
      },
    ),
    subjectId: bigint("subject_id", { mode: "number" }).references(
      () => quizSubjects.id,
      {
        onDelete: "restrict",
      },
    ),
    topicId: bigint("topic_id", { mode: "number" }).references(
      () => quizTopics.id,
      {
        onDelete: "restrict",
      },
    ),
    mode: text("mode").notNull(),
    experience: text("experience").notNull().default("training"),
    timed: boolean("timed").notNull().default(false),
    examScope: text("exam_scope").notNull().default("latest"),
    examEditionId: bigint("exam_edition_id", { mode: "number" }).references(
      () => examEditions.id,
      {
        onDelete: "restrict",
      },
    ),
    requestedCount: smallint("requested_count").notNull(),
    questionCount: smallint("question_count").notNull().default(0),
    status: text("status").notNull().default("created"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    check(
      "quiz_sessions_topic_check",
      sql`${table.topicId} is null or ${table.subjectId} is not null`,
    ),
    check(
      "quiz_sessions_mode_check",
      sql`${table.mode} in ('dry_law', 'previous_exam', 'original_style')`,
    ),
    check(
      "quiz_sessions_experience_check",
      sql`${table.experience} in ('training', 'exam')`,
    ),
    check(
      "quiz_sessions_exam_scope_check",
      sql`${table.examScope} in ('latest', 'all')`,
    ),
    check(
      "quiz_sessions_exam_edition_check",
      sql`${table.examEditionId} is null or (
        ${table.examScope} = 'latest'
        and (
          ${table.path} = 'career'
          or (${table.path} = 'bank' and ${table.mode} = 'previous_exam')
        )
      )`,
    ),
    check(
      "quiz_sessions_count_check",
      sql`${table.requestedCount} between 1 and 50 and ${table.questionCount} between 0 and ${table.requestedCount}`,
    ),
    check(
      "quiz_sessions_status_check",
      sql`${table.status} in ('created', 'in_progress', 'completed', 'expired')`,
    ),
    check(
      "quiz_sessions_expiry_check",
      sql`${table.expiresAt} > ${table.startedAt}`,
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.sessionId, table.questionId],
      name: "quiz_session_questions_pkey",
    }),
    uniqueIndex("quiz_session_questions_session_position_uidx").on(
      table.sessionId,
      table.position,
    ),
    index("quiz_session_questions_question_id_idx").on(table.questionId),
    check("quiz_session_questions_position_check", sql`${table.position} >= 1`),
  ],
);

export const quizSessionAnswers = pgTable(
  "quiz_session_answers",
  {
    sessionId: text("session_id").notNull(),
    questionId: bigint("question_id", { mode: "number" }).notNull(),
    selectedOptionId: bigint("selected_option_id", {
      mode: "number",
    }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    durationMs: integer("duration_ms"),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.sessionId, table.questionId],
      name: "quiz_session_answers_pkey",
    }),
    foreignKey({
      columns: [table.sessionId, table.questionId],
      foreignColumns: [
        quizSessionQuestions.sessionId,
        quizSessionQuestions.questionId,
      ],
      name: "quiz_session_answers_session_question_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.selectedOptionId, table.questionId],
      foreignColumns: [questionOptions.id, questionOptions.questionId],
      name: "quiz_session_answers_option_question_fk",
    }).onDelete("restrict"),
    index("quiz_session_answers_question_id_idx").on(table.questionId),
    index("quiz_session_answers_selected_option_id_idx").on(
      table.selectedOptionId,
    ),
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
    selectedOptionId: bigint("selected_option_id", {
      mode: "number",
    }).references(() => questionOptions.id, {
      onDelete: "restrict",
    }),
    isCorrect: boolean("is_correct").notNull(),
    confidence: smallint("confidence"),
    durationMs: integer("duration_ms"),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_attempts_quiz_session_question_uidx").on(
      table.quizSessionId,
      table.questionId,
    ),
    index("user_attempts_user_answered_idx").on(table.userId, table.answeredAt),
    index("user_attempts_question_id_idx").on(table.questionId),
    index("user_attempts_selected_option_id_idx").on(table.selectedOptionId),
    check(
      "user_attempts_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} between 1 and 3`,
    ),
    check(
      "user_attempts_duration_check",
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
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
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    lastResult: text("last_result"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.questionId],
      name: "review_queue_pkey",
    }),
    index("review_queue_user_due_idx").on(table.userId, table.nextReviewAt),
    index("review_queue_question_id_idx").on(table.questionId),
    check("review_queue_stage_check", sql`${table.stage} between 0 and 6`),
    check(
      "review_queue_counts_check",
      sql`${table.repetitions} >= 0 and ${table.lapses} >= 0`,
    ),
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
    uniqueIndex("saved_study_filters_user_name_uidx").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
    index("saved_study_filters_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("saved_study_filters_legal_act_id_idx").on(table.legalActId),
    check(
      "saved_study_filters_name_check",
      sql`char_length(btrim(${table.name})) between 1 and 80`,
    ),
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
    uniqueIndex("question_notebooks_user_name_uidx").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
    index("question_notebooks_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    check(
      "question_notebooks_name_check",
      sql`char_length(btrim(${table.name})) between 1 and 80`,
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.studyDate],
      name: "study_days_pkey",
    }),
    index("study_days_date_xp_idx").on(table.studyDate, table.xpEarned),
    check(
      "study_days_counts_check",
      sql`${table.answeredCount} >= 0 and ${table.correctCount} >= 0 and ${table.correctCount} <= ${table.answeredCount}`,
    ),
    check(
      "study_days_minutes_xp_check",
      sql`${table.minutesStudied} >= 0 and ${table.xpEarned} >= 0`,
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("checkout_attempts_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("checkout_attempts_plan_id_idx").on(table.planId),
    check(
      "checkout_attempts_status_check",
      sql`${table.status} in ('created', 'session_created', 'completed', 'expired', 'failed')`,
    ),
  ],
);

export const accountAccessTokens = pgTable(
  "account_access_tokens",
  {
    id: text("id").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkoutAttemptId: text("checkout_attempt_id").references(
      () => checkoutAttempts.id,
      {
        onDelete: "set null",
      },
    ),
    purpose: text("purpose").notNull(),
    deliveryStatus: text("delivery_status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("account_access_tokens_checkout_uidx")
      .on(table.checkoutAttemptId)
      .where(sql`${table.checkoutAttemptId} is not null`),
    index("account_access_tokens_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("account_access_tokens_expires_idx").on(table.expiresAt),
    check(
      "account_access_tokens_id_check",
      sql`${table.id} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "account_access_tokens_purpose_check",
      sql`${table.purpose} in ('purchase_access', 'password_reset')`,
    ),
    check(
      "account_access_tokens_delivery_check",
      sql`${table.deliveryStatus} in ('pending', 'sent', 'failed')`,
    ),
    check(
      "account_access_tokens_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "account_access_tokens_error_check",
      sql`${table.lastError} is null or char_length(${table.lastError}) <= 500`,
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
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("stripe_events_status_received_idx").on(
      table.status,
      table.receivedAt,
    ),
    index("stripe_events_type_idx").on(table.eventType),
    check(
      "stripe_events_status_check",
      sql`${table.status} in ('received', 'processing', 'processed', 'failed')`,
    ),
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
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: bigint("updated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
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
    check(
      "stripe_connect_partners_country_check",
      sql`${table.country} = upper(${table.country})`,
    ),
    check(
      "stripe_connect_partners_currency_check",
      sql`${table.currency} = lower(${table.currency})`,
    ),
    check(
      "stripe_connect_partners_account_id_check",
      sql`${table.stripeAccountId} is null or ${table.stripeAccountId} ~ '^acct_[A-Za-z0-9]+$'`,
    ),
    check(
      "stripe_connect_partners_account_type_check",
      sql`${table.accountType} = 'express'`,
    ),
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
    chargeModel: text("charge_model")
      .notNull()
      .default("separate_charges_and_transfers"),
    currency: text("currency").notNull().default("brl"),
    platformShareBps: integer("platform_share_bps").notNull().default(0),
    version: integer("version").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    createdByUserId: bigint("created_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: bigint("updated_by_user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("stripe_connect_split_rules_one_active_uidx")
      .on(table.status)
      .where(sql`${table.status} = 'active'`),
    index("stripe_connect_split_rules_created_by_idx").on(
      table.createdByUserId,
    ),
    index("stripe_connect_split_rules_updated_by_idx").on(
      table.updatedByUserId,
    ),
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
    check(
      "stripe_connect_split_rules_currency_check",
      sql`${table.currency} = lower(${table.currency})`,
    ),
    check(
      "stripe_connect_split_rules_platform_share_check",
      sql`${table.platformShareBps} between 0 and 10000`,
    ),
    check(
      "stripe_connect_split_rules_version_check",
      sql`${table.version} >= 1`,
    ),
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
    checkoutAttemptId: text("checkout_attempt_id").references(
      () => checkoutAttempts.id,
      {
        onDelete: "restrict",
      },
    ),
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
    index("stripe_connect_transfer_batches_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("stripe_connect_transfer_batches_rule_idx").on(table.ruleId),
    index("stripe_connect_transfer_batches_checkout_attempt_idx").on(
      table.checkoutAttemptId,
    ),
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
    check(
      "stripe_connect_transfer_batches_currency_check",
      sql`${table.currency} = lower(${table.currency})`,
    ),
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
    uniqueIndex("stripe_connect_transfers_batch_partner_uidx").on(
      table.batchId,
      table.partnerId,
    ),
    index("stripe_connect_transfers_rule_partner_idx").on(
      table.ruleId,
      table.partnerId,
    ),
    index("stripe_connect_transfers_partner_status_idx").on(
      table.partnerId,
      table.status,
    ),
    check(
      "stripe_connect_transfers_amount_check",
      sql`${table.amountCents} > 0`,
    ),
    check(
      "stripe_connect_transfers_reversed_amount_check",
      sql`${table.reversedAmountCents} between 0 and ${table.amountCents}`,
    ),
    check(
      "stripe_connect_transfers_currency_check",
      sql`${table.currency} = lower(${table.currency})`,
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("question_reports_question_id_idx").on(table.questionId),
    index("question_reports_user_id_idx").on(table.userId),
    index("question_reports_open_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'open'`),
    check(
      "question_reports_status_check",
      sql`${table.status} in ('open', 'reviewing', 'resolved', 'dismissed')`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn(),
    actorUserId: bigint("actor_user_id", { mode: "number" }).references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    userId: bigint("user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    ipHash: text("ip_hash"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("contact_messages_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("contact_messages_user_id_idx").on(table.userId),
    check(
      "contact_messages_status_check",
      sql`${table.status} in ('open', 'reviewing', 'resolved', 'spam')`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export { purchaseDeliveryOutbox, purchaseDeliveryEvents } from "./purchase-delivery-schema";
export type NewUser = typeof users.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type QuestionStyleProfile = typeof questionStyleProfiles.$inferSelect;
export type LegalSourceSnapshot = typeof legalSourceSnapshots.$inferSelect;
export type LegalTextSnapshot = typeof legalTextSnapshots.$inferSelect;
