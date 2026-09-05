import type { Metadata } from "next";
import { BookOpenCheck, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { DemoStudySession } from "@/components/study/demo-study-session";
import { DEMO_CONTENT_PROVENANCE, DEMO_QUESTIONS, type DemoQuestion } from "@/lib/demo-content";
import {
  describeDemoEditorialState,
  resolvePublicDemoSurface,
} from "@/lib/editorial/public-demo-policy";
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
    "Conheça o treino de literalidade da lei: mecânica da sessão, correção imediata e fonte oficial. Conteúdo jurídico só é publicado após revisão humana registrada.",
  alternates: { canonical: "/demo" },
  openGraph: {
    type: "website",
    url: "/demo",
    title: "Demonstração gratuita | Editalume",
    description:
      "Veja a mecânica do treino de literalidade. O conteúdo jurídico só é publicado após revisão humana registrada.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Demonstração gratuita | Editalume",
    description:
      "Veja a mecânica do treino de literalidade. O conteúdo jurídico só é publicado após revisão humana registrada.",
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

/**
 * Portão editorial. Conteúdo jurídico só é servido nesta página quando a
 * revisão humana estiver registrada; caso contrário mostramos o estado
 * editorial e uma demonstração neutra da interface. O acervo continua
 * declarado acima e não é apagado.
 */
const demoSurface = resolvePublicDemoSurface({
  provenance: DEMO_CONTENT_PROVENANCE,
  questions: DEMO_SESSION_QUESTIONS,
});
const editorialState = describeDemoEditorialState(demoSurface);

const INTERFACE_STEPS = [
  {
    title: "Escolha uma alternativa",
    detail: "Cada item apresenta a redação em disputa e alternativas próximas entre si.",
  },
  {
    title: "Declare sua confiança",
    detail: "Chutei, quase certo ou tenho certeza. É isso que calibra a próxima revisão.",
  },
  {
    title: "Receba a correção na hora",
    detail: "A correção mostra a redação usada e o link para a fonte oficial consultada.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${absoluteUrl("/demo")}#webpage`,
  url: absoluteUrl("/demo"),
  name: "Demonstração gratuita da Editalume",
  description:
    "Demonstração pública do treino de literalidade da lei. O conteúdo jurídico só é publicado após revisão humana registrada.",
  inLanguage: "pt-BR",
  isPartOf: { "@id": WEBSITE_ID },
  about: { "@id": ORGANIZATION_ID },
  dateModified: "2026-08-17",
};

export default function DemoPage() {
  return (
    <main className="bg-[#060b13] text-white">
      <JsonLd data={structuredData} />
      <section className="border-b border-white/8 bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,164,.12),transparent_34%),#07101b]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_.9fr] lg:items-center lg:py-16">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-amber-300">Demonstração pública</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              {demoSurface.kind === "reviewed_session"
                ? "Treine a literalidade antes de criar uma conta"
                : "Veja como o treino de literalidade funciona"}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              {demoSurface.kind === "reviewed_session"
                ? "A sessão abaixo contém cinco questões da Constituição Federal já revisadas. Você escolhe uma alternativa, declara sua confiança e recebe correção imediata com a redação e a fonte utilizadas."
                : "Abaixo está a mecânica do treino, passo a passo. As questões desta demonstração ainda estão em revisão humana, então nenhuma delas é exibida aqui como material de estudo."}
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
          {demoSurface.kind === "reviewed_session" ? (
            <article className="rounded-[1.6rem] border border-white/10 bg-[#0a1420] p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">
                  <BookOpenCheck aria-hidden="true" className="size-4" />
                  Exemplo da sessão
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                  {demoSurface.questions[0].articleRef}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold leading-7 text-white">{demoSurface.questions[0].prompt}</h2>
              <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-slate-400">
                <ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-emerald-300" />
                Questão revisada. Texto conferido em{" "}
                {demoSurface.questions[0].verifiedAt.split("-").reverse().join("/")}.
              </p>
              <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200" href={demoSurface.questions[0].officialUrl} rel="noreferrer">
                Abrir a fonte oficial
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
              <p className="mt-4 text-[10px] leading-5 text-slate-600">
                Conteúdo meramente informativo e não oficial; não substitui a publicação no Diário Oficial da União.
              </p>
            </article>
          ) : (
            <article
              aria-labelledby="demo-estado-editorial"
              className="rounded-[1.6rem] border border-amber-300/25 bg-[#0a1420] p-6"
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-300">
                <ShieldCheck aria-hidden="true" className="size-4" />
                Estado editorial
              </span>
              <h2 id="demo-estado-editorial" className="mt-5 text-lg font-semibold leading-7 text-white">
                Conteúdo jurídico em revisão humana
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{editorialState}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Itens aguardando revisão</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{demoSurface.pendingCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Norma coberta</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-300">
                    {demoSurface.legalActs.join(", ") || "—"}
                  </dd>
                </div>
              </dl>
              <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200"
                href="/fontes-e-atualizacao"
              >
                Como revisamos e publicamos
                <ExternalLink aria-hidden="true" className="size-4" />
              </Link>
            </article>
          )}
        </div>
      </section>
      {demoSurface.kind === "reviewed_session" ? (
        <DemoStudySession questions={demoSurface.questions} />
      ) : (
        <section aria-labelledby="demo-interface" className="mx-auto max-w-6xl px-5 py-12">
          <h2 id="demo-interface" className="text-2xl font-semibold tracking-[-0.03em]">
            A mecânica do treino
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Demonstração neutra da interface, sem afirmação jurídica. Quando a revisão humana estiver registrada, esta
            mesma tela passa a rodar a sessão real de questões.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {INTERFACE_STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-white/10 bg-[#0a1420] p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/5 text-sm font-bold text-amber-300">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-start gap-2 text-xs leading-6 text-slate-500">
            <BookOpenCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-600" />
            Nenhuma questão jurídica é servida nesta página enquanto a revisão humana não estiver registrada.
          </p>
        </section>
      )}
    </main>
  );
}
