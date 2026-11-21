/** Chave e teto das tarefas de artigo fino (ver ./thin-article-authoring). Sem importações:
 * a fila (agent-work-queue) usa estes valores ao montar a reserva. */
export const THIN_ARTICLE_JOB_PREFIX = "author-thin";
export const THIN_ARTICLE_JOB_KEY_SQL_PATTERN = "^author-thin:[0-9]{1,18}:[0-9]{1,18}$";
const THIN_ARTICLE_JOB_KEY = /^author-thin:([0-9]{1,18}):([0-9]{1,18})$/u;
/** Com 3 questões revisadas o artigo sai da lista (gate da página pública). */
export const THIN_ARTICLE_TARGET_REVIEWED = 3;
export const THIN_ARTICLE_POLICY = "thin_article_authoring_v1";

export function thinArticleJobKey(requirementId: number, articleId: number) {
  for (const value of [requirementId, articleId]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Identidade de artigo fino inválida.");
  }
  return `${THIN_ARTICLE_JOB_PREFIX}:${requirementId}:${articleId}`;
}

export function parseThinArticleJobKey(key: string) {
  const match = THIN_ARTICLE_JOB_KEY.exec(key);
  return match ? { requirementId: Number(match[1]), articleId: Number(match[2]) } : null;
}

/**
 * Teto de tarefas de artigo fino em execução ao mesmo tempo (todas as instâncias do motor,
 * contado no banco sob a trava da reserva). Padrão 1; 0 pausa; inválido também pausa
 * (o erro de configuração nunca pode tirar vaga da autoria dos produtos à venda).
 */
export const THIN_ARTICLE_MAX_RUNNING_ENV = "EDITORIAL_THIN_ARTICLE_MAX_RUNNING";
export const THIN_ARTICLE_MAX_RUNNING_DEFAULT = 1;
export function thinArticleMaxRunning(raw: string | undefined = process.env[THIN_ARTICLE_MAX_RUNNING_ENV]) {
  const text = raw?.trim();
  if (!text) return THIN_ARTICLE_MAX_RUNNING_DEFAULT;
  if (!/^[0-9]{1,2}$/u.test(text)) return 0;
  const value = Number(text);
  return value <= 8 ? value : 0;
}

