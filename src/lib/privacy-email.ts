import "server-only";

import { sendTransactionalEmail, TransactionalEmailError } from "@/lib/transactional-email";

type PrivacyEmailConfig = {
  from: string;
  templateId: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || null;
}

export function getPrivacyEmailConfig(): PrivacyEmailConfig | null {
  const from = readEnv("LGPD_EMAIL_FROM");
  const templateId = readEnv("RESEND_LGPD_TEMPLATE_ID");

  if (!from || !templateId) return null;
  return { from, templateId };
}

export async function sendPrivacyRequestConfirmation({
  email,
  firstName,
  protocol,
  requestType,
}: {
  email: string;
  firstName: string;
  protocol: string;
  requestType: string;
}) {
  const config = getPrivacyEmailConfig();
  if (!config) {
    throw new TransactionalEmailError(
      "A confirmação de privacidade ainda não está configurada.",
      "privacy_email_not_configured",
    );
  }

  return sendTransactionalEmail({
    to: email,
    from: config.from,
    template: {
      id: config.templateId,
      variables: {
        NOME: firstName,
        TIPO_SOLICITACAO: requestType,
        PROTOCOLO: protocol,
      },
    },
    idempotencyKey: `privacy-request/${protocol}`,
  });
}
