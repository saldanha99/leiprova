import { getOfficialOpportunitySourcePolicy, type OfficialOpportunitySourceId } from "@/lib/opportunities/source-monitor-policy";

const MESSAGES = {
  invalid_source_url: "A URL da fonte não atende à política oficial.",
  invalid_document_url: "A URL do documento não atende à política oficial.",
  robots_path_disallowed: "A política de acesso proíbe a captura neste caminho.",
  prohibited_exam_material: "Cadernos, questões, respostas e gabaritos de terceiros não podem ser capturados.",
  document_not_eligible: "O arquivo não foi identificado como edital ou anexo de conteúdo programático.",
  unsafe_source_address: "A origem oficial não resolveu para um endereço público seguro.",
  official_dns_failed: "Falha ao resolver o endereço da origem oficial.",
  official_tls_failed: "Falha na validação TLS da origem oficial.",
  official_connection_failed: "Falha de conexão com a origem oficial.",
  official_timeout: "O acesso à origem oficial excedeu o tempo permitido.",
  official_request_failed: "Falha na requisição à origem oficial.",
  redirect_missing_location: "A origem oficial redirecionou sem informar o destino.",
  redirect_disallowed: "O redirecionamento não atende à política da origem oficial.",
  redirect_limit: "A origem oficial excedeu o limite seguro de redirecionamentos.",
  document_size_limit: "O documento excede o limite de 15 MB.",
  discovery_size_limit: "A página excede o limite de 2 MB.",
  empty_source_body: "A origem oficial respondeu sem conteúdo.",
  official_body_read_failed: "Falha ao ler o conteúdo da origem oficial.",
  unsupported_source_type: "A fonte não retornou uma página HTML nem um PDF oficial.",
  official_discovery_failed: "Falha ao identificar documentos na página oficial.",
  invalid_pdf_signature: "O arquivo selecionado não possui a assinatura de um PDF válido.",
  pdf_parse_failed: "Não foi possível abrir o PDF recebido.",
  pdf_extract_failed: "Não foi possível extrair o texto do PDF recebido.",
  pdf_page_limit: "O PDF precisa ter entre 1 e 250 páginas.",
  pdf_needs_ocr: "O PDF não contém texto pesquisável suficiente; OCR ainda não está habilitado.",
  pdf_text_limit: "O texto extraído excede o limite operacional de 2 milhões de caracteres.",
  pdf_cleanup_failed: "Não foi possível liberar os recursos do leitor de PDF.",
} as const;

export type OfficialDocumentFetchErrorCode = keyof typeof MESSAGES | `official_http_${number}`;
export type OfficialDocumentFetchStage =
  | "policy" | "dns" | "request" | "redirect" | "body" | "discovery"
  | "pdf_signature" | "pdf_parse" | "pdf_extract" | "pdf_cleanup";

/** Só recebe códigos internos. Nunca preserva causa, mensagem externa, URL ou headers. */
export class OfficialDocumentFetchError extends Error {
  readonly code: OfficialDocumentFetchErrorCode;
  readonly stage: OfficialDocumentFetchStage;
  readonly sourceId?: OfficialOpportunitySourceId;
  readonly httpStatus?: number;

  constructor(
    code: OfficialDocumentFetchErrorCode,
    stage: OfficialDocumentFetchStage,
    sourceId?: OfficialOpportunitySourceId,
  ) {
    const status = /^official_http_([1-5]\d{2})$/.exec(code)?.[1];
    const safeCode = Object.hasOwn(MESSAGES, code) || status ? code : "official_request_failed";
    super(status ? `A origem oficial respondeu com HTTP ${status}.` : MESSAGES[safeCode as keyof typeof MESSAGES]);
    this.name = "OfficialDocumentFetchError";
    this.code = safeCode;
    this.stage = stage;
    this.sourceId = sourceId ? getOfficialOpportunitySourcePolicy(sourceId)?.id : undefined;
    if (status) this.httpStatus = Number(status);
  }

  toJSON() {
    return { name: this.name, code: this.code, stage: this.stage,
      sourceId: this.sourceId, httpStatus: this.httpStatus, message: this.message };
  }
}

const NETWORK_CODES: Readonly<Record<string, OfficialDocumentFetchErrorCode>> = {
  ENOTFOUND: "official_dns_failed", EAI_AGAIN: "official_dns_failed",
  CERT_HAS_EXPIRED: "official_tls_failed", CERT_NOT_YET_VALID: "official_tls_failed",
  DEPTH_ZERO_SELF_SIGNED_CERT: "official_tls_failed", SELF_SIGNED_CERT_IN_CHAIN: "official_tls_failed",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "official_tls_failed", UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "official_tls_failed",
  ERR_TLS_CERT_ALTNAME_INVALID: "official_tls_failed",
  ECONNREFUSED: "official_connection_failed", ECONNRESET: "official_connection_failed",
  ENETUNREACH: "official_connection_failed", EHOSTUNREACH: "official_connection_failed",
  UND_ERR_SOCKET: "official_connection_failed",
  ETIMEDOUT: "official_timeout", UND_ERR_CONNECT_TIMEOUT: "official_timeout",
  UND_ERR_HEADERS_TIMEOUT: "official_timeout", UND_ERR_BODY_TIMEOUT: "official_timeout",
};

/** Examina apenas nomes/códigos conhecidos, com profundidade limitada; não copia valores externos. */
export function normalizeOfficialDocumentFetchError(
  error: unknown,
  fallback: keyof typeof MESSAGES,
  stage: OfficialDocumentFetchStage,
  sourceId?: OfficialOpportunitySourceId,
) {
  if (error instanceof OfficialDocumentFetchError) {
    return new OfficialDocumentFetchError(error.code, error.stage, sourceId ?? error.sourceId);
  }
  let current = error;
  // Códigos de rede só fazem sentido durante I/O, nunca inferidos de erros do parser.
  if (["dns", "request", "body"].includes(stage)) {
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
      const record = current as { name?: unknown; code?: unknown; cause?: unknown };
      if (record.name === "TimeoutError" || record.name === "AbortError") {
        return new OfficialDocumentFetchError("official_timeout", stage, sourceId);
      }
      if (typeof record.code === "string" && Object.hasOwn(NETWORK_CODES, record.code)) {
        return new OfficialDocumentFetchError(NETWORK_CODES[record.code], stage, sourceId);
      }
      current = record.cause;
    }
  }
  return new OfficialDocumentFetchError(fallback, stage, sourceId);
}
