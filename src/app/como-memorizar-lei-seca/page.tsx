import type { Metadata } from "next";
import {
  ArrowDown,
  BookOpen,
  BrainCircuit,
  Compass,
  MapPinned,
  RefreshCw,
  Route,
  ShieldCheck,
  Target,
} from "lucide-react";

import {
  GuideBreadcrumbs,
  GuideCta,
  PublicGuideShell,
} from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  absoluteUrl,
} from "@/lib/seo";

const PAGE_PATH = "/como-memorizar-lei-seca";
const PAGE_TITLE = "Como memorizar lei seca para concursos";
const PAGE_DESCRIPTION =
  "Aprenda um método prático de leitura curta, recuperação ativa, correção e revisão espaçada para memorizar a literalidade da lei sem abandonar a compreensão.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "article",
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

const FAQS = [
  {
    question: "Só reler a lei seca é suficiente para memorizar?",
    answer:
      "A releitura ajuda a reencontrar o texto, mas não comprova que você consegue recuperá-lo sem apoio. Por isso, a LeiProva combina leitura com questões, correção e novas tentativas distribuídas no tempo.",
  },
  {
    question: "Qual é o melhor intervalo de revisão?",
    answer:
      "Não existe um calendário universal que sirva igualmente para toda pessoa e todo artigo. Na plataforma, acerto, erro e confiança declarada ajustam a próxima revisão; os intervalos são uma regra operacional de estudo, não uma promessa biológica exata.",
  },
  {
    question: "Memorizar a literalidade substitui compreender a matéria?",
    answer:
      "Não. Literalidade e compreensão cumprem papéis diferentes. O treino de texto legal ajuda em itens que cobram palavras, prazos, competências e exceções, mas deve ser combinado com teoria, jurisprudência e resolução contextualizada conforme o edital.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Article", "WebPage"],
      "@id": `${absoluteUrl(PAGE_PATH)}#article`,
      url: absoluteUrl(PAGE_PATH),
      name: PAGE_TITLE,
      headline: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      inLanguage: "pt-BR",
      datePublished: "2026-08-17",
      dateModified: "2026-08-17",
      isPartOf: { "@id": WEBSITE_ID },
      author: { "@id": ORGANIZATION_ID },
      publisher: { "@id": ORGANIZATION_ID },
      mainEntityOfPage: absoluteUrl(PAGE_PATH),
      about: [
        { "@type": "Thing", name: "Lei seca para concursos" },
        { "@type": "Thing", name: "Prática de recuperação" },
        { "@type": "Thing", name: "Prática distribuída" },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${absoluteUrl(PAGE_PATH)}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Início",
          item: absoluteUrl(),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: PAGE_TITLE,
          item: absoluteUrl(PAGE_PATH),
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${absoluteUrl(PAGE_PATH)}#perguntas`,
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

const STEPS = [
  {
    number: "01",
    icon: BookOpen,
    title: "Leia um trecho curto na fonte",
    text: "Delimite artigo, inciso ou parágrafo. Identifique verbos, condições, prazos, exceções e o sujeito da regra.",
  },
  {
    number: "02",
    icon: Target,
    title: "Tente recuperar sem olhar",
    text: "Responda a uma alternativa literal ou complete a ideia antes de voltar ao texto. O esforço de lembrar faz parte do treino.",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Compare com a redação oficial",
    text: "Veja qual palavra mudou e por que o distrator parecia correto. A fonte e a data de verificação precisam permanecer visíveis.",
  },
  {
    number: "04",
    icon: RefreshCw,
    title: "Volte em outro momento",
    text: "Erros e respostas inseguras retornam antes. Acertos consistentes podem ganhar intervalos maiores, sempre sujeitos a nova revisão.",
  },
] as const;

export default function MemorizeDryLawPage() {
  return (
    <PublicGuideShell>
      <JsonLd data={structuredData} />
      <article>
        <header className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_80%_10%,rgba(45,212,164,.13),transparent_34%),radial-gradient(circle_at_10%_0%,rgba(251,191,36,.12),transparent_32%),#07101b]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <GuideBreadcrumbs current="Como memorizar lei seca" />
            <div className="mt-9 grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                  Método LeiProva
                </p>
                <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
                  Como memorizar lei seca sem depender só da releitura
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                  Leia um trecho curto, tente recuperar a redação sem olhar, corrija a diferença e volte ao artigo em sessões espaçadas. Essa sequência transforma a lei em prática verificável — sem prometer aprovação e sem substituir compreensão, jurisprudência ou edital.
                </p>
                <p className="mt-5 text-sm text-slate-500">
                  Publicado pela LeiProva em 17 de agosto de 2026; fontes científicas conferidas nesta data.
                </p>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#0a1522]/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
                <div className="flex items-center gap-3 text-amber-300">
                  <Route aria-hidden="true" className="size-6" />
                  <span className="text-xs font-extrabold uppercase tracking-[0.16em]">A metáfora da rota</span>
                </div>
                <p className="mt-5 text-2xl font-semibold leading-9 tracking-[-0.035em] text-white">
                  Um caminho repetido deixa de exigir GPS o tempo todo.
                </p>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  No estudo, cada tentativa ajuda você a reconhecer os “marcos” do artigo: quem pode agir, em qual condição, dentro de qual prazo e com qual exceção. É uma analogia para orientar a prática, não uma medição literal do cérebro.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:py-20">
          <section aria-labelledby="sequencia-title">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">Sequência prática</p>
              <h2 id="sequencia-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Quatro movimentos em uma sessão curta
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-400">
                A plataforma usa questões de múltipla escolha para exigir uma decisão antes de mostrar a correção. Assim, “parece familiar” e “consigo lembrar” deixam de ser a mesma coisa.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-2">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.number} className="rounded-[1.6rem] border border-white/9 bg-[#0a1420] p-6">
                    <div className="flex items-center justify-between">
                      <span className="grid size-11 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-600">{step.number}</span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-white">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="rota-title" className="rounded-[2rem] border border-white/9 bg-[#08111d] p-6 sm:p-10">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div>
                <span className="grid size-14 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-300">
                  <MapPinned aria-hidden="true" className="size-7" />
                </span>
                <h2 id="rota-title" className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-white">
                  O que muda quando você percorre a mesma rota
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  A dificuldade não desaparece de forma mágica. Você cria referências recuperáveis e descobre em quais trechos ainda se perde.
                </p>
              </div>
              <ol className="space-y-3">
                {[
                  [Compass, "Primeira passagem", "Você consulta mais, hesita e percebe os detalhes que nunca tinha isolado."],
                  [Route, "Novas passagens", "Prazos, exceções e competências começam a funcionar como marcos do caminho."],
                  [BrainCircuit, "Recuperação na prova", "O objetivo é acessar a redação com menos pistas externas — sem confundir familiaridade com domínio."],
                ].map(([Icon, title, text], index) => (
                  <li key={title as string} className="relative flex gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-emerald-300">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{title as string}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{text as string}</p>
                    </div>
                    {index < 2 && <ArrowDown aria-hidden="true" className="absolute -bottom-3 left-8 z-10 size-4 text-slate-600" />}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section aria-labelledby="evidencias-title" className="grid gap-8 lg:grid-cols-[1fr_.75fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">O que sustenta o método</p>
              <h2 id="evidencias-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white">
                Recuperação ativa e prática distribuída
              </h2>
              <div className="mt-6 space-y-5 text-sm leading-7 text-slate-400">
                <p>
                  A prática de recuperação exige tentar lembrar antes de rever. Em experimento publicado na revista <em>Science</em>, a recuperação repetida teve efeito positivo sobre a lembrança posterior, enquanto apenas continuar estudando itens já aprendidos não produziu o mesmo resultado naquele desenho experimental.
                </p>
                <p>
                  A prática distribuída separa episódios de estudo no tempo. Uma síntese de 317 experimentos mostrou que intervalo entre sessões e prazo até o teste interagem; isso é justamente o motivo para não vender uma “curva” única com dias universais.
                </p>
                <p>
                  Uma revisão ampla de técnicas de aprendizagem classificou testes práticos e prática distribuída como estratégias de alta utilidade. Esses resultados apoiam o desenho do treino, mas não autorizam prometer nota, aprovação ou um ganho percentual fixo para todo aluno.
                </p>
              </div>
            </div>
            <aside className="rounded-[1.6rem] border border-white/9 bg-[#0a1420] p-6">
              <h3 className="font-semibold text-white">Fontes científicas consultadas</h3>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-400">
                <li>
                  <a className="font-semibold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="https://doi.org/10.1126/science.1152408" rel="noreferrer">
                    Karpicke &amp; Roediger (2008), Science
                  </a>
                  <p className="mt-1">Recuperação repetida e retenção posterior.</p>
                </li>
                <li>
                  <a className="font-semibold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="https://pubmed.ncbi.nlm.nih.gov/16719566/" rel="noreferrer">
                    Cepeda et al. (2006), Psychological Bulletin
                  </a>
                  <p className="mt-1">Síntese quantitativa sobre prática distribuída.</p>
                </li>
                <li>
                  <a className="font-semibold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="https://doi.org/10.1177/1529100612453266" rel="noreferrer">
                    Dunlosky et al. (2013), Psychological Science in the Public Interest
                  </a>
                  <p className="mt-1">Revisão de dez técnicas de aprendizagem.</p>
                </li>
              </ul>
            </aside>
          </section>

          <section aria-labelledby="faq-metodo-title">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">Perguntas objetivas</p>
            <h2 id="faq-metodo-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white">
              O que considerar antes de montar a rotina
            </h2>
            <div className="mt-8 space-y-3">
              {FAQS.map((item, index) => (
                <details key={item.question} open={index === 0} className="rounded-2xl border border-white/9 bg-[#0a1420] p-5 open:border-amber-300/20">
                  <summary className="cursor-pointer list-none pr-4 font-semibold text-white">{item.question}</summary>
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <GuideCta
            title="Faça a primeira passagem sem depender de cadastro"
            description="A demonstração usa questões originais assistidas por IA de Direito Constitucional, mostra a fonte oficial e corrige a palavra que mudou. A revisão humana independente ainda está pendente e o progresso fica apenas no seu navegador."
          />
        </div>
      </article>
    </PublicGuideShell>
  );
}
