import {describe,it,expect} from 'vitest';
import {safeEditorialError} from '@/lib/editorial/safe-error';
describe('diagnóstico editorial sem segredos',()=>{
  it('mantém apenas código seguro do driver ou fetch',()=>{
    expect(safeEditorialError(new Error('SQL e senha',{cause:{code:'42501',message:'segredo'}}))).toBe('{"code":"42501"}');
  });
  it('identifica erro HTTP conhecido sem registrar conteúdo arbitrário',()=>{
    expect(safeEditorialError(new Error('A origem oficial respondeu com HTTP 503.'))).toContain('official_http_503');
    expect(safeEditorialError(new Error('segredo no corpo',{cause:{code:'postgres://senha'}}))).not.toContain('senha');
  });
  it('identifica ausência de OCR e timeouts',()=>{
    expect(safeEditorialError(new Error('O PDF não contém texto pesquisável suficiente; OCR ainda não está habilitado.'))).toContain('pdf_needs_ocr');
    expect(safeEditorialError(new DOMException('secret','TimeoutError'))).toContain('official_timeout');
  });
});
