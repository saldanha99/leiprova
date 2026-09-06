/** Diagnóstico operacional sem registrar SQL, conteúdo, credenciais ou URLs. */
export function safeEditorialError(error: unknown) {
  const cause=error instanceof Error && error.cause ? error.cause : error;
  const record=cause && typeof cause==='object' ? cause as {code?:unknown;name?:unknown} : {};
  const code=typeof record.code==='string' && /^[a-z0-9_]{1,80}$/i.test(record.code) ? record.code : null;
  if(code) return JSON.stringify({code});
  const message=error instanceof Error ? error.message : '';
  const http=/^A origem oficial respondeu com HTTP (\d{3})\.$/.exec(message)?.[1];
  if(http) return JSON.stringify({code:`official_http_${http}`});
  const known:Record<string,string>={
    'A fonte não retornou uma página HTML nem um PDF oficial.':'unsupported_source_type',
    'O arquivo selecionado não possui a assinatura de um PDF válido.':'invalid_pdf_signature',
    'O PDF não contém texto pesquisável suficiente; OCR ainda não está habilitado.':'pdf_needs_ocr',
    'A origem oficial excedeu o limite seguro de redirecionamentos.':'redirect_limit',
    'A origem oficial não resolveu para um endereço público seguro.':'unsafe_source_address',
    'Cadernos, questões, respostas e gabaritos de terceiros não podem ser capturados.':'prohibited_exam_material',
  };
  return JSON.stringify({code:known[message]??(error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)?'official_timeout':'editorial_operation_failed')});
}
