import type { Metadata } from "next";
import Link from "next/link";

import { PublicGuideShell } from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { AuthorNotice, Breadcrumbs, Section } from "@/components/seo/legal/blocks";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listLawSnapshots } from "@/lib/seo/legal-data";
import { brDate } from "@/lib/seo/legal-format";
import { lawHeadline, lawsHubJsonLd } from "@/lib/seo/legal-views";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

const PATH = "/leis";
const TITLE = "Leis para concursos: texto oficial e questões";
const DESCRIPTION =
  "Normas cobradas nos editais acompanhados pelo Edital Lei Seca, com texto oficial por artigo, data de verificação da fonte e questões inéditas resolvidas.";

export const metadata: Metadata = buildMetadata({ path: PATH, title: TITLE, description: DESCRIPTION, index: true });

export default async function LawsHubPage() {
  const snapshots = isDatabaseConfigured() ? await listLawSnapshots() : [];
  const laws = snapshots.filter((snapshot) => snapshot.articles.length > 0);
  const now = new Date();

  return (
    <PublicGuideShell>
      <JsonLd data={lawsHubJsonLd(laws.map((law) => ({ label: lawHeadline(law), path: law.path })), DESCRIPTION)} />
      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Breadcrumbs
          crumbs={[
            { name: "Início", path: "/" },
            { name: "Leis", path: PATH },
          ]}
        />
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Leis cobradas em concursos</h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          {laws.length} normas com texto oficial verificado, em ordem de presença nos programas das preparações acompanhadas
          pelo Edital Lei Seca. Contagens de questões da nossa base em {brDate(now)}.
        </p>
        <Section id="lista" title="Normas">
          <ul className="divide-y divide-white/5">
            {laws.map((law) => (
              <li className="flex items-baseline justify-between gap-4 py-3" key={law.path}>
                <Link className="font-semibold text-amber-300 hover:underline" href={law.path}>
                  {lawHeadline(law)}
                </Link>
                <span className="shrink-0 text-sm text-slate-400">{law.reviewedQuestionCount} questões</span>
              </li>
            ))}
          </ul>
        </Section>
        <AuthorNotice withQuestions={false} />
      </article>
    </PublicGuideShell>
  );
}
