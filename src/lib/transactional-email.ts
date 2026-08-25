import "server-only";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

type TransactionalEmailConfig = {
  apiToken: string;
  from: string;
};

type TransactionalHtmlEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

type TransactionalTemplateEmailMessage = {
  to: string;
  from?: string;
  template: {
    id: string;
    variables: Record<string, string | number>;
  };
  idempotencyKey: string;
};

export type TransactionalEmailMessage =
  | TransactionalHtmlEmailMessage
  | TransactionalTemplateEmailMessage;

type ResendEmailResponse = {
  id?: string;
  name?: string;
  message?: string;
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

  const apiToken = readEnv("RESEND_API_KEY");
  const from = readEnv("TRANSACTIONAL_EMAIL_FROM");

  if (!apiToken || !from) return null;
  return { apiToken, from };
}

function apiErrorCode(payload: ResendEmailResponse | null) {
  const name = payload?.name?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return name ? `resend_${name}` : "resend_request_failed";
}

function shouldRetry(status: number, payload: ResendEmailResponse | null) {
  if (RETRYABLE_STATUSES.has(status)) return true;
  return status === 429 && payload?.name === "rate_limit_exceeded";
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

  let lastStatus = 0;
  let lastPayload: ResendEmailResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(RESEND_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
          "User-Agent": "leiprova/0.1.0",
        },
        body: JSON.stringify(
          "template" in message
            ? {
                to: message.to,
                from: message.from ?? config.from,
                template: message.template,
              }
            : {
                to: message.to,
                from: config.from,
                subject: message.subject,
                html: message.html,
                text: message.text,
              },
        ),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new TransactionalEmailError(
        "O provedor de e-mail não respondeu.",
        "email_provider_unreachable",
      );
    }

    lastStatus = response.status;
    lastPayload = (await response.json().catch(() => null)) as ResendEmailResponse | null;

    if (response.ok && lastPayload?.id) {
      return {
        messageId: lastPayload.id,
        status: "queued",
      };
    }

    if (!shouldRetry(response.status, lastPayload) || attempt === 1) break;
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(Math.max(retryAfterSeconds * 1_000, 250), 1_000)
      : 250;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new TransactionalEmailError(
    `O provedor de e-mail recusou o envio (HTTP ${lastStatus || "indisponível"}).`,
    apiErrorCode(lastPayload),
  );
}
