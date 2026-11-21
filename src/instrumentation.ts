/**
 * Partida do servidor (Next.js). Aquece em segundo plano os cálculos pesados: a
 * lista de produtos à venda (home, /concursos, páginas de lei e artigo: ~13 s) e os
 * catálogos do quiz, dos simulados e do treino. O visitante e o Googlebot não esperam.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const [{ warmReleasedContestProducts }, { warmQuizCatalogCaches }, { warmStudyPool }] = await Promise.all([
    import("@/lib/commerce/store"),
    import("@/lib/db/quiz-exam-editions"),
    import("@/lib/study/eligible-question-pool"),
  ]);
  // Um de cada vez (o banco é compartilhado); a vitrine primeiro: é a que as páginas
  // públicas e o Googlebot esperam.
  void warmReleasedContestProducts()
    .then(() => warmQuizCatalogCaches())
    .then(() => warmStudyPool())
    .catch(() => undefined);
}
