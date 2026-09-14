export type DailyStudyArticleCandidate = Readonly<{
  id: number;
  articleOrder: number;
  articleRef: string;
  questionCount: number;
}>;

export type DailyStudyActCandidate = Readonly<{
  id: number;
  slug: string;
  title: string;
  officialUrl: string;
  articles: readonly DailyStudyArticleCandidate[];
}>;

function daySerial(dateIso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    throw new Error("Data inválida para o plano diário.");
  }
  const value = Date.parse(`${dateIso}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== dateIso) {
    throw new Error("Data inválida para o plano diário.");
  }
  return Math.floor(value / 86_400_000);
}

export function selectDailyStudyTarget(
  userId: number,
  dateIso: string,
  candidates: readonly DailyStudyActCandidate[],
) {
  const orderedActs = candidates
    .map((act) => ({
      ...act,
      articles: [...act.articles]
        .filter((article) => article.questionCount > 0)
        .sort((left, right) => left.articleOrder - right.articleOrder || left.id - right.id),
    }))
    .filter((act) => act.articles.length > 0)
    .sort((left, right) => left.title.localeCompare(right.title, "pt-BR") || left.id - right.id);
  if (!orderedActs.length) return null;

  const seed = Math.abs(daySerial(dateIso) + Math.trunc(userId));
  const act = orderedActs[seed % orderedActs.length];
  const windowCount = Math.max(1, act.articles.length - 4);
  const startIndex = Math.floor(seed / orderedActs.length) % windowCount;
  const articles = act.articles.slice(startIndex, startIndex + 5);

  return {
    ...act,
    articles,
    articleStartOrder: articles[0].articleOrder,
    articleEndOrder: articles.at(-1)!.articleOrder,
    questionCount: articles.reduce((total, article) => total + article.questionCount, 0),
  };
}

export function dailyPlanLinks(target: {
  slug: string;
  articleStartOrder: number;
  articleEndOrder: number;
}) {
  const slug = encodeURIComponent(target.slug);
  const range = `de=${target.articleStartOrder}&ate=${target.articleEndOrder}`;
  return {
    reading: `/app/leis/${slug}?${range}`,
    practice: `/app/treinar?lei=${slug}&${range}&ordem=sequencial`,
    review: `/app/mapas?lei=${slug}&${range}`,
  };
}
