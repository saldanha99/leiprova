import type { Metadata } from "next";
import { BookOpenCheck, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { DemoStudySession } from "@/components/study/demo-study-session";
import { DEMO_QUESTIONS, type DemoQuestion } from "@/lib/demo-content";
import {
  ORGANIZATION_ID,
  SOCIAL_IMAGE,
  SOCIAL_IMAGE_PATH,
  WEBSITE_ID,
  absoluteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Demonstração gratuita",
  description:
    "Experimente uma sessão gratuita de treino de literalidade da Constituição Federal, com correção imediata e fonte oficial.",
  alternates: { canonical: "/demo" },
  openGraph: {
    type: "website",
    url: "/demo",
    title: "Demonstração gratuita | LeiProva",
    description:
      "Resolva cinco questões originais assistidas por IA de literalidade constitucional, com correção e fonte oficial.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Demonstração gratuita | LeiProva",
    description:
      "Resolva cinco questões originais assistidas por IA de literalidade constitucional, com correção e fonte oficial.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

const DEMO_SESSION_QUESTIONS = [
  DEMO_QUESTIONS[0],
  DEMO_QUESTIONS[3],
  DEMO_QUESTIONS[6],
  DEMO_QUESTIONS[8],
  DEMO_QUESTIONS[10],
] satisfies readonly DemoQuestion[];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${absoluteUrl("/demo")}#webpage`,
  url: absoluteUrl("/demo"),
  name: "Demonstração gratuita da LeiProva",
  description:
    "Sessão gratuita com cinco questões originais assistidas por IA de literalidade da Constituição Federal.",
  inLanguage: "pt-BR",
  isPartOf: { "@id": WEBSITE_ID },
  about: { "@id": ORGANIZATION_ID },
  dateModified: "2026-08-17",
};

export default function DemoPage() {
  const firstQuestion = DEMO_SESSION_QUESTIONS[0];

  return (
    <main className="bg-[#060b13] text-white">
      <JsonLd data={structuredData} />
      <section className="border-b border-white/8 bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,164,.12),transparent_34%),#07101b]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_.9fr] lg:items-center lg:py-16">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-amber-300">Demonstração pública</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Treine a literalidade antes de criar uma conta
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              A sessão abaixo contém cinco questões originais assistidas por IA da Constituição Federal. Você escolhe uma alternativa, declara sua confiança e recebe correção imediata com a redação e a fonte utilizadas. A revisão humana independente ainda não foi registrada.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
              <Link className="text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="/como-memorizar-lei-seca">
                Entender o método
              </Link>
              <Link className="text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="/fontes-e-atualizacao">
                Ver fontes e atualização
              </Link>
            </div>
          </div>
          <article className="rounded-[1.6rem] border border-white/10 bg-[#0a1420] p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">
                <BookOpenCheck aria-hidden="true" className="size-4" />
                Exemplo da sessão
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{firstQuestion.articleRef}</span>
            </div>
            <h2 className="mt-5 text-lg font-semibold leading-7 text-white">{firstQuestion.prompt}</h2>
            <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-slate-400">
              <ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-emerald-300" />
              Questão original assistida por IA. Texto conferido em {firstQuestion.verifiedAt.split("-").reverse().join("/")}.
            </p>
            <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200" href={firstQuestion.officialUrl} rel="noreferrer">
              Abrir a fonte oficial
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
            <p className="mt-4 text-[10px] leading-5 text-slate-600">
              Conteúdo meramente informativo e não oficial; não substitui a publicação no Diário Oficial da União.
            </p>
          </article>
        </div>
      </section>
      <DemoStudySession questions={DEMO_SESSION_QUESTIONS} />
    </main>
  );
}
