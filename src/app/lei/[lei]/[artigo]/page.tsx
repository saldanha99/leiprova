import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { PublicGuideShell } from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { AuthorNotice, Breadcrumbs, FaqBlock, Section, SourceSeal, TrainCta } from "@/components/seo/legal/blocks";
import { LiteralText, PublicQuestionCard } from "@/components/seo/legal/article-blocks";
import { findLaw, getLawSnapshot, loadArticleContestLinks } from "@/lib/seo/legal-data";
import { inlineArticle, ofLaw } from "@/lib/seo/legal-format";
import {
  articleCrumbs,
  articleDescription,
  articleFaq,
  articleHeadline,
  articleJsonLd,
  articleTitle,
} from "@/lib/seo/legal-views";
import { buildMetadata } from "@/lib/seo/metadata";
import { readPageStates } from "@/lib/seo/page-state-db";
import { resolveLastModified } from "@/lib/seo/page-state";
import { normalizeArticleSegment } from "@/lib/seo/slugs";

export const dynamic = "force-dynamic";

type Params = Promise<{ lei: string; artigo: string }>;

const loadArticle = cache(async (lei: string, artigo: string) => {
  const lookup = await findLaw(lei);
  if (lookup.kind === "missing") notFound();
  const segment = normalizeArticleSegment(artigo);
  if (!segment) notFound();
  // The proxy already answers known aliases with 301; this covers database slugs.
  if (lookup.kind === "redirect" || segment !== artigo) {
    permanentRedirect(`/lei/${lookup.kind === "redirect" ? lookup.slug : lookup.law.slug}/${segment}`);
  }
  const snapshot = await getLawSnapshot(lookup.law);
  const article = snapshot.bySegment.get(segment);
  // Spec 2.6: no reviewed text means 404, never an empty page.
  if (!article || article.gate.status === "not_found") notFound();
  const states = await readPageStates([article.path]);
  return { snapshot, article, modifiedAt: resolveLastModified(states.get(article.path), article) };
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lei, artigo } = await params;
  const { snapshot, article, modifiedAt } = await loadArticle(lei, artigo);
  return buildMetadata({
    path: article.path,
    title: articleTitle(snapshot, article),
    description: articleDescription(snapshot, article),
    index: article.gate.status === "index",
    type: "article",
    modifiedAt,
  });
}

export default async function ArticlePageRoute({ params }: { params: Params }) {
  const { lei, artigo } = await params;
  const { snapshot, article, modifiedAt } = await loadArticle(lei, artigo);
  const contests = (await loadArticleContestLinks(snapshot.law.versionId)).get(article.id) ?? [];
  const now = new Date();
  const description = articleDescription(snapshot, article);
  const faq = articleFaq(snapshot, article, contests, now);
  const name = `${inlineArticle(article.label)} ${ofLaw(snapshot.label)}`;
  const remaining = Math.max(0, article.reviewedQuestionCount - article.publicQuestions.length);
  const segment = article.path.split("/").pop() ?? "artigo";

  return (
    <PublicGuideShell>
      <JsonLd data={articleJsonLd(snapshot, article, { description, faq, modifiedAt })} />
      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Breadcrumbs crumbs={articleCrumbs(snapshot, article)} />
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          {articleHeadline(snapshot, article)}
        </h1>
        {article.directAnswer ? (
          <p className="mt-5 text-lg leading-8 text-slate-200" id="resposta-direta">
            {article.directAnswer}
          </p>
        ) : null}
        <SourceSeal
          contentChangedAt={modifiedAt}
          officialUrl={snapshot.law.officialUrl}
          verifiedAt={snapshot.law.versionVerifiedAt}
          versionSourceUrl={snapshot.law.versionSourceUrl}
        />

        <Section id="texto-oficial" title={`Texto oficial do ${name}`}>
          <LiteralText literalText={article.literalText} />
        </Section>

        {article.traps.length ? (
          <Section id="cai-assim" title="Cai assim na prova">
            <p className="text-sm leading-7 text-slate-400">
              Afirmações erradas tiradas das nossas questões revisadas sobre este artigo, com o motivo do erro.
            </p>
            <ul className="mt-4 space-y-4">
              {article.traps.map((trap) => (
                <li className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-4" key={trap.questionAnchorId + trap.statement}>
                  <p className="text-sm leading-7 text-slate-200">
                    <span className="font-bold text-rose-200">Errado: </span>“{trap.statement}”
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{trap.why}</p>
                  <a className="mt-2 inline-block text-xs font-bold text-amber-300 hover:underline" href={`#${trap.questionAnchorId}`}>
                    Ver a questão que mostra esse padrão
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {article.publicQuestions.length ? (
          <Section id="questoes" title="Questões resolvidas">
            <div className="space-y-6">
              {article.publicQuestions.map((question, index) => (
                <PublicQuestionCard index={index + 1} key={question.publicId} question={question} />
              ))}
            </div>
          </Section>
        ) : null}

        {contests.length ? (
          <Section id="concursos" title="Concursos que cobram este artigo">
            <ul className="space-y-2 text-sm">
              {contests.slice(0, 10).map((contest) => (
                <li key={contest.path}>
                  <Link className="font-semibold text-amber-300 hover:underline" href={contest.path}>
                    {contest.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <nav aria-label="Artigo anterior e próximo" className="mt-12 grid gap-3 sm:grid-cols-2">
          {article.previous ? (
            <Link className="rounded-2xl border border-white/10 p-4 text-sm hover:border-amber-300/40" href={article.previous.path} rel="prev">
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Artigo anterior</span>
              <span className="mt-1 block font-semibold text-slate-100">
                {article.previous.label} {ofLaw(snapshot.label)}
                {article.previous.heading ? ` — ${article.previous.heading}` : ""}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {article.next ? (
            <Link className="rounded-2xl border border-white/10 p-4 text-sm hover:border-amber-300/40 sm:text-right" href={article.next.path} rel="next">
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Próximo artigo</span>
              <span className="mt-1 block font-semibold text-slate-100">
                {article.next.label} {ofLaw(snapshot.label)}
                {article.next.heading ? ` — ${article.next.heading}` : ""}
              </span>
            </Link>
          ) : null}
        </nav>

        {article.related.length ? (
          <Section id="mesmo-tema" title="Artigos do mesmo tema">
            <ul className="space-y-2 text-sm">
              {article.related.map((related) => (
                <li key={related.path}>
                  <Link className="font-semibold text-amber-300 hover:underline" href={related.path}>
                    {related.label} {ofLaw(snapshot.label)}
                    {related.heading ? ` — ${related.heading}` : ""}
                  </Link>
                </li>
              ))}
              <li>
                <Link className="font-semibold text-amber-300 hover:underline" href={snapshot.path}>
                  Todos os artigos {ofLaw(snapshot.label)}
                </Link>
              </li>
            </ul>
          </Section>
        ) : null}

        <FaqBlock items={faq} />
        <AuthorNotice withQuestions={article.publicQuestions.length > 0} />
        <TrainCta
          description={
            remaining > 0
              ? `Há mais ${remaining} ${remaining === 1 ? "questão revisada" : "questões revisadas"} sobre o ${name} no treino, com revisão espaçada e correção imediata.`
              : `Treine o ${name} com revisão espaçada e correção imediata.`
          }
          href={contests[0]?.path ?? "/concursos"}
          id={`cta-treinar-${snapshot.slug}-${segment}`}
          title={remaining > 1 ? `Treinar as outras ${remaining} questões` : remaining === 1 ? "Treinar a outra questão" : "Treinar este artigo"}
        />
      </article>
    </PublicGuideShell>
  );
}
