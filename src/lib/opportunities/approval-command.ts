export type OpportunityApprovalCommand = Readonly<{
  approve: boolean;
}>;

export type OpportunityApprovalReviewerIdentity = Readonly<{
  email: string | null;
  provenance: "admin_emails_unique" | "database_admin_unique";
  executionSource: "server_cli";
  approvalReference: string;
}>;

type ApprovalEnvironment = Readonly<{
  ADMIN_EMAILS?: string;
  DATABASE_URL?: string;
  MIGRATION_DATABASE_URL?: string;
  OPPORTUNITY_APPROVAL_REFERENCE?: string;
}>;

const CONFIGURED_ADMIN_EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function parseOpportunityApprovalReviewerIdentity(
  environment: ApprovalEnvironment,
): OpportunityApprovalReviewerIdentity {
  const configured = environment.ADMIN_EMAILS?.trim();
  const entries = configured ? configured.split(",").map((entry) => entry.trim()) : [];

  if (entries.length > 1 || entries.some((entry) => !entry)) {
    throw new Error(
      "ADMIN_EMAILS deve estar vazio ou conter exatamente um administrador para esta revisão.",
    );
  }

  const email = entries[0]?.toLowerCase() ?? null;
  if (email && (email.length > 254 || !CONFIGURED_ADMIN_EMAIL_PATTERN.test(email))) {
    throw new Error("ADMIN_EMAILS contém um e-mail de administrador inválido.");
  }

  const approvalReference = environment.OPPORTUNITY_APPROVAL_REFERENCE?.trim();
  if (
    !approvalReference ||
    approvalReference.length > 160 ||
    !/^[a-z0-9][a-z0-9._:/-]*$/i.test(approvalReference)
  ) {
    throw new Error(
      "OPPORTUNITY_APPROVAL_REFERENCE deve identificar a autorização com 1 a 160 caracteres seguros.",
    );
  }

  return Object.freeze({
    email,
    provenance: email ? ("admin_emails_unique" as const) : ("database_admin_unique" as const),
    executionSource: "server_cli" as const,
    approvalReference,
  });
}

export function requireOpportunityApprovalDatabaseUrl(environment: ApprovalEnvironment) {
  const databaseUrl = environment.MIGRATION_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "Defina MIGRATION_DATABASE_URL; DATABASE_URL não é aceito pelo comando de aprovação.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL deve ser uma URL PostgreSQL válida.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.username ||
    !parsed.password ||
    !parsed.hostname ||
    parsed.pathname.length <= 1
  ) {
    throw new Error(
      "MIGRATION_DATABASE_URL deve informar protocolo PostgreSQL, credenciais, host e banco.",
    );
  }

  return databaseUrl;
}

export function parseOpportunityApprovalCommand(
  argv: readonly string[],
): OpportunityApprovalCommand {
  let approve = false;
  let separatorSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      if (separatorSeen || index !== 0) throw new Error("Separador -- em posição inválida.");
      separatorSeen = true;
      continue;
    }

    if (argument === "--approve") {
      if (approve) throw new Error("--approve foi informado mais de uma vez.");
      approve = true;
      continue;
    }

    throw new Error("Argumento desconhecido ou não permitido no comando de aprovação.");
  }

  return Object.freeze({ approve });
}

export function organizerSlugForApproval(
  input: Readonly<{
    institutionAcronym: string;
    organizationName: string;
    responsibleType: "external_organizer" | "institutional_commission" | "hybrid";
    role: "primary_responsible" | "examination_provider" | "logistics_provider";
    quizBankSlug: string | null;
  }>,
) {
  const source =
    input.quizBankSlug ??
    (input.responsibleType === "institutional_commission" &&
    input.role === "primary_responsible"
      ? input.institutionAcronym
      : input.organizationName);

  const slug = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Não foi possível derivar o slug do responsável ${input.organizationName}.`);
  }
  return slug;
}
