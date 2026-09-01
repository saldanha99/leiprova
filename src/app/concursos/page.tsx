import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileSearch,
  MapPinned,
  Scale,
  ShieldCheck,
} from "lucide-react";

import {
  GuideBreadcrumbs,
  PublicGuideShell,
} from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listReviewedContestOpportunities } from "@/lib/db/contest-opportunities";
import { contestCategories } from "@/lib/opportunities/categories";
import { getOpportunityJurisdictionByCode } from "@/lib/opportunities/jurisdictions";
import { getOpportunityLifecycleLabel } from "@/lib/opportunities/presentation";
import { createPublicWebPageStructuredData } from "@/lib/seo/page-structured-data";

const PAGE_PATH = "/concursos";
const PAGE_TITLE = "Concursos organizados por categoria, estado e edição";
const PAGE_DESCRIPTION =
  "Acompanhe como a LeiProva organiza concursos por categoria, estado e edição, com fonte oficial, situação do responsável e revisão humana antes da publicação.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "website",
    url: PAGE_PATH,
    title: `${PAGE_TITLE} | LeiProva`,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/assets/leiprova-ecosystem.png",
        width: 1586,
        height: 992,
        alt: "Interface de estudo da LeiProva em notebook, tablet e celular",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | LeiProva`,
    description: PAGE_DESCRIPTION,
    images: ["/assets/leiprova-ecosystem.png"],
  },
};

export const dynamic = "force-dynamic";

export const contestsStructuredData = createPublicWebPageStructuredData({
  path: PAGE_PATH,
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  breadcrumbs: [
    { name: "Início", path: "/" },
    { name: "Concursos", path: PAGE_PATH },
  ],
  about: [
    "Concursos públicos por categoria e estado",
    "Editais e pré-editais com fonte oficial",
    "Responsável por edição de concurso",
  ],
});

const PUBLICATION_CHECKS = [
  {
    icon: FileSearch,
    title: "Fonte oficial da edição",
    text: "Autorização, edital, retificação e calendário precisam apontar para o órgão, diário oficial ou organizadora oficialmente vinculada.",
  },
  {
    icon: Building2,
    title: "Situação do responsável",
    text: "A categoria não escolhe banca. Cada edição registra o responsável confirmado ou declara, no pré-edital, que ele ainda não foi definido oficialmente.",
  },
  {
    icon: ShieldCheck,
    title: "Revisão humana antes da página",
    text: "O robô pode detectar mudanças, mas não publica sozinho. Uma pessoa confere situação, datas, cargos, estado e evidências.",
  },
] as const;

export default async function ContestsPage() {
  const publicOpportunities = isDatabaseConfigured()
    ? await listReviewedContestOpportunities()
    : [];

  return (
    <PublicGuideShell>
      <JsonLd data={contestsStructuredData} />
      <article>
        <header className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,164,.15),transparent_35%),radial-gradient(circle_at_5%_20%,rgba(251,191,36,.1),transparent_30%),#07101b]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <GuideBreadcrumbs current="Concursos" />
            <div className="mt-9 grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                  Publicação controlada por evidência
                </p>
                <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
                  {PAGE_TITLE}
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                  A LeiProva está estruturando páginas específicas para editais abertos e pré-editais. Cada página só entra no catálogo público depois de confirmar a edição em fonte oficial, registrar se já existe responsável vigente e concluir revisão humana.
                </p>
              </div>

              <aside className="rounded-[1.7rem] border border-amber-300/20 bg-amber-300/[0.055] p-6 text-sm leading-7 text-amber-100/80">
                <p className="flex items-center gap-2 font-extrabold text-amber-200">
                  <BadgeCheck aria-hidden="true" className="size-5" />
                  Situação desta área
                </p>
                <p className="mt-3">
                  As oito categorias já estão definidas. Uma página de concurso específico continua fora do sitemap enquanto suas evidências e revisão editorial não estiverem completas.
                </p>
              </aside>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:py-20">
          <section aria-labelledby="edicoes-publicas-title">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">
                Catálogo vivo
              </p>
              <h2 id="edicoes-publicas-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Edições públicas e revisadas
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-400">
                Esta lista é alimentada somente por registros que concluíram as travas editoriais. Candidatos detectados pelo robô não aparecem aqui enquanto estiverem em revisão.
              </p>
            </div>

            {publicOpportunities.length > 0 ? (
              <div className="mt-9 grid gap-4 md:grid-cols-2">
                {publicOpportunities.map((opportunity) => {
                  const jurisdiction = getOpportunityJurisdictionByCode(opportunity.jurisdictionCode);
                  if (!jurisdiction) return null;
                  return (
                    <article key={opportunity.publicId} className="rounded-[1.6rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-300">
                        <span>{getOpportunityLifecycleLabel(opportunity.lifecycleStatus)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{jurisdiction.code}</span>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-white">{opportunity.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{opportunity.summary}</p>
                      <p className="mt-4 text-sm font-semibold text-slate-300">
                        Responsável: {opportunity.responsibleName ?? "ainda não definido em fonte oficial"}
                        {opportunity.examinationProviderName && opportunity.examinationProviderName !== opportunity.responsibleName
                          ? ` · prova: ${opportunity.examinationProviderName}`
                          : ""}
                      </p>
                      <Link
                        className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-amber-300"
                        href={`/concursos/${opportunity.categorySlug}/${jurisdiction.slug}/${opportunity.slug}`}
                      >
                        Ver página da edição
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-9 rounded-[1.6rem] border border-white/9 bg-[#0a1420] p-6 text-sm leading-7 text-slate-400">
                Nenhuma edição específica foi liberada neste ambiente ainda. Os sinais oficiais já detectados permanecem privados até a conferência humana.
              </div>
            )}
          </section>

          <section aria-labelledby="categorias-title">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">
                Oito frentes de acompanhamento
              </p>
              <h2 id="categorias-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Categorias do catálogo
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-400">
                A categoria serve para navegação e planejamento editorial. Estado, ano, estágio do concurso e responsável pertencem à edição concreta — nunca são herdados automaticamente de outra prova.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {contestCategories.map((category, index) => (
                <article id={category.slug} key={category.slug} className="scroll-mt-6 rounded-[1.6rem] border border-white/9 bg-[#0a1420] p-6">
                  <div className="flex items-start justify-between gap-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 font-mono text-sm font-extrabold text-emerald-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-bold text-slate-400">
                      revisão obrigatória
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-white">
                    {category.name}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{category.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="recorte-title" className="rounded-[2rem] border border-white/9 bg-[#08111d] p-6 sm:p-10">
            <div className="grid gap-9 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
              <div>
                <span className="grid size-14 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
                  <MapPinned aria-hidden="true" className="size-7" />
                </span>
                <h2 id="recorte-title" className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-white">
                  Uma página para a edição certa
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  O recorte público planejado é específico o bastante para não misturar fatos de concursos diferentes.
                </p>
              </div>
              <ol className="grid gap-3 sm:grid-cols-2">
                {["Categoria e carreira", "Estado ou âmbito federal", "Órgão, cargo e ano", "Situação e responsável da edição"].map((item, index) => (
                  <li key={item} className="flex min-h-24 items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <span className="font-mono text-sm font-extrabold text-amber-300">{index + 1}</span>
                    <span className="text-sm font-semibold leading-6 text-slate-200">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section aria-labelledby="travas-title">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">
                Travas de publicação
              </p>
              <h2 id="travas-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                O que precisa existir antes de um concurso aparecer
              </h2>
            </div>
            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {PUBLICATION_CHECKS.map((check) => {
                const Icon = check.icon;
                return (
                  <article key={check.title} className="rounded-[1.5rem] border border-white/9 bg-[#0a1420] p-6">
                    <Icon aria-hidden="true" className="size-6 text-emerald-300" />
                    <h3 className="mt-5 text-lg font-semibold text-white">{check.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{check.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,.14),transparent_48%),#0b1624] p-6 sm:p-9">
            <Scale aria-hidden="true" className="size-6 text-amber-300" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
              Transparência vem antes da pressa
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Uma página ausente é preferível a uma página que atribui banca, prazo ou conteúdo programático sem prova oficial. Veja como detecção, estatística e revisão devem funcionar antes da publicação.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-200" href="/metodologia">
                Conhecer a metodologia
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link className="inline-flex min-h-12 items-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:text-white" href="/fontes-e-atualizacao">
                Ver política de fontes
              </Link>
            </div>
          </aside>
        </div>
      </article>
    </PublicGuideShell>
  );
}
