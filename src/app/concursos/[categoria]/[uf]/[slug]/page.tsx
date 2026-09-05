import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicGuideShell } from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { getReviewedContestOpportunity } from "@/lib/db/contest-opportunities";
import { getOpportunityJurisdictionBySlug } from "@/lib/opportunities/jurisdictions";
import {
  formatOpportunityDate,
  getOpportunityLifecycleLabel,
  getResponsibleTypeLabel,
} from "@/lib/opportunities/presentation";
import { WEBSITE_ID, absoluteUrl } from "@/lib/seo";

type ContestOpportunityPageProps = {
  params: Promise<{ categoria: string; uf: string; slug: string }>;
};

const getPageOpportunity = cache(
  async (categorySlug: string, jurisdictionSlug: string, opportunitySlug: string) => {
    const jurisdiction = getOpportunityJurisdictionBySlug(jurisdictionSlug);
    if (!jurisdiction) return null;

    const opportunity = await getReviewedContestOpportunity({
      categorySlug,
      jurisdictionCode: jurisdiction.code,
      opportunitySlug,
    });

    return opportunity ? { opportunity, jurisdiction } : null;
  },
);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ContestOpportunityPageProps): Promise<Metadata> {
  const { categoria, uf, slug } = await params;
  const result = await getPageOpportunity(categoria, uf, slug);

  if (!result) {
    return {
      title: "Oportunidade não encontrada",
      robots: { index: false, follow: false },
    };
  }

  const path = `/concursos/${categoria}/${uf}/${slug}`;
  return {
    title: `${result.opportunity.title} — situação oficial da edição`,
    description: result.opportunity.summary,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: path,
      title: result.opportunity.title,
      description: result.opportunity.summary,
      siteName: "Editalume",
      locale: "pt_BR",
      images: [
        {
          url: "/assets/leiprova-ecosystem.png",
          width: 1586,
          height: 992,
          alt: "Interface de estudo da Editalume em notebook, tablet e celular",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: result.opportunity.title,
      description: result.opportunity.summary,
      images: ["/assets/leiprova-ecosystem.png"],
    },
  };
}

export default async function ContestOpportunityPage({ params }: ContestOpportunityPageProps) {
  const { categoria, uf, slug } = await params;
  const result = await getPageOpportunity(categoria, uf, slug);
  if (!result) notFound();

  const { opportunity, jurisdiction } = result;
  const path = `/concursos/${categoria}/${uf}/${slug}`;
  const statusLabel = getOpportunityLifecycleLabel(opportunity.lifecycleStatus);
  const responsibleTypeLabel = getResponsibleTypeLabel(opportunity.responsibleType);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl(path)}#webpage`,
        url: absoluteUrl(path),
        name: opportunity.title,
        description: opportunity.summary,
        inLanguage: "pt-BR",
        isPartOf: { "@id": WEBSITE_ID },
        datePublished: opportunity.publishedAt?.toISOString(),
        dateModified: opportunity.updatedAt.toISOString(),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${absoluteUrl(path)}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl() },
          {
            "@type": "ListItem",
            position: 2,
            name: "Concursos",
            item: absoluteUrl("/concursos"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: opportunity.categoryName,
            item: absoluteUrl(`/concursos#${opportunity.categorySlug}`),
          },
          { "@type": "ListItem", position: 4, name: opportunity.title },
        ],
      },
    ],
  };

  return (
    <PublicGuideShell>
      <JsonLd data={structuredData} />
      <article className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-24">
        <nav aria-label="Navegação estrutural" className="mb-8 text-sm text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/">Início</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/concursos">Concursos</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/concursos#${opportunity.categorySlug}`}>{opportunity.categoryName}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{opportunity.title}</li>
          </ol>
        </nav>

        <div>
          <header className="max-w-4xl">
            <div className="mb-6 flex flex-wrap gap-3 text-sm font-extrabold uppercase tracking-[0.12em]">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-emerald-200">
                {statusLabel}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-slate-300">
                Situação em {formatOpportunityDate(opportunity.statusAsOf)}
              </span>
            </div>
            <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.18em] text-amber-300">
              {opportunity.categoryName} · {jurisdiction.name} · {opportunity.cycleYear}
            </p>
            <h1 className="text-balance text-4xl font-black leading-tight text-white sm:text-6xl">
              {opportunity.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              {opportunity.summary}
            </p>
          </header>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-7 sm:p-9" aria-labelledby="edicao-title">
              <h2 id="edicao-title" className="text-2xl font-black text-white">Situação oficial da edição</h2>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div><dt className="text-sm text-slate-400">Órgão</dt><dd className="mt-1 font-bold text-white">{opportunity.institutionName}</dd></div>
                <div><dt className="text-sm text-slate-400">Cargo</dt><dd className="mt-1 font-bold text-white">{opportunity.roleName}</dd></div>
                <div><dt className="text-sm text-slate-400">Inscrições</dt><dd className="mt-1 font-bold text-white">{formatOpportunityDate(opportunity.registrationStartsAt) ?? "Ainda não informadas"}{opportunity.registrationEndsAt ? ` a ${formatOpportunityDate(opportunity.registrationEndsAt)}` : ""}</dd></div>
                <div><dt className="text-sm text-slate-400">Prova</dt><dd className="mt-1 font-bold text-white">{formatOpportunityDate(opportunity.examDate) ?? "Ainda não informada"}</dd></div>
              </dl>
              {opportunity.officialUrl ? (
                <a className="mt-8 inline-flex font-extrabold text-amber-300 underline decoration-amber-300/40 underline-offset-4" href={opportunity.officialUrl} target="_blank" rel="noreferrer">
                  Conferir publicação oficial
                </a>
              ) : null}
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Fonte conferida em {formatOpportunityDate(opportunity.sourceCheckedAt)}. A publicação oficial prevalece sobre este resumo.
              </p>
            </section>

            <section className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.08] p-7 sm:p-9" aria-labelledby="responsavel-title">
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-amber-300">Sem seletor de banca</p>
              <h2 id="responsavel-title" className="mt-3 text-2xl font-black text-white">Responsável desta edição</h2>
              {opportunity.responsibleName ? (
                <div className="mt-6">
                  <p className="text-2xl font-black text-white">{opportunity.responsibleName}</p>
                  <p className="mt-2 text-slate-300">{responsibleTypeLabel}</p>
                  {opportunity.examinationProviderName && opportunity.examinationProviderName !== opportunity.responsibleName ? (
                    <p className="mt-2 text-sm text-slate-300">Elaboração/prova: {opportunity.examinationProviderName}</p>
                  ) : null}
                  {opportunity.bankName ? (
                    <p className="mt-2 text-sm text-slate-300">Perfil de estudo vinculado: {opportunity.bankName}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-6 leading-7 text-slate-300">
                  Ainda não há responsável primário confirmado em fonte oficial. O motor não herda a banca de outra edição e não libera um perfil por suposição.
                </p>
              )}
            </section>
          </div>

          <section className="mt-6 rounded-3xl border border-white/10 bg-[#0b1729] p-7 sm:p-9" aria-labelledby="analise-title">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-300">Análise responsável</p>
            <h2 id="analise-title" className="mt-3 text-3xl font-black text-white">Do edital ao simulado autoral</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              <div><strong className="text-white">1. Conteúdo vigente</strong><p className="mt-2 leading-7 text-slate-400">Edital, anexos e retificações são ligados à própria edição e revisados antes de aparecer.</p></div>
              <div><strong className="text-white">2. Janela histórica</strong><p className="mt-2 leading-7 text-slate-400">Amostra de até dez anos, com tamanho, critérios, direitos do corpus e limitações publicados.</p></div>
              <div><strong className="text-white">3. Questões originais</strong><p className="mt-2 leading-7 text-slate-400">Prazos, exceções e trocas de termos viram simulados autorais; frequência não é tratada como certeza.</p></div>
            </div>
          </section>

          <section className="mt-6 flex flex-col items-start justify-between gap-6 rounded-3xl bg-emerald-300 p-7 text-[#06111e] sm:flex-row sm:items-center sm:p-9">
            <div><p className="text-sm font-extrabold uppercase tracking-[0.16em]">Plano específico da edição</p><h2 className="mt-2 text-3xl font-black">Em preparação editorial</h2><p className="mt-2 max-w-2xl font-medium">Enquanto o plano específico não conclui a revisão humana, você pode ver como o treino funciona sem contratar um conteúdo ainda indisponível.</p></div>
            <Link className="shrink-0 rounded-2xl bg-[#071426] px-6 py-4 font-black text-white" href="/demo">
              Ver como funciona
            </Link>
          </section>
        </div>
      </article>
    </PublicGuideShell>
  );
}
