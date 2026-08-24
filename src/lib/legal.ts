export const TERMS_VERSION = "2026-08-16-beta";
export const PRIVACY_VERSION = "2026-08-16-beta";

/**
 * Identificação do fornecedor.
 *
 * O Decreto 7.962/2013, art. 2º, I, exige que o site de comércio eletrônico
 * exiba em local de destaque o nome empresarial, o CNPJ e os endereços físico
 * e eletrônico. A LGPD, art. 41, exige a identidade e o contato do encarregado.
 *
 * Estes valores vivem no `.env`, e não no código, por dois motivos: o
 * repositório é público e endereço com CNPJ não deve ser versionado; e assim a
 * identificação pode ser preenchida na VPS sem exigir um novo deploy.
 */
export type SupplierIdentity = {
  /** Razão social ou nome empresarial completo. */
  legalName: string;
  /** Nome fantasia, quando houver. */
  tradeName: string | null;
  /** CNPJ ou, no caso de empresário individual, CPF. */
  taxId: string;
  /** Endereço físico completo, com CEP. */
  address: string;
  /** Endereço eletrônico de atendimento. */
  email: string;
  /** Canal e horário de atendimento ao consumidor. */
  supportChannel: string;
  /** Contato do encarregado pelo tratamento de dados (LGPD, art. 41). */
  dataProtectionContact: string;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

/**
 * Devolve a identificação apenas quando **todos** os campos obrigatórios estão
 * preenchidos. Uma identificação parcial é pior que nenhuma: ela aparenta
 * cumprir o Decreto 7.962 sem cumprir.
 */
export function getSupplierIdentity(): SupplierIdentity | null {
  const legalName = readEnv("SUPPLIER_LEGAL_NAME");
  const taxId = readEnv("SUPPLIER_TAX_ID");
  const address = readEnv("SUPPLIER_ADDRESS");
  const email = readEnv("SUPPLIER_EMAIL");
  const supportChannel = readEnv("SUPPLIER_SUPPORT_CHANNEL");
  const dataProtectionContact = readEnv("SUPPLIER_DPO_CONTACT");

  if (!legalName || !taxId || !address || !email || !supportChannel || !dataProtectionContact) {
    return null;
  }

  return {
    legalName,
    tradeName: readEnv("SUPPLIER_TRADE_NAME"),
    taxId,
    address,
    email,
    supportChannel,
    dataProtectionContact,
  };
}

export function isSupplierIdentityComplete() {
  return getSupplierIdentity() !== null;
}

/** Campos ainda em falta, para diagnóstico no painel administrativo. */
export function missingSupplierFields(): readonly string[] {
  const required = {
    SUPPLIER_LEGAL_NAME: readEnv("SUPPLIER_LEGAL_NAME"),
    SUPPLIER_TAX_ID: readEnv("SUPPLIER_TAX_ID"),
    SUPPLIER_ADDRESS: readEnv("SUPPLIER_ADDRESS"),
    SUPPLIER_EMAIL: readEnv("SUPPLIER_EMAIL"),
    SUPPLIER_SUPPORT_CHANNEL: readEnv("SUPPLIER_SUPPORT_CHANNEL"),
    SUPPLIER_DPO_CONTACT: readEnv("SUPPLIER_DPO_CONTACT"),
  };

  return Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

/**
 * Prazo de arrependimento do art. 49 do CDC. Fica aqui, e não escrito à mão em
 * cada página, para que os documentos não possam divergir entre si.
 */
export const WITHDRAWAL_PERIOD_DAYS = 7;
