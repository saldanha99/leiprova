import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";

import {
  GuideBreadcrumbs,
  PublicGuideShell,
} from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { ContestCatalogBrowser } from "@/components/contests/contest-catalog-browser";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listContestCalendarOpportunities } from "@/lib/db/contest-opportunities";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import type { PreparationMode } from "@/lib/commerce/preparation-mode";
import { buildContestShowcase } from "@/lib/commerce/contest-showcase";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";
import { createPublicWebPageStructuredData } from "@/lib/seo/page-structured-data";

const PAGE_PATH = "/concursos";
const PAGE_TITLE = "Concursos organizados por categoria, estado e edição";
const PAGE_DESCRIPTION =
  "Encontre preparações de lei seca por carreira, banca e estado. Acompanhe novidades, inscrições abertas, pré-editais e provas realizadas na Edital Lei Seca.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "website",
    url: PAGE_PATH,
    title: `${PAGE_TITLE} | Edital Lei Seca`,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/brand/edital-lei-seca-social.png",
        width: 1200,
        height: 630,
        alt: "Edital Lei Seca — lei seca guiada pelo edital",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | Edital Lei Seca`,
    description: PAGE_DESCRIPTION,
    images: ["/brand/edital-lei-seca-social.png"],
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

export default async function ContestsPage() {
  const referenceDate = new Date();
  const [opportunities, released] = isDatabaseConfigured()
    ? await Promise.all([listContestCalendarOpportunities(referenceDate), listReleasedContestProducts()])
    : [[], []];
  const cards = buildContestShowcase(opportunities, released.map((item) => item.slug), saoPauloCalendarDate(referenceDate),
    Object.fromEntries(released.map((item) => [item.slug, item.preparationMode as PreparationMode])));

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
                  Seu próximo capítulo
                </p>
                <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
                  Seu próximo concurso começa aqui.
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                  Da primeira leitura à reta final: encontre a preparação para
                  seu objetivo. Filtre por carreira, banca e estado e acompanhe
                  os editais abertos, as novidades e as provas já realizadas.
                </p>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
                  <a
                    href="#catalogo-planejado"
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
                  >
                    Explorar os concursos{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                  <Link
                    href="/concursos/calendario"
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-300 underline underline-offset-4"
                  >
                    Calendário: inscrições, provas e encerrados{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <aside className="rounded-[1.7rem] border border-amber-300/20 bg-amber-300/[0.055] p-6 text-sm leading-7 text-amber-100/80">
                <p className="flex items-center gap-2 font-extrabold text-amber-200">
                  <BadgeCheck aria-hidden="true" className="size-5" />
                  Um objetivo ou vários caminhos?
                </p>
                <p className="mt-3">
                  Cada edição tem sua proposta de acesso avulso. O Master reúne
                  os concursos liberados durante a assinatura. Compare abaixo:
                  páginas em preparação ainda não estão disponíveis para compra.
                </p>
              </aside>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:py-20">
          <ContestCatalogBrowser cards={cards} />
          <aside className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.035] p-7">
            <h2 className="text-2xl font-semibold text-white">Estude com direção.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Cada preparação segue o cargo e o programa da sua edição. Leia a lei,
              treine a literalidade e volte aos pontos que precisam de revisão.
              Os cards indicam quando o material já está disponível.
            </p>
            <Link className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-amber-300" href="/metodologia">
              Conhecer o método <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </article>
    </PublicGuideShell>
  );
}
