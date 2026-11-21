/**
 * Partida do servidor (Next.js). Aquece em segundo plano os catálogos pesados do
 * quiz e dos simulados, para o primeiro aluno não esperar o cálculo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { warmQuizCatalogCaches } = await import("@/lib/db/quiz-exam-editions");
  void warmQuizCatalogCaches().catch(() => undefined);
}
