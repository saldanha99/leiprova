import "server-only";

const CLOUDFLARE_EMAIL_ENDPOINT = "https://api.cloudflare.com/client/v4/accounts";
const RETRYABLE_STATUSES = new Set([429, 500, 503]);

type TransactionalEmailConfig = {
  accountId: string;
  apiToken: string;
  from: string;
};

export type TransactionalEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type CloudflareEmailResponse = {
  success?: boolean;
  result?: {
    delivered?: string[];
    queued?: string[];
    permanent_bounces?: string[];
    message_id?: string;
  } | null;
  errors?: Array<{ code?: number; message?: string }>;
};

export class TransactionalEmailError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "TransactionalEmailError";
  }
}

function readEnv(name: string) {
  return process.env[name]?.trim() || null;
}

export function getTransactionalEmailConfig(): TransactionalEmailConfig | null {
  if (readEnv("TRANSACTIONAL_EMAIL_ENABLED")?.toLowerCase() !== "true") return null;

  const accountId = readEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = readEnv("CLOUDFLARE_EMAIL_API_TOKEN");
  const from = readEnv("TRANSACTIONAL_EMAIL_FROM");

  if (!accountId || !apiToken || !from) return null;
  return { accountId, apiToken, from };
}

function apiErrorCode(payload: CloudflareEmailResponse | null) {
  const code = payload?.errors?.[0]?.code;
  return code ? `cloudflare_${code}` : "cloudflare_request_failed";
}

export async function sendTransactionalEmail(
  message: TransactionalEmailMessage,
): Promise<{ messageId: string | null; status: "delivered" | "queued" }> {
  const config = getTransactionalEmailConfig();
  if (!config) {
    throw new TransactionalEmailError(
      "O envio transacional ainda não está configurado.",
      "email_not_configured",
    );
  }

  const endpoint = `${CLOUDFLARE_EMAIL_ENDPOINT}/${encodeURIComponent(config.accountId)}/email/sending/send`;
  let lastStatus = 0;
  let lastPayload: CloudflareEmailResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: message.to,
          from: config.from,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new TransactionalEmailError(
        "O provedor de e-mail não respondeu.",
        "email_provider_unreachable",
      );
    }

    lastStatus = response.status;
    lastPayload = (await response.json().catch(() => null)) as CloudflareEmailResponse | null;

    const delivered = lastPayload?.result?.delivered ?? [];
    const queued = lastPayload?.result?.queued ?? [];
    const bounced = lastPayload?.result?.permanent_bounces ?? [];

    if (response.ok && lastPayload?.success && !bounced.length && (delivered.length || queued.length)) {
      return {
        messageId: lastPayload.result?.message_id ?? null,
        status: delivered.length ? "delivered" : "queued",
      };
    }

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new TransactionalEmailError(
    `O provedor de e-mail recusou o envio (HTTP ${lastStatus || "indisponível"}).`,
    apiErrorCode(lastPayload),
  );
}
