import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  Bot,
  Building2,
  ExternalLink,
  FileCheck2,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  GuideBreadcrumbs,
  PublicGuideShell,
} from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { createPublicWebPageStructuredData } from "@/lib/seo/page-structured-data";

const PAGE_PATH = "/metodologia";
const PAGE_TITLE = "Como editais viram prioridades de estudo e simulados";
const PAGE_DESCRIPTION =
  "Entenda as regras da LeiProva para detectar editais em fontes oficiais, validar a edição e seu responsável, analisar evidências e publicar simulados originais com revisão humana.";

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

export const methodologyStructuredData = createPublicWebPageStructuredData({
  path: PAGE_PATH,
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  breadcrumbs: [
    { name: "Início", path: "/" },
    { name: "Metodologia", path: PAGE_PATH },
  ],
  about: [
    "Monitoramento de editais",
    "Análise estatística de incidência em concursos",
    "Simulados autorais de lei seca",
    "Revisão humana de conteúdo jurídico",
  ],
});

const PIPELINE = [
  {
    icon: SearchCheck,
    title: "1. Detectar em fonte oficial",
    text: "O motor procura sinais em páginas do órgão, diário oficial, portal de contratações e organizadora já confirmada. Busca e agregadores podem ajudar a encontrar uma pista, mas não comprovam o fato.",
  },
  {
    icon: FileCheck2,
    title: "2. Validar a edição",
    text: "Uma pessoa confere órgão, cargo, estado, ano, situação, datas e documento. Retificação nova gera nova conferência; não sobrescreve silenciosamente o histórico.",
  },
  {
    icon: Building2,
    title: "3. Fixar o responsável vigente",
    text: "O vínculo é da edição, não da categoria. O responsável pode ser banca externa, comissão institucional ou arranjo híbrido. Em pré-edital, ele pode ainda não ter sido escolhido.",
  },
  {
    icon: BarChart3,
    title: "4. Medir o que os dados permitem",
    text: "A análise registra período, amostra, origem e direitos do corpus. Frequência, recência e aderência ao edital viram sinais de prioridade — nunca certeza de que um artigo cairá.",
  },
  {
    icon: Sparkles,
    title: "5. Produzir questões autorais",
    text: "Simulados partem do conteúdo programático e do texto legal oficial. Questões anteriores só entram com licença ou autorização documentada; disponibilidade pública não basta.",
  },
  {
    icon: ShieldCheck,
    title: "6. Revisar e publicar",
    text: "A revisão humana confere fonte, vigência, gabarito, explicação, linguagem e limites estatísticos. Só então a página específica se torna pública e pode entrar no sitemap.",
  },
] as const;

const STATISTICAL_SIGNALS = [
  {
    title: "Incidência observada",
    text: "Quantidade e proporção de itens por disciplina, norma, assunto e artigo dentro do corpus autorizado.",
  },
  {
    title: "Recência e persistência",
    text: "Diferença entre um pico isolado e uma cobrança que se repete em várias edições, com o período sempre declarado.",
  },
  {
    title: "Aderência ao edital atual",
    text: "Um tema histórico só recebe prioridade se permanecer no conteúdo programático e na legislação vigente da edição acompanhada.",
  },
  {
    title: "Mudança legislativa relevante",
    text: "Alterações de prazo, competência, condição ou termo técnico são marcadas para revisão, sem presumir que a mudança será cobrada.",
  },
] as const;

