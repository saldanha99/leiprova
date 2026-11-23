import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { PublicGuideShell } from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { AuthorNotice, Breadcrumbs, FaqBlock, Section, SourceSeal, TrainCta } from "@/components/seo/legal/blocks";
import { findLaw, getLawSnapshot, loadLawContestLinks } from "@/lib/seo/legal-data";
import { brDate, legislationTypeLabel, ofLaw, sourceLabel, theLaw } from "@/lib/seo/legal-format";
import type { ArticlePage } from "@/lib/seo/legal-snapshot";
import { lawCrumbs, lawDescription, lawFaq, lawHeadline, lawJsonLd, lawSummary } from "@/lib/seo/legal-views";
import { buildMetadata } from "@/lib/seo/metadata";
import { readPageStates } from "@/lib/seo/page-state-db";
import { resolveLastModified } from "@/lib/seo/page-state";

export const dynamic = "force-dynamic";

type Params = Promise<{ lei: string }>;

const loadLaw = cache(async (lei: string) => {
  const lookup = await findLaw(lei);
  if (lookup.kind === "missing") notFound();
  if (lookup.kind === "redirect") permanentRedirect(`/lei/${lookup.slug}`);
  const snapshot = await getLawSnapshot(lookup.law);
  const states = await readPageStates([snapshot.path]);
  return { snapshot, modifiedAt: resolveLastModified(states.get(snapshot.path), snapshot) };
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lei } = await params;
  const { snapshot, modifiedAt } = await loadLaw(lei);
  return buildMetadata({
    path: snapshot.path,
    title: `${lawHeadline(snapshot)}: artigos e questões`,
    description: lawDescription(snapshot),
    index: snapshot.gate.status === "index",
    modifiedAt,
  });
}

/** Consecutive articles under the same structural heading. */
function groupByHeading(articles: readonly ArticlePage[]) {
  const groups: { heading: string | null; articles: ArticlePage[] }[] = [];
  for (const article of articles) {
    const last = groups.at(-1);
    if (last && last.heading === article.heading) last.articles.push(article);
    else groups.push({ heading: article.heading, articles: [article] });
  }
  return groups;
}

function ArticleEntry({ article }: { article: ArticlePage }) {
  const text = `${article.label}${article.heading ? ` — ${article.heading}` : ""}`;
  // Spec 2.5 B: only indexable articles are linked; the others are listed.
  return article.gate.status === "index" ? (
    <Link className="font-semibold text-els-amber-ink hover:underline" href={article.path}>
      {text}
    </Link>
  ) : (
    <span className="text-els-fg-3">{article.label}</span>
  );
}

export default async function LawPageRoute({ params }: { params: Params }) {
  const { lei } = await params;
  const { snapshot, modifiedAt } = await loadLaw(lei);
  const contests = await loadLawContestLinks(snapshot.law.id);
  const now = new Date();
  const description = lawDescription(snapshot);
  const faq = lawFaq(snapshot, contests, now);
  const groups = groupByHeading(snapshot.articles);
  const law = snapshot.law;

  return (
    <PublicGuideShell tone="els">
      <JsonLd data={lawJsonLd(snapshot, { description, faq, modifiedAt })} />
      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Breadcrumbs crumbs={lawCrumbs(snapshot)} />
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-els-fg sm:text-4xl">{lawHeadline(snapshot)}</h1>
        <p className="mt-5 text-lg leading-8 text-els-fg-2" id="resumo">
          {lawSummary(snapshot, contests)}
        </p>
        <SourceSeal
          contentChangedAt={modifiedAt}
          officialUrl={law.officialUrl}
          verifiedAt={law.versionVerifiedAt}
          versionSourceUrl={law.versionSourceUrl}
        />

        <Section id="ficha" title="Ficha da norma">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-bold text-els-fg-3">Norma</dt>
            <dd className="text-els-fg-2">{law.title}</dd>
            <dt className="font-bold text-els-fg-3">Tipo</dt>
            <dd className="text-els-fg-2">{legislationTypeLabel(law.actType)}</dd>
            {law.actNumber ? (
              <>
                <dt className="font-bold text-els-fg-3">Número</dt>
                <dd className="text-els-fg-2">{law.actNumber}</dd>
              </>
            ) : null}
            {law.actYear ? (
              <>
                <dt className="font-bold text-els-fg-3">Ano</dt>
                <dd className="text-els-fg-2">{law.actYear}</dd>
              </>
            ) : null}
            <dt className="font-bold text-els-fg-3">Situação</dt>
            <dd className="text-els-fg-2">Vigente (versão verificada em {brDate(law.versionVerifiedAt)})</dd>
            <dt className="font-bold text-els-fg-3">Texto oficial</dt>
            <dd>
              <a className="font-semibold text-els-amber-ink hover:underline" href={law.officialUrl} rel="noopener">
                {sourceLabel(law.officialUrl)}
              </a>
            </dd>
          </dl>
        </Section>

        {snapshot.topArticles.length ? (
          <Section id="mais-cobrados" title={`Os artigos ${ofLaw(snapshot.label)} com mais questões`}>
            <p className="text-sm leading-7 text-els-fg-3">
              Contagem de questões revisadas na base do Edital Lei Seca em {brDate(now)} (inéditas da nossa base, não todas as provas do país).
            </p>
            <ol className="mt-4 space-y-2 text-sm">
              {snapshot.topArticles.map((article) => (
                <li className="flex items-baseline justify-between gap-4 border-b border-els-line pb-2" key={article.path}>
                  <ArticleEntry article={article} />
                  <span className="shrink-0 text-els-fg-3">{article.reviewedQuestionCount} questões</span>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {contests.length ? (
          <Section id="concursos" title={`Concursos que cobram ${theLaw(snapshot.label)}`}>
            <ul className="space-y-2 text-sm">
              {contests.map((contest) => (
                <li key={contest.path}>
                  <Link className="font-semibold text-els-amber-ink hover:underline" href={contest.path}>
                    {contest.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section id="sumario" title="Sumário">
          <div className="space-y-6">
            {groups.map((group, index) => (
              <div key={`${group.heading ?? "sem-titulo"}-${index}`}>
                {group.heading ? <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-els-fg-3">{group.heading}</h3> : null}
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {group.articles.map((article) => (
                    <li key={article.path}>
                      <ArticleEntry article={article} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <FaqBlock items={faq} />
        <AuthorNotice withQuestions={false} />
        <TrainCta
          description={`Treine a literalidade ${ofLaw(snapshot.label)} com questões inéditas, correção imediata e revisão espaçada.`}
          href={contests[0]?.path ?? "/concursos"}
          id={`cta-treinar-${snapshot.slug}`}
          title={`Treinar ${theLaw(snapshot.label)}`}
        />
      </article>
    </PublicGuideShell>
  );
}
