export const PRIVACY_REQUEST_TYPES = [
  { value: "confirmation_access", label: "Confirmação e acesso aos dados" },
  { value: "correction", label: "Correção de dados" },
  { value: "deletion_anonymization", label: "Eliminação ou anonimização" },
  { value: "portability", label: "Portabilidade" },
  { value: "sharing_information", label: "Informações sobre compartilhamento" },
  { value: "consent_revocation", label: "Revogação de consentimento" },
  { value: "other", label: "Outro direito relacionado à privacidade" },
] as const;

export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number]["value"];

const PRIVACY_REQUEST_LABELS = Object.fromEntries(
  PRIVACY_REQUEST_TYPES.map(({ value, label }) => [value, label]),
) as Record<PrivacyRequestType, string>;

export function privacyRequestLabel(type: PrivacyRequestType) {
  return PRIVACY_REQUEST_LABELS[type];
}

export function formatPrivacyRequestProtocol(now: Date, entropy: string) {
  const normalizedEntropy = entropy.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  if (normalizedEntropy.length !== 8) {
    throw new Error("O protocolo LGPD exige oito caracteres aleatórios.");
  }

  const date = [
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");

  return `LP-LGPD-${date}-${normalizedEntropy}`;
}