export default function MethodologyPage() {
  return (
    <PublicGuideShell>
      <JsonLd data={methodologyStructuredData} />
      <article>
        <header className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_82%_5%,rgba(105,167,255,.15),transparent_36%),radial-gradient(circle_at_8%_15%,rgba(45,212,164,.1),transparent_30%),#07101b]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <GuideBreadcrumbs current="Metodologia" />
            <div className="mt-9 max-w-5xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-300">
                Política pública de produto e conteúdo
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
                {PAGE_TITLE}
              </h1>
              <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-300">
                O motor proposto separa três trabalhos: descobrir mudanças, medir evidências e publicar conteúdo. Automação acelera os dois primeiros; fonte oficial e revisão humana continuam sendo obrigatórias antes de qualquer edital, responsável, estimativa ou questão aparecer como informação pública.
              </p>
              <p className="mt-5 text-sm leading-7 text-slate-400">
                Esta página descreve a política de implementação. Ela não afirma que todos os conectores, análises históricas ou páginas específicas já estejam operando.
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:py-20">
          <section aria-labelledby="fluxo-title">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">
                Do sinal à publicação
              </p>
              <h2 id="fluxo-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Seis etapas com evidência e responsabilidade
              </h2>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-2">
              {PIPELINE.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="rounded-[1.6rem] border border-white/9 bg-[#0a1420] p-6">
                    <Icon aria-hidden="true" className="size-6 text-emerald-300" />
                    <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-white">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="responsavel-title" className="rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,.12),transparent_40%),#08111d] p-6 sm:p-10">
            <div className="grid gap-9 lg:grid-cols-[.72fr_1.28fr]">
              <div>
                <Building2 aria-hidden="true" className="size-7 text-amber-300" />
                <h2 id="responsavel-title" className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-white">
                  Categoria não é banca
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  A mesma carreira pode ter responsáveis diferentes a cada ano e em cada estado. Por isso, a interface não deve oferecer quatro bancas livres para uma edição concreta.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Organizadora externa", "Instituição contratada para organizar ou elaborar a prova, quando confirmada oficialmente."],
                  ["Comissão institucional", "O próprio órgão conduz a edição; não se inventa uma banca de questões."],
                  ["Modelo híbrido", "Papéis de responsabilidade, elaboração e logística ficam separados e documentados."],
                ].map(([title, text]) => (
                  <article key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="estatistica-title">
            <div className="grid gap-10 lg:grid-cols-[1fr_.9fr]">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">
                  Estatística com limites visíveis
                </p>
                <h2 id="estatistica-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                  Dez anos é uma janela possível, não um número mágico
                </h2>
                <p className="mt-5 text-sm leading-7 text-slate-400">
                  A janela histórica pode chegar a dez anos quando existirem provas comparáveis, fonte identificada e direito de uso documentado. Se a amostra for menor, a página deve mostrar exatamente o período e a quantidade analisada. Nenhum percentual deve ser apresentado como “chance de cair” sem método, denominador e incerteza explicados.
                </p>
                <p className="mt-4 rounded-2xl border border-white/9 bg-white/[0.025] p-5 text-sm leading-7 text-slate-400">
                  No modelo inicial versionado, o ranking combina incidência histórica (35%), recência (20%), persistência entre anos (15%), aderência ao edital atual (25%) e relevância de mudança legislativa (5%). A incidência exibe intervalo de 95%; o resultado é prioridade de estudo, não previsão garantida.
                </p>
              </div>
              <div className="grid gap-3">
                {STATISTICAL_SIGNALS.map((signal) => (
                  <article key={signal.title} className="rounded-2xl border border-white/9 bg-[#0a1420] p-5">
                    <h3 className="font-semibold text-white">{signal.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{signal.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="lexml-title" className="grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-center">
            <div className="rounded-[1.7rem] border border-blue-300/16 bg-blue-300/[0.045] p-6 sm:p-8">
              <div className="flex items-center gap-3 text-blue-300">
                <Bot aria-hidden="true" className="size-6" />
                <span className="text-xs font-extrabold uppercase tracking-[0.16em]">LexML no motor</span>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                Os serviços e dados abertos da LexML podem ajudar a localizar registros, identificadores e relações entre atos. Essa integração funciona como apoio à descoberta e ao versionamento; a publicação jurídica continua vinculada à fonte oficial competente e à revisão humana.
              </p>
              <a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200" href="https://projeto.lexml.gov.br/open-data" rel="noreferrer">
                Conhecer os dados abertos da LexML
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            </div>
            <div>
              <h2 id="lexml-title" className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                O que a API jurídica não decide
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-400">
                <li className="flex gap-3"><span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-amber-300" />Ela não confirma, sozinha, que um concurso está aberto ou que uma organizadora foi contratada.</li>
                <li className="flex gap-3"><span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-amber-300" />Ela não transforma provas e questões disponíveis na internet em conteúdo licenciado para exploração comercial.</li>
                <li className="flex gap-3"><span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-amber-300" />Ela não substitui diário oficial, texto consolidado do ente competente nem conferência de vigência.</li>
              </ul>
            </div>
          </section>

          <section aria-labelledby="publicacao-title" className="rounded-[2rem] border border-white/9 bg-[#08111d] p-6 sm:p-10">
            <BookOpenCheck aria-hidden="true" className="size-7 text-emerald-300" />
            <h2 id="publicacao-title" className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-white">
              O que fica público — e quando
            </h2>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.045] p-5">
                <h3 className="font-semibold text-emerald-200">Pode ser publicado</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Página com fonte oficial aprovada, edição identificada, responsável corretamente classificado, situação conferida, conteúdo visível coerente com o schema e revisão humana registrada.
                </p>
              </article>
              <article className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.035] p-5">
                <h3 className="font-semibold text-rose-200">Continua privado</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Pista de agregador, edital sem validação, banca herdada de ano anterior, estimativa sem amostra, questão sem direito de uso ou texto jurídico sem revisão independente.
                </p>
              </article>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-12 items-center rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-200" href="/concursos">
                Ver categorias acompanhadas
              </Link>
              <Link className="inline-flex min-h-12 items-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:text-white" href="/fontes-e-atualizacao">
                Ver fontes e atualização
              </Link>
            </div>
          </section>
        </div>
      </article>
    </PublicGuideShell>
  );
}
