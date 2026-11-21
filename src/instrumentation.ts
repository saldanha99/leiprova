/**
 * Partida do servidor (Next.js). Aquece em segundo plano os catálogos pesados do
 * quiz, dos simulados e do treino, para o primeiro aluno não esperar o cálculo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const [{ warmQuizCatalogCaches }, { warmStudyPool }] = await Promise.all([
    import("@/lib/db/quiz-exam-editions"),
    import("@/lib/study/eligible-question-pool"),
  ]);
  // Um de cada vez: as duas consultas são pesadas e o banco é compartilhado.
  void warmQuizCatalogCaches().then(warmStudyPool).catch(() => undefined);
}
