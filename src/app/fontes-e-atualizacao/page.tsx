import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileClock,
  Fingerprint,
  RefreshCcw,
  Scale,
  ShieldCheck,
} from "lucide-react";

import {
  GuideBreadcrumbs,
  GuideCta,
  PublicGuideShell,
} from "@/components/content/public-guide-shell";
import { JsonLd } from "@/components/seo/json-ld";
import {
  CONSTITUTION_OFFICIAL_URL,
  DEMO_CONTENT_PROVENANCE,
  DEMO_QUESTIONS,
} from "@/lib/demo-content";
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  absoluteUrl,
} from "@/lib/seo";

const PAGE_PATH = "/fontes-e-atualizacao";
const PAGE_TITLE = "Fontes, questões e atualização da Editalume";
const PAGE_DESCRIPTION =
  "Veja de onde vêm as leis e questões da Editalume, o que existe hoje no acervo e as regras de versionamento, revisão e licenciamento para manter o conteúdo confiável.";
const PENAL_CODE_OFFICIAL_URL =
  "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "article",
    url: PAGE_PATH,
    title: `${PAGE_TITLE} | Editalume`,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/assets/leiprova-ecosystem.png",
        width: 1586,
        height: 992,
        alt: "Ecossistema de estudo Editalume",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | Editalume`,
    description: PAGE_DESCRIPTION,
    images: ["/assets/leiprova-ecosystem.png"],
  },
};

const verifiedDate = DEMO_QUESTIONS[0]?.verifiedAt ?? "2026-08-16";
const articleNumbers = [
  ...new Set(
    DEMO_QUESTIONS.map((question) => question.articleRef.match(/^Art\. ([^,§]+)/)?.[1]).filter(
      (article): article is string => Boolean(article),
    ),
  ),
];
const articleSummary = new Intl.ListFormat("pt-BR").format(articleNumbers);

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
        { "@type": "Thing", name: "Fontes oficiais de legislação brasileira" },
        { "@type": "Thing", name: "Atualização legislativa" },
        { "@type": "Thing", name: "Questões para concursos públicos" },
      ],
      citation: [
        CONSTITUTION_OFFICIAL_URL,
        PENAL_CODE_OFFICIAL_URL,
        "https://www.planalto.gov.br/ccivil_03/leis/l9610.htm",
        "https://inlabs.in.gov.br/",
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${absoluteUrl(PAGE_PATH)}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl() },
        { "@type": "ListItem", position: 2, name: PAGE_TITLE, item: absoluteUrl(PAGE_PATH) },
      ],
    },
  ],
};

const UPDATE_STEPS = [
  {
    icon: FileClock,
    title: "1. Detectar",
    text: "Consultar a fonte oficial e registrar quando o conteúdo foi verificado. Uma mudança gera uma nova versão; não sobrescreve silenciosamente o histórico.",
  },
  {
    icon: Fingerprint,
    title: "2. Comparar",
    text: "Calcular a impressão digital do documento oficial e comparar a fotografia nova com a referência aprovada. O sistema não altera artigos, alternativas ou explicações automaticamente.",
  },
  {
    icon: ShieldCheck,
    title: "3. Suspender",
    text: "Se a vigência estiver em dúvida, o item deve sair do treino até a conferência. Disponibilidade não tem prioridade sobre correção.",
  },
  {
    icon: BadgeCheck,
    title: "4. Revisar e publicar",
    text: "Uma pessoa revisora valida texto, vigência, gabarito e explicação. Só então o registro recebe a identificação dessa revisão humana e pode integrar a oferta comercial.",
  },
] as const;

export default function SourcesAndUpdatesPage() {
  return (
    <PublicGuideShell>
      <JsonLd data={structuredData} />
      <article>
        <header className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_85%_0%,rgba(105,167,255,.14),transparent_36%),radial-gradient(circle_at_5%_20%,rgba(251,191,36,.11),transparent_32%),#07101b]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <GuideBreadcrumbs current="Fontes e atualização" />
            <div className="mt-9 max-w-5xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                Transparência editorial
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
                De onde vêm as leis e as questões da Editalume?
              </h1>
              <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-300">
                No acervo persistido do quiz, a lei utilizada hoje é a Constituição consolidada no Portal da Legislação da Presidência da República. O monitor acompanha dez fontes federais oficiais e encaminha qualquer nova fotografia à revisão humana. As {DEMO_QUESTIONS.length} questões do beta são originais e assistidas por {DEMO_CONTENT_PROVENANCE.generatorModel}; ainda não existe revisão humana independente registrada. Não há questões anteriores licenciadas nem questões inéditas no estilo de banca publicadas.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs font-bold">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/8 px-4 py-2 text-emerald-200">1 norma no acervo persistido</span>
                <span className="rounded-full border border-blue-300/20 bg-blue-300/8 px-4 py-2 text-blue-200">10 fontes federais monitoradas</span>
                <span className="rounded-full border border-amber-300/20 bg-amber-300/8 px-4 py-2 text-amber-200">{DEMO_QUESTIONS.length} questões assistidas por IA</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-300">0 questões anteriores licenciadas</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-300">0 questões estilo banca publicadas</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:py-20">
          <section aria-labelledby="inventario-title" className="grid gap-8 lg:grid-cols-[1fr_.85fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">Inventário atual</p>
              <h2 id="inventario-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Acervo persistido e microdemonstrações
              </h2>
              <div className="mt-6 space-y-5 text-sm leading-7 text-slate-400">
                <p>
                  O primeiro recorte é Direito Constitucional: arts. {articleSummary} da Constituição Federal. Cada questão guarda a URL oficial, a data de verificação, a alternativa literal, o tipo de alteração usado nos distratores e a explicação.
                </p>
                <p>
                  A versão atual foi verificada em <strong className="font-semibold text-slate-200">16 de agosto de 2026</strong>. Essa data não significa que a Editalume substitui o Diário Oficial nem garante que nenhuma mudança tenha ocorrido depois dela; é o marco editorial que permite ao usuário avaliar a atualidade do item.
                </p>
                <p>
                  Separadamente, o laboratório ilustrativo da página inicial contém três microexemplos não persistidos no quiz: Constituição, art. 5º, LIV; Constituição, art. 37, caput; e Código Penal, art. 1º. Esses trechos foram novamente conferidos nas páginas oficiais em 17 de agosto de 2026.
                </p>
              </div>
              <a className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href={CONSTITUTION_OFFICIAL_URL} rel="noreferrer">
                Abrir o texto constitucional utilizado
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            </div>

            <div className="rounded-[1.7rem] border border-white/9 bg-[#0a1420] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-300">
                  <FileCheck2 aria-hidden="true" className="size-6" />
                </span>
                <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">Beta · revisão humana pendente</span>
              </div>
              <dl className="mt-7 space-y-5 text-sm">
                <div className="border-b border-white/8 pb-4">
                  <dt className="text-slate-500">Norma</dt>
                  <dd className="mt-1 font-semibold text-white">Constituição da República Federativa do Brasil de 1988</dd>
                </div>
                <div className="border-b border-white/8 pb-4">
                  <dt className="text-slate-500">Origem</dt>
                  <dd className="mt-1 font-semibold text-white">Portal da Legislação — Presidência da República</dd>
                </div>
                <div className="border-b border-white/8 pb-4">
                  <dt className="text-slate-500">Conferência técnica da fonte</dt>
                  <dd className="mt-1 font-semibold text-white">{verifiedDate.split("-").reverse().join("/")}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Produção das questões</dt>
                  <dd className="mt-1 font-semibold text-white">Original, assistida por IA e baseada no texto oficial</dd>
                </div>
              </dl>
            </div>
          </section>

          <aside className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.045] p-5 text-sm leading-7 text-amber-100/80">
            <strong className="text-amber-200">Pendência editorial declarada:</strong> as 12 questões do beta não possuem revisor humano independente registrado. Elas não devem ser apresentadas como conteúdo humano revisado nem usadas para abrir a oferta comercial antes dessa etapa.
          </aside>

          <section aria-labelledby="hierarquia-title">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">Hierarquia de fontes</p>
            <h2 id="hierarquia-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
              A fonte muda conforme a jurisdição
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
              Para cada norma, registramos a página oficial específica e a data de acesso. Agregadores e mecanismos de busca podem ajudar a localizar um ato, mas não substituem a conferência no órgão competente.
            </p>
            <div className="mt-9 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Normas federais consolidadas",
                  text: "Portal da Legislação da Presidência da República, com URL direta do ato e conferência da redação indicada como compilada.",
                  href: "https://www.planalto.gov.br/ccivil_03/leis/_lei-principal.htm",
                  label: "Portal da Legislação",
                },
                {
                  title: "Publicação e alterações federais",
                  text: "Diário Oficial da União e dados abertos da Imprensa Nacional para confirmar publicação, data e ato modificador.",
                  href: "https://inlabs.in.gov.br/",
                  label: "INLABS — Imprensa Nacional",
                },
                {
                  title: "Normas estaduais e locais",
                  text: "Assembleia Legislativa, governo e diário oficial do ente responsável. A Editalume não reutiliza automaticamente uma URL federal para outro ente.",
                  href: null,
                  label: null,
                },
                {
                  title: "Processo legislativo e conferência",
                  text: "Portais oficiais da Câmara e do Senado funcionam como apoio para tramitação, histórico e atos relacionados; a vigência é conferida na publicação oficial.",
                  href: "https://www2.camara.leg.br/atividade-legislativa/legislacao",
                  label: "Legislação — Câmara dos Deputados",
                },
                {
                  title: "Editais e conteúdo programático",
                  text: "O portal oficial do órgão ou da organizadora é validado antes da captura. Somente editais e anexos oficiais podem ser armazenados; cada versão recebe checksum e uma decisão humana auditável, preferencialmente por revisor independente. Exceções do proprietário ficam identificadas. Provas, cadernos e gabaritos permanecem bloqueados.",
                  href: null,
                  label: null,
                },
              ].map((source) => (
                <article key={source.title} className="rounded-[1.5rem] border border-white/9 bg-[#0a1420] p-6">
                  <BookOpenCheck aria-hidden="true" className="size-5 text-amber-300" />
                  <h3 className="mt-4 text-lg font-semibold text-white">{source.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{source.text}</p>
                  {source.href && (
                    <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200" href={source.href} rel="noreferrer">
                      {source.label}
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="atualizacao-title" className="rounded-[2rem] border border-white/9 bg-[#08111d] p-6 sm:p-10">
            <div className="max-w-4xl">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">
                <RefreshCcw aria-hidden="true" className="size-4" />
                Atualização contínua com trava humana
              </p>
              <h2 id="atualizacao-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Como uma mudança legislativa deve chegar ao aplicativo
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                O monitor periódico consulta as dez páginas federais registradas, normaliza o texto e compara sua impressão digital com o histórico. Uma mudança cria uma fotografia pendente; não modifica o acervo nem um gabarito. A sequência abaixo mantém o alerta automático e a decisão editorial separada.
              </p>
            </div>
            <ol className="mt-9 grid gap-4 md:grid-cols-2">
              {UPDATE_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <Icon aria-hidden="true" className="size-5 text-emerald-300" />
                    <h3 className="mt-4 font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="questoes-title">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">Proveniência das questões</p>
            <h2 id="questoes-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
              Três tipos de conteúdo, três regras diferentes
            </h2>
            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              <article className="rounded-[1.5rem] border border-emerald-300/18 bg-emerald-300/[0.045] p-6">
                <CheckCircle2 aria-hidden="true" className="size-6 text-emerald-300" />
                <h3 className="mt-5 text-xl font-semibold text-white">Questões originais de lei seca assistidas por IA</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  A alternativa correta reproduz o trecho oficial; os distratores recebem alterações controladas de palavra, prazo, condição, órgão ou alcance. Há 12 itens desse tipo no beta, ainda pendentes de revisão humana independente.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-white/9 bg-[#0a1420] p-6">
                <Scale aria-hidden="true" className="size-6 text-amber-300" />
                <h3 className="mt-5 text-xl font-semibold text-white">Questões anteriores</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Hoje há zero. Só entrarão com autorização ou licença documentada, titular identificado, URL de origem, edição, número original e validade do direito de uso. Estar disponível para download não equivale a licença comercial.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-white/9 bg-[#0a1420] p-6">
                <Bot aria-hidden="true" className="size-6 text-blue-300" />
                <h3 className="mt-5 text-xl font-semibold text-white">Questões inéditas no estilo da banca</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Hoje há zero publicados. A fábrica autoral já registra modelo e versão do processo, compara o enunciado com o acervo interno e exige revisão humana confirmada. A IA pode apoiar um rascunho; não publica diretamente.
                </p>
              </article>
            </div>
          </section>

          <section aria-labelledby="direitos-title" className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div className="rounded-[1.6rem] border border-amber-300/18 bg-amber-300/[0.04] p-6">
              <AlertTriangle aria-hidden="true" className="size-6 text-amber-300" />
              <h2 id="direitos-title" className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-white">Público não significa domínio público</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Uma banca publicar caderno e gabarito prova que o arquivo pode ser acessado. Isso, sozinho, não concede autorização para copiar, adaptar, vender ou inserir o material integralmente em uma base comercial.
              </p>
            </div>
            <div className="space-y-5 text-sm leading-7 text-slate-400">
              <p>
                A Lei nº 9.610/1998 exclui textos de leis, decretos, regulamentos, decisões judiciais e demais atos oficiais da proteção autoral prevista nessa lei. A mesma norma reserva ao autor os direitos de utilização, reprodução, adaptação, distribuição e inclusão em base de dados de obras protegidas. Por isso, tratamos texto normativo e caderno de prova como categorias distintas.
              </p>
              <p>
                O Portal da Legislação também possui política própria de reutilização. A fonte, a URL e a data de acesso devem acompanhar o conteúdo. Os trechos exibidos na Editalume são meramente informativos e não oficiais e não substituem a publicação no Diário Oficial da União.
              </p>
              <div className="flex flex-wrap gap-4">
                <a className="inline-flex items-center gap-2 font-semibold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="https://www.planalto.gov.br/ccivil_03/leis/l9610.htm" rel="noreferrer">
                  Lei de Direitos Autorais
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
                <a className="inline-flex items-center gap-2 font-semibold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200" href="https://www.planalto.gov.br/ccivil_03/portaria/p130-21-ccivil.htm" rel="noreferrer">
                  Portaria PR nº 130/2021
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              </div>
            </div>
          </section>

          <section aria-labelledby="compromissos-title">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">Padrão antes do lançamento</p>
            <h2 id="compromissos-title" className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white">
              O que todo item deverá permitir conferir
            </h2>
            <ul className="mt-8 grid gap-3 md:grid-cols-2">
              {[
                "Norma, artigo e URL oficial usados no item.",
                "Data da última verificação editorial.",
                "Origem própria ou licenciada da questão.",
                "Correção e explicação depois da resposta.",
                "Sinalização ou suspensão quando houver dúvida de vigência.",
                "Canal para reportar inconsistência de conteúdo — ainda em configuração.",
              ].map((commitment) => (
                <li key={commitment} className="flex gap-3 rounded-2xl border border-white/8 bg-[#0a1420] p-4 text-sm leading-6 text-slate-300">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                  {commitment}
                </li>
              ))}
            </ul>
          </section>

          <GuideCta
            title="Confira a fonte dentro de uma questão real"
            description="A demonstração pública usa cinco itens assistidos por IA do beta constitucional. Você responde, recebe a explicação e pode abrir a página oficial utilizada na conferência; a revisão humana independente continua pendente."
          />
        </div>
      </article>
    </PublicGuideShell>
  );
}
