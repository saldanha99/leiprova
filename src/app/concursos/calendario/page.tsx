import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, ExternalLink } from "lucide-react";

import {
  GuideBreadcrumbs,
  PublicGuideShell,
} from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { catalogContestPath, getCatalogContest } from "@/lib/commerce/catalog";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listContestCalendarOpportunities } from "@/lib/db/contest-opportunities";
import {
  daysUntil,
  groupContestCalendar,
  isTerminalLifecycleStatus,
  type ContestCalendarPhase,
} from "@/lib/opportunities/calendar";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";
import {
  formatOpportunityDate,
  getOpportunityLifecycleLabel,
} from "@/lib/opportunities/presentation";
import { createPublicWebPageStructuredData } from "@/lib/seo/page-structured-data";

const PAGE_PATH = "/concursos/calendario";
const PAGE_TITLE = "Calendário de concursos: inscrições, provas e encerrados";
const PAGE_DESCRIPTION =
  "Inscrições abertas, provas marcadas, concursos previstos e encerrados, com datas conferidas na fonte oficial de cada edital.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "website",
    url: PAGE_PATH,
    title: `${PAGE_TITLE} | Editalume`,
    description: PAGE_DESCRIPTION,
  },
};

export const dynamic = "force-dynamic";

const structuredData = createPublicWebPageStructuredData({
  path: PAGE_PATH,
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  breadcrumbs: [
    { name: "Início", path: "/" },
    { name: "Concursos", path: "/concursos" },
    { name: "Calendário", path: PAGE_PATH },
  ],
  about: [
    "Calendário de concursos públicos",
    "Inscrições abertas e provas marcadas",
    "Concursos encerrados",
  ],
});

type CalendarItem = Awaited<
  ReturnType<typeof listContestCalendarOpportunities>
>[number];

function badge(item: CalendarItem, phase: ContestCalendarPhase) {
  // Prova passada é encerrado mesmo que a fase gravada ainda não tenha avançado.
  if (phase === "closed" && !isTerminalLifecycleStatus(item.lifecycleStatus)) {
    return "Prova realizada";
  }
  return getOpportunityLifecycleLabel(item.lifecycleStatus);
}

function keyDate(item: CalendarItem, phase: ContestCalendarPhase, todayIso: string) {
  const exam = formatOpportunityDate(item.examDate);
  switch (phase) {
    case "registration_open": {
      const ends = formatOpportunityDate(item.registrationEndsAt);
      return [ends && `Inscrições até ${ends}`, exam && `prova em ${exam}`]
        .filter(Boolean)
        .join(" · ");
    }
    case "registration_soon": {
      const starts = formatOpportunityDate(item.registrationStartsAt);
      return starts ? `Inscrições a partir de ${starts}` : "Cronograma de inscrição a confirmar";
    }
    case "exam_upcoming": {
      if (!item.examDate || !exam) return null;
      const days = daysUntil(todayIso, item.examDate);
      return days === 0 ? `Prova hoje, ${exam}` : `Prova em ${exam} · faltam ${days} dias`;
    }
    case "forecast":
      return "Edital ainda não publicado";
    case "closed":
      return exam ? `Prova realizada em ${exam}` : null;
  }
}

export default async function ContestCalendarPage() {
  const todayIso = saoPauloCalendarDate();
  const sections = isDatabaseConfigured()
    ? groupContestCalendar(await listContestCalendarOpportunities(), todayIso)
    : [];

  return (
    <PublicGuideShell>
      <JsonLd data={structuredData} />
      <article>
        <header className="border-b border-white/8 bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,164,.15),transparent_35%),#07101b]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <GuideBreadcrumbs
              current="Calendário"
              parent={{ label: "Concursos", href: "/concursos" }}
            />
            <p className="mt-9 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              <CalendarDays aria-hidden="true" className="size-4" />
              Calendário de concursos
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
              O que abre, o que tem prova e o que já passou.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Cada data vem do edital oficial conferido pela equipe. Quando o
              prazo de inscrição ou a prova passa, o concurso muda de seção
              sozinho, e os encerrados ficam aqui por um ano.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-16 px-5 py-16 sm:py-20">
          {sections.length === 0 ? (
            <div className="rounded-[1.6rem] border border-white/9 bg-[#0a1420] p-6 text-sm leading-7 text-slate-400">
              Nenhum edital revisado neste ambiente ainda.
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.phase} aria-labelledby={`calendario-${section.phase}`}>
                <div className="max-w-3xl">
                  <h2
                    id={`calendario-${section.phase}`}
                    className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl"
                  >
                    {section.title}{" "}
                    <span className="text-lg font-bold text-slate-500">
                      ({section.items.length})
                    </span>
                  </h2>
                  <p className="mt-3 text-base leading-8 text-slate-400">
                    {section.description}
                  </p>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {section.items.map((item) => {
                    const contest = item.productSlug ? getCatalogContest(item.productSlug) : null;
                    const closed = section.phase === "closed";
                    const date = keyDate(item, section.phase, todayIso);
                    return (
                      <article
                        key={item.publicId}
                        className={
                          closed
                            ? "rounded-[1.6rem] border border-white/8 bg-white/[0.02] p-6"
                            : "rounded-[1.6rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-6"
                        }
                      >
                        <div
                          className={`flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] ${closed ? "text-slate-500" : "text-emerald-300"}`}
                        >
                          <span>{badge(item, section.phase)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.jurisdictionCode}</span>
                          {item.bankName ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{item.bankName}</span>
                            </>
                          ) : null}
                        </div>
                        <h3 className={`mt-4 text-xl font-semibold ${closed ? "text-slate-300" : "text-white"}`}>
                          {item.title}
                        </h3>
                        {date ? (
                          <p className="mt-3 text-sm font-semibold text-amber-200/90">{date}</p>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-extrabold">
                          {contest && !closed ? (
                            <Link
                              className="inline-flex items-center gap-2 text-amber-300"
                              href={catalogContestPath(contest)}
                            >
                              Ver concurso
                              <ArrowRight aria-hidden="true" className="size-4" />
                            </Link>
                          ) : null}
                          {item.officialUrl ? (
                            <a
                              className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
                              href={item.officialUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Fonte oficial
                              <ExternalLink aria-hidden="true" className="size-4" />
                            </a>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </article>
    </PublicGuideShell>
  );
}
